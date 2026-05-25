"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  const { error } = await supabase.from("playbooks").insert({
    title: formData.get("title") as string,
    subtitle: (formData.get("subtitle") as string) || null,
    theme_id: (formData.get("theme_id") as string) || null,
    body_markdown: (formData.get("body_markdown") as string) || null,
  });
  if (error) throw error;
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
  });
  if (error) throw error;
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

export async function deleteStory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}
