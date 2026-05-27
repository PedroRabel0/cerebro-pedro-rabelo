"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { scrapeInstagramProfile } from "@/lib/ai/apify";
import { analyzeDNA } from "@/lib/ai";
import type { InstagramPostData } from "@/lib/ai/apify";
import Anthropic from "@anthropic-ai/sdk";

const PATH = "/referencias";

// --- Helpers ---

function getAIClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseJSON<T>(text: string): T | null {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    const match = objectMatch || arrayMatch;
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Scrape, analyze DNA, save posts, and generate content suggestions for a profile.
 * Runs in the background — errors are logged but don't propagate.
 */
async function scrapeAndAnalyzeProfile(profileId: string, handle: string, displayName: string) {
  try {
    const supabase = await createClient();

    // 1. Scrape latest 9 posts
    console.log(`[AutoScrape] Scraping @${handle}...`);
    const scraped = await scrapeInstagramProfile(handle, 9);

    if ("error" in scraped) {
      console.error(`[AutoScrape] Failed for @${handle}:`, scraped.error);
      await supabase.from("activity_log").insert({
        actor: "ia",
        action: `Falha ao scraper perfil @${handle}: ${scraped.error}`,
        entity_type: "reference_profile",
        entity_id: profileId,
        entity_title: displayName,
      });
      return;
    }

    console.log(`[AutoScrape] Got ${scraped.length} posts for @${handle}`);

    // 2. For each post: analyze DNA and save
    const savedPosts: Array<{ caption: string; dna: Record<string, string> }> = [];

    for (const post of scraped) {
      let dna: Record<string, string> = {} as Record<string, string>;
      if (post.caption) {
        const dnaResult = await analyzeDNA({ content: post.caption });
        if (!("error" in dnaResult)) {
          dna = dnaResult as unknown as Record<string, string>;
        }
      }

      const postUrl = post.owner_username
        ? `https://www.instagram.com/${post.owner_username}/`
        : null;

      await supabase.from("reference_posts").insert({
        profile_id: profileId,
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

      if (post.caption && Object.keys(dna).length > 0) {
        savedPosts.push({ caption: post.caption, dna });
      }
    }

    // 3. Update last_scraped_at
    await supabase
      .from("reference_profiles")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", profileId);

    // 4. Log activity
    await supabase.from("activity_log").insert({
      actor: "ia",
      action: `Auto-scrape: ${scraped.length} posts de @${handle} analisados e salvos`,
      entity_type: "reference_profile",
      entity_id: profileId,
      entity_title: displayName,
    });

    // 5. Generate content suggestions based on scraped posts
    if (savedPosts.length > 0) {
      try {
        await generateContentSuggestions(profileId, handle, displayName, savedPosts, supabase);
      } catch (err) {
        console.error(`[AutoScrape] Suggestion generation failed for @${handle}:`, err);
      }
    }

    revalidatePath(PATH);
    console.log(`[AutoScrape] Done for @${handle}`);
  } catch (err) {
    console.error(`[AutoScrape] Unexpected error for @${handle}:`, err);
  }
}

/**
 * Generate 3 content suggestions for Pedro based on scraped reference posts.
 */
async function generateContentSuggestions(
  profileId: string,
  handle: string,
  displayName: string,
  posts: Array<{ caption: string; dna: Record<string, string> }>,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const client = getAIClient();

  const postsContext = posts
    .map(
      (p, i) =>
        `### Post ${i + 1}\n**Legenda:** ${p.caption.slice(0, 500)}\n**DNA:** hook=${p.dna.hook_type}, estrutura=${p.dna.structure}, tom=${p.dna.tone}, tema=${p.dna.main_theme}, tese=${p.dna.thesis}`,
    )
    .join("\n\n");

  const systemPrompt = `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUÊS BRASILEIRO (PT-BR). SE O CONTEÚDO ORIGINAL ESTIVER EM INGLÊS OU QUALQUER OUTRO IDIOMA, TRADUZA E ADAPTE TUDO PARA PT-BR. TÍTULOS, RESUMOS, PROPOSTAS, TAGS — TUDO EM PORTUGUÊS. NUNCA RESPONDA EM INGLÊS OU OUTRO IDIOMA.

Você é o assistente de conteúdo de Pedro Sobral. Sua tarefa é analisar posts de referência de @${handle} e gerar 3 sugestões de conteúdo para Pedro no mesmo estilo/estrutura, mas adaptados para a voz e os temas de Pedro.

Pedro é criador de conteúdo sobre marketing digital, gestão e empreendedorismo. Ele fala com autoridade, é direto, usa exemplos práticos e tem um tom provocativo mas educativo.

## Regras
- Gere exatamente 3 propostas de conteúdo inspiradas nos padrões do @${handle}
- Cada proposta deve ter: título, hook, legenda completa, hashtags e CTA
- Adapte os temas para o universo de Pedro (marketing, gestão, resultados)
- Mantenha o estilo estrutural (hook_type, structure, tone) que funciona para @${handle}
- Formato: instagram_carousel

## Formato de Resposta (JSON):
[
  {
    "platform": "instagram_carousel",
    "title": "...",
    "hook": "...",
    "caption": "...",
    "hashtags": ["...", "..."],
    "cta": "...",
    "slides": ["slide 1", "slide 2", "..."]
  }
]`;

  const userPrompt = `## Posts de referência de @${handle} (${displayName})

${postsContext}

Baseado nos padrões de DNA destes ${posts.length} posts, gere 3 sugestões de conteúdo para Pedro Sobral.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  interface SuggestionPost {
    platform: string;
    title: string;
    hook: string;
    caption: string;
    hashtags: string[];
    cta: string;
    slides?: string[];
  }

  const suggestions = parseJSON<SuggestionPost[]>(text);
  if (!suggestions || !Array.isArray(suggestions)) {
    console.error("[AutoScrape] Failed to parse suggestions");
    return;
  }

  // Save as proposals — we need a capture first
  const { data: capture } = await supabase
    .from("captures")
    .insert({
      title: `Auto-análise: @${handle}`,
      source_type: "manual" as const,
      source_url: `https://www.instagram.com/${handle}/`,
      raw_content: `Análise automática de ${posts.length} posts de @${handle}`,
      status: "processed" as const,
    })
    .select("id")
    .single();

  if (!capture) return;

  const proposalRows = suggestions.map((s) => {
    const slidesSection =
      s.slides && s.slides.length > 0
        ? `\n\n**Slides:**\n${s.slides.map((sl, i) => `${i + 1}. ${sl}`).join("\n")}`
        : "";

    const contentMarkdown = `**Hook:** ${s.hook}\n\n**Legenda:**\n${s.caption}\n\n**Hashtags:** ${s.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}\n\n**CTA:** ${s.cta}${slidesSection}`;

    return {
      capture_id: capture.id,
      type: (s.platform || "instagram_carousel") as "instagram_carousel" | "linkedin_post" | "x_thread",
      title: s.title,
      content_markdown: contentMarkdown,
      suggested_tags: s.hashtags,
      status: "pending" as const,
    };
  });

  if (proposalRows.length > 0) {
    await supabase.from("proposals").insert(proposalRows);
  }

  await supabase.from("activity_log").insert({
    actor: "ia",
    action: `Gerou ${proposalRows.length} sugestões de conteúdo baseadas em @${handle}`,
    entity_type: "capture",
    entity_id: capture.id,
    entity_title: `Auto-análise: @${handle}`,
  });

  console.log(`[AutoScrape] Generated ${proposalRows.length} suggestions from @${handle}`);
}

// --- Reference Profiles ---

export async function getProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reference_profiles")
    .select("*")
    .order("display_name");
  if (error) throw error;
  return data;
}

export async function createProfile(formData: FormData) {
  const supabase = await createClient();
  const platform = formData.get("platform") as string;
  const handle = (formData.get("handle") as string).replace(/^@/, "");
  const displayName = formData.get("display_name") as string;

  const { data: profile, error } = await supabase
    .from("reference_profiles")
    .insert({
      platform,
      handle,
      display_name: displayName,
      active: formData.get("active") === "on",
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath(PATH);

  // Auto-scrape Instagram profiles in background (fire-and-forget)
  if (platform === "instagram" && profile) {
    scrapeAndAnalyzeProfile(profile.id, handle, displayName).catch((err) =>
      console.error("[AutoScrape] Background error:", err),
    );
  }
}

export async function rescrapeProfile(profileId: string) {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("reference_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error || !profile) throw error || new Error("Perfil não encontrado");
  if (profile.platform !== "instagram") {
    throw new Error("Rescrape só disponível para perfis Instagram");
  }

  // Delete existing posts to avoid duplicates, then rescrape
  await supabase.from("reference_posts").delete().eq("profile_id", profileId);

  revalidatePath(PATH);

  // Fire-and-forget background scraping
  scrapeAndAnalyzeProfile(profileId, profile.handle, profile.display_name).catch((err) =>
    console.error("[Rescrape] Background error:", err),
  );
}

/**
 * On-demand scrape for a single profile. Deduplicates by caption,
 * analyzes DNA in parallel batches of 5, logs activity, returns counts.
 */
export async function scrapeProfileNow(
  profileId: string,
): Promise<{ posts_found: number; posts_new: number } | { error: string }> {
  try {
    const supabase = await createClient();

    // 1. Fetch the profile
    const { data: profile, error: profileError } = await supabase
      .from("reference_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      return { error: "Perfil não encontrado" };
    }

    if (profile.platform !== "instagram") {
      return { error: "Scrape só disponível para perfis Instagram" };
    }

    // 2. Scrape latest 50 posts (pega bastante pra ter um bom volume)
    console.log(`[ScrapeNow] Scraping @${profile.handle}...`);
    const scraped = await scrapeInstagramProfile(profile.handle, 50);

    if ("error" in scraped) {
      return { error: scraped.error };
    }

    const postsFound = scraped.length;

    // 3. Get existing captions for deduplication (first 100 chars)
    const { data: existingPosts } = await supabase
      .from("reference_posts")
      .select("caption_text")
      .eq("profile_id", profileId);

    const existingCaptions = new Set(
      (existingPosts || [])
        .map((p) => p.caption_text?.slice(0, 100))
        .filter(Boolean),
    );

    // 4. Filter to new posts only
    const newPosts = scraped.filter((post) => {
      if (!post.caption) return false;
      return !existingCaptions.has(post.caption.slice(0, 100));
    });

    // 5. Process in parallel batches of 5
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
            }
          }
          return { post, dna };
        }),
      );

      // Save all posts from this batch
      for (const { post, dna } of batchResults) {
        const postUrl = post.owner_username
          ? `https://www.instagram.com/${post.owner_username}/`
          : null;

        await supabase.from("reference_posts").insert({
          profile_id: profileId,
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

    // 6. Update last_scraped_at
    await supabase
      .from("reference_profiles")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", profileId);

    // 7. Log activity
    await supabase.from("activity_log").insert({
      actor: "ia",
      action: `Puxar agora: ${newPosts.length} novos posts de @${profile.handle} (${postsFound} total)`,
      entity_type: "reference_profile",
      entity_id: profileId,
      entity_title: profile.display_name,
    });

    console.log(
      `[ScrapeNow] @${profile.handle}: ${newPosts.length} new / ${postsFound} total`,
    );

    revalidatePath(PATH);

    return { posts_found: postsFound, posts_new: newPosts.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error(`[ScrapeNow] Error:`, message);
    return { error: message };
  }
}

export async function deleteProfile(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reference_profiles")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Reference Posts ---

export async function getPostsByProfile(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reference_posts")
    .select("*")
    .eq("profile_id", profileId)
    .order("scraped_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("reference_posts").insert({
    profile_id: formData.get("profile_id") as string,
    platform: formData.get("platform") as string,
    url: (formData.get("url") as string) || null,
    thumbnail_url: (formData.get("thumbnail_url") as string) || null,
    caption_text: (formData.get("caption_text") as string) || null,
    likes: Number(formData.get("likes")) || 0,
    comments: Number(formData.get("comments")) || 0,
    engagement_rate: Number(formData.get("engagement_rate")) || null,
    dna_hook_type: (formData.get("hook_type") as string) || null,
    dna_structure: (formData.get("structure") as string) || null,
    dna_length: (formData.get("length") as string) || null,
    dna_tone: (formData.get("tone") as string) || null,
    dna_cta_type: (formData.get("cta_type") as string) || null,
    dna_main_theme: (formData.get("main_theme") as string) || null,
    dna_sub_theme: (formData.get("sub_theme") as string) || null,
    dna_thesis: (formData.get("thesis") as string) || null,
  });
  if (error) throw error;
  revalidatePath(PATH);
}

export async function deletePost(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reference_posts")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Weekly Patterns (Sinais da Semana) ---

export interface WeeklyPattern {
  pattern_type: string;
  description: string;
  count: number;
  example_posts: string[];
  suggestion: string;
}

export async function detectWeeklyPatterns(): Promise<WeeklyPattern[]> {
  const supabase = await createClient();

  // Fetch posts from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: posts, error } = await supabase
    .from("reference_posts")
    .select("*")
    .gte("scraped_at", sevenDaysAgo.toISOString())
    .order("scraped_at", { ascending: false });

  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  // Group by DNA fields to find patterns
  const hookGroups: Record<string, typeof posts> = {};
  const structureGroups: Record<string, typeof posts> = {};
  const themeGroups: Record<string, typeof posts> = {};
  const toneGroups: Record<string, typeof posts> = {};
  const ctaGroups: Record<string, typeof posts> = {};

  for (const post of posts) {
    if (post.dna_hook_type) {
      hookGroups[post.dna_hook_type] = hookGroups[post.dna_hook_type] || [];
      hookGroups[post.dna_hook_type].push(post);
    }
    if (post.dna_structure) {
      structureGroups[post.dna_structure] = structureGroups[post.dna_structure] || [];
      structureGroups[post.dna_structure].push(post);
    }
    if (post.dna_main_theme) {
      themeGroups[post.dna_main_theme] = themeGroups[post.dna_main_theme] || [];
      themeGroups[post.dna_main_theme].push(post);
    }
    if (post.dna_tone) {
      toneGroups[post.dna_tone] = toneGroups[post.dna_tone] || [];
      toneGroups[post.dna_tone].push(post);
    }
    if (post.dna_cta_type) {
      ctaGroups[post.dna_cta_type] = ctaGroups[post.dna_cta_type] || [];
      ctaGroups[post.dna_cta_type].push(post);
    }
  }

  // Build pattern summaries for AI (only groups with 2+ posts)
  const rawPatterns: Array<{
    field: string;
    value: string;
    count: number;
    examples: string[];
  }> = [];

  const addPatterns = (groups: Record<string, typeof posts>, field: string) => {
    for (const [value, groupPosts] of Object.entries(groups)) {
      if (groupPosts.length >= 2) {
        rawPatterns.push({
          field,
          value,
          count: groupPosts.length,
          examples: groupPosts
            .slice(0, 3)
            .map((p) => p.caption_text?.slice(0, 120) || "(sem legenda)"),
        });
      }
    }
  };

  addPatterns(hookGroups, "hook_type");
  addPatterns(structureGroups, "structure");
  addPatterns(themeGroups, "main_theme");
  addPatterns(toneGroups, "tone");
  addPatterns(ctaGroups, "cta_type");

  if (rawPatterns.length === 0) return [];

  // Sort by count descending and take top 8
  rawPatterns.sort((a, b) => b.count - a.count);
  const topPatterns = rawPatterns.slice(0, 8);

  // Use Claude Haiku to summarize into actionable insights
  const client = getAIClient();

  const patternsText = topPatterns
    .map(
      (p, i) =>
        `${i + 1}. Campo: ${p.field} | Valor: "${p.value}" | Ocorrências: ${p.count}\n   Exemplos: ${p.examples.join(" | ")}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `Você é um analista de conteúdo. Receba padrões detectados em posts de referência da última semana e transforme-os em insights acionáveis em português brasileiro.

Para cada padrão, retorne um JSON array com objetos contendo:
- pattern_type: tipo curto (ex: "hook", "estrutura", "tema", "tom", "cta")
- description: descrição clara do padrão em português (ex: "5 posts usam hook de pergunta")
- count: número de ocorrências
- example_posts: até 3 trechos de exemplo
- suggestion: sugestão prática de como Pedro pode usar esse padrão no conteúdo dele

Responda APENAS com o JSON array, sem markdown.`,
    messages: [
      {
        role: "user",
        content: `Total de posts analisados na última semana: ${posts.length}\n\nPadrões encontrados:\n${patternsText}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = parseJSON<WeeklyPattern[]>(text);

  return parsed && Array.isArray(parsed) ? parsed : [];
}

export async function createFormatFromPattern(
  patternType: string,
  description: string,
  suggestion: string,
) {
  const supabase = await createClient();

  const name = `Formato: ${patternType} — ${description.slice(0, 50)}`;
  const structureMarkdown = `## Padrão detectado\n${description}\n\n## Como usar\n${suggestion}\n\n## Estrutura sugerida\n- Hook baseado em "${patternType}"\n- Desenvolver com exemplos práticos\n- CTA alinhado ao padrão`;

  const { error } = await supabase.from("content_formats").insert({
    name,
    content_type: "instagram_carousel",
    description: `Formato criado a partir de padrão semanal: ${description}`,
    structure_markdown: structureMarkdown,
  });

  if (error) throw error;
  revalidatePath(PATH);
  revalidatePath("/gerar-conteudo");
}

// --- Profile Analysis for Pedro ---

export async function analyzeProfileForPedro(
  profileId: string,
): Promise<{ analysis: string } | { error: string }> {
  try {
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("reference_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (!profile) return { error: "Perfil não encontrado" };

    const { data: posts } = await supabase
      .from("reference_posts")
      .select("*")
      .eq("profile_id", profileId)
      .order("likes", { ascending: false });

    if (!posts || posts.length === 0) {
      return { error: "Nenhum post encontrado para analisar" };
    }

    const client = getAIClient();

    // Build context with top posts and DNA breakdown
    const topPosts = posts.slice(0, 10);
    const postsContext = topPosts
      .map(
        (p, i) =>
          `### Post ${i + 1} (${p.likes ?? 0} likes, ${p.comments ?? 0} comments${p.engagement_rate ? `, ${p.engagement_rate}% eng` : ""})
Legenda: ${p.caption_text?.slice(0, 400) || "(sem legenda)"}
DNA: hook=${p.dna_hook_type || "?"}, estrutura=${p.dna_structure || "?"}, tom=${p.dna_tone || "?"}, tema=${p.dna_main_theme || "?"}, tese=${p.dna_thesis || "?"}`,
      )
      .join("\n\n");

    // Compute stats
    const totalPosts = posts.length;
    const avgLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0) / totalPosts;
    const avgComments = posts.reduce((s, p) => s + (p.comments ?? 0), 0) / totalPosts;

    // DNA frequencies
    const hookCounts: Record<string, number> = {};
    const themeCounts: Record<string, number> = {};
    const toneCounts: Record<string, number> = {};
    for (const p of posts) {
      if (p.dna_hook_type) hookCounts[p.dna_hook_type] = (hookCounts[p.dna_hook_type] || 0) + 1;
      if (p.dna_main_theme) themeCounts[p.dna_main_theme] = (themeCounts[p.dna_main_theme] || 0) + 1;
      if (p.dna_tone) toneCounts[p.dna_tone] = (toneCounts[p.dna_tone] || 0) + 1;
    }

    const topHooks = Object.entries(hookCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topTones = Object.entries(toneCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUÊS BRASILEIRO (PT-BR).

Você é o analista de referências do Pedro Rabelo. Sua tarefa é analisar um perfil de referência do Instagram e gerar RECOMENDAÇÕES PRÁTICAS que o Pedro pode aplicar imediatamente no conteúdo dele.

Pedro é criador de conteúdo sobre marketing digital, vendas, gestão e empreendedorismo. Tom: direto, prático, contrário ao senso comum.

## O que você deve entregar:

### 1. O que está funcionando pra esse criador
- Quais tipos de post performam melhor (mais likes/comments)
- Padrões de hook que geram mais engajamento
- Temas que a audiência mais curte

### 2. O que o Pedro pode copiar/adaptar
- Formatos específicos de carrossel ou post
- Estruturas de hook que funcionam
- Tipos de CTA que geram ação
- Frequência e ritmo de postagem

### 3. Ideias concretas de conteúdo
- 3 a 5 ideias ESPECÍFICAS de posts que o Pedro pode criar, inspiradas nos padrões desse perfil
- Cada ideia com: título do post + hook sugerido + formato (carrossel/reel/imagem)

Use markdown com ## para títulos, - para listas, **negrito** para destaque.
Seja DIRETO e PRÁTICO — sem enrolação.`,
      messages: [
        {
          role: "user",
          content: `## Análise do perfil @${profile.handle} (${profile.display_name})

**Estatísticas gerais:**
- ${totalPosts} posts analisados
- Média de ${Math.round(avgLikes)} likes por post
- Média de ${Math.round(avgComments)} comentários por post

**Hooks mais usados:** ${topHooks.map(([h, c]) => `${h} (${c}x)`).join(", ") || "N/A"}
**Temas mais frequentes:** ${topThemes.map(([t, c]) => `${t} (${c}x)`).join(", ") || "N/A"}
**Tons mais usados:** ${topTones.map(([t, c]) => `${t} (${c}x)`).join(", ") || "N/A"}

## Top 10 posts (ordenados por likes):

${postsContext}

Com base nisso, o que o Pedro pode aprender e aplicar?`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    await supabase.from("activity_log").insert({
      actor: "ia",
      action: `Analisou perfil @${profile.handle} para recomendações`,
      entity_type: "reference_profile",
      entity_id: profileId,
      entity_title: profile.display_name,
    });

    return { analysis: text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[AnalyzeProfile] Error:", message);
    return { error: message };
  }
}

// --- Reference Knowledge ---

export async function getKnowledge() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reference_knowledge")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createKnowledge(formData: FormData) {
  const supabase = await createClient();
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const { error } = await supabase.from("reference_knowledge").insert({
    author: (formData.get("author") as string) || null,
    source_type: (formData.get("source_type") as string) || null,
    source_url: (formData.get("source_url") as string) || null,
    title: formData.get("title") as string,
    tags,
    citation_allowed: (formData.get("citation_allowed") as string) || "attributed",
  });
  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteKnowledge(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reference_knowledge")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}
