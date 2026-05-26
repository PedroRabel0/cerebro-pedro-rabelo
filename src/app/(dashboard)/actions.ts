"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { processUniversalInput } from "@/lib/ai/universal";
import { scrapeInstagramPost } from "@/lib/ai/apify";
import { analyzeDNA } from "@/lib/ai";
import { getClient, logCost } from "@/lib/ai/client";
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

    // Save proposals (playbook/story/question for the knowledge base)
    if (result.proposals.length > 0) {
      const proposalRows = result.proposals.map((p) => ({
        capture_id: capture.id,
        type: p.type as "playbook" | "story" | "question",
        title: p.title,
        content_markdown: p.content_markdown,
        suggested_tags: p.suggested_tags || [],
        status: "pending",
      }));

      if (proposalRows.length > 0) {
        await supabase
          .from("proposals")
          .insert(proposalRows)
          .select("id, type");
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

// --- Brain Chat ---

export async function askBrain(question: string): Promise<string> {
  const supabase = await createClient();

  const [identity, playbooks, stories, recentRefs] = await Promise.all([
    supabase.from("identity").select("*").limit(1).single(),
    supabase
      .from("playbooks")
      .select("id, title, body_markdown")
      .limit(30),
    supabase
      .from("stories")
      .select("id, title, summary, body_markdown, tags")
      .limit(30),
    supabase
      .from("reference_posts")
      .select(
        "caption_text, dna_hook_type, dna_structure, dna_main_theme, profile:reference_profiles(display_name, handle)"
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Build context
  const parts: string[] = [];

  if (identity.data) {
    parts.push(
      `## Identidade do Pedro\n${JSON.stringify(identity.data, null, 2)}`
    );
  }

  if (playbooks.data && playbooks.data.length > 0) {
    const playbookText = playbooks.data
      .map(
        (p) =>
          `### ${p.title}\n${p.body_markdown || "(sem conteúdo)"}`
      )
      .join("\n\n");
    parts.push(`## Playbooks (${playbooks.data.length})\n${playbookText}`);
  }

  if (stories.data && stories.data.length > 0) {
    const storyText = stories.data
      .map(
        (s) =>
          `### ${s.title}\n${s.summary || ""}\n${s.body_markdown || "(sem conteúdo)"}\nTags: ${(s.tags || []).join(", ")}`
      )
      .join("\n\n");
    parts.push(`## Histórias (${stories.data.length})\n${storyText}`);
  }

  if (recentRefs.data && recentRefs.data.length > 0) {
    const refText = recentRefs.data
      .map((r) => {
        const profile = r.profile as unknown as {
          display_name: string;
          handle: string;
        } | null;
        const profileName = profile
          ? `${profile.display_name} (@${profile.handle})`
          : "Desconhecido";
        return `- ${profileName}: ${(r.caption_text || "").slice(0, 200)} [Hook: ${r.dna_hook_type || "?"}, Tema: ${r.dna_main_theme || "?"}]`;
      })
      .join("\n");
    parts.push(
      `## Referências Recentes (${recentRefs.data.length})\n${refText}`
    );
  }

  const knowledgeContext = parts.join("\n\n---\n\n");

  const systemPrompt =
    "Você é o Segundo Cérebro do Pedro Rabelo. Você sabe TUDO que está na base de conhecimento dele. " +
    "Responda como se fosse a memória e inteligência do Pedro — use os playbooks, histórias e referências " +
    "para dar respostas completas e contextualizadas. Se não souber algo, diga que ainda não tem essa " +
    "informação na base. Responda sempre em português brasileiro, de forma direta e útil.\n\n" +
    "=== BASE DE CONHECIMENTO ===\n\n" +
    knowledgeContext;

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user", content: question }],
  });

  logCost(
    "claude-sonnet-4-6",
    response.usage.input_tokens,
    response.usage.output_tokens
  );

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return text;
}

// --- Activity Feed ---

export async function getActivityFeed() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}
