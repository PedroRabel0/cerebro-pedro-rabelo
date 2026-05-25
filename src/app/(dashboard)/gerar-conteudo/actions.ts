"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  const { error } = await supabase.from("generated_contents").insert({
    source_type: sourceType,
    playbook_id: (formData.get("playbook_id") as string) || null,
    story_id: (formData.get("story_id") as string) || null,
    free_text_input: (formData.get("free_text_input") as string) || null,
    content_type: formData.get("content_type") as string,
    format_id: (formData.get("format_id") as string) || null,
    content_text:
      "Geração de conteúdo pendente — integração com IA em breve",
    status: "draft",
  });
  if (error) throw error;
  revalidatePath(PATH);
}

export async function updateContentStatus(
  id: string,
  status: string,
  feedbackRating?: number,
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
