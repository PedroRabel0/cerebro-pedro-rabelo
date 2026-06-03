"use server";


import { log } from '@/lib/logger';
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClient, logCost } from "@/lib/ai/client";
import { scrapeInstagramProfile } from "@/lib/ai/apify";
import type { ContentMetric } from "@/lib/supabase/types";

const PATH = "/analytics";

// Default handle — can be changed in the future
const PEDRO_INSTAGRAM_HANDLE = "pedro.bagy";

export async function getMetrics(): Promise<ContentMetric[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_metrics")
    .select("*")
    .order("posted_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createMetric(data: {
  title: string;
  platform: string;
  content_type: string;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
  views: number;
  posted_at: string;
}) {
  const supabase = await createClient();

  const engagementRate =
    data.views > 0
      ? ((data.likes + data.saves + data.shares + data.comments) / data.views) *
        100
      : 0;

  const { error } = await supabase.from("content_metrics").insert({
    title: data.title,
    platform: data.platform,
    content_type: data.content_type,
    likes: data.likes,
    saves: data.saves,
    shares: data.shares,
    comments: data.comments,
    views: data.views,
    engagement_rate: parseFloat(engagementRate.toFixed(2)),
    posted_at: data.posted_at,
  });

  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteMetric(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_metrics")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// ===========================================
// AUTO-IMPORT: Scrape Pedro's own Instagram
// ===========================================

export interface ImportResult {
  posts_found: number;
  posts_imported: number;
  posts_skipped: number;
  handle: string;
  error?: string;
}

export async function importInstagramMetrics(): Promise<ImportResult> {
  const handle = PEDRO_INSTAGRAM_HANDLE;

  try {
    const supabase = await createClient();

    // 1. Scrape Pedro's latest 20 posts
    log.info(`[Analytics Import] Scraping @${handle}...`);
    const scraped = await scrapeInstagramProfile(handle, 20);

    if ("error" in scraped) {
      return {
        posts_found: 0,
        posts_imported: 0,
        posts_skipped: 0,
        handle,
        error: scraped.error,
      };
    }

    // 2. Get existing metrics to avoid duplicates (match by caption first 80 chars + platform)
    const { data: existing } = await supabase
      .from("content_metrics")
      .select("title, posted_at")
      .eq("platform", "instagram");

    const existingTitles = new Set(
      (existing || []).map((m) => m.title?.slice(0, 80)?.toLowerCase())
    );

    // 3. Import new posts
    let imported = 0;
    let skipped = 0;

    for (const post of scraped) {
      // Build title from caption (first line or first 80 chars)
      const caption = post.caption || "";
      const firstLine = caption.split("\n")[0]?.trim() || "";
      const title = firstLine.length > 80
        ? firstLine.slice(0, 77) + "..."
        : firstLine || `Post ${post.posted_at ? new Date(post.posted_at).toLocaleDateString("pt-BR") : "sem data"}`;

      // Check for duplicates
      if (existingTitles.has(title.slice(0, 80).toLowerCase())) {
        skipped++;
        continue;
      }

      const likes = post.likes || 0;
      const comments = post.comments || 0;
      // Instagram scraper doesn't provide views/saves/shares directly
      // Estimate engagement from likes + comments
      const engagementRate = post.engagement_rate || 0;

      const contentType = post.is_video ? "reel" : "post";

      const { error: insertError } = await supabase.from("content_metrics").insert({
        title,
        platform: "instagram",
        content_type: contentType,
        likes,
        saves: 0, // Not available from scraping
        shares: 0, // Not available from scraping
        comments,
        views: 0, // Not available from scraping
        engagement_rate: parseFloat(engagementRate.toFixed(2)),
        posted_at: post.posted_at || new Date().toISOString(),
        notes: caption.length > 80 ? caption.slice(0, 500) : null,
      });

      if (!insertError) {
        imported++;
        existingTitles.add(title.slice(0, 80).toLowerCase());
      }
    }

    // 4. Log activity
    await supabase.from("activity_log").insert({
      actor: "ia",
      action: `Auto-import: ${imported} métricas importadas de @${handle} (${skipped} já existiam)`,
      entity_type: "content_metric",
      entity_title: `Import @${handle}`,
    });

    log.info(`[Analytics Import] @${handle}: ${imported} imported, ${skipped} skipped of ${scraped.length} total`);

    revalidatePath(PATH);

    return {
      posts_found: scraped.length,
      posts_imported: imported,
      posts_skipped: skipped,
      handle,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[Analytics Import] Error:" + " " + String(message));
    return {
      posts_found: 0,
      posts_imported: 0,
      posts_skipped: 0,
      handle,
      error: message,
    };
  }
}

export async function getInstagramHandle(): Promise<string> {
  return PEDRO_INSTAGRAM_HANDLE;
}

export async function getAnalyticsInsights(): Promise<string> {
  const supabase = await createClient();

  // Fetch all metrics
  const { data: metrics, error: metricsError } = await supabase
    .from("content_metrics")
    .select("*")
    .order("posted_at", { ascending: false });

  if (metricsError) throw metricsError;

  if (!metrics || metrics.length === 0) {
    return "Nenhuma metrica registrada ainda. Adicione dados de performance dos seus conteudos para gerar insights.";
  }

  // Fetch identity for context
  const { data: identity } = await supabase
    .from("identity")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const identityContext = identity
    ? `\nContexto do criador: posicionamento "${identity.positioning || "nao definido"}", tom "${identity.tone_descriptors || "nao definido"}", referências: ${identity.reference_creators || "nao definidas"}.`
    : "";

  const metricsJson = JSON.stringify(
    metrics.map((m) => ({
      title: m.title,
      platform: m.platform,
      content_type: m.content_type,
      likes: m.likes,
      saves: m.saves,
      shares: m.shares,
      comments: m.comments,
      views: m.views,
      engagement_rate: m.engagement_rate,
      posted_at: m.posted_at,
    })),
    null,
    2
  );

  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Voce e um analista de performance de conteudo digital. Analise os dados de metricas abaixo e gere insights acionaveis em portugues.
${identityContext}

Dados de metricas (${metrics.length} posts):
${metricsJson}

Gere uma analise completa com:
1. **Resumo geral** — como esta a performance no geral
2. **Melhor plataforma** — qual plataforma tem melhor engajamento e por que
3. **Tipo de conteudo que mais performa** — qual formato gera mais saves, shares, engagement
4. **Padroes de horario** — se ha correlacao entre horario de postagem e performance
5. **Top 3 posts** — quais foram os melhores posts e o que eles tem em comum
6. **Insights acionaveis** — 3-5 recomendacoes praticas (ex: "posts com hook X performam Y% melhor", "melhor horario para postar", "tipo de conteudo com mais saves")

Seja direto, use numeros concretos, e foque em insights que o criador pode usar imediatamente.`,
      },
    ],
  });

  logCost(
    "claude-sonnet-4-6",
    response.usage.input_tokens,
    response.usage.output_tokens
  );

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "Nao foi possivel gerar insights.";
}
