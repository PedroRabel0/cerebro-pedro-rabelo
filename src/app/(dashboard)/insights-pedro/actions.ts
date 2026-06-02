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

export async function approveProposal(
  proposalId: string,
  origin: "pedro" | "outros" = "pedro"
) {
  const supabase = await createClient();

  // 1. Read the proposal
  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (fetchError || !proposal) throw fetchError || new Error("Proposal not found");

  // 2. Create the corresponding item in the knowledge base
  const createdBy = origin === "pedro" ? "pedro" : "outros";

  if (proposal.type === "playbook") {
    const { error: insertError } = await supabase.from("playbooks").insert({
      title: proposal.title,
      body_markdown: proposal.content_markdown,
      completeness_score: 0,
      has_example: false,
      has_story: false,
      has_origin: false,
      has_counterexample: false,
      created_by: createdBy,
    });
    if (insertError) throw insertError;
  } else if (proposal.type === "story") {
    const { error: insertError } = await supabase.from("stories").insert({
      title: proposal.title,
      body_markdown: proposal.content_markdown,
      tags: proposal.suggested_tags || [],
      created_by: createdBy,
    });
    if (insertError) throw insertError;
  }

  // 3. Update proposal status
  const { error: updateError } = await supabase
    .from("proposals")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (updateError) throw updateError;

  // 4. Log activity
  const originLabel = origin === "pedro" ? "Pedro" : "Outros";
  await supabase.from("activity_log").insert({
    actor: "pedro",
    action: `Aprovou proposta de ${proposal.type} como ${originLabel}: "${proposal.title}"`,
    entity_type: "proposal",
    entity_id: proposalId,
    entity_title: proposal.title,
  });

  // 5. Revalidate paths
  revalidatePath(PATH);
  revalidatePath("/base-de-conhecimento");
  revalidatePath("/");
}

export async function rejectProposal(proposalId: string) {
  const supabase = await createClient();

  // 1. Read the proposal for logging
  const { data: proposal } = await supabase
    .from("proposals")
    .select("title, type")
    .eq("id", proposalId)
    .single();

  // 2. Update proposal status
  const { error: updateError } = await supabase
    .from("proposals")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (updateError) throw updateError;

  // 3. Log activity
  if (proposal) {
    await supabase.from("activity_log").insert({
      actor: "henrique",
      action: `Rejeitou proposta de ${proposal.type}: "${proposal.title}"`,
      entity_type: "proposal",
      entity_id: proposalId,
      entity_title: proposal.title,
    });
  }

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
