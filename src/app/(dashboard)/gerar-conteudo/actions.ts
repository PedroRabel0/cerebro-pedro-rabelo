"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateContent } from "@/lib/ai";
import { generateImageWithGemini } from "@/lib/ai/gemini";
import { generateImageWithDalle } from "@/lib/ai/openai-images";
import { uploadImageToStorage } from "@/lib/supabase/storage";
import type { ContentType } from "@/lib/supabase/types";

const PATH = "/gerar-conteudo";

// --- Content Formats ---

export async function getFormats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_formats")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createFormat(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("content_formats").insert({
    name: formData.get("name") as string,
    content_type: formData.get("content_type") as string,
    description: (formData.get("description") as string) || null,
    structure_markdown: (formData.get("structure_markdown") as string) || null,
  });
  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteFormat(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_formats")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Generated Contents ---

export async function getGeneratedContents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_contents")
    .select(
      "*, playbook:playbooks(id, title), story:stories(id, title), format:content_formats(*)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createGeneratedContent(formData: FormData) {
  const supabase = await createClient();
  const sourceType = formData.get("source_type") as string;
  const playbookId = (formData.get("playbook_id") as string) || null;
  const storyId = (formData.get("story_id") as string) || null;
  const freeTextInput = (formData.get("free_text_input") as string) || null;
  const contentType = formData.get("content_type") as string;
  const formatId = (formData.get("format_id") as string) || null;

  const { data: inserted, error } = await supabase
    .from("generated_contents")
    .insert({
      source_type: sourceType,
      playbook_id: playbookId,
      story_id: storyId,
      free_text_input: freeTextInput,
      content_type: contentType,
      format_id: formatId,
      content_text:
        "Geração de conteúdo pendente — integração com IA em breve",
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;

  // AI generation (non-blocking — record is already saved)
  try {
    // Fetch supporting data for AI
    const [identityRes, playbookRes, storyRes, formatRes, feedbackRes] =
      await Promise.all([
        supabase.from("identity").select("*").limit(1).single(),
        playbookId
          ? supabase.from("playbooks").select("*").eq("id", playbookId).single()
          : Promise.resolve({ data: null }),
        storyId
          ? supabase.from("stories").select("*").eq("id", storyId).single()
          : Promise.resolve({ data: null }),
        formatId
          ? supabase
              .from("content_formats")
              .select("*")
              .eq("id", formatId)
              .single()
          : Promise.resolve({ data: null }),
        supabase
          .from("generated_contents")
          .select("feedback_text, feedback_rating")
          .not("feedback_text", "is", null)
          .eq("feedback_rating", "bad")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const result = await generateContent({
      identity: identityRes.data,
      playbook: playbookRes.data,
      story: storyRes.data,
      format: formatRes.data,
      freeText: freeTextInput ?? undefined,
      contentType,
      recentFeedbacks: feedbackRes.data ?? [],
    });

    if (!("error" in result)) {
      await supabase
        .from("generated_contents")
        .update({
          content_text: result.content_text,
          source_map: result.source_map,
        })
        .eq("id", inserted.id);

      // Generate image (Nano Banana Pro first, fallback to GPT Image)
      try {
        let imageResult = await generateImageWithGemini(
          result.content_text,
          contentType
        );

        // Fallback to GPT Image if Nano Banana fails
        if ("error" in imageResult) {
          console.log("[AI] Nano Banana failed, trying GPT Image...", imageResult.error);
          imageResult = await generateImageWithDalle(
            result.content_text,
            contentType
          );
        }

        if (!("error" in imageResult)) {
          // Upload to Supabase Storage; fall back to original URL on failure
          const storageUrl = await uploadImageToStorage(
            imageResult.image_url,
            inserted.id
          );

          await supabase
            .from("generated_contents")
            .update({
              image_url: storageUrl ?? imageResult.image_url,
              image_prompt: imageResult.image_prompt,
              image_model: imageResult.image_model,
            })
            .eq("id", inserted.id);
        } else {
          console.log("[AI] Image generation failed:", imageResult.error);
        }
      } catch (imgError) {
        console.error("[AI] Image generation error:", imgError);
      }
    }
  } catch (aiError) {
    console.error("[AI] generateContent failed:", aiError);
  }

  revalidatePath(PATH);
}

export async function createQuickContent(
  formData: FormData
): Promise<{ content: string; id: string } | { error: string }> {
  const supabase = await createClient();
  const topic = formData.get("topic") as string;
  const contentType = formData.get("content_type") as string;

  if (!topic || !contentType) {
    return { error: "Topico e tipo de conteudo sao obrigatorios." };
  }

  try {
    // Fetch identity, all playbooks, all stories in parallel
    const [identityRes, playbooksRes, storiesRes, feedbackRes] =
      await Promise.all([
        supabase.from("identity").select("*").limit(1).single(),
        supabase
          .from("playbooks")
          .select("id, title, body_markdown")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("stories")
          .select("id, title, summary, body_markdown")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("generated_contents")
          .select("feedback_text, feedback_rating")
          .not("feedback_text", "is", null)
          .eq("feedback_rating", "bad")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    // Pick top 3 playbooks relevant to the topic (simple keyword match, fallback to first 3)
    const allPlaybooks = playbooksRes.data ?? [];
    const topicLower = topic.toLowerCase();
    const relevantPlaybooks = allPlaybooks
      .filter(
        (p) =>
          p.title.toLowerCase().includes(topicLower) ||
          topicLower.split(" ").some((w: string) => w.length > 3 && p.title.toLowerCase().includes(w))
      )
      .slice(0, 3);
    const selectedPlaybooks =
      relevantPlaybooks.length > 0
        ? relevantPlaybooks
        : allPlaybooks.slice(0, 3);

    // Pick top 2 stories relevant to the topic
    const allStories = storiesRes.data ?? [];
    const relevantStories = allStories
      .filter(
        (s) =>
          s.title.toLowerCase().includes(topicLower) ||
          (s.summary && s.summary.toLowerCase().includes(topicLower)) ||
          topicLower.split(" ").some((w) => w.length > 3 && s.title.toLowerCase().includes(w))
      )
      .slice(0, 2);
    const selectedStories =
      relevantStories.length > 0
        ? relevantStories
        : allStories.slice(0, 2);

    // Build playbook context
    const playbookContext = selectedPlaybooks
      .map(
        (p) =>
          `### ${p.title}\n${(p.body_markdown || "").slice(0, 1500)}`
      )
      .join("\n\n");

    // Build story context
    const storyContext = selectedStories
      .map(
        (s) =>
          `### ${s.title}\n${s.summary || ""}\n${(s.body_markdown || "").slice(0, 1000)}`
      )
      .join("\n\n");

    // Use the existing generateContent function with constructed inputs
    const result = await generateContent({
      identity: identityRes.data,
      playbook: selectedPlaybooks[0]
        ? {
            id: selectedPlaybooks[0].id,
            title: selectedPlaybooks[0].title,
            body_markdown: selectedPlaybooks[0].body_markdown,
            subtitle: null,
            completeness_score: 0,
            has_example: false,
            has_story: false,
            has_origin: false,
            has_counterexample: false,
            version_current: null,
            version_previous: null,
            created_by: null,
            created_at: "",
            updated_at: "",
            theme_id: null,
          }
        : undefined,
      story: selectedStories[0]
        ? {
            id: selectedStories[0].id,
            title: selectedStories[0].title,
            summary: selectedStories[0].summary,
            body_markdown: selectedStories[0].body_markdown,
            period: null,
            tags: [],
            lesson: null,
            version_current: null,
            version_previous: null,
            created_by: null,
            created_at: "",
            updated_at: "",
          }
        : undefined,
      contentType,
      freeText: `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUES BRASILEIRO (PT-BR).

TOPICO SOLICITADO: ${topic}

CONTEXTO ADICIONAL DA BASE DE CONHECIMENTO:

## Playbooks Relevantes:
${playbookContext || "Nenhum playbook encontrado."}

## Historias Relevantes:
${storyContext || "Nenhuma historia encontrada."}

INSTRUCAO: Gere um conteudo PRONTO PARA POSTAR sobre o topico acima. Use as informacoes dos playbooks e historias como base. O conteudo deve ser direto, pratico e refletir o tom e voz da identidade fornecida.`,
      recentFeedbacks: feedbackRes.data ?? [],
    });

    if ("error" in result) {
      return { error: result.error };
    }

    // Save to database
    const { data: inserted, error: insertError } = await supabase
      .from("generated_contents")
      .insert({
        source_type: "free_text" as const,
        playbook_id: selectedPlaybooks[0]?.id || null,
        story_id: selectedStories[0]?.id || null,
        free_text_input: topic,
        content_type: contentType,
        format_id: null,
        content_text: result.content_text,
        source_map: result.source_map,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Generate image in background (Nano Banana Pro first, GPT Image fallback)
    try {
      const imageResult = await generateImageWithGemini(
        result.content_text,
        contentType
      );

      if (!("error" in imageResult)) {
        const storageUrl = await uploadImageToStorage(
          imageResult.image_url,
          inserted.id
        );
        await supabase
          .from("generated_contents")
          .update({
            image_url: storageUrl ?? imageResult.image_url,
            image_prompt: imageResult.image_prompt,
            image_model: imageResult.image_model,
          })
          .eq("id", inserted.id);
      } else {
        // Fallback to GPT Image
        const dalleResult = await generateImageWithDalle(
          result.content_text,
          contentType
        );
        if (!("error" in dalleResult)) {
          const storageUrl = await uploadImageToStorage(
            dalleResult.image_url,
            inserted.id
          );
          await supabase
            .from("generated_contents")
            .update({
              image_url: storageUrl ?? dalleResult.image_url,
              image_prompt: dalleResult.image_prompt,
              image_model: dalleResult.image_model,
            })
            .eq("id", inserted.id);
        }
      }
    } catch (imgError) {
      console.error("[AI] Image generation error:", imgError);
    }

    revalidatePath(PATH);

    return {
      content: result.content_text,
      id: inserted.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[QuickContent] Error:", message);
    return { error: `Falha ao gerar conteudo: ${message}` };
  }
}

export async function updateContentStatus(
  id: string,
  status: string,
  feedbackRating?: string,
  feedbackText?: string
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = { status };
  if (feedbackRating !== undefined) update.feedback_rating = feedbackRating;
  if (feedbackText !== undefined) update.feedback_text = feedbackText;

  const { error } = await supabase
    .from("generated_contents")
    .update(update)
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteContent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("generated_contents")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Lookup data ---

export async function getPlaybooks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbooks")
    .select("id, title")
    .order("title");
  if (error) throw error;
  return data;
}

export async function getStories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("id, title")
    .order("title");
  if (error) throw error;
  return data;
}

export async function getThemes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

// --- Wizard Content Generation ---

export interface WizardPayload {
  source: string;
  topicMode: string;
  playbookId?: string;
  storyId?: string;
  freeTopic?: string;
  recorte?: string;
  pullStory: string;
  pullStoryId?: string;
  audience?: string;
  extraContext?: string;
  contentTypes: string[];
  typeDetails: Record<string, Record<string, string>>;
}

export interface WizardResult {
  id: string;
  contentType: ContentType;
  content: string;
  sourceMap: Record<string, unknown> | null;
}

export async function createWizardContent(
  payload: WizardPayload
): Promise<{ results: WizardResult[] } | { error: string }> {
  const supabase = await createClient();

  if (!payload.contentTypes || payload.contentTypes.length === 0) {
    return { error: "Selecione pelo menos um tipo de conteudo." };
  }

  try {
    // Fetch identity, playbook, stories in parallel
    const playbookId = payload.playbookId || null;
    const storyId = payload.storyId || payload.pullStoryId || null;

    const [identityRes, playbooksRes, storiesRes, feedbackRes, playbookRes, storyRes] =
      await Promise.all([
        supabase.from("identity").select("*").limit(1).single(),
        supabase
          .from("playbooks")
          .select("id, title, body_markdown")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("stories")
          .select("id, title, summary, body_markdown")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("generated_contents")
          .select("feedback_text, feedback_rating")
          .not("feedback_text", "is", null)
          .eq("feedback_rating", "bad")
          .order("created_at", { ascending: false })
          .limit(5),
        playbookId
          ? supabase.from("playbooks").select("*").eq("id", playbookId).single()
          : Promise.resolve({ data: null }),
        storyId
          ? supabase.from("stories").select("*").eq("id", storyId).single()
          : Promise.resolve({ data: null }),
      ]);

    // Fetch reference posts when source is "both" or "references_only"
    let referenceContext = "";
    if (payload.source !== "base_only") {
      const { data: refPosts } = await supabase
        .from("reference_posts")
        .select("caption_text, profile_id, dna_hook_type, dna_structure, dna_main_theme")
        .order("posted_at", { ascending: false })
        .limit(10);

      // Fetch profile info for attribution
      let profileMap: Record<string, string> = {};
      if (refPosts && refPosts.length > 0) {
        const profileIds = [...new Set(refPosts.map((p) => p.profile_id).filter(Boolean))];
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from("reference_profiles")
            .select("id, display_name, handle")
            .in("id", profileIds);
          if (profiles) {
            profileMap = Object.fromEntries(
              profiles.map((p) => [p.id, `@${p.handle || p.display_name}`])
            );
          }
        }
      }

      if (refPosts && refPosts.length > 0) {
        referenceContext = refPosts
          .map((p) => {
            const handle = profileMap[p.profile_id] || "desconhecido";
            const dna = [p.dna_hook_type, p.dna_structure, p.dna_main_theme]
              .filter(Boolean)
              .join(" | ");
            const caption = (p.caption_text || "").slice(0, 800);
            return `### Ref: ${handle}${dna ? ` (${dna})` : ""}\n${caption}`;
          })
          .join("\n\n");
      }
    }

    // Build context from knowledge base
    const allPlaybooks = playbooksRes.data ?? [];
    const allStories = storiesRes.data ?? [];

    const topicText = payload.freeTopic || playbookRes.data?.title || "conteudo";
    const topicLower = topicText.toLowerCase();

    // Pick relevant playbooks
    const relevantPlaybooks = playbookId
      ? allPlaybooks.filter((p) => p.id === playbookId)
      : allPlaybooks
          .filter(
            (p) =>
              p.title.toLowerCase().includes(topicLower) ||
              topicLower
                .split(" ")
                .some((w: string) => w.length > 3 && p.title.toLowerCase().includes(w))
          )
          .slice(0, 3);
    const selectedPlaybooks =
      relevantPlaybooks.length > 0
        ? relevantPlaybooks
        : allPlaybooks.slice(0, 3);

    // Pick relevant stories
    let selectedStories: typeof allStories = [];
    if (storyId) {
      selectedStories = allStories.filter((s) => s.id === storyId);
    } else if (payload.pullStory === "no") {
      selectedStories = [];
    } else {
      const relevant = allStories
        .filter(
          (s) =>
            s.title.toLowerCase().includes(topicLower) ||
            (s.summary && s.summary.toLowerCase().includes(topicLower)) ||
            topicLower
              .split(" ")
              .some((w: string) => w.length > 3 && s.title.toLowerCase().includes(w))
        )
        .slice(0, 2);
      selectedStories = relevant.length > 0 ? relevant : allStories.slice(0, 2);
    }

    // Build context strings
    const playbookContext = selectedPlaybooks
      .map((p) => `### ${p.title}\n${(p.body_markdown || "").slice(0, 1500)}`)
      .join("\n\n");

    const storyContext = selectedStories
      .map(
        (s) =>
          `### ${s.title}\n${s.summary || ""}\n${(s.body_markdown || "").slice(0, 1000)}`
      )
      .join("\n\n");

    // Generate content for each selected type
    const results: WizardResult[] = [];

    for (const contentType of payload.contentTypes) {
      const details = payload.typeDetails[contentType] || {};

      // Build type-specific instructions
      let typeInstructions = "";
      switch (contentType) {
        case "instagram_carousel":
          typeInstructions = `FORMATO: Instagram Carousel
- Objetivo: ${details.objetivo || "educar"}
- Numero de slides: ${details.num_slides || "6"}
- Slide 1 deve ser um GANCHO que prende atencao${details.gancho ? `: "${details.gancho}"` : ""}
- Ultimo slide deve ter CTA${details.cta ? `: "${details.cta}"` : ""}
- Imagem de capa: ${details.imagem_capa || "capa com frase"}
Gere o texto de CADA slide separadamente, numerando-os.`;
          break;
        case "linkedin_post":
          typeInstructions = `FORMATO: LinkedIn Post
- Objetivo: ${details.objetivo || "educar"}
- Tamanho: ${details.tamanho || "medio"} (curto <100 palavras, medio 100-250, longo 250-500)
- Abertura: ${details.abertura || "cena"}
- Quebras de linha: ${details.quebras || "medio"}
- Hashtags: ${details.hashtags || "2-3"}
- CTA: ${details.cta || "incluir CTA natural"}
- Imagem: ${details.imagem || "sim"}`;
          break;
        case "x_thread":
          typeInstructions = `FORMATO: X Thread
- Objetivo: ${details.objetivo || "educar"}
- Tweet 1 (tese)${details.tese ? `: "${details.tese}"` : ": defina uma tese forte"}
- Numero de tweets: ${details.num_tweets || "5"}
- Ultimo tweet: CTA${details.cta ? `: "${details.cta}"` : ""}
Gere cada tweet separadamente, numerando-os. Max 280 chars por tweet.`;
          break;
        case "x_tweet":
          typeInstructions = `FORMATO: X Tweet (single tweet)
- Objetivo: ${details.objetivo || "educar"}
- Tom: ${details.tom || "provocativo"}
Max 280 caracteres.`;
          break;
        case "instagram_reel":
          typeInstructions = `FORMATO: Instagram Reels (roteiro)
- Objetivo: ${details.objetivo || "educar"}
- Duracao: ${details.duracao || "30-60s"}
- Quem aparece: ${details.quem_aparece || "voce"}
- Gancho 3s${details.gancho ? `: "${details.gancho}"` : ": crie um gancho forte"}
- Energia/Tom: ${details.energia || "alta"}
- CTA: ${details.cta || "incluir CTA"}
Gere um ROTEIRO com marcacoes de tempo e instrucoes de gravacao.`;
          break;
        case "youtube_long":
          typeInstructions = `FORMATO: YouTube Longo (roteiro)
- Objetivo: ${details.objetivo || "ensinar"}
- Duracao: ${details.duracao || "8-12min"}
- Gancho 15s${details.gancho ? `: "${details.gancho}"` : ": crie abertura forte"}
- Promessa explicita: ${details.promessa || "definir promessa clara"}
- Estrutura: ${details.estrutura || "narrativa"}
- Inclui historia pessoal: ${details.inclui_historia || "sim"}
- CTA: ${details.cta || "incluir CTA"}
Gere um ROTEIRO com secoes, marcacoes de tempo e pontos-chave.`;
          break;
        case "youtube_short":
          typeInstructions = `FORMATO: YouTube Short (roteiro)
- Objetivo: ${details.objetivo || "educar"}
- Gancho 3s${details.gancho ? `: "${details.gancho}"` : ": crie um gancho forte"}
- Energia: ${details.energia || "alta"}
- CTA: ${details.cta || "incluir CTA"}
Roteiro curto e direto, max 60 segundos.`;
          break;
        case "instagram_static":
          typeInstructions = `FORMATO: Instagram Estatico (post com imagem)
- Objetivo: ${details.objetivo || "educar"}
- Texto do post${details.texto_post ? `: "${details.texto_post}"` : ""}
- CTA: ${details.cta || "incluir CTA"}
- Imagem: ${details.imagem || "frase"}
Gere a legenda completa do post.`;
          break;
      }

      // Build source-specific instructions
      let sourceInstructions = "";
      if (payload.source === "both") {
        sourceInstructions = `
## REGRAS DE FONTE (MODO AMBOS - Pedro + Terceiros):
- Use o conteudo do Pedro (playbooks, historias) como BASE PRINCIPAL e espinha dorsal
- Use referencias externas apenas como complemento, inspiracao ou contraponto
- Sempre que usar insight de terceiros, cite a fonte: [Ref: @handle]
- O conteudo final deve soar 100% como Pedro, nunca como copia de terceiros
- A voz, tom e estilo sao SEMPRE do Pedro — referencias sao apenas tempero`;
      } else if (payload.source === "references_only") {
        sourceInstructions = `
## REGRAS DE FONTE (MODO REFERENCIAS):
- Use as referencias externas como inspiracao principal
- Adapte completamente para a voz e tom do Pedro
- Cite as fontes quando relevante: [Ref: @handle]
- O conteudo final deve parecer 100% Pedro, mesmo baseado em referencias`;
      }

      const freeTextPrompt = `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUES BRASILEIRO (PT-BR).

TOPICO: ${topicText}
${payload.recorte ? `RECORTE ESPECIFICO: ${payload.recorte}` : ""}
${payload.audience ? `PUBLICO-ALVO: ${payload.audience}` : ""}
${payload.extraContext ? `CONTEXTO EXTRA: ${payload.extraContext}` : ""}
${sourceInstructions}

${typeInstructions}

CONTEXTO DA BASE DE CONHECIMENTO DO PEDRO:

## Playbooks Relevantes:
${playbookContext || "Nenhum playbook encontrado."}

## Historias Relevantes:
${storyContext || "Nenhuma historia encontrada."}
${referenceContext ? `
## Referencias Externas (terceiros):
${referenceContext}
` : ""}
INSTRUCAO: Gere um conteudo PRONTO PARA POSTAR. Use as informacoes dos playbooks e historias como base. O conteudo deve ser direto, pratico e refletir o tom e voz da identidade fornecida.`;

      const result = await generateContent({
        identity: identityRes.data,
        playbook: playbookRes.data
          ? {
              id: playbookRes.data.id,
              title: playbookRes.data.title,
              body_markdown: playbookRes.data.body_markdown,
              subtitle: null,
              completeness_score: 0,
              has_example: false,
              has_story: false,
              has_origin: false,
              has_counterexample: false,
              version_current: null,
              version_previous: null,
              created_by: null,
              created_at: "",
              updated_at: "",
              theme_id: null,
            }
          : selectedPlaybooks[0]
            ? {
                id: selectedPlaybooks[0].id,
                title: selectedPlaybooks[0].title,
                body_markdown: selectedPlaybooks[0].body_markdown,
                subtitle: null,
                completeness_score: 0,
                has_example: false,
                has_story: false,
                has_origin: false,
                has_counterexample: false,
                version_current: null,
                version_previous: null,
                created_by: null,
                created_at: "",
                updated_at: "",
                theme_id: null,
              }
            : undefined,
        story: storyRes.data
          ? {
              id: storyRes.data.id,
              title: storyRes.data.title,
              summary: storyRes.data.summary,
              body_markdown: storyRes.data.body_markdown,
              period: null,
              tags: [],
              lesson: null,
              version_current: null,
              version_previous: null,
              created_by: null,
              created_at: "",
              updated_at: "",
            }
          : selectedStories[0]
            ? {
                id: selectedStories[0].id,
                title: selectedStories[0].title,
                summary: selectedStories[0].summary,
                body_markdown: selectedStories[0].body_markdown,
                period: null,
                tags: [],
                lesson: null,
                version_current: null,
                version_previous: null,
                created_by: null,
                created_at: "",
                updated_at: "",
              }
            : undefined,
        contentType,
        freeText: freeTextPrompt,
        recentFeedbacks: feedbackRes.data ?? [],
      });

      if ("error" in result) {
        return { error: result.error };
      }

      // Save to DB
      const { data: inserted, error: insertError } = await supabase
        .from("generated_contents")
        .insert({
          source_type: payload.source as "base_only" | "references_only" | "both" | "free_text",
          playbook_id: playbookId || selectedPlaybooks[0]?.id || null,
          story_id: storyId || selectedStories[0]?.id || null,
          free_text_input: payload.freeTopic || null,
          content_type: contentType,
          format_id: null,
          content_text: result.content_text,
          source_map: result.source_map,
          generation_params: {
            wizard: true,
            details,
            audience: payload.audience,
            recorte: payload.recorte,
            pullStory: payload.pullStory,
          },
          status: "draft",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      results.push({
        id: inserted.id,
        contentType: contentType as ContentType,
        content: result.content_text,
        sourceMap: result.source_map,
      });

      // Generate image in background (non-blocking, fire and forget)
      generateImageForContent(result.content_text, contentType, inserted.id).catch(
        (e) => console.error("[AI] Image generation error:", e)
      );
    }

    revalidatePath(PATH);

    return { results };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[WizardContent] Error:", message);
    return { error: `Falha ao gerar conteudo: ${message}` };
  }
}

// Helper to generate images in background
async function generateImageForContent(
  contentText: string,
  contentType: string,
  contentId: string
) {
  const supabase = await createClient();

  // Nano Banana Pro primeiro, GPT Image como fallback
  let imageResult = await generateImageWithGemini(contentText, contentType);

  if ("error" in imageResult) {
    console.log("[AI] Nano Banana failed, trying GPT Image...", imageResult.error);
    imageResult = await generateImageWithDalle(contentText, contentType);
  }

  if (!("error" in imageResult)) {
    const storageUrl = await uploadImageToStorage(
      imageResult.image_url,
      contentId
    );
    await supabase
      .from("generated_contents")
      .update({
        image_url: storageUrl ?? imageResult.image_url,
        image_prompt: imageResult.image_prompt,
        image_model: imageResult.image_model,
      })
      .eq("id", contentId);
  }

  revalidatePath(PATH);
}

export async function savePublishedUrl(contentId: string, url: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("generated_contents")
    .update({ published_url: url, status: "published" })
    .eq("id", contentId);
  if (error) throw error;
  revalidatePath(PATH);
}

export async function updateContentText(id: string, text: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("generated_contents")
    .update({ content_text: text })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}
