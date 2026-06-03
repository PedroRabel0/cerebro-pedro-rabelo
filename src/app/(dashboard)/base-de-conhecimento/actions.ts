"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { analyzeCompleteness, generateBookQuestions } from "@/lib/ai";

// --- Themes ---

export async function getThemes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createTheme(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("themes").insert({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    color: (formData.get("color") as string) || "#3a5a7a",
  });
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function deleteTheme(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("themes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

// --- Playbooks ---

export async function getPlaybooks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbooks")
    .select("*, theme:themes(*)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPlaybook(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbooks")
    .select("*, theme:themes(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPlaybook(formData: FormData) {
  const supabase = await createClient();
  const createdBy = (formData.get("created_by") as string) || "pedro";
  const { error } = await supabase.from("playbooks").insert({
    title: formData.get("title") as string,
    subtitle: (formData.get("subtitle") as string) || null,
    theme_id: (formData.get("theme_id") as string) || null,
    body_markdown: (formData.get("body_markdown") as string) || null,
    created_by: createdBy,
  });
  if (error) throw error;

  // Log activity with proper attribution
  await supabase.from("activity_log").insert({
    actor: createdBy as "pedro" | "henrique",
    action: `Criou playbook: "${formData.get("title")}"`,
    entity_type: "playbook",
    entity_title: formData.get("title") as string,
  });

  revalidatePath("/base-de-conhecimento");
}

export async function updatePlaybook(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("playbooks")
    .update({
      title: formData.get("title") as string,
      subtitle: (formData.get("subtitle") as string) || null,
      theme_id: (formData.get("theme_id") as string) || null,
      body_markdown: (formData.get("body_markdown") as string) || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function togglePlaybookOrigin(id: string, newOrigin: "pedro" | "outros") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("playbooks")
    .update({ created_by: newOrigin })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function deletePlaybook(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("playbooks").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

// --- Stories ---

export async function getStories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getStory(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createStory(formData: FormData) {
  const supabase = await createClient();
  const createdBy = (formData.get("created_by") as string) || "pedro";
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase.from("stories").insert({
    title: formData.get("title") as string,
    summary: (formData.get("summary") as string) || null,
    body_markdown: (formData.get("body_markdown") as string) || null,
    period: (formData.get("period") as string) || null,
    tags,
    lesson: (formData.get("lesson") as string) || null,
    created_by: createdBy,
  });
  if (error) throw error;

  // Log activity with proper attribution
  await supabase.from("activity_log").insert({
    actor: createdBy as "pedro" | "henrique",
    action: `Criou história: "${formData.get("title")}"`,
    entity_type: "story",
    entity_title: formData.get("title") as string,
  });

  revalidatePath("/base-de-conhecimento");
}

export async function updateStory(id: string, formData: FormData) {
  const supabase = await createClient();
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from("stories")
    .update({
      title: formData.get("title") as string,
      summary: (formData.get("summary") as string) || null,
      body_markdown: (formData.get("body_markdown") as string) || null,
      period: (formData.get("period") as string) || null,
      tags,
      lesson: (formData.get("lesson") as string) || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function toggleStoryOrigin(id: string, newOrigin: "pedro" | "outros") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stories")
    .update({ created_by: newOrigin })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function deleteStory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

// --- Playbook Completeness Analysis ---

export async function analyzePlaybookCompleteness(id: string) {
  const supabase = await createClient();
  const { data: playbook, error } = await supabase
    .from("playbooks")
    .select("*, theme:themes(*)")
    .eq("id", id)
    .single();
  if (error) throw error;

  try {
    const result = await analyzeCompleteness(playbook);

    if ("error" in result) {
      throw new Error(result.error);
    }

    await supabase
      .from("playbooks")
      .update({
        completeness_score: result.completeness_score,
        has_example: result.has_example,
        has_story: result.has_story,
        has_origin: result.has_origin,
        has_counterexample: result.has_counterexample,
      })
      .eq("id", id);

    revalidatePath("/base-de-conhecimento");
    return result;
  } catch (aiError) {
    console.error("[AI] analyzeCompleteness failed:", aiError);
    throw new Error("Falha ao analisar completude do playbook");
  }
}

// --- Book Questions ---

export async function getBookQuestions(playbookId: string) {
  const supabase = await createClient();
  const { data: playbook, error } = await supabase
    .from("playbooks")
    .select("*, theme:themes(*)")
    .eq("id", playbookId)
    .single();
  if (error) throw error;

  const result = await generateBookQuestions(playbook);

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result;
}

export async function saveQuestionAnswer(
  playbookId: string,
  questionText: string,
  answer: string
) {
  const supabase = await createClient();
  const { data: playbook, error } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", playbookId)
    .single();
  if (error) throw error;

  // Append answer to body_markdown
  const existingBody = playbook.body_markdown || "";
  const section = `\n\n---\n\n**P:** ${questionText}\n\n**R:** ${answer}`;
  const updatedBody = existingBody + section;

  await supabase
    .from("playbooks")
    .update({ body_markdown: updatedBody })
    .eq("id", playbookId);

  // Re-analyze completeness
  const completenessResult = await analyzeCompleteness({ ...playbook, body_markdown: updatedBody });
  if (!("error" in completenessResult)) {
    await supabase
      .from("playbooks")
      .update({
        completeness_score: completenessResult.completeness_score,
        has_example: completenessResult.has_example,
        has_story: completenessResult.has_story,
        has_origin: completenessResult.has_origin,
        has_counterexample: completenessResult.has_counterexample,
      })
      .eq("id", playbookId);
  }

  revalidatePath("/base-de-conhecimento");

  // Return updated playbook
  const { data: updated } = await supabase
    .from("playbooks")
    .select("*, theme:themes(*)")
    .eq("id", playbookId)
    .single();
  return updated;
}
