"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { processCapture } from "@/lib/ai";

const PATH = "/insights-pedro";

// --- Captures ---

export async function getCaptures() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCapture(formData: FormData) {
  const supabase = await createClient();
  const rawContent = (formData.get("raw_content") as string) || null;
  const sourceType = formData.get("source_type") as string;

  const { data: inserted, error } = await supabase
    .from("captures")
    .insert({
      title: formData.get("title") as string,
      context: (formData.get("context") as string) || null,
      source_type: sourceType,
      source_url: (formData.get("source_url") as string) || null,
      raw_content: rawContent,
    })
    .select("id")
    .single();
  if (error) throw error;

  // AI processing (non-blocking — capture is already saved)
  try {
    if (rawContent) {
      const result = await processCapture(rawContent, sourceType);

      if ("error" in result) throw new Error(result.error);

      // Save proposals
      if (result.proposals && result.proposals.length > 0) {
        const proposalRows = result.proposals.map((p) => ({
          ...p,
          capture_id: inserted.id,
        }));
        await supabase.from("proposals").insert(proposalRows);
      }

      // Update capture status
      await supabase
        .from("captures")
        .update({
          status: "processed",
          speaker_verified: result.speaker_verified,
        })
        .eq("id", inserted.id);
    }
  } catch (aiError) {
    // AI failure is non-fatal — the capture remains saved without proposals
    console.error("[AI] processCapture failed:", aiError);
  }

  revalidatePath(PATH);
}

export async function deleteCapture(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("captures").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Proposals ---

export async function getProposalsByCapture(captureId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("capture_id", captureId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateProposalStatus(
  id: string,
  status: "approved" | "rejected"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("proposals")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Activity Log ---

export async function getActivityLog() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}
