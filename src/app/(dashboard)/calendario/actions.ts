"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const PATH = "/calendario";

// --- Calendar Entries ---

export async function getCalendarEntries(startDate?: string, endDate?: string) {
  const supabase = await createClient();

  // Default to current month if no range provided
  const now = new Date();
  const start =
    startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end =
    endDate ||
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from("calendar_entries")
    .select("*, content:generated_contents(id, content_text, content_type, status, image_url)")
    .gte("scheduled_for", start)
    .lte("scheduled_for", end)
    .order("scheduled_for", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createCalendarEntry(data: {
  contentId?: string;
  title: string;
  contentType: string;
  scheduledFor: string;
  platform: string;
  notes?: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("calendar_entries").insert({
    content_id: data.contentId || null,
    title: data.title,
    content_type: data.contentType,
    scheduled_for: data.scheduledFor,
    platform: data.platform,
    notes: data.notes || null,
  });

  if (error) throw error;
  revalidatePath(PATH);
}

export async function updateCalendarEntry(
  id: string,
  data: Partial<{
    title: string;
    scheduledFor: string;
    status: string;
    notes: string;
  }>
) {
  const supabase = await createClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) update.title = data.title;
  if (data.scheduledFor !== undefined) update.scheduled_for = data.scheduledFor;
  if (data.status !== undefined) update.status = data.status;
  if (data.notes !== undefined) update.notes = data.notes;

  const { error } = await supabase
    .from("calendar_entries")
    .update(update)
    .eq("id", id);

  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteCalendarEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

export async function getUnscheduledContents() {
  const supabase = await createClient();

  // Fetch generated contents that have NO calendar entry linked, with status draft or approved
  const { data: allContents, error: contentsError } = await supabase
    .from("generated_contents")
    .select("id, content_type, content_text, status, created_at")
    .in("status", ["draft", "approved"])
    .order("created_at", { ascending: false });

  if (contentsError) throw contentsError;

  // Fetch all content_ids that already have calendar entries
  const { data: scheduled, error: scheduledError } = await supabase
    .from("calendar_entries")
    .select("content_id")
    .not("content_id", "is", null);

  if (scheduledError) throw scheduledError;

  const scheduledIds = new Set(
    (scheduled || []).map((e: { content_id: string | null }) => e.content_id)
  );

  // Filter out already-scheduled contents
  return (allContents || []).filter((c) => !scheduledIds.has(c.id));
}

export async function scheduleContentFromDraft(
  contentId: string,
  scheduledFor: string
) {
  const supabase = await createClient();

  // Fetch the content to get its type and text for the title
  const { data: content, error: fetchError } = await supabase
    .from("generated_contents")
    .select("id, content_type, content_text")
    .eq("id", contentId)
    .single();

  if (fetchError) throw fetchError;

  // Derive platform from content type
  const platform = getPlatform(content.content_type);

  // Build a title from the content text (first 60 chars)
  const title =
    (content.content_text || "Conteudo sem titulo").slice(0, 60).trim() + "...";

  const { error } = await supabase.from("calendar_entries").insert({
    content_id: contentId,
    title,
    content_type: content.content_type,
    scheduled_for: scheduledFor,
    platform,
  });

  if (error) throw error;
  revalidatePath(PATH);
}

// Helper: derive platform from content type
function getPlatform(contentType: string): string {
  if (contentType.startsWith("instagram")) return "instagram";
  if (contentType.startsWith("youtube")) return "youtube";
  if (contentType.startsWith("linkedin")) return "linkedin";
  if (contentType.startsWith("x_")) return "x";
  return "instagram";
}
