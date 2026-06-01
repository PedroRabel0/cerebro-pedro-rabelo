"use server";

import { createClient } from "@/lib/supabase/server";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { revalidatePath } from "next/cache";
import type { Trend } from "@/lib/supabase/types";

const PATH = "/tendencias";

// --- Fetch all trends ---

export async function getTrends(): Promise<Trend[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trends")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Trend[];
}

// --- Create a new trend ---

export async function createTrend(
  title: string,
  url?: string,
  description?: string,
  sourceText?: string
) {
  const supabase = await createClient();
  const { error } = await supabase.from("trends").insert({
    title,
    url: url || null,
    description: description || null,
    source_text: sourceText || null,
    status: "pending",
  });
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Analyze a trend with AI ---

export async function analyzeTrend(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const anthropic = getClient();

  // Fetch the trend
  const { data: trend, error: trendError } = await supabase
    .from("trends")
    .select("*")
    .eq("id", id)
    .single();
  if (trendError || !trend) {
    return { error: "Tendencia nao encontrada." };
  }

  // Fetch identity + playbooks for context
  const [identityRes, playbooksRes] = await Promise.all([
    supabase.from("identity").select("*").limit(1).single(),
    supabase.from("playbooks").select("title, body_markdown").limit(10),
  ]);

  const identity = identityRes.data;
  const tone =
    identity?.tone_descriptors || "Direto, pratico, provocativo";
  const voiceUses =
    (identity?.voice_uses || []).join(", ") ||
    "Frameworks praticos, experiencia real, linguagem direta";
  const voiceAvoids =
    (identity?.voice_avoids || []).join(", ") ||
    "Jargao corporativo, teoria vazia";
  const positioning = identity?.positioning || "Especialista pratico";

  const playbooks = playbooksRes.data || [];
  const playbookContext =
    playbooks.length > 0
      ? `\nPLAYBOOKS DISPONIVEIS (use como referencia para angulos):\n${playbooks.map((p) => `- ${p.title}`).join("\n")}`
      : "";

  const trendContext = [
    `TITULO: ${trend.title}`,
    trend.url ? `URL: ${trend.url}` : null,
    trend.description ? `DESCRICAO: ${trend.description}` : null,
    trend.source_text
      ? `TEXTO ORIGINAL / POST VIRAL:\n${trend.source_text}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Voce e um estrategista de conteudo para o Pedro, um criador de conteudo sobre negocios e desenvolvimento pessoal.

IDENTIDADE DO PEDRO:
- Tom: ${tone}
- Posicionamento: ${positioning}
- A voz DEVE usar: ${voiceUses}
- A voz NUNCA deve usar: ${voiceAvoids}
${playbookContext}

TENDENCIA PARA ANALISAR:
${trendContext}

TAREFA:
1. Analise essa tendencia/conteudo viral e explique brevemente por que esta gerando engajamento.
2. Sugira de 3 a 5 angulos unicos que o Pedro poderia usar para criar conteudo sobre essa tendencia, usando sua voz e playbooks.

Para cada angulo, explique:
- O angulo em si (uma frase curta)
- Por que esse angulo funciona para o Pedro especificamente

Responda com um JSON no formato:
{
  "analysis": "Texto da analise aqui (2-4 paragrafos em portugues)",
  "suggested_angles": [
    { "angle": "O angulo aqui", "why": "Por que funciona para o Pedro" }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "Resposta vazia da IA." };
    }

    logCost(
      "claude-sonnet-4-6",
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const parsed = parseJSON<{
      analysis: string;
      suggested_angles: { angle: string; why: string }[];
    }>(textBlock.text);

    if (!parsed || !parsed.analysis || !parsed.suggested_angles) {
      return { error: "Falha ao interpretar resposta da IA." };
    }

    // Save analysis to DB
    const { error: updateError } = await supabase
      .from("trends")
      .update({
        analysis: parsed.analysis,
        suggested_angles: parsed.suggested_angles,
        status: "analyzed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;

    revalidatePath(PATH);
    return { success: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Trends] analyzeTrend error:", message);
    return { error: `Falha ao analisar tendencia: ${message}` };
  }
}

// --- Delete a trend ---

export async function deleteTrend(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("trends").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}
