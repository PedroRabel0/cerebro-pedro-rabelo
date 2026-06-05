"use server";

import { createClient } from "@/lib/supabase/server";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { log } from "@/lib/logger";
import { revalidatePath } from "next/cache";

export interface DecisionRule {
  id: string;
  category: string;
  rule_text: string;
  context: string | null;
  created_at: string;
  updated_at: string;
}

export type RuleCategory =
  | "conteudo"
  | "formato"
  | "plataforma"
  | "metrica"
  | "marca"
  | "geral";

// RULE_CATEGORIES constant lives in DecisionRules.tsx (client component)
// Categories: conteudo, formato, plataforma, metrica, marca, geral

export async function getRules(): Promise<DecisionRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("decision_rules")
    .select("*")
    .order("category")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createRule(
  ruleText: string,
  category: string,
  context?: string
): Promise<DecisionRule> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("decision_rules")
    .insert({
      rule_text: ruleText,
      category,
      context: context || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  revalidatePath("/identidade");
  return data;
}

export async function updateRule(
  id: string,
  ruleText: string,
  category: string,
  context?: string
): Promise<DecisionRule> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("decision_rules")
    .update({
      rule_text: ruleText,
      category,
      context: context || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  revalidatePath("/identidade");
  return data;
}

export async function deleteRule(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("decision_rules")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/identidade");
}

interface SuggestedRule {
  rule_text: string;
  category: string;
  context: string;
}

export async function generateRulesFromContent(
  contentText: string
): Promise<SuggestedRule[]> {
  try {
    const supabase = await createClient();

    // Fetch identity for context
    const { data: identity } = await supabase
      .from("identity")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const identityContext = identity
      ? `Contexto da identidade do Pedro:
- Tom: ${identity.tone_descriptors || "Direto, pratico"}
- Posicionamento: ${identity.positioning || "Especialista pratico"}
- Voz usa: ${(identity.voice_uses || []).join(", ")}
- Voz evita: ${(identity.voice_avoids || []).join(", ")}`
      : "";

    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        {
          type: "text" as const,
          text: `Voce e um analista de conteudo especializado em extrair regras de decisao, heuristicas e padroes de um criador de conteudo.

${identityContext}

Categorias disponiveis: conteudo, formato, plataforma, metrica, marca, geral

Extraia regras de decisao, heuristicas, criterios e padroes que o Pedro usa ao criar conteudo. Foque no PORQUE por tras das decisoes — nao apenas o que ele faz, mas por que faz.

Formato de resposta (JSON valido):
[
  {
    "rule_text": "Quando o tema e lideranca, sempre abrir com historia pessoal",
    "category": "conteudo",
    "context": "Porque storytelling conecta mais que teoria pura"
  }
]

Regras:
- Extraia entre 3 e 10 regras
- Cada regra deve ser acionavel e especifica
- O campo context explica o PORQUE da regra
- Responda APENAS com o JSON, sem texto adicional`,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Analise o texto abaixo e extraia as regras de decisao do Pedro:\n\n${contentText.slice(0, 8000)}`,
        },
      ],
    });

    logCost(
      "claude-sonnet-4-6",
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = parseJSON<SuggestedRule[]>(text);
    if (!parsed || !Array.isArray(parsed)) {
      log.error("[Rules] Failed to parse AI response");
      return [];
    }

    // Validate categories
    const validCategories = new Set([
      "conteudo",
      "formato",
      "plataforma",
      "metrica",
      "marca",
      "geral",
    ]);

    return parsed
      .filter(
        (r) =>
          r.rule_text &&
          r.category &&
          validCategories.has(r.category)
      )
      .map((r) => ({
        rule_text: r.rule_text,
        category: r.category,
        context: r.context || "",
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("[Rules] generateRulesFromContent error: " + message);
    return [];
  }
}
