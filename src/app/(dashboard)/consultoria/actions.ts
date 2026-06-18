"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { findSimilarPlaybooks } from "@/lib/ai/embeddings";
import { buildContentGenerationSystemPrompt } from "@/lib/ai/prompts";
import { isGoogleConnected, createCalendarEvent } from "@/lib/google-calendar";
import { requireUser } from "@/lib/api-guards";
import { log } from "@/lib/logger";
import type {
  ConsultingCompany,
  ConsultingContact,
  ConsultingMeeting,
  ConsultingTask,
  ConsultingDocument,
  ConsultingStep,
} from "@/lib/supabase/types";

const PATH = "/consultoria";
const DOCS_BUCKET = "consulting-docs";

// ============================================================
// Visao geral + lista de empresas
// ============================================================

export interface CompanyWithCounts extends ConsultingCompany {
  pending_tasks: number;
  overdue_tasks: number;
}

export interface ConsultoriaOverview {
  active_companies: number;
  pending_tasks: number;
  overdue_tasks: number;
}

export async function getConsultoriaData(): Promise<{
  companies: CompanyWithCounts[];
  overview: ConsultoriaOverview;
}> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [companiesRes, tasksRes] = await Promise.all([
    supabase
      .from("consulting_companies")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("consulting_tasks")
      .select("company_id, status, due_date")
      .eq("status", "pendente"),
  ]);

  const companies = (companiesRes.data ?? []) as ConsultingCompany[];
  const tasks = tasksRes.data ?? [];

  const withCounts: CompanyWithCounts[] = companies.map((c) => {
    const ts = tasks.filter((t) => t.company_id === c.id);
    return {
      ...c,
      pending_tasks: ts.length,
      overdue_tasks: ts.filter((t) => t.due_date && t.due_date < today).length,
    };
  });

  const overview: ConsultoriaOverview = {
    active_companies: companies.filter((c) => c.status === "ativa").length,
    pending_tasks: tasks.length,
    overdue_tasks: tasks.filter((t) => t.due_date && t.due_date < today).length,
  };

  return { companies: withCounts, overview };
}

export interface CompanyDetail {
  company: ConsultingCompany;
  contacts: ConsultingContact[];
  meetings: ConsultingMeeting[];
  tasks: ConsultingTask[];
  documents: ConsultingDocument[];
  steps: ConsultingStep[];
}

export async function getCompany(id: string): Promise<CompanyDetail | null> {
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("consulting_companies")
    .select("*")
    .eq("id", id)
    .single();

  if (!company) return null;

  const [contacts, meetings, tasks, documents, steps] = await Promise.all([
    supabase.from("consulting_contacts").select("*").eq("company_id", id).order("is_primary", { ascending: false }),
    supabase.from("consulting_meetings").select("*").eq("company_id", id).order("held_at", { ascending: false }),
    supabase.from("consulting_tasks").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("consulting_documents").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("consulting_steps").select("*").eq("company_id", id).order("ordem", { ascending: true }),
  ]);

  return {
    company: company as ConsultingCompany,
    contacts: (contacts.data ?? []) as ConsultingContact[],
    meetings: (meetings.data ?? []) as ConsultingMeeting[],
    tasks: (tasks.data ?? []) as ConsultingTask[],
    documents: (documents.data ?? []) as ConsultingDocument[],
    steps: (steps.data ?? []) as ConsultingStep[],
  };
}

// ============================================================
// Empresas
// ============================================================

export async function createCompany(input: {
  name: string;
  sector?: string;
  goal?: string;
}): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  if (!input.name?.trim()) return { error: "Nome da empresa e obrigatorio." };

  const { data, error } = await supabase
    .from("consulting_companies")
    .insert({ name: input.name.trim(), sector: input.sector || null, goal: input.goal || null })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { id: data.id };
}

export async function updateCompany(
  id: string,
  fields: Partial<Pick<ConsultingCompany, "name" | "sector" | "goal" | "status" | "contract_status" | "contract_value" | "payment_status" | "notes">>
): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("consulting_companies")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("consulting_companies").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

// ============================================================
// Contatos
// ============================================================

export async function createContact(
  companyId: string,
  input: { name: string; role?: string; whatsapp?: string; email?: string; is_primary?: boolean; consent?: boolean }
): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  if (!input.name?.trim()) return { error: "Nome do contato e obrigatorio." };

  const { data, error } = await supabase
    .from("consulting_contacts")
    .insert({
      company_id: companyId,
      name: input.name.trim(),
      role: input.role || null,
      whatsapp: input.whatsapp ? input.whatsapp.replace(/\D/g, "") : null,
      email: input.email || null,
      is_primary: input.is_primary ?? false,
      consent: input.consent ?? false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { id: data.id };
}

export async function deleteContact(id: string, companyId: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("consulting_contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

// ============================================================
// Reunioes
// ============================================================

export async function createMeeting(
  companyId: string,
  input: { title: string; held_at?: string; transcript?: string }
): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  if (!input.title?.trim()) return { error: "Titulo da reuniao e obrigatorio." };

  const { data, error } = await supabase
    .from("consulting_meetings")
    .insert({
      company_id: companyId,
      title: input.title.trim(),
      held_at: input.held_at || new Date().toISOString(),
      transcript: input.transcript || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { id: data.id };
}

export async function deleteMeeting(id: string, companyId: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("consulting_meetings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

/**
 * Processa a transcricao de uma reuniao com IA: gera um resumo e extrai as
 * tarefas (descricao, dono sugerido, prazo). Cria as tarefas (source='ai').
 */
export async function processMeeting(
  meetingId: string
): Promise<{ created: number } | { error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("consulting_meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (!meeting) return { error: "Reuniao nao encontrada." };
  if (!meeting.transcript?.trim()) return { error: "Cole a transcricao da reuniao primeiro." };

  const { data: company } = await supabase
    .from("consulting_companies")
    .select("name, goal, sector")
    .eq("id", meeting.company_id)
    .single();

  // Contexto do Cerebro (playbooks do Pedro) para embasar pontos-chave e duvidas
  let playbookContext = "";
  try {
    const similar = await findSimilarPlaybooks(
      `${company?.goal || ""} ${meeting.transcript.slice(0, 1500)}`,
      0.3,
      5
    );
    if (similar.length > 0) {
      const { data: pbs } = await supabase
        .from("playbooks")
        .select("title, body_markdown")
        .in("id", similar.map((s) => s.id));
      playbookContext = (pbs ?? [])
        .map((p) => `### ${p.title}\n${(p.body_markdown || "").slice(0, 900)}`)
        .join("\n\n");
    }
  } catch {
    // segue sem playbooks
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `REGRA ABSOLUTA: responda SEMPRE em portugues brasileiro (PT-BR).

Voce e o assistente de consultoria do Pedro Rabelo. Analise a TRANSCRICAO de uma reuniao de consultoria e extraia:
1. Um RESUMO objetivo (3-5 linhas) com os pontos principais e decisoes.
2. PONTOS-CHAVE: as coisas mais importantes que foram ditas (insights, numeros, decisoes).
3. DUVIDAS EM ABERTO: perguntas/duvidas que ficaram da reuniao. Para CADA duvida, responda usando o CONHECIMENTO DO PEDRO abaixo (playbooks) quando aplicavel; se nao houver base, diga objetivamente o que precisaria saber.
4. TAREFAS/ACOES definidas (o que precisa ser feito, por quem, ate quando).

EMPRESA: ${company?.name || "(cliente)"}${company?.goal ? ` — objetivo: ${company.goal}` : ""}
DATA DE HOJE: ${today}

## CONHECIMENTO DO PEDRO (playbooks relevantes — use para responder as duvidas):
${playbookContext || "(nenhum playbook diretamente relacionado)"}

Para cada tarefa: "description" (acionavel), "owner_name" (quem ficou responsavel; "" se nao houver), "due_date" (AAAA-MM-DD se mencionado, calculando a partir de hoje; senao null).

Responda APENAS com um JSON neste formato:
{"summary": "...", "key_points": ["...", "..."], "open_questions": [{"question": "...", "answer": "..."}], "tasks": [{"description": "...", "owner_name": "...", "due_date": "AAAA-MM-DD ou null"}]}

TRANSCRICAO:
${meeting.transcript.slice(0, 14000)}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    logCost("claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens);

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseJSON<{
      summary: string;
      key_points?: string[];
      open_questions?: { question: string; answer: string }[];
      tasks: { description: string; owner_name?: string; due_date?: string | null }[];
    }>(text);

    if (!parsed || !Array.isArray(parsed.tasks)) {
      return { error: "Nao consegui extrair as tarefas. Tente reprocessar." };
    }

    // Resumo rico (markdown) com resumo + pontos-chave + duvidas respondidas
    const parts: string[] = [];
    if (parsed.summary) parts.push(`## Resumo\n${parsed.summary}`);
    if (parsed.key_points?.length) {
      parts.push(`## Pontos-chave\n${parsed.key_points.map((k) => `- ${k}`).join("\n")}`);
    }
    if (parsed.open_questions?.length) {
      parts.push(
        `## Duvidas em aberto (respondidas com o Cerebro)\n${parsed.open_questions
          .map((q) => `**${q.question}**\n${q.answer}`)
          .join("\n\n")}`
      );
    }
    const composed = parts.join("\n\n");
    if (composed) {
      await supabase.from("consulting_meetings").update({ summary: composed }).eq("id", meetingId);
    }

    const rows = parsed.tasks
      .filter((t) => t.description?.trim())
      .map((t) => {
        const due = t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null;
        return {
          company_id: meeting.company_id,
          meeting_id: meetingId,
          description: t.description.trim(),
          owner_name: t.owner_name?.trim() || null,
          due_date: due,
          remind_at: due, // lembra na sua agenda no dia que vence
          status: "pendente" as const,
          source: "ai" as const,
        };
      });

    if (rows.length > 0) {
      const { error } = await supabase.from("consulting_tasks").insert(rows);
      if (error) return { error: error.message };
    }

    revalidatePath(`${PATH}/${meeting.company_id}`);
    return { created: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[Consultoria] processMeeting: " + message);
    return { error: `Falha ao processar reuniao: ${message}` };
  }
}

// ============================================================
// Tarefas
// ============================================================

export async function createTask(
  companyId: string,
  input: { description: string; owner_name?: string; due_date?: string; contact_id?: string }
): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  if (!input.description?.trim()) return { error: "Descricao da tarefa e obrigatoria." };

  const { data, error } = await supabase
    .from("consulting_tasks")
    .insert({
      company_id: companyId,
      description: input.description.trim(),
      owner_name: input.owner_name || null,
      due_date: input.due_date || null,
      remind_at: input.due_date || null,
      contact_id: input.contact_id || null,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { id: data.id };
}

export async function updateTask(
  id: string,
  companyId: string,
  fields: Partial<Pick<ConsultingTask, "description" | "owner_name" | "due_date" | "remind_at" | "status" | "contact_id">>
): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("consulting_tasks")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

export async function deleteTask(id: string, companyId: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("consulting_tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

/**
 * Gera a mensagem de WhatsApp pronta (voz do Pedro) para o dono da tarefa.
 * Salva em message_draft e retorna o texto.
 */
export async function generateTaskMessage(
  taskId: string
): Promise<{ message: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data: task } = await supabase.from("consulting_tasks").select("*").eq("id", taskId).single();
  if (!task) return { error: "Tarefa nao encontrada." };

  const [{ data: company }, { data: identity }] = await Promise.all([
    supabase.from("consulting_companies").select("name, goal").eq("id", task.company_id).single(),
    supabase.from("identity").select("tone_descriptors").limit(1).single(),
  ]);

  const prompt = `REGRA ABSOLUTA: responda em portugues brasileiro (PT-BR).

Voce escreve no lugar do Pedro Rabelo (consultor). Escreva uma mensagem de WhatsApp CURTA, amigavel e direta para ${task.owner_name || "o cliente"}, lembrando/pedindo para executar esta tarefa combinada na consultoria.

${identity?.tone_descriptors ? `Tom do Pedro: ${identity.tone_descriptors}` : ""}
EMPRESA: ${company?.name || ""}${company?.goal ? ` (objetivo: ${company.goal})` : ""}
TAREFA: ${task.description}
${task.due_date ? `PRAZO: ${task.due_date}` : ""}

Regras: mensagem pronta pra copiar e colar; no maximo 3-4 linhas; comeca com um cumprimento curto; tom proximo mas profissional; sem assinatura formal; nao use placeholders. Responda SOMENTE com o texto da mensagem.`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    logCost("claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens);
    const message = (response.content[0].type === "text" ? response.content[0].text : "").trim();

    await supabase.from("consulting_tasks").update({ message_draft: message }).eq("id", taskId);
    revalidatePath(`${PATH}/${task.company_id}`);
    return { message };
  } catch (err) {
    const m = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha ao gerar mensagem: ${m}` };
  }
}

// ============================================================
// Documentos (bucket privado + signed URL)
// ============================================================

export async function uploadDocument(
  companyId: string,
  formData: FormData
): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const file = formData.get("file") as File | null;
  const kind = ((formData.get("kind") as string) || "outro") as ConsultingDocument["kind"];
  if (!file || file.size === 0) return { error: "Arquivo vazio." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${companyId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { error: upErr.message };

  const { data, error } = await supabase
    .from("consulting_documents")
    .insert({ company_id: companyId, name: file.name, storage_path: path, kind })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`${PATH}/${companyId}`);
  return { id: data.id };
}

export async function getDocumentUrl(docId: string): Promise<{ url: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("consulting_documents").select("storage_path").eq("id", docId).single();
  if (!doc) return { error: "Documento nao encontrado." };
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(doc.storage_path, 3600);
  if (error || !data) return { error: error?.message || "Falha ao gerar link." };
  return { url: data.signedUrl };
}

export async function deleteDocument(id: string, companyId: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("consulting_documents").select("storage_path").eq("id", id).single();
  if (doc?.storage_path) {
    await supabase.storage.from(DOCS_BUCKET).remove([doc.storage_path]);
  }
  const { error } = await supabase.from("consulting_documents").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

// ============================================================
// Roadmap / passos
// ============================================================

export async function createStep(
  companyId: string,
  input: { title: string; target_date?: string }
): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  if (!input.title?.trim()) return { error: "Titulo do passo e obrigatorio." };

  const { count } = await supabase
    .from("consulting_steps")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  const { data, error } = await supabase
    .from("consulting_steps")
    .insert({ company_id: companyId, title: input.title.trim(), target_date: input.target_date || null, ordem: count ?? 0 })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { id: data.id };
}

export async function toggleStep(id: string, companyId: string, done: boolean): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("consulting_steps")
    .update({ status: done ? "feita" : "pendente" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

export async function deleteStep(id: string, companyId: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("consulting_steps").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

// ============================================================
// Fase 3 — Google Calendar (lembretes reais) + Q&A do Cerebro
// ============================================================

export async function getGoogleStatus(): Promise<{ connected: boolean }> {
  const user = await requireUser();
  return { connected: await isGoogleConnected(user.id) };
}

/**
 * Cria um lembrete REAL na Google Agenda do operador para cobrar a tarefa.
 * Requer Google conectado (senao retorna not_connected pra UI cair no link).
 */
export async function addTaskReminderToCalendar(
  taskId: string
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: task } = await supabase.from("consulting_tasks").select("*").eq("id", taskId).single();
  if (!task) return { error: "Tarefa nao encontrada." };

  const date = task.remind_at || task.due_date;
  if (!date) return { error: "Defina um prazo na tarefa primeiro." };

  const res = await createCalendarEvent(user.id, {
    summary: `Cobrar ${task.owner_name || "cliente"}: ${task.description}`,
    description: "Lembrete da consultoria (Segundo Cerebro)",
    date,
  });
  return res;
}

/**
 * Pergunta ao Cerebro com o contexto da empresa: playbooks do Pedro (busca
 * semantica) + objetivo da empresa + resumos das reunioes.
 */
export async function askConsultoria(
  companyId: string,
  question: string
): Promise<{ answer: string } | { error: string }> {
  await requireUser();
  if (!question.trim()) return { error: "Faca uma pergunta." };
  const supabase = await createClient();

  const [{ data: company }, { data: meetings }, { data: identity }] = await Promise.all([
    supabase.from("consulting_companies").select("name, sector, goal").eq("id", companyId).single(),
    supabase.from("consulting_meetings").select("title, summary").eq("company_id", companyId).order("held_at", { ascending: false }).limit(5),
    supabase.from("identity").select("*").limit(1).single(),
  ]);

  let playbookContext = "";
  try {
    const similar = await findSimilarPlaybooks(question, 0.3, 5);
    if (similar.length > 0) {
      const { data: pbs } = await supabase
        .from("playbooks")
        .select("title, body_markdown")
        .in("id", similar.map((s) => s.id));
      playbookContext = (pbs ?? [])
        .map((p) => `### ${p.title}\n${(p.body_markdown || "").slice(0, 1200)}`)
        .join("\n\n");
    }
  } catch (err) {
    log.error("[Consultoria] askConsultoria embeddings: " + String(err));
  }

  const meetingCtx = (meetings ?? [])
    .filter((m) => m.summary)
    .map((m) => `- ${m.title}: ${m.summary}`)
    .join("\n");

  const systemPrompt = identity
    ? buildContentGenerationSystemPrompt(identity)
    : "REGRA: responda em PT-BR. Voce e o consultor Pedro Rabelo.";

  const userPrompt = `Pergunta sobre a consultoria da empresa "${company?.name || "(cliente)"}"${company?.goal ? ` (objetivo: ${company.goal})` : ""}.

## Conhecimento do Pedro (playbooks relevantes):
${playbookContext || "(nenhum playbook diretamente relacionado encontrado)"}

## Contexto da empresa (resumos de reunioes):
${meetingCtx || "(sem reunioes resumidas ainda)"}

## Pergunta:
${question}

Responda de forma pratica e direta, no tom do Pedro, usando o conhecimento acima como base. Se faltar embasamento, diga objetivamente o que precisaria saber. Sempre em PT-BR.`;

  try {
    const client = getClient();
    const r = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [{ type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const } }],
      messages: [{ role: "user", content: userPrompt }],
    });
    logCost("claude-sonnet-4-6", r.usage.input_tokens, r.usage.output_tokens);
    const answer = (r.content[0].type === "text" ? r.content[0].text : "").trim();
    return { answer };
  } catch (err) {
    const m = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha ao consultar o Cerebro: ${m}` };
  }
}
