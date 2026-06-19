"use server";

import { createClient } from "@/lib/supabase/server";
import { getClient, logCost } from "@/lib/ai/client";
import { revalidatePath } from "next/cache";
import type { VoiceSnapshot } from "@/lib/supabase/types";

const PATH = "/evolucao-voz";

// --- Fetch all snapshots ---

export async function getSnapshots(): Promise<VoiceSnapshot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("voice_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false });
  if (error) throw error;
  return data as VoiceSnapshot[];
}

// --- Capture current identity as a new snapshot ---

export async function captureSnapshot(): Promise<void> {
  const supabase = await createClient();

  // 1. Read current identity
  const { data: identity, error: idError } = await supabase
    .from("identity")
    .select("tone_descriptors, voice_uses, voice_avoids, positioning, opening_style, closing_style")
    .eq("id", 1)
    .maybeSingle();
  if (idError) throw idError;
  if (!identity) throw new Error("Identidade não encontrada. Configure primeiro.");

  // 2. Fetch previous snapshot for comparison
  const { data: prevSnapshots } = await supabase
    .from("voice_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const previous = prevSnapshots?.[0] as VoiceSnapshot | undefined;

  // 3. Use Claude to generate analysis (and comparison if previous exists)
  const anthropic = getClient();
  const model = "claude-haiku-4-5-20251001";

  const currentState = `
Tom: ${identity.tone_descriptors || "Não definido"}
Posicionamento: ${identity.positioning || "Não definido"}
Estilo de abertura: ${identity.opening_style || "Não definido"}
Estilo de fechamento: ${identity.closing_style || "Não definido"}
A voz USA: ${(identity.voice_uses || []).join(", ") || "Nenhum"}
A voz EVITA: ${(identity.voice_avoids || []).join(", ") || "Nenhum"}
`.trim();

  let prompt: string;

  if (previous) {
    const previousState = `
Tom: ${previous.tone_descriptors || "Não definido"}
Posicionamento: ${previous.positioning || "Não definido"}
Estilo de abertura: ${previous.opening_style || "Não definido"}
Estilo de fechamento: ${previous.closing_style || "Não definido"}
A voz USA: ${(previous.voice_uses || []).join(", ") || "Nenhum"}
A voz EVITA: ${(previous.voice_avoids || []).join(", ") || "Nenhum"}
`.trim();

    prompt = `Você é um analista de marca pessoal e voz autoral.

ESTADO ANTERIOR da voz (snapshot de ${previous.snapshot_date}):
${previousState}

ESTADO ATUAL da voz:
${currentState}

Faça duas coisas:

1. ANÁLISE: Escreva um parágrafo curto (3-5 frases) resumindo o estado atual da voz. Destaque os pontos fortes e o que define essa voz.

2. COMPARAÇÃO: Escreva um parágrafo curto (3-5 frases) comparando com o snapshot anterior. O que mudou? O que se manteve consistente? A evolução faz sentido?

Responda EXATAMENTE neste formato JSON:
{"analysis": "...", "comparison": "..."}`;
  } else {
    prompt = `Você é um analista de marca pessoal e voz autoral.

ESTADO ATUAL da voz:
${currentState}

Escreva um parágrafo curto (3-5 frases) resumindo o estado atual da voz. Destaque os pontos fortes, a coerência e o que define essa voz como única.

Responda EXATAMENTE neste formato JSON:
{"analysis": "..."}`;
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  logCost(model, response.usage.input_tokens, response.usage.output_tokens);

  let analysis: string | null = null;
  let comparison: string | null = null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysis = parsed.analysis || null;
      comparison = parsed.comparison || null;
    }
  } catch {
    analysis = text;
  }

  // 4. Insert snapshot
  const today = new Date().toISOString().split("T")[0];
  const { error: insertError } = await supabase
    .from("voice_snapshots")
    .insert({
      snapshot_date: today,
      tone_descriptors: identity.tone_descriptors,
      voice_uses: identity.voice_uses || [],
      voice_avoids: identity.voice_avoids || [],
      positioning: identity.positioning,
      opening_style: identity.opening_style,
      closing_style: identity.closing_style,
      analysis,
      comparison_with_previous: comparison,
    });
  if (insertError) throw insertError;

  revalidatePath(PATH);
}

// --- Delete a snapshot ---

export async function deleteSnapshot(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("voice_snapshots")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}
