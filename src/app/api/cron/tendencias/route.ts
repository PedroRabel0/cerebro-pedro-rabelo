export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

import { createClient } from "@/lib/supabase/server";
import { scrapeInstagramProfile } from "@/lib/ai/apify";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";

/**
 * Daily cron: scrapes all active reference profiles,
 * analyzes cross-profile trends, and saves a scan report.
 *
 * Trigger: Vercel Cron or external scheduler with CRON_SECRET.
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

  // 1. Get active profiles
  const { data: profiles } = await supabase
    .from("reference_profiles")
    .select("*")
    .eq("active", true);

  if (!profiles || profiles.length === 0) {
    return Response.json({ message: "Nenhum perfil ativo", profiles_processed: 0 });
  }

  // 2. Scrape each Instagram profile
  let totalNewPosts = 0;
  const scrapeResults: Array<{ handle: string; posts_new: number; error?: string }> = [];

  for (const profile of profiles) {
    if (profile.platform !== "instagram") {
      scrapeResults.push({ handle: profile.handle, posts_new: 0, error: "Plataforma nao suportada" });
      continue;
    }

    try {
      const scraped = await scrapeInstagramProfile(profile.handle, 15);
      if ("error" in scraped) {
        scrapeResults.push({ handle: profile.handle, posts_new: 0, error: scraped.error });
        continue;
      }

      // Dedup
      const { data: existing } = await supabase
        .from("reference_posts")
        .select("caption_text")
        .eq("profile_id", profile.id);

      const existingCaptions = new Set(
        (existing || []).map((p) => p.caption_text?.slice(0, 100)?.toLowerCase()).filter(Boolean)
      );

      let newCount = 0;
      for (const post of scraped) {
        if (post.caption && existingCaptions.has(post.caption.slice(0, 100).toLowerCase())) continue;

        await supabase.from("reference_posts").insert({
          profile_id: profile.id,
          platform: "instagram",
          url: post.owner_username ? `https://www.instagram.com/${post.owner_username}/` : null,
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
        .eq("id", profile.id);

      totalNewPosts += newCount;
      scrapeResults.push({ handle: profile.handle, posts_new: newCount });
    } catch (err) {
      scrapeResults.push({
        handle: profile.handle,
        posts_new: 0,
        error: err instanceof Error ? err.message : "Erro",
      });
    }
  }

  // 3. Fetch all posts from last 30 days for analysis
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const profileIds = profiles.map((p) => p.id);

  const { data: allPosts } = await supabase
    .from("reference_posts")
    .select("*")
    .in("profile_id", profileIds)
    .gte("posted_at", thirtyDaysAgo.toISOString())
    .order("posted_at", { ascending: false });

  const posts = allPosts || [];

  // 4. Build per-profile summaries
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const perProfileSummary = profiles.map((profile) => {
    const profilePosts = posts.filter((p) => p.profile_id === profile.id);
    const themeCounts: Record<string, number> = {};
    for (const p of profilePosts) {
      if (p.dna_main_theme) themeCounts[p.dna_main_theme] = (themeCounts[p.dna_main_theme] || 0) + 1;
    }
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);
    const avgEng = profilePosts.length > 0
      ? profilePosts.reduce((s, p) => s + (p.engagement_rate || 0), 0) / profilePosts.length
      : 0;

    const bestPost = [...profilePosts].sort(
      (a, b) => (b.likes || 0) + (b.comments || 0) - ((a.likes || 0) + (a.comments || 0))
    )[0];

    return {
      profile_id: profile.id,
      handle: profile.handle,
      display_name: profile.display_name,
      platform: profile.platform,
      posts_count: profilePosts.length,
      top_themes: topThemes,
      avg_engagement: parseFloat(avgEng.toFixed(2)),
      highlight: bestPost?.caption_text?.split("\n")[0]?.slice(0, 100) || "Sem posts",
    };
  });

  // 5. Global themes
  const globalThemes: Record<string, { count: number; profiles: Set<string> }> = {};
  for (const post of posts) {
    if (!post.dna_main_theme) continue;
    if (!globalThemes[post.dna_main_theme]) globalThemes[post.dna_main_theme] = { count: 0, profiles: new Set() };
    globalThemes[post.dna_main_theme].count++;
    const prof = profileMap.get(post.profile_id);
    if (prof) globalThemes[post.dna_main_theme].profiles.add(prof.handle);
  }

  const topThemes = Object.entries(globalThemes)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([theme, data]) => ({ theme, count: data.count, profiles: Array.from(data.profiles) }));

  // 6. AI cross-profile analysis
  let crossInsights = "Sem dados suficientes para analise.";
  let contentRecs: Array<{ title: string; hook: string; format: string; why: string; inspired_by: string }> = [];

  if (posts.length > 0) {
    try {
      const anthropic = getClient();

      const summariesText = perProfileSummary
        .filter((p) => p.posts_count > 0)
        .map((p) => `@${p.handle}: ${p.posts_count} posts, eng ${p.avg_engagement}%, temas: ${p.top_themes.join(", ")}`)
        .join("\n");

      const topPostsText = posts
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 10)
        .map((p) => {
          const prof = profileMap.get(p.profile_id);
          return `@${prof?.handle}: "${p.caption_text?.split("\n")[0]?.slice(0, 100)}" (${p.likes} likes)`;
        })
        .join("\n");

      const { data: identity } = await supabase.from("identity").select("*").eq("id", 1).maybeSingle();
      const pedroCtx = identity
        ? `Tom: ${identity.tone_descriptors}, Posicionamento: ${identity.positioning}`
        : "Criador de conteudo sobre marketing e empreendedorismo.";

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: `Radar diario de conteudo para Pedro Rabelo.
Identidade: ${pedroCtx}

Perfis monitorados:
${summariesText}

Top posts:
${topPostsText}

Temas em alta: ${topThemes.map((t) => `${t.theme} (${t.count}x)`).join(", ")}

Gere JSON:
{
  "cross_profile_insights": "Analise markdown 3-5 paragrafos sobre tendencias, padroes e oportunidades",
  "content_recommendations": [{"title":"...","hook":"...","format":"carrossel|reel|post","why":"...","inspired_by":"@handle"}]
}
5-8 recomendacoes em pt-br.`,
        }],
      });

      logCost("claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens);

      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const parsed = parseJSON<{
          cross_profile_insights: string;
          content_recommendations: typeof contentRecs;
        }>(textBlock.text);
        if (parsed) {
          crossInsights = parsed.cross_profile_insights || crossInsights;
          contentRecs = parsed.content_recommendations || [];
        }
      }
    } catch (err) {
      console.error("[Cron Tendencias] AI error:", err);
    }
  }

  // 7. Save scan
  try {
    await supabase.from("trend_scans").insert({
      scanned_at: new Date().toISOString(),
      profiles_scanned: profiles.length,
      total_posts_analyzed: posts.length,
      new_posts_found: totalNewPosts,
      cross_profile_insights: crossInsights,
      top_themes: topThemes,
      content_recommendations: contentRecs,
      per_profile_summary: perProfileSummary,
    });
  } catch {
    console.error("[Cron Tendencias] Failed to save scan — table may not exist");
  }

  // 8. Log
  await supabase.from("activity_log").insert({
    actor: "ia",
    action: `[Cron] Radar diario: ${profiles.length} perfis, ${totalNewPosts} novos posts, ${contentRecs.length} recomendacoes`,
    entity_type: "trend_scan",
    entity_title: "Cron radar diario",
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return Response.json({
    message: `Radar concluido em ${elapsed}s`,
    profiles_processed: profiles.length,
    total_new_posts: totalNewPosts,
    total_posts_analyzed: posts.length,
    recommendations: contentRecs.length,
    scrape_results: scrapeResults,
  });
}
