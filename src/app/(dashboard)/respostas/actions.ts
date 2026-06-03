"use server";


import { log } from '@/lib/logger';
import { createClient } from "@/lib/supabase/server";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { revalidatePath } from "next/cache";
import type { FaqResponse } from "@/lib/supabase/types";

const PATH = "/respostas";

// --- Fetch responses ---

export async function getResponses(category?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("faq_responses")
    .select("*")
    .order("used_count", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as FaqResponse[];
}

// --- Create response manually ---

export async function createResponse(
  question: string,
  answer: string,
  category: string
) {
  const supabase = await createClient();
  const { error } = await supabase.from("faq_responses").insert({
    question,
    answer,
    category,
    source: "manual",
  });
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Delete response ---

export async function deleteResponse(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("faq_responses")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Increment usage ---

export async function incrementUsage(id: string) {
  const supabase = await createClient();
  const { data: row, error: fetchError } = await supabase
    .from("faq_responses")
    .select("used_count")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("faq_responses")
    .update({ used_count: (row.used_count ?? 0) + 1 })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Copy response (tracks usage) ---

export async function copyResponse(id: string) {
  return incrementUsage(id);
}

// --- Generate responses with AI ---

interface GeneratedQA {
  question: string;
  answer: string;
  category: string;
}

export async function generateResponses(
  topic: string,
  count: number = 5
): Promise<{ responses: FaqResponse[] } | { error: string }> {
  const anthropic = getClient();
  const supabase = await createClient();

  // Fetch identity + playbooks from DB for context
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

  // Build knowledge context from playbooks
  const playbooks = playbooksRes.data || [];
  const playbookContext =
    playbooks.length > 0
      ? `\nBASE DE CONHECIMENTO (use como referencia para respostas mais especificas e fundamentadas):\n${playbooks.map((p) => `- ${p.title}: ${(p.body_markdown || "").slice(0, 200)}`).join("\n")}`
      : "";

  const prompt = `Voce e o Pedro — um especialista que responde perguntas frequentes do seu publico com autoridade e autenticidade.

IDENTIDADE (do banco de dados):
- Tom: ${tone}
- Posicionamento: ${positioning}
- A voz DEVE usar: ${voiceUses}
- A voz NUNCA deve usar: ${voiceAvoids}
${playbookContext}

TAREFA:
Gere exatamente ${count} pares de pergunta e resposta sobre o tema: "${topic}"

As perguntas devem ser duvidas reais que o publico do Pedro faria.
As respostas devem ser na VOZ do Pedro — diretas, praticas, com exemplos quando possivel.

CATEGORIAS DISPONIVEIS:
- geral: perguntas gerais sobre o tema
- vendas: relacionado a vendas, conversao, fechamento
- mindset: mentalidade, disciplina, foco
- lideranca: gestao de pessoas, time, delegacao
- negocios: estrategia, crescimento, operacao
- pessoal: vida pessoal, rotina, habitos

REGRAS:
- Perguntas devem ser naturais, como alguem perguntaria no Instagram/WhatsApp
- Respostas entre 2 e 5 frases — concisas mas completas
- Use a voz do Pedro: direto, sem enrolacao, com opiniao forte
- Portugues brasileiro coloquial mas profissional
- Inclua exemplos praticos ou frameworks quando relevante
- Nao use emojis
- Cada resposta deve ser util e acionavel
- Classifique cada par na categoria mais adequada

Responda APENAS com um JSON array no formato:
[{"question": "pergunta aqui", "answer": "resposta aqui", "category": "categoria"}]`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
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

    const parsed = parseJSON<GeneratedQA[]>(textBlock.text);
    if (!parsed || !Array.isArray(parsed)) {
      return { error: "Falha ao interpretar resposta da IA." };
    }

    // Save all to DB
    const rows = parsed.map((qa) => ({
      question: qa.question,
      answer: qa.answer,
      category: qa.category,
      source: "generated" as const,
    }));

    const { data, error } = await supabase
      .from("faq_responses")
      .insert(rows)
      .select("*");
    if (error) throw error;

    revalidatePath(PATH);
    return { responses: data as FaqResponse[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[Respostas] generateResponses error:" + " " + String(message));
    return { error: `Falha ao gerar respostas: ${message}` };
  }
}
