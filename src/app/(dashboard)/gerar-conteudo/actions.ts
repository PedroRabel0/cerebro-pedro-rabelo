"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateContent } from "@/lib/ai";
import { generateImageWithGemini } from "@/lib/ai/gemini";
import { generateImageWithDalle } from "@/lib/ai/openai-images";
import { uploadImageToStorage } from "@/lib/supabase/storage";

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

      // Generate image (Gemini first, fallback to DALL-E)
      try {
        let imageResult = await generateImageWithGemini(
          result.content_text,
          contentType
        );

        // Fallback to DALL-E if Gemini fails
        if ("error" in imageResult) {
          console.log("[AI] Gemini image failed, trying DALL-E...", imageResult.error);
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
          topicLower.split(" ").some((w) => w.length > 3 && p.title.toLowerCase().includes(w))
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

    // Generate image in background (non-blocking)
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
        // Fallback to DALL-E
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
