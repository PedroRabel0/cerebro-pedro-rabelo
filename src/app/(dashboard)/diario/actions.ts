"use server";

import { createClient } from "@/lib/supabase/server";
import { getClient, logCost } from "@/lib/ai/client";
import { log } from "@/lib/logger";
import { revalidatePath } from "next/cache";

const PATH = "/diario";

// --- Journal Entries ---

export async function getEntries(limit = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getEntryByDate(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("entry_date", date)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveEntry(data: {
  entry_date: string;
  content: string;
  highlights?: string;
  challenges?: string;
  decisions?: string;
}) {
  const supabase = await createClient();

  // Check if entry already exists for this date + author
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("entry_date", data.entry_date)
    .eq("author", "henrique")
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Update
    const { error } = await supabase
      .from("journal_entries")
      .update({
        content: data.content,
        highlights: data.highlights || null,
        challenges: data.challenges || null,
        decisions: data.decisions || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    // Insert
    const { error } = await supabase.from("journal_entries").insert({
      entry_date: data.entry_date,
      author: "henrique",
      content: data.content,
      highlights: data.highlights || null,
      challenges: data.challenges || null,
      decisions: data.decisions || null,
    });
    if (error) throw error;
  }

  revalidatePath(PATH);
}

export async function deleteEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

export async function generateDaySummary(entryId: string) {
  const supabase = await createClient();

  // 1. Fetch the journal entry
  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", entryId)
    .single();
  if (entryError || !entry) throw entryError || new Error("Entry not found");

  // 2. Fetch platform activity for that day
  const dayStart = `${entry.entry_date}T00:00:00`;
  const dayEnd = `${entry.entry_date}T23:59:59`;

  const [activityRes, contentsRes, capturesRes] = await Promise.all([
    supabase
      .from("activity_log")
      .select("action, entity_type, entity_title, created_at")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("generated_contents")
      .select("content_type, status, created_at")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(20),
    supabase
      .from("captures")
      .select("title, source_type, status, created_at")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(20),
  ]);

  // 3. Build the prompt
  const activitySummary = (activityRes.data || [])
    .map((a) => `- ${a.action} (${a.entity_type}: ${a.entity_title || "?"})`)
    .join("\n");

  const contentsSummary = (contentsRes.data || [])
    .map((c) => `- ${c.content_type} (${c.status})`)
    .join("\n");

  const capturesSummary = (capturesRes.data || [])
    .map((c) => `- ${c.title} (${c.source_type}, ${c.status})`)
    .join("\n");

  const prompt = `Voce e o assistente do Segundo Cerebro de Pedro Rabelo. Analise o registro do dia e a atividade na plataforma para gerar um resumo executivo do dia.

## Registro do dia (escrito por ${entry.author})
Data: ${entry.entry_date}

### O que aconteceu
${entry.content}

${entry.highlights ? `### Destaques\n${entry.highlights}` : ""}
${entry.challenges ? `### Desafios\n${entry.challenges}` : ""}
${entry.decisions ? `### Decisoes tomadas\n${entry.decisions}` : ""}

## Atividade na plataforma neste dia
${activitySummary || "(nenhuma atividade registrada)"}

### Conteudos gerados
${contentsSummary || "(nenhum)"}

### Capturas processadas
${capturesSummary || "(nenhuma)"}

---

Gere:
1. Um resumo executivo do dia (3-5 frases, em portugues)
2. Se houver decisoes mencionadas, sugira regras de decisao que poderiam ser adicionadas ao sistema (formato: "Quando X, fazer Y porque Z")
3. Conexoes entre o que foi escrito e a atividade da plataforma

Responda em portugues, de forma concisa e pratica.`;

  // 4. Call Claude
  const model = "claude-haiku-4-5-20251001";
  const client = getClient();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const aiText =
      response.content[0].type === "text" ? response.content[0].text : "";

    logCost(
      model,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    // 5. Save to ai_summary
    const { error: updateError } = await supabase
      .from("journal_entries")
      .update({
        ai_summary: aiText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);
    if (updateError) throw updateError;

    revalidatePath(PATH);
    return aiText;
  } catch (aiError) {
    log.error("[Diario] AI summary failed: " + String(aiError));
    throw new Error("Falha ao gerar resumo com IA");
  }
}
