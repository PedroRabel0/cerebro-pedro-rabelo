"use server";

import { createClient } from "@/lib/supabase/server";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { searchNews } from "@/lib/ai/gnews";
import { revalidatePath } from "next/cache";

const PATH = "/noticias";

// ============================================================
// TYPES
// ============================================================

export interface NewsTheme {
  id: string;
  name: string;
  keywords: string[];
  active: boolean;
  created_at: string;
}

export interface NewsArticle {
  id: string;
  theme_id: string;
  title: string;
  description: string;
  url: string;
  source_name: string;
  image_url: string | null;
  published_at: string;
  pedro_angle: string | null;
  created_at: string;
}

export interface NewsDigest {
  id: string;
  theme_id: string;
  theme_name: string;
  period: string;
  digest_markdown: string;
  pedro_angles: Record<string, string> | null;
  articles_count: number;
  created_at: string;
}

// ============================================================
// THEME CRUD
// ============================================================

export async function getThemes(): Promise<NewsTheme[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_themes")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data || []) as NewsTheme[];
}

export async function createTheme(
  name: string,
  keywords: string[]
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_themes")
    .insert({ name, keywords, active: true })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { id: data.id };
}

export async function toggleTheme(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("news_themes")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteTheme(id: string) {
  const supabase = await createClient();
  // Deletar artigos associados primeiro
  await supabase.from("news_articles").delete().eq("theme_id", id);
  await supabase.from("news_digests").delete().eq("theme_id", id);
  const { error } = await supabase.from("news_themes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// ============================================================
// ARTICLES
// ============================================================

export async function getArticlesByTheme(
  themeId?: string,
  limit = 20
): Promise<NewsArticle[]> {
  const supabase = await createClient();
  let query = supabase
    .from("news_articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (themeId) {
    query = query.eq("theme_id", themeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as NewsArticle[];
}

// ============================================================
// DIGESTS
// ============================================================

export async function getDigests(limit = 10): Promise<NewsDigest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_digests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as NewsDigest[];
}

// ============================================================
// FETCH NEWS (GNews API)
// ============================================================

export async function fetchNewsForTheme(
  themeId: string
): Promise<{ count: number } | { error: string }> {
  const supabase = await createClient();

  // Buscar tema
  const { data: theme, error: themeError } = await supabase
    .from("news_themes")
    .select("*")
    .eq("id", themeId)
    .single();

  if (themeError || !theme) return { error: "Tema nao encontrado." };

  const keywords: string[] = theme.keywords || [];
  if (keywords.length === 0) return { error: "Tema sem palavras-chave." };

  // Buscar via GNews usando keywords combinadas
  const query = keywords.join(" OR ");
  const result = await searchNews(query, 10);

  if ("error" in result) return { error: result.error };

  // Buscar URLs existentes para dedup
  const { data: existing } = await supabase
    .from("news_articles")
    .select("url")
    .eq("theme_id", themeId);

  const existingUrls = new Set((existing || []).map((a) => a.url));

  let newCount = 0;
  for (const article of result) {
    if (existingUrls.has(article.url)) continue;

    const { error: insertError } = await supabase.from("news_articles").insert({
      theme_id: themeId,
      title: article.title,
      description: article.description,
      url: article.url,
      source_name: article.source_name,
      image_url: article.image_url,
      published_at: article.published_at,
    });

    if (!insertError) newCount++;
  }

  revalidatePath(PATH);
  return { count: newCount };
}

export async function fetchAllNews(): Promise<{
  summary: string;
  total: number;
  details: { theme: string; count: number; error?: string }[];
}> {
  const supabase = await createClient();

  const { data: themes } = await supabase
    .from("news_themes")
    .select("*")
    .eq("active", true);

  if (!themes || themes.length === 0) {
    return {
      summary: "Nenhum tema ativo encontrado.",
      total: 0,
      details: [],
    };
  }

  const details: { theme: string; count: number; error?: string }[] = [];
  let total = 0;

  for (const theme of themes) {
    const result = await fetchNewsForTheme(theme.id);
    if ("error" in result) {
      details.push({ theme: theme.name, count: 0, error: result.error });
    } else {
      details.push({ theme: theme.name, count: result.count });
      total += result.count;
    }
  }

  // Log atividade
  await supabase.from("activity_log").insert({
    actor: "ia",
    action: `[Noticias] Busca completa: ${total} novos artigos de ${themes.length} temas`,
    entity_type: "news_fetch",
    entity_title: "Busca de noticias",
  });

  revalidatePath(PATH);

  return {
    summary: `${total} novos artigos importados de ${themes.length} temas.`,
    total,
    details,
  };
}

// ============================================================
// GENERATE DIGEST (AI)
// ============================================================

export async function generateDigest(
  themeId: string
): Promise<{ digest: NewsDigest } | { error: string }> {
  const supabase = await createClient();
  const anthropic = getClient();

  // Buscar tema
  const { data: theme, error: themeError } = await supabase
    .from("news_themes")
    .select("*")
    .eq("id", themeId)
    .single();

  if (themeError || !theme) return { error: "Tema nao encontrado." };

  // Buscar artigos dos ultimos 7 dias
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { data: articles } = await supabase
    .from("news_articles")
    .select("*")
    .eq("theme_id", themeId)
    .gte("published_at", sevenDaysAgo.toISOString())
    .order("published_at", { ascending: false });

  if (!articles || articles.length === 0) {
    return { error: "Nenhum artigo encontrado nos ultimos 7 dias para este tema." };
  }

  // Buscar identidade e playbooks do Pedro
  const [identityRes, playbooksRes] = await Promise.all([
    supabase.from("identity").select("*").limit(1).single(),
    supabase.from("playbooks").select("title, body_markdown").limit(10),
  ]);

  const identity = identityRes.data;
  const tone = identity?.tone_descriptors || "Direto, pratico, provocativo";
  const voiceUses = (identity?.voice_uses || []).join(", ") || "Frameworks praticos, experiencia real";
  const voiceAvoids = (identity?.voice_avoids || []).join(", ") || "Jargao corporativo, teoria vazia";
  const positioning = identity?.positioning || "Especialista pratico";

  const playbooks = playbooksRes.data || [];
  const playbookContext =
    playbooks.length > 0
      ? `\nPLAYBOOKS DO PEDRO:\n${playbooks.map((p) => `- ${p.title}`).join("\n")}`
      : "";

  const articlesContext = articles
    .slice(0, 20)
    .map(
      (a, i) =>
        `${i + 1}. "${a.title}" (${a.source_name}, ${new Date(a.published_at).toLocaleDateString("pt-BR")})\n   ${a.description || "Sem descricao"}`
    )
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Voce e o assistente estrategico do Pedro Rabelo, criador de conteudo sobre negocios e empreendedorismo.

IDENTIDADE DO PEDRO:
Tom: ${tone} | Posicionamento: ${positioning}
Usa: ${voiceUses} | Evita: ${voiceAvoids}
${playbookContext}

TEMA: ${theme.name}
PALAVRAS-CHAVE: ${(theme.keywords || []).join(", ")}

ARTIGOS DA ULTIMA SEMANA:
${articlesContext}

TAREFA: Gere um digest semanal sobre "${theme.name}" com as seguintes secoes:

1. **Resumo das principais noticias/tendencias** — o que aconteceu de mais relevante esta semana neste tema
2. **Angulo do Pedro** — para cada noticia principal, como o Pedro comentaria isso, conectando com seus playbooks e visao
3. **3 ideias de conteudo** — sugestoes praticas de conteudo que o Pedro pode criar baseado nestas noticias

Responda em JSON:
{
  "digest_markdown": "O digest completo em markdown, bem formatado com headers e bullets",
  "pedro_angles": {
    "titulo_da_noticia_1": "O que Pedro diria sobre isso...",
    "titulo_da_noticia_2": "..."
  },
  "content_ideas": [
    { "title": "...", "format": "carrossel|reel|post|video", "hook": "..." }
  ]
}

Tudo em portugues (pt-BR). Tom direto e pratico, como o Pedro fala.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: "Resposta vazia da IA." };

    logCost("claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens);

    const parsed = parseJSON<{
      digest_markdown: string;
      pedro_angles: Record<string, string>;
      content_ideas: { title: string; format: string; hook: string }[];
    }>(textBlock.text);

    if (!parsed || !parsed.digest_markdown) return { error: "Falha ao interpretar resposta da IA." };

    // Adicionar ideias de conteudo ao final do digest
    let fullDigest = parsed.digest_markdown;
    if (parsed.content_ideas && parsed.content_ideas.length > 0) {
      fullDigest += "\n\n## Ideias de Conteudo\n\n";
      for (const idea of parsed.content_ideas) {
        fullDigest += `- **${idea.title}** (${idea.format})\n  Hook: "${idea.hook}"\n\n`;
      }
    }

    // Salvar digest
    const now = new Date();
    const period = `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")} a ${now.toLocaleDateString("pt-BR")}`;

    const { data: digest, error: insertError } = await supabase
      .from("news_digests")
      .insert({
        theme_id: themeId,
        theme_name: theme.name,
        period,
        digest_markdown: fullDigest,
        pedro_angles: parsed.pedro_angles || null,
        articles_count: articles.length,
      })
      .select("*")
      .single();

    if (insertError || !digest) {
      return { error: insertError?.message || "Erro ao salvar digest." };
    }

    // Log atividade
    await supabase.from("activity_log").insert({
      actor: "ia",
      action: `[Noticias] Digest gerado: "${theme.name}" (${articles.length} artigos)`,
      entity_type: "news_digest",
      entity_id: digest.id,
      entity_title: `Digest: ${theme.name}`,
    });

    revalidatePath(PATH);
    return { digest: digest as NewsDigest };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha ao gerar digest: ${message}` };
  }
}

// ============================================================
// GENERATE PEDRO ANGLE (single article)
// ============================================================

export async function generatePedroAngle(
  articleId: string
): Promise<{ angle: string } | { error: string }> {
  const supabase = await createClient();
  const anthropic = getClient();

  // Buscar artigo
  const { data: article, error: articleError } = await supabase
    .from("news_articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (articleError || !article) return { error: "Artigo nao encontrado." };

  // Buscar identidade e playbooks
  const [identityRes, playbooksRes] = await Promise.all([
    supabase.from("identity").select("*").limit(1).single(),
    supabase.from("playbooks").select("title, body_markdown").limit(10),
  ]);

  const identity = identityRes.data;
  const tone = identity?.tone_descriptors || "Direto, pratico, provocativo";
  const positioning = identity?.positioning || "Especialista pratico";
  const voiceUses = (identity?.voice_uses || []).join(", ") || "Frameworks praticos";

  const playbooks = playbooksRes.data || [];
  const playbookContext =
    playbooks.length > 0
      ? `\nPlaybooks: ${playbooks.map((p) => p.title).join(", ")}`
      : "";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Voce e o Pedro Rabelo, criador de conteudo sobre negocios e empreendedorismo.

IDENTIDADE: Tom: ${tone} | Posicionamento: ${positioning} | Usa: ${voiceUses}${playbookContext}

NOTICIA:
Titulo: ${article.title}
Fonte: ${article.source_name}
Descricao: ${article.description || "Sem descricao"}

TAREFA: Escreva um comentario curto (2-4 paragrafos) sobre esta noticia na voz do Pedro. Conecte com algum playbook ou framework dele se possivel. Seja direto, pratico e com opiniao. Portugues (pt-BR).

Responda APENAS com o texto do comentario, sem JSON ou formatacao extra.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: "Resposta vazia da IA." };

    logCost("claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens);

    const angle = textBlock.text.trim();

    // Salvar no artigo
    const { error: updateError } = await supabase
      .from("news_articles")
      .update({ pedro_angle: angle })
      .eq("id", articleId);

    if (updateError) return { error: updateError.message };

    revalidatePath(PATH);
    return { angle };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha ao gerar angulo: ${message}` };
  }
}
