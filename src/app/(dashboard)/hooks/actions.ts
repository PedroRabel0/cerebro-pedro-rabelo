"use server";

import { createClient } from "@/lib/supabase/server";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { revalidatePath } from "next/cache";

const PATH = "/hooks";

export interface Hook {
  id: string;
  text: string;
  category: string;
  content_type: string | null;
  source: string | null;
  used_count: number;
  performance_score: number | null;
  content_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- Fetch hooks ---

export async function getHooks(category?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("hooks")
    .select("*")
    .order("performance_score", { ascending: false, nullsFirst: false })
    .order("used_count", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Hook[];
}

// --- Create hook manually ---

export async function createHook(text: string, category: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("hooks").insert({
    text,
    category,
    source: "manual",
  });
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Delete hook ---

export async function deleteHook(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("hooks").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Increment usage ---

export async function incrementHookUsage(id: string) {
  const supabase = await createClient();
  const { data: hook, error: fetchError } = await supabase
    .from("hooks")
    .select("used_count")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("hooks")
    .update({ used_count: (hook.used_count ?? 0) + 1 })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Generate hooks with AI ---

interface GeneratedHook {
  text: string;
  category: string;
}

export async function generateHooks(
  topic: string,
  category?: string,
  count: number = 10
): Promise<{ hooks: Hook[] } | { error: string }> {
  const anthropic = getClient();

  const categoryInstruction = category
    ? `Todos os hooks devem ser da categoria "${category}".`
    : `Gere uma mistura variada entre as categorias: curiosidade, polemica, autoridade, dor, historia, dado, pergunta, contraintuitivo.`;

  const prompt = `Voce e um copywriter especialista em ganchos (hooks) para conteudo de redes sociais.

CONTEXTO DA MARCA:
- Pedro Rabelo: comunicacao direta, provocativa, anti-guru
- Tom: sem enrolacao, confronta crencas populares, usa linguagem coloquial mas inteligente
- Objetivo: parar o scroll, provocar curiosidade ou desconforto produtivo

TAREFA:
Gere exatamente ${count} hooks/ganchos sobre o tema: "${topic}"

${categoryInstruction}

CATEGORIAS DISPONIVEIS:
- curiosidade: gera vontade de saber mais ("Voce sabia que...")
- polemica: desafia crencas, provoca ("Isso vai irritar muita gente...")
- autoridade: mostra expertise ou resultado ("Depois de 10 anos...")
- dor: toca na ferida do publico ("Se voce ainda faz X...")
- historia: abre uma narrativa ("Em 2019 eu perdi tudo...")
- dado: usa numero ou estatistica ("97% das pessoas...")
- pergunta: questao que faz pensar ("Por que ninguem fala sobre...")
- contraintuitivo: inverte a logica ("Quanto mais voce tenta, pior fica")

REGRAS:
- Cada hook deve ter entre 5 e 25 palavras
- Hooks devem ser em portugues brasileiro
- Devem ser frases de ABERTURA (primeira linha de um post/video)
- Foque em parar o scroll — provocar, intrigar, chocar
- Nao use cliches como "neste artigo" ou "vou te ensinar"
- Seja especifico ao tema, nao generico

Responda APENAS com um JSON array no formato:
[{"text": "o hook aqui", "category": "categoria"}]`;

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

    const parsed = parseJSON<GeneratedHook[]>(textBlock.text);
    if (!parsed || !Array.isArray(parsed)) {
      return { error: "Falha ao interpretar resposta da IA." };
    }

    // Save all to DB
    const supabase = await createClient();
    const rows = parsed.map((h) => ({
      text: h.text,
      category: h.category,
      source: "generated" as const,
    }));

    const { data, error } = await supabase
      .from("hooks")
      .insert(rows)
      .select("*");
    if (error) throw error;

    revalidatePath(PATH);
    return { hooks: data as Hook[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Hooks] generateHooks error:", message);
    return { error: `Falha ao gerar hooks: ${message}` };
  }
}
