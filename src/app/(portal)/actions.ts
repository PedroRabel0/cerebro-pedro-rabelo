"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { findSimilarShareablePlaybooks } from "@/lib/ai/embeddings";
import { buildContentGenerationSystemPrompt } from "@/lib/ai/prompts";
import { requireClient } from "@/lib/api-guards";
import { log } from "@/lib/logger";

const PATH = "/portal";

// Resposta padrao quando a IA nao tem contexto suficiente e a pergunta e
// escalada para a equipe do Pedro responder manualmente.
const STANDARD =
  "Ainda não tenho esse contexto — a equipe do Pedro vai verificar e te responder em breve.";

/**
 * Resolve a empresa vinculada ao cliente autenticado. Valida auth no topo
 * (requireClient) — nao confie no middleware.
 */
export async function getClientCompany(): Promise<
  { id: string; name: string } | { error: string }
> {
  try {
    const { companyId } = await requireClient();
    const db = await createClient();
    const { data, error } = await db
      .from("consulting_companies")
      .select("name")
      .eq("id", companyId)
      .single();
    if (error || !data) return { error: "Empresa nao encontrada." };
    return { id: companyId, name: data.name as string };
  } catch (err) {
    const m = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: m };
  }
}

/**
 * Historico de chat da empresa do cliente (mais antigo -> mais recente).
 * Nunca lanca: em erro retorna lista vazia.
 */
export async function getClientChat(): Promise<
  {
    id: string;
    question: string;
    answer: string;
    has_context: boolean;
    created_at: string;
  }[]
> {
  try {
    const { companyId } = await requireClient();
    const db = await createClient();
    const { data, error } = await db
      .from("consulting_chat_messages")
      .select("id, question, answer, has_context, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) {
      log.error("[Portal] getClientChat: " + error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    log.error("[Portal] getClientChat: " + String(err));
    return [];
  }
}

/**
 * Pergunta do cliente ao Pedro IA. Responde SOMENTE com base no contexto
 * (playbooks compartilhaveis + resumos de reunioes). Sem contexto suficiente,
 * escala para a equipe via consulting_pending_questions.
 */
export async function askClient(
  question: string
): Promise<
  { answer: string; escalated: boolean } | { error: string }
> {
  try {
    const { user, companyId } = await requireClient();
    if (!question.trim()) return { error: "Faca uma pergunta." };

    const db = await createClient();

    const [{ data: meetings }, { data: identity }] = await Promise.all([
      db
        .from("consulting_meetings")
        .select("title, summary")
        .eq("company_id", companyId)
        .order("held_at", { ascending: false })
        .limit(5),
      db.from("identity").select("*").limit(1).maybeSingle(),
    ]);

    let playbookContext = "";
    try {
      const similar = await findSimilarShareablePlaybooks(question, 0.3, 5);
      playbookContext = similar
        .map(
          (p) => `### ${p.title}\n${(p.body_markdown || "").slice(0, 1200)}`
        )
        .join("\n\n");
    } catch (err) {
      log.error("[Portal] askClient embeddings: " + String(err));
    }

    const meetingCtx = (meetings ?? [])
      .filter((m) => m.summary)
      .map((m) => `- ${m.title}: ${m.summary}`)
      .join("\n");

    const systemPrompt = identity
      ? buildContentGenerationSystemPrompt(identity)
      : "REGRA: responda SEMPRE em PT-BR. Voce e o Pedro IA, assistente da consultoria do Pedro Rabelo.";

    const userPrompt = `Voce e o Pedro IA respondendo a um cliente da consultoria.

## Conhecimento do Pedro (playbooks compartilhaveis relevantes):
${playbookContext || "(nenhum playbook diretamente relacionado encontrado)"}

## Contexto da empresa (resumos de reunioes):
${meetingCtx || "(sem reunioes resumidas ainda)"}

## Pergunta do cliente:
${question}

INSTRUCOES:
- Responda SOMENTE com base no contexto fornecido acima. NAO invente informacoes.
- Se o contexto acima nao for suficiente para responder com seguranca, defina has_context = false.
- Sempre em PT-BR, no tom do Pedro, pratico e direto.

Retorne APENAS um JSON valido no formato:
{"has_context": boolean, "answer": "sua resposta aqui"}`;

    let parsed: { has_context: boolean; answer: string } | null = null;
    const client = getClient();
    const r = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [
        {
          type: "text" as const,
          text: systemPrompt,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    logCost("claude-sonnet-4-6", r.usage.input_tokens, r.usage.output_tokens);
    const text = r.content[0].type === "text" ? r.content[0].text : "";
    parsed = parseJSON<{ has_context: boolean; answer: string }>(text);

    const hasContext = !!parsed?.has_context;
    const answer = hasContext ? parsed!.answer : STANDARD;

    const { data: inserted, error: insertErr } = await db
      .from("consulting_chat_messages")
      .insert({
        company_id: companyId,
        asked_by_user_id: user.id,
        question,
        answer,
        has_context: hasContext,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      return { error: "Falha ao gravar a mensagem." };
    }

    if (!hasContext) {
      const { data: pending } = await db
        .from("consulting_pending_questions")
        .insert({
          company_id: companyId,
          asked_by_user_id: user.id,
          asked_by_name:
            (user.user_metadata?.name as string | undefined) ?? user.email,
          question,
          status: "pendente",
        })
        .select("id")
        .single();
      if (pending) {
        await db
          .from("consulting_chat_messages")
          .update({ pending_question_id: pending.id })
          .eq("id", inserted.id);
      }
      revalidatePath(PATH);
      return { answer: STANDARD, escalated: true };
    }

    revalidatePath(PATH);
    return { answer: parsed!.answer, escalated: false };
  } catch (err) {
    const m = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha ao consultar o Pedro IA: ${m}` };
  }
}
