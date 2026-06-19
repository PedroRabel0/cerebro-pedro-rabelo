"use server";


import { log } from '@/lib/logger';
import { createClient } from "@/lib/supabase/server";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { scrapeInstagramProfile } from "@/lib/ai/apify";
import { revalidatePath } from "next/cache";
import type { Trend, ReferenceProfile, ReferencePost } from "@/lib/supabase/types";

const PATH = "/tendencias";

// ============================================================
// EXISTING TREND CRUD (manual trends)
// ============================================================

export async function getTrends(): Promise<Trend[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trends")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Trend[];
}

export async function createTrend(
  title: string,
  url?: string,
  description?: string,
  sourceText?: string
) {
  const supabase = await createClient();
  const { error } = await supabase.from("trends").insert({
    title,
    url: url || null,
    description: description || null,
    source_text: sourceText || null,
    status: "pending",
  });
  if (error) throw error;
  revalidatePath(PATH);
}

export async function analyzeTrend(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const anthropic = getClient();

  const { data: trend, error: trendError } = await supabase
    .from("trends")
    .select("*")
    .eq("id", id)
    .single();
  if (trendError || !trend) return { error: "Tendencia nao encontrada." };

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
      ? `\nPLAYBOOKS DISPONIVEIS:\n${playbooks.map((p) => `- ${p.title}`).join("\n")}`
      : "";

  const trendContext = [
    `TITULO: ${trend.title}`,
    trend.url ? `URL: ${trend.url}` : null,
    trend.description ? `DESCRICAO: ${trend.description}` : null,
    trend.source_text ? `TEXTO ORIGINAL:\n${trend.source_text}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Voce e um estrategista de conteudo para o Pedro, criador de conteudo sobre negocios.

IDENTIDADE: Tom: ${tone} | Posicionamento: ${positioning}
Usa: ${voiceUses} | Evita: ${voiceAvoids}
${playbookContext}

TENDENCIA:
${trendContext}

TAREFA: Analise a tendencia e sugira 3-5 angulos para Pedro criar conteudo.

JSON:
{
  "analysis": "Analise em 2-4 paragrafos em pt-br",
  "suggested_angles": [{ "angle": "...", "why": "..." }]
}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: "Resposta vazia da IA." };

    logCost("claude-haiku-4-5-20251001", response.usage.input_tokens, response.usage.output_tokens);

    const parsed = parseJSON<{
      analysis: string;
      suggested_angles: { angle: string; why: string }[];
    }>(textBlock.text);

    if (!parsed || !parsed.analysis) return { error: "Falha ao interpretar resposta." };

    const { error: updateError } = await supabase
      .from("trends")
      .update({
        analysis: parsed.analysis,
        suggested_angles: parsed.suggested_angles,
        status: "analyzed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;
    revalidatePath(PATH);
    return { success: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha ao analisar: ${message}` };
  }
}

export async function deleteTrend(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("trends").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// ============================================================
// REFERENCE PROFILES (for Tendencias radar)
// ============================================================

export async function getActiveProfiles(): Promise<ReferenceProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reference_profiles")
    .select("*")
    .eq("active", true)
    .order("display_name");
  if (error) throw error;
  return data || [];
}

export async function getAllProfiles(): Promise<ReferenceProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reference_profiles")
    .select("*")
    .order("display_name");
  if (error) throw error;
  return data || [];
}

export async function addReferenceProfile(
  platform: string,
  handle: string,
  displayName: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const cleanHandle = handle.replace(/^@/, "").trim();

  // Check for duplicates
  const { data: existing } = await supabase
    .from("reference_profiles")
    .select("id")
    .eq("platform", platform)
    .eq("handle", cleanHandle)
    .maybeSingle();

  if (existing) return { error: `Perfil @${cleanHandle} (${platform}) ja existe.` };

  const { data: profile, error } = await supabase
    .from("reference_profiles")
    .insert({
      platform,
      handle: cleanHandle,
      display_name: displayName,
      active: true,
    })
    .select("id")
    .single();

  if (error) throw error;

  // Auto-scrape Instagram profiles (fire-and-forget)
  if (platform === "instagram" && profile) {
    scrapeAndSavePosts(profile.id, cleanHandle).catch((err) =>
      log.error("[Tendencias] Background scrape error:" + " " + String(err))
    );
  }

  revalidatePath(PATH);
  revalidatePath("/referencias");
  return { id: profile.id };
}

export async function removeReferenceProfile(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reference_profiles")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
  revalidatePath("/referencias");
}

export async function toggleProfileActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reference_profiles")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// ============================================================
// SCRAPING + ANALYSIS
// ============================================================

/**
 * Scrape and save posts for a single profile (Instagram only).
 * Deduplicates by caption first 100 chars.
 */
async function scrapeAndSavePosts(
  profileId: string,
  handle: string
): Promise<{ posts_found: number; posts_new: number }> {
  const supabase = await createClient();

  const scraped = await scrapeInstagramProfile(handle, 15);
  if ("error" in scraped) throw new Error(scraped.error);

  // Dedup
  const { data: existingPosts } = await supabase
    .from("reference_posts")
    .select("caption_text")
    .eq("profile_id", profileId);

  const existingCaptions = new Set(
    (existingPosts || []).map((p) => p.caption_text?.slice(0, 100)?.toLowerCase()).filter(Boolean)
  );

  let newCount = 0;
  for (const post of scraped) {
    if (post.caption && existingCaptions.has(post.caption.slice(0, 100).toLowerCase())) continue;

    await supabase.from("reference_posts").insert({
      profile_id: profileId,
      platform: "instagram",
      url: post.owner_username ? `https://www.instagram.com/p/` : null,
      thumbnail_url: post.thumbnail_url,
      caption_text: post.caption,
      likes: post.likes,
      comments: post.comments,
      engagement_rate: post.engagement_rate,
      posted_at: post.posted_at,
      saved_as_reference: true,
    });
    newCount++;
  }

  await supabase
    .from("reference_profiles")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", profileId);

  return { posts_found: scraped.length, posts_new: newCount };
}

// ============================================================
// RADAR SCAN — The main feature
// ============================================================

export interface ScanResult {
  profiles_scanned: number;
  total_posts_analyzed: number;
  new_posts_found: number;
  cross_profile_insights: string;
  top_themes: { theme: string; count: number; profiles: string[] }[];
  content_recommendations: {
    title: string;
    hook: string;
    format: string;
    why: string;
    inspired_by: string;
  }[];
  per_profile_summary: {
    profile_id: string;
    handle: string;
    display_name: string;
    platform: string;
    posts_count: number;
    top_themes: string[];
    avg_engagement: number;
    highlight: string;
  }[];
  error?: string;
}

/**
 * Full radar scan: scrapes all active Instagram profiles,
 * analyzes cross-profile trends, generates recommendations.
 */
export async function runRadarScan(): Promise<ScanResult> {
  const supabase = await createClient();
  const anthropic = getClient();

  // 1. Get all active profiles
  const { data: profiles } = await supabase
    .from("reference_profiles")
    .select("*")
    .eq("active", true);

  if (!profiles || profiles.length === 0) {
    return {
      profiles_scanned: 0,
      total_posts_analyzed: 0,
      new_posts_found: 0,
      cross_profile_insights: "Nenhum perfil ativo. Adicione perfis de referencia para comecar.",
      top_themes: [],
      content_recommendations: [],
      per_profile_summary: [],
    };
  }

  // 2. Scrape Instagram profiles that haven't been scraped in 24h
  let totalNewPosts = 0;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const profile of profiles) {
    if (profile.platform !== "instagram") continue;

    const lastScraped = profile.last_scraped_at ? new Date(profile.last_scraped_at) : null;
    if (lastScraped && lastScraped > twentyFourHoursAgo) continue;

    try {
      const result = await scrapeAndSavePosts(profile.id, profile.handle);
      totalNewPosts += result.posts_new;
    } catch (err) {
      log.error(`[Radar] Failed to scrape @${profile.handle}:` + " " + String(err));
    }
  }

  // 3. Fetch ALL posts from active profiles (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const profileIds = profiles.map((p) => p.id);

  const { data: allPosts } = await supabase
    .from("reference_posts")
    .select("*")
    .in("profile_id", profileIds)
    .gte("posted_at", thirtyDaysAgo.toISOString())
    .order("posted_at", { ascending: false });

  const posts = allPosts || [];

  // 4. Build per-profile summaries
  const perProfileSummary: ScanResult["per_profile_summary"] = [];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  for (const profile of profiles) {
    const profilePosts = posts.filter((p) => p.profile_id === profile.id);
    if (profilePosts.length === 0) {
      perProfileSummary.push({
        profile_id: profile.id,
        handle: profile.handle,
        display_name: profile.display_name,
        platform: profile.platform,
        posts_count: 0,
        top_themes: [],
        avg_engagement: 0,
        highlight: "Sem posts recentes",
      });
      continue;
    }

    // Top themes from DNA
    const themeCounts: Record<string, number> = {};
    for (const p of profilePosts) {
      if (p.dna_main_theme) {
        themeCounts[p.dna_main_theme] = (themeCounts[p.dna_main_theme] || 0) + 1;
      }
    }
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    // Calculate engagement: if real rate exists use it, otherwise use relative interaction score
    const maxInteractions = Math.max(
      ...profilePosts.map((p) => (p.likes || 0) + (p.comments || 0)),
      1
    );
    const avgEng = profilePosts.reduce((s, p) => {
      if (p.engagement_rate && p.engagement_rate > 0) return s + p.engagement_rate;
      const interactions = (p.likes || 0) + (p.comments || 0);
      return s + (interactions / maxInteractions) * 100;
    }, 0) / profilePosts.length;

    // Best post
    const bestPost = [...profilePosts].sort(
      (a, b) => (b.likes || 0) + (b.comments || 0) - ((a.likes || 0) + (a.comments || 0))
    )[0];

    const highlight = bestPost?.caption_text
      ? bestPost.caption_text.split("\n")[0]?.slice(0, 100) || "Post sem legenda"
      : "Post sem legenda";

    perProfileSummary.push({
      profile_id: profile.id,
      handle: profile.handle,
      display_name: profile.display_name,
      platform: profile.platform,
      posts_count: profilePosts.length,
      top_themes: topThemes,
      avg_engagement: parseFloat(avgEng.toFixed(2)),
      highlight,
    });
  }

  // 5. Aggregate themes across all profiles
  const globalThemes: Record<string, { count: number; profiles: Set<string> }> = {};
  for (const post of posts) {
    const theme = post.dna_main_theme;
    if (!theme) continue;
    if (!globalThemes[theme]) globalThemes[theme] = { count: 0, profiles: new Set() };
    globalThemes[theme].count++;
    const profile = profileMap.get(post.profile_id);
    if (profile) globalThemes[theme].profiles.add(profile.handle);
  }

  const topThemes = Object.entries(globalThemes)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([theme, data]) => ({
      theme,
      count: data.count,
      profiles: Array.from(data.profiles),
    }));

  // 6. Build context for AI cross-profile analysis
  const profileSummariesText = perProfileSummary
    .filter((p) => p.posts_count > 0)
    .map(
      (p) =>
        `@${p.handle} (${p.display_name}) — ${p.posts_count} posts, eng ${p.avg_engagement}%, temas: ${p.top_themes.join(", ") || "N/A"}\nMelhor post: "${p.highlight}"`
    )
    .join("\n\n");

  const topPostsContext = posts
    .sort((a, b) => (b.likes || 0) + (b.comments || 0) - ((a.likes || 0) + (a.comments || 0)))
    .slice(0, 15)
    .map((p) => {
      const profile = profileMap.get(p.profile_id);
      return `@${profile?.handle || "?"} | ${p.likes || 0} likes, ${p.comments || 0} comments | "${p.caption_text?.split("\n")[0]?.slice(0, 120) || "sem legenda"}"`;
    })
    .join("\n");

  const themesText = topThemes
    .map((t) => `"${t.theme}" — ${t.count} posts (${t.profiles.join(", ")})`)
    .join("\n");

  // 7. Fetch Pedro's identity for context
  const { data: identity } = await supabase
    .from("identity")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const pedroContext = identity
    ? `Tom: ${identity.tone_descriptors || "Direto"}, Posicionamento: ${identity.positioning || "Especialista pratico"}, Usa: ${(identity.voice_uses || []).join(", ")}, Evita: ${(identity.voice_avoids || []).join(", ")}`
    : "Criador de conteudo sobre marketing digital e empreendedorismo. Tom direto e pratico.";

  // 8. AI analysis
  const aiPrompt = `Voce e o radar de conteudo do Pedro Rabelo. Analise os dados dos perfis de referencia abaixo e gere insights acionaveis.

IDENTIDADE DO PEDRO: ${pedroContext}

## PERFIS MONITORADOS (ultimos 30 dias):
${profileSummariesText || "Nenhum perfil com posts recentes."}

## TOP 15 POSTS (por engajamento):
${topPostsContext || "Nenhum post encontrado."}

## TEMAS MAIS FREQUENTES:
${themesText || "Nenhum tema detectado."}

## TAREFA:
Gere um JSON com:
{
  "cross_profile_insights": "Analise em markdown (3-5 paragrafos) sobre: (1) O que os criadores de referencia estao fazendo de mais relevante, (2) Temas em alta, (3) Padroes de conteudo que estao funcionando, (4) O que o Pedro deveria prestar atencao",
  "content_recommendations": [
    {
      "title": "Titulo do conteudo sugerido",
      "hook": "Hook sugerido para o post",
      "format": "carrossel | reel | post | video",
      "why": "Por que criar este conteudo agora",
      "inspired_by": "@handle que inspirou"
    }
  ]
}

Gere de 5 a 8 recomendacoes de conteudo. Todas em pt-br. Foque em insights PRATICOS e ACIONAVEIS.`;

  let crossInsights = "Analise nao disponivel — sem posts suficientes.";
  let contentRecs: ScanResult["content_recommendations"] = [];

  if (posts.length > 0) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: aiPrompt }],
      });

      logCost("claude-haiku-4-5-20251001", response.usage.input_tokens, response.usage.output_tokens);

      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        log.info(`[Radar] AI response: ${textBlock.text.length} chars`);

        const parsed = parseJSON<{
          cross_profile_insights: string;
          content_recommendations: ScanResult["content_recommendations"];
        }>(textBlock.text);

        if (parsed) {
          crossInsights = parsed.cross_profile_insights || crossInsights;
          contentRecs = parsed.content_recommendations || [];
          log.info(`[Radar] Parsed: ${contentRecs.length} recommendations`);
        } else {
          log.error("[Radar] Failed to parse AI response. Raw: " + textBlock.text.slice(0, 300));
          crossInsights = "A IA gerou a analise mas nao foi possivel interpretar. Tente escanear novamente.";
        }
      }
    } catch (err) {
      log.error("[Radar] AI analysis error:" + " " + String(err));
      crossInsights = "Erro ao gerar analise com IA. Tente novamente.";
    }
  }

  // 9. Save scan result
  const scanData = {
    scanned_at: now.toISOString(),
    profiles_scanned: profiles.length,
    total_posts_analyzed: posts.length,
    new_posts_found: totalNewPosts,
    cross_profile_insights: crossInsights,
    top_themes: topThemes,
    content_recommendations: contentRecs,
    per_profile_summary: perProfileSummary,
  };

  // Try to save to trend_scans table (may not exist yet)
  try {
    await supabase.from("trend_scans").insert(scanData);
  } catch {
    // Table may not exist yet — that's OK
  }

  // 10. Log activity
  await supabase.from("activity_log").insert({
    actor: "ia",
    action: `Radar scan: ${profiles.length} perfis, ${posts.length} posts analisados, ${totalNewPosts} novos, ${contentRecs.length} recomendacoes`,
    entity_type: "trend_scan",
    entity_title: "Scan automatico",
  });

  revalidatePath(PATH);
  revalidatePath("/referencias");

  return {
    profiles_scanned: profiles.length,
    total_posts_analyzed: posts.length,
    new_posts_found: totalNewPosts,
    cross_profile_insights: crossInsights,
    top_themes: topThemes,
    content_recommendations: contentRecs,
    per_profile_summary: perProfileSummary,
  };
}

// ============================================================
// GET LATEST SCAN
// ============================================================

export async function getLatestScan(): Promise<ScanResult | null> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("trend_scans")
      .select("*")
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      profiles_scanned: data.profiles_scanned || 0,
      total_posts_analyzed: data.total_posts_analyzed || 0,
      new_posts_found: data.new_posts_found || 0,
      cross_profile_insights: data.cross_profile_insights || "",
      top_themes: (data.top_themes as ScanResult["top_themes"]) || [],
      content_recommendations:
        (data.content_recommendations as ScanResult["content_recommendations"]) || [],
      per_profile_summary:
        (data.per_profile_summary as ScanResult["per_profile_summary"]) || [],
    };
  } catch {
    // Table may not exist yet
    return null;
  }
}

// ============================================================
// ACCEPT / REJECT RECOMMENDATIONS → FEED THE BRAIN
// ============================================================

export interface RecommendationAction {
  title: string;
  hook: string;
  format: string;
  why: string;
  inspired_by: string;
}

/**
 * Accept a recommendation: creates a Capture + Proposal in the knowledge base.
 * The proposal appears in Insights Pedro for final review/approval.
 */
export async function acceptRecommendation(
  rec: RecommendationAction
): Promise<{ proposal_id: string } | { error: string }> {
  try {
    const supabase = await createClient();

    // 1. Create a capture (entry point for the knowledge pipeline)
    const { data: capture, error: captureError } = await supabase
      .from("captures")
      .insert({
        title: `Radar: ${rec.title}`,
        context: `Recomendacao gerada pelo Radar de Tendencias, inspirada em ${rec.inspired_by}`,
        source_type: "manual" as const,
        source_url: null,
        raw_content: `**Titulo:** ${rec.title}\n\n**Hook:** ${rec.hook}\n\n**Formato:** ${rec.format}\n\n**Por que agora:** ${rec.why}\n\n**Inspirado por:** ${rec.inspired_by}`,
        status: "processed" as const,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (captureError || !capture) {
      return { error: captureError?.message || "Erro ao criar captura" };
    }

    // 2. Map format to proposal type
    const formatToType: Record<string, string> = {
      carrossel: "instagram_carousel",
      carousel: "instagram_carousel",
      reel: "instagram_carousel",
      post: "instagram_carousel",
      video: "instagram_carousel",
      linkedin: "linkedin_post",
      thread: "x_thread",
    };
    const proposalType = formatToType[rec.format.toLowerCase()] || "instagram_carousel";

    // 3. Build rich content markdown
    const contentMarkdown = `## ${rec.title}

**Hook:** ${rec.hook}

**Formato sugerido:** ${rec.format}

---

### Por que criar este conteudo agora
${rec.why}

### Inspiracao
Baseado em padroes detectados de ${rec.inspired_by}

---

> *Recomendacao gerada automaticamente pelo Radar de Tendencias. Edite e adapte para a voz do Pedro antes de publicar.*`;

    // 4. Create the proposal
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .insert({
        capture_id: capture.id,
        type: proposalType,
        title: rec.title,
        content_markdown: contentMarkdown,
        suggested_tags: [rec.format, "radar", rec.inspired_by.replace("@", "")].filter(Boolean),
        status: "pending" as const,
      })
      .select("id")
      .single();

    if (proposalError || !proposal) {
      return { error: proposalError?.message || "Erro ao criar proposta" };
    }

    // 5. Log activity
    await supabase.from("activity_log").insert({
      actor: "ia",
      action: `Recomendacao aceita do Radar: "${rec.title}" — proposta criada`,
      entity_type: "proposal",
      entity_id: proposal.id,
      entity_title: rec.title,
    });

    revalidatePath(PATH);
    revalidatePath("/insights-pedro");

    return { proposal_id: proposal.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: message };
  }
}

/**
 * Reject a recommendation: logs the rejection for learning.
 */
export async function rejectRecommendation(
  rec: RecommendationAction
): Promise<{ success: true }> {
  const supabase = await createClient();

  await supabase.from("activity_log").insert({
    actor: "pedro",
    action: `Recomendacao rejeitada do Radar: "${rec.title}" (inspirado por ${rec.inspired_by})`,
    entity_type: "trend_scan",
    entity_title: rec.title,
  });

  revalidatePath(PATH);
  return { success: true };
}

/**
 * Get titles of recommendations that were already accepted (exist as proposals).
 * Used to show status badges on recommendation cards.
 */
export async function getAcceptedRecommendationTitles(): Promise<Set<string>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("captures")
    .select("title")
    .like("title", "Radar:%");

  const titles = new Set(
    (data || []).map((c) => c.title.replace("Radar: ", "").toLowerCase())
  );

  return titles;
}

// ============================================================
// QUICK STATS (for dashboard header)
// ============================================================

export interface RadarStats {
  active_profiles: number;
  total_posts_30d: number;
  last_scan_at: string | null;
  platforms: string[];
}

export async function getRadarStats(): Promise<RadarStats> {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("reference_profiles")
    .select("id, platform, active")
    .eq("active", true);

  const activeProfiles = profiles || [];
  const platforms = [...new Set(activeProfiles.map((p) => p.platform))];

  let totalPosts = 0;
  if (activeProfiles.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count } = await supabase
      .from("reference_posts")
      .select("id", { count: "exact", head: true })
      .in(
        "profile_id",
        activeProfiles.map((p) => p.id)
      )
      .gte("posted_at", thirtyDaysAgo.toISOString());
    totalPosts = count || 0;
  }

  let lastScanAt: string | null = null;
  try {
    const { data: scan } = await supabase
      .from("trend_scans")
      .select("scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastScanAt = scan?.scanned_at || null;
  } catch {
    // Table may not exist
  }

  return {
    active_profiles: activeProfiles.length,
    total_posts_30d: totalPosts,
    last_scan_at: lastScanAt,
    platforms,
  };
}
