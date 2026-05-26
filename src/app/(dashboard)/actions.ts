"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { processUniversalInput } from "@/lib/ai/universal";
import { scrapeInstagramPost } from "@/lib/ai/apify";
import { analyzeDNA } from "@/lib/ai";
import { generateCarouselSlides } from "@/lib/ai/slide-generator";
import { uploadImageToStorage } from "@/lib/supabase/storage";
import type { CaptureSourceType } from "@/lib/supabase/types";

// --- Universal Input ---

function detectInstagramUrl(input: string): boolean {
  return /instagram\.com\/(p|reel|tv)\//i.test(input.trim());
}

async function handleInstagramInput(url: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  // 1. Scrape with Apify
  const scraped = await scrapeInstagramPost(url);
  if ("error" in scraped) {
    console.error("[Apify] Scrape failed:", scraped.error);
    return null;
  }

  // 2. Find or create profile
  let profileId: string | null = null;
  if (scraped.owner_username) {
    const { data: existing } = await supabase
      .from("reference_profiles")
      .select("id")
      .eq("handle", scraped.owner_username)
      .eq("platform", "instagram")
      .limit(1)
      .single();

    if (existing) {
      profileId = existing.id;
    } else {
      const { data: newProfile } = await supabase
        .from("reference_profiles")
        .insert({
          platform: "instagram",
          handle: scraped.owner_username,
          display_name: scraped.owner_full_name || scraped.owner_username,
          active: true,
        })
        .select("id")
        .single();
      profileId = newProfile?.id ?? null;
    }
  }

  // 3. Analyze DNA with Claude
  let dna: { hook_type?: string; structure?: string; length?: string; tone?: string; cta_type?: string; main_theme?: string; sub_theme?: string; thesis?: string } = {};
  if (scraped.caption) {
    const dnaResult = await analyzeDNA({ content: scraped.caption });
    if (!("error" in dnaResult)) {
      dna = dnaResult;
    }
  }

  // 4. Save reference post
  if (profileId) {
    await supabase.from("reference_posts").insert({
      profile_id: profileId,
      platform: "instagram",
      url,
      thumbnail_url: scraped.thumbnail_url,
      caption_text: scraped.caption,
      likes: scraped.likes,
      comments: scraped.comments,
      engagement_rate: scraped.engagement_rate,
      posted_at: scraped.posted_at,
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

  return scraped;
}

export async function submitUniversalInput(input: string) {
  const supabase = await createClient();

  // Detect source type from URL
  const urlPattern = /^https?:\/\/[^\s]+$/i;
  const isUrl = urlPattern.test(input.trim());
  const isInstagram = isUrl && detectInstagramUrl(input);
  let sourceType: CaptureSourceType = "manual";

  if (isUrl) {
    const url = input.trim().toLowerCase();
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      sourceType = "youtube";
    }
  } else {
    sourceType = input.length > 500 ? "transcript" : "manual";
  }

  // 0. Deduplication — check if this exact input was already processed
  if (isUrl) {
    const { data: existing } = await supabase
      .from("captures")
      .select("id, title, status")
      .eq("source_url", input.trim())
      .eq("status", "processed")
      .limit(1)
      .single();
    if (existing) {
      console.log(`[Dedup] Input already processed: ${existing.id}`);
      revalidatePath("/");
      return {
        captureId: existing.id,
        status: "duplicate" as const,
        message: `Este link já foi processado anteriormente: "${existing.title}"`,
      };
    }
  }

  // 1. Save capture immediately (even if AI fails later)
  const title = isUrl
    ? `Input: ${new URL(input.trim()).hostname}`
    : input.slice(0, 80) + (input.length > 80 ? "..." : "");

  const { data: capture, error: captureError } = await supabase
    .from("captures")
    .insert({
      title,
      source_type: sourceType,
      source_url: isUrl ? input.trim() : null,
      raw_content: input,
      status: "pending",
    })
    .select("id")
    .single();

  if (captureError) throw captureError;

  // 2. Log activity
  await supabase.from("activity_log").insert({
    actor: "ia",
    action: `Novo input recebido: ${sourceType}${isInstagram ? " (Instagram — scraping com Apify)" : ""}`,
    entity_type: "capture",
    entity_id: capture.id,
    entity_title: isUrl ? input.trim() : input.slice(0, 60),
  });

  // 3. Instagram-specific: scrape with Apify + DNA analysis
  let instagramData = null;
  if (isInstagram) {
    try {
      instagramData = await handleInstagramInput(input.trim(), supabase);
      if (instagramData) {
        await supabase.from("activity_log").insert({
          actor: "ia",
          action: `Instagram scrapado: ${instagramData.likes} likes, ${instagramData.comments} comments`,
          entity_type: "reference_post",
          entity_id: capture.id,
          entity_title: instagramData.caption?.slice(0, 60) || input.trim(),
        });
      }
    } catch (err) {
      console.error("[Instagram] Scrape error:", err);
    }
  }

  // 4. AI Processing (Claude)
  try {
    // If Instagram, enrich the input with scraped data
    const aiInput = instagramData?.caption
      ? `URL: ${input.trim()}\n\nLegenda do post:\n${instagramData.caption}\n\nMétricas: ${instagramData.likes} likes, ${instagramData.comments} comentários`
      : input;

    const result = await processUniversalInput(aiInput);

    if ("error" in result) {
      console.error("[Universal] AI processing failed:", result.error);
      revalidatePath("/");
      return { captureId: capture.id, status: "saved_without_ai" as const, instagramData };
    }

    // Update capture with AI results
    await supabase
      .from("captures")
      .update({
        title: result.title,
        context: result.summary,
        status: "processed",
        speaker_verified: result.speaker_verified,
      })
      .eq("id", capture.id);

    // Save proposals (now ready-to-post content pieces)
    if (result.proposals.length > 0) {
      const proposalRows = result.proposals.map((p) => {
        // Build structured markdown from the post data
        const slidesSection = p.slides && p.slides.length > 0
          ? `\n\n**Slides:**\n${p.slides.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
          : "";

        const contentMarkdown = `**Hook:** ${p.hook}\n\n**Legenda:**\n${p.caption}\n\n**Hashtags:** ${p.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}\n\n**CTA:** ${p.cta}${slidesSection}`;

        return {
          capture_id: capture.id,
          type: p.platform as "instagram_carousel" | "linkedin_post" | "x_thread",
          title: p.title,
          content_markdown: contentMarkdown,
          suggested_tags: p.hashtags,
          status: "pending",
        };
      });

      if (proposalRows.length > 0) {
        const { data: insertedProposals } = await supabase
          .from("proposals")
          .insert(proposalRows)
          .select("id, type");

        // Generate carousel slide images in background (fire-and-forget)
        const carouselProposal = result.proposals.find(
          (p) => p.platform === "instagram_carousel" && p.slides && p.slides.length > 0
        );
        const insertedCarousel = insertedProposals?.find(
          (p) => p.type === "instagram_carousel"
        );

        if (carouselProposal && insertedCarousel) {
          generateAndSaveSlideImages(
            carouselProposal,
            insertedCarousel.id,
            supabase
          ).catch((err) =>
            console.error("[SlideGen] Background generation failed:", err)
          );
        }
      }
    }

    // Log success
    await supabase.from("activity_log").insert({
      actor: "ia",
      action: `Processou input e gerou ${result.proposals.length} proposta(s)${isInstagram ? " + referência Instagram" : ""}`,
      entity_type: "capture",
      entity_id: capture.id,
      entity_title: result.title,
    });

    revalidatePath("/");
    revalidatePath("/insights-pedro");
    revalidatePath("/base-de-conhecimento");
    revalidatePath("/referencias");

    return {
      captureId: capture.id,
      status: "processed" as const,
      result,
      instagramData,
    };
  } catch (aiError) {
    console.error("[Universal] Processing error:", aiError);
    revalidatePath("/");
    return { captureId: capture.id, status: "saved_without_ai" as const, instagramData };
  }
}

// --- Slide Image Generation (background) ---

async function generateAndSaveSlideImages(
  carouselPost: { slides?: string[]; hook: string; cta: string; title: string; hashtags: string[] },
  proposalId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  try {
    console.log(`[SlideGen] Starting image generation for proposal ${proposalId}`);

    const slideImages = await generateCarouselSlides({
      slides: carouselPost.slides || [],
      hook: carouselPost.hook,
      cta: carouselPost.cta,
      title: carouselPost.title,
      hashtags: carouselPost.hashtags,
    });

    if (slideImages.length === 0) {
      console.log("[SlideGen] No images generated");
      return;
    }

    // Upload each slide to Supabase Storage
    const uploadedUrls: string[] = [];
    for (const slide of slideImages) {
      const publicUrl = await uploadImageToStorage(
        slide.imageUrl,
        `proposal-${proposalId}-slide-${slide.slideIndex}`
      );
      if (publicUrl) {
        uploadedUrls.push(publicUrl);
      }
    }

    if (uploadedUrls.length > 0) {
      // Get current proposal content and append image URLs
      const { data: proposal } = await supabase
        .from("proposals")
        .select("content_markdown")
        .eq("id", proposalId)
        .single();

      const existingContent = proposal?.content_markdown || "";
      const imageSection = `\n\n**Imagens dos Slides:**\n${uploadedUrls.map((url, i) => `${i + 1}. ${url}`).join("\n")}`;

      await supabase
        .from("proposals")
        .update({
          content_markdown: existingContent + imageSection,
        })
        .eq("id", proposalId);

      console.log(`[SlideGen] Saved ${uploadedUrls.length} slide images for proposal ${proposalId}`);

      // Log activity
      await supabase.from("activity_log").insert({
        actor: "ia",
        action: `Gerou ${uploadedUrls.length} imagens de slides para carousel`,
        entity_type: "proposal",
        entity_id: proposalId,
      });

      revalidatePath("/insights-pedro");
    }
  } catch (error) {
    console.error("[SlideGen] Error:", error);
  }
}

// --- Dashboard Queries ---

export async function getRecentInputs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .select("id, title, source_type, source_url, status, created_at, context")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const [capturesRes, playbooksRes, storiesRes, contentsRes, pendingRes] =
    await Promise.all([
      supabase.from("captures").select("id", { count: "exact", head: true }),
      supabase.from("playbooks").select("id", { count: "exact", head: true }),
      supabase.from("stories").select("id", { count: "exact", head: true }),
      supabase
        .from("generated_contents")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
  return {
    captures: capturesRes.count ?? 0,
    playbooks: playbooksRes.count ?? 0,
    stories: storiesRes.count ?? 0,
    contents: contentsRes.count ?? 0,
    pendingProposals: pendingRes.count ?? 0,
  };
}
