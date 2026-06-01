export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

import { createClient } from "@/lib/supabase/server";
import { searchNews } from "@/lib/ai/gnews";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";

/**
 * Cron diario: busca noticias para todos os temas ativos,
 * salva artigos novos (dedup por URL), e gera digest para
 * temas com artigos novos.
 *
 * Trigger: Vercel Cron ou scheduler externo com CRON_SECRET.
 */
export async function GET(request: Request) {
  // Auth
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    const vercelCron = request.headers.get("x-vercel-cron");
    if (!vercelCron) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = await createClient();
  const startTime = Date.now();

  // 1. Buscar temas ativos
  const { data: themes } = await supabase
    .from("news_themes")
    .select("*")
    .eq("active", true);

  if (!themes || themes.length === 0) {
    return Response.json({ message: "Nenhum tema ativo", themes_processed: 0 });
  }

  // 2. Buscar noticias para cada tema
  const results: Array<{
    theme: string;
    theme_id: string;
    new_articles: number;
    error?: string;
  }> = [];

  let totalNewArticles = 0;

  for (const theme of themes) {
    const keywords: string[] = theme.keywords || [];
    if (keywords.length === 0) {
      results.push({
        theme: theme.name,
        theme_id: theme.id,
        new_articles: 0,
        error: "Sem palavras-chave",
      });
      continue;
    }

    const query = keywords.join(" OR ");
    const searchResult = await searchNews(query, 10);

    if ("error" in searchResult) {
      results.push({
        theme: theme.name,
        theme_id: theme.id,
        new_articles: 0,
        error: searchResult.error,
      });
      continue;
    }

    // Dedup por URL
    const { data: existing } = await supabase
      .from("news_articles")
      .select("url")
      .eq("theme_id", theme.id);

    const existingUrls = new Set((existing || []).map((a) => a.url));

    let newCount = 0;
    for (const article of searchResult) {
      if (existingUrls.has(article.url)) continue;

      const { error: insertError } = await supabase
        .from("news_articles")
        .insert({
          theme_id: theme.id,
          title: article.title,
          description: article.description,
          url: article.url,
          source_name: article.source_name,
          image_url: article.image_url,
          published_at: article.published_at,
        });

      if (!insertError) newCount++;
    }

    totalNewArticles += newCount;
    results.push({
      theme: theme.name,
      theme_id: theme.id,
      new_articles: newCount,
    });
  }

  // 3. Gerar digest para temas com artigos novos
  const themesWithNewArticles = results.filter((r) => r.new_articles > 0);
  const digestResults: Array<{ theme: string; success: boolean; error?: string }> = [];

  for (const result of themesWithNewArticles) {
    try {
      // Buscar artigos dos ultimos 7 dias
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: articles } = await supabase
        .from("news_articles")
        .select("*")
        .eq("theme_id", result.theme_id)
        .gte("published_at", sevenDaysAgo.toISOString())
        .order("published_at", { ascending: false })
        .limit(20);

      if (!articles || articles.length < 3) {
        digestResults.push({
          theme: result.theme,
          success: false,
          error: "Poucos artigos para digest",
        });
        continue;
      }

      // Buscar contexto do Pedro
      const { data: identity } = await supabase
        .from("identity")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      const pedroCtx = identity
        ? `Tom: ${identity.tone_descriptors}, Posicionamento: ${identity.positioning}`
        : "Criador de conteudo sobre marketing e empreendedorismo.";

      const articlesCtx = articles
        .map(
          (a, i) =>
            `${i + 1}. "${a.title}" (${a.source_name})\n   ${a.description || "Sem descricao"}`
        )
        .join("\n\n");

      const anthropic = getClient();
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: `Gere um digest diario sobre "${result.theme}" para Pedro Rabelo.
Identidade: ${pedroCtx}

Artigos:
${articlesCtx}

JSON:
{
  "digest_markdown": "Digest em markdown com resumo das noticias + angulos do Pedro",
  "pedro_angles": { "titulo_noticia": "comentario do Pedro" }
}
Em pt-BR. Tom direto e pratico.`,
          },
        ],
      });

      logCost(
        "claude-sonnet-4-6",
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const parsed = parseJSON<{
          digest_markdown: string;
          pedro_angles: Record<string, string>;
        }>(textBlock.text);

        if (parsed?.digest_markdown) {
          const now = new Date();
          const period = `${new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")} a ${now.toLocaleDateString("pt-BR")}`;

          await supabase.from("news_digests").insert({
            theme_id: result.theme_id,
            theme_name: result.theme,
            period,
            digest_markdown: parsed.digest_markdown,
            pedro_angles: parsed.pedro_angles || null,
            articles_count: articles.length,
          });

          digestResults.push({ theme: result.theme, success: true });
        } else {
          digestResults.push({
            theme: result.theme,
            success: false,
            error: "Falha ao parsear resposta IA",
          });
        }
      }
    } catch (err) {
      digestResults.push({
        theme: result.theme,
        success: false,
        error: err instanceof Error ? err.message : "Erro",
      });
    }
  }

  // 4. Log atividade
  await supabase.from("activity_log").insert({
    actor: "ia",
    action: `[Cron Noticias] ${themes.length} temas processados, ${totalNewArticles} novos artigos, ${digestResults.filter((d) => d.success).length} digests gerados`,
    entity_type: "news_cron",
    entity_title: "Cron diario de noticias",
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return Response.json({
    message: `Cron noticias concluido em ${elapsed}s`,
    themes_processed: themes.length,
    total_new_articles: totalNewArticles,
    fetch_results: results,
    digest_results: digestResults,
  });
}
