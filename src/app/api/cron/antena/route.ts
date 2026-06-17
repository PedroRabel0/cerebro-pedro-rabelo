export const dynamic = "force-dynamic";
export const maxDuration = 60; // Hobby plan max

import { createClient } from "@/lib/supabase/server";
import { scrapeInstagramProfile } from "@/lib/ai/apify";
import { analyzeDNA } from "@/lib/ai";
import { isAuthorizedCron } from "@/lib/api-guards";

import { log } from '@/lib/logger';
export async function GET(request: Request) {
  // Auth: exige Bearer CRON_SECRET (Vercel injeta automaticamente nos crons).
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();
  const startTime = Date.now();

  // 1. Fetch all active reference profiles
  const { data: profiles, error: profilesError } = await supabase
    .from("reference_profiles")
    .select("*")
    .eq("active", true);

  if (profilesError) {
    log.error("[Cron Antena] Failed to fetch profiles:" + " " + String(profilesError));
    return Response.json(
      { error: "Falha ao buscar perfis", details: profilesError.message },
      { status: 500 }
    );
  }

  if (!profiles || profiles.length === 0) {
    return Response.json({ message: "Nenhum perfil ativo encontrado", processed: 0 });
  }

  const results: Array<{
    profile: string;
    handle: string;
    posts_scraped: number;
    posts_new: number;
    posts_analyzed: number;
    error?: string;
  }> = [];

  // 2. Process each profile
  for (const profile of profiles) {
    const profileResult = {
      profile: profile.display_name,
      handle: profile.handle,
      posts_scraped: 0,
      posts_new: 0,
      posts_analyzed: 0,
      error: undefined as string | undefined,
    };

    try {
      if (profile.platform !== "instagram") {
        profileResult.error = `Plataforma ${profile.platform} não suportada`;
        results.push(profileResult);
        continue;
      }

      log.info(`[Cron Antena] Scraping @${profile.handle}...`);

      // 2a. Scrape latest 15 posts
      const scraped = await scrapeInstagramProfile(profile.handle, 15);

      if ("error" in scraped) {
        profileResult.error = scraped.error;
        results.push(profileResult);

        await supabase.from("activity_log").insert({
          actor: "ia",
          action: `[Cron] Falha ao scraper @${profile.handle}: ${scraped.error}`,
          entity_type: "reference_profile",
          entity_id: profile.id,
          entity_title: profile.display_name,
        });
        continue;
      }

      profileResult.posts_scraped = scraped.length;

      // 2b. Get existing post URLs/dates to avoid duplicates
      const { data: existingPosts } = await supabase
        .from("reference_posts")
        .select("caption_text, posted_at")
        .eq("profile_id", profile.id);

      const existingCaptions = new Set(
        (existingPosts || [])
          .map((p) => p.caption_text?.slice(0, 100))
          .filter(Boolean)
      );

      // 2c. Filter to new posts only
      const newPosts = scraped.filter((post) => {
        if (!post.caption) return false;
        return !existingCaptions.has(post.caption.slice(0, 100));
      });

      profileResult.posts_new = newPosts.length;

      // 2d. Process posts in parallel batches of 5 for speed
      const BATCH_SIZE = 5;
      for (let i = 0; i < newPosts.length; i += BATCH_SIZE) {
        const batch = newPosts.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (post) => {
            let dna: Record<string, string> = {} as Record<string, string>;

            if (post.caption) {
              const dnaResult = await analyzeDNA({ content: post.caption });
              if (!("error" in dnaResult)) {
                dna = dnaResult as unknown as Record<string, string>;
                profileResult.posts_analyzed++;
              }
            }

            return { post, dna };
          })
        );

        // Save all posts from this batch
        for (const { post, dna } of batchResults) {
          const postUrl = post.owner_username
            ? `https://www.instagram.com/${post.owner_username}/`
            : null;

          await supabase.from("reference_posts").insert({
            profile_id: profile.id,
            platform: "instagram",
            url: postUrl,
            thumbnail_url: post.thumbnail_url,
            caption_text: post.caption,
            likes: post.likes,
            comments: post.comments,
            engagement_rate: post.engagement_rate,
            posted_at: post.posted_at,
            dna_hook_type: dna.hook_type || null,
            dna_structure: dna.structure || null,
            dna_length: dna.length || null,
            dna_tone: dna.tone || null,
            dna_cta_type: dna.cta_type || null,
            dna_main_theme: dna.main_theme || null,
            dna_sub_theme: dna.sub_theme || null,
            dna_thesis: dna.thesis || null,
            saved_as_reference: true,
          });
        }
      }

      // 2e. Update last_scraped_at
      await supabase
        .from("reference_profiles")
        .update({ last_scraped_at: new Date().toISOString() })
        .eq("id", profile.id);

      // 2f. Log activity
      await supabase.from("activity_log").insert({
        actor: "ia",
        action: `[Cron] Scrape semanal: ${newPosts.length} novos posts de @${profile.handle} (${scraped.length} total)`,
        entity_type: "reference_profile",
        entity_id: profile.id,
        entity_title: profile.display_name,
      });

      log.info(
        `[Cron Antena] @${profile.handle}: ${newPosts.length} new / ${scraped.length} total`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      profileResult.error = message;
      log.error(`[Cron Antena] Error processing @${profile.handle}:` + " " + String(message));
    }

    results.push(profileResult);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalNew = results.reduce((sum, r) => sum + r.posts_new, 0);
  const totalAnalyzed = results.reduce((sum, r) => sum + r.posts_analyzed, 0);
  const errors = results.filter((r) => r.error);

  log.info(
    `[Cron Antena] Done in ${elapsed}s — ${profiles.length} profiles, ${totalNew} new posts, ${totalAnalyzed} analyzed, ${errors.length} errors`
  );

  return Response.json({
    message: `Cron antena concluído em ${elapsed}s`,
    profiles_processed: profiles.length,
    total_new_posts: totalNew,
    total_analyzed: totalAnalyzed,
    errors: errors.length,
    results,
  });
}
