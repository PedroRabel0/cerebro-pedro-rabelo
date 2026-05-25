"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const PATH = "/referencias";

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
  const { error } = await supabase.from("reference_profiles").insert({
    platform: formData.get("platform") as string,
    handle: formData.get("handle") as string,
    display_name: formData.get("display_name") as string,
    active: formData.get("active") === "on",
  });
  if (error) throw error;
  revalidatePath(PATH);
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
    .order("created_at", { ascending: false });
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
    likes: Number(formData.get("likes")) || null,
    comments: Number(formData.get("comments")) || null,
    shares: Number(formData.get("shares")) || null,
    saves: Number(formData.get("saves")) || null,
    hook_type: (formData.get("hook_type") as string) || null,
    structure: (formData.get("structure") as string) || null,
    length: (formData.get("length") as string) || null,
    tone: (formData.get("tone") as string) || null,
    cta_type: (formData.get("cta_type") as string) || null,
    main_theme: (formData.get("main_theme") as string) || null,
    sub_theme: (formData.get("sub_theme") as string) || null,
    thesis: (formData.get("thesis") as string) || null,
    saved_as_reference: formData.get("saved_as_reference") === "on",
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
    citation_allowed: formData.get("citation_allowed") === "on",
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
