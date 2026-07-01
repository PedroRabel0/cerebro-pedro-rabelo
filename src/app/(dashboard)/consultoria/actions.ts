"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { findSimilarPlaybooks, updatePlaybookEmbedding } from "@/lib/ai/embeddings";
import { buildContentGenerationSystemPrompt } from "@/lib/ai/prompts";
import { isGoogleConnected, createCalendarEvent, createTimedCalendarEvent, listCalendars, listUpcomingEvents, getCalendarEvent, patchCalendarEvent } from "@/lib/google-calendar";
import { requireUser, requireStaff } from "@/lib/api-guards";
import { log } from "@/lib/logger";
import type {
  ConsultingCompany,
  ConsultingContact,
  ConsultingMeeting,
  ConsultingTask,
  ConsultingDocument,
  ConsultingStep,
  ConsultingWin,
} from "@/lib/supabase/types";

const PATH = "/consultoria";
const DOCS_BUCKET = "consulting-docs";

// ============================================================
// Health (termometro de cliente) — dias sem contato
// ============================================================
// Mentoria/board costuma ter cadencia semanal/quinzenal. Passou de ~2 semanas
// sem contato = atencao; passou de ~4 semanas = risco de esfriar.
// NB: em um arquivo "use server" so e permitido EXPORTAR funcoes async (e tipos,
// que sao apagados em runtime). Por isso estes valores ficam locais ao modulo.
const HEALTH_ATTENTION_DAYS = 14;
const HEALTH_RISK_DAYS = 28;
// Janela para avisar que um contrato esta perto de vencer/renovar.
const RENEWAL_WINDOW_DAYS = 30;

export type CompanyHealth = "ok" | "atencao" | "risco";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias inteiros entre uma data ISO no passado e agora (null se sem data). */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / DAY_MS);
}

/** Dias ate uma data (AAAA-MM-DD); negativo se ja passou. null se sem data. */
function daysUntilDate(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  const todayMidnight = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((target - todayMidnight) / DAY_MS);
}

/** Health de uma empresa a partir da ultima interacao (so faz sentido se ativa). */
function healthFromContact(company: Pick<ConsultingCompany, "status" | "last_contact_at" | "created_at">): {
  health: CompanyHealth;
  daysSinceContact: number | null;
} {
  const days = daysSince(company.last_contact_at || company.created_at);
  if (company.status !== "ativa" || days === null) return { health: "ok", daysSinceContact: days };
  const health: CompanyHealth = days > HEALTH_RISK_DAYS ? "risco" : days > HEALTH_ATTENTION_DAYS ? "atencao" : "ok";
  return { health, daysSinceContact: days };
}

// ============================================================
// Visao geral + lista de empresas
// ============================================================

export interface CompanyWithCounts extends ConsultingCompany {
  pending_tasks: number;
  overdue_tasks: number;
  pending_questions: number;
  health: CompanyHealth;
  days_since_contact: number | null;
  renewal_in_days: number | null;
}

export interface ConsultoriaOverview {
  active_companies: number;
  pending_tasks: number;
  overdue_tasks: number;
  // Financeiro recorrente + alertas (CRM+)
  mrr: number;
  overdue_payments: number;
  renewals_soon: number;
  cooling_clients: number;
}

export async function getConsultoriaData(): Promise<{
  companies: CompanyWithCounts[];
  overview: ConsultoriaOverview;
}> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [companiesRes, tasksRes, pendingRes] = await Promise.all([
    supabase
      .from("consulting_companies")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("consulting_tasks")
      .select("company_id, status, due_date")
      .eq("status", "pendente"),
    supabase
      .from("consulting_pending_questions")
      .select("company_id")
      .eq("status", "pendente"),
  ]);

  const companies = (companiesRes.data ?? []) as ConsultingCompany[];
  const tasks = tasksRes.data ?? [];
  const pending = (pendingRes.data ?? []) as { company_id: string }[];

  const withCounts: CompanyWithCounts[] = companies.map((c) => {
    const ts = tasks.filter((t) => t.company_id === c.id);
    const { health, daysSinceContact } = healthFromContact(c);
    const renewal = daysUntilDate(c.contract_end);
    return {
      ...c,
      pending_tasks: ts.length,
      overdue_tasks: ts.filter((t) => t.due_date && t.due_date < today).length,
      pending_questions: pending.filter((p) => p.company_id === c.id).length,
      health,
      days_since_contact: daysSinceContact,
      renewal_in_days: renewal,
    };
  });

  const active = withCounts.filter((c) => c.status === "ativa");
  const overview: ConsultoriaOverview = {
    active_companies: active.length,
    pending_tasks: tasks.length,
    overdue_tasks: tasks.filter((t) => t.due_date && t.due_date < today).length,
    mrr: active.reduce((sum, c) => sum + (c.monthly_fee || 0), 0),
    overdue_payments: active.filter((c) => c.payment_status === "atrasado").length,
    renewals_soon: active.filter(
      (c) => c.renewal_in_days !== null && c.renewal_in_days <= RENEWAL_WINDOW_DAYS
    ).length,
    cooling_clients: active.filter((c) => c.health !== "ok").length,
  };

  return { companies: withCounts, overview };
}

// ============================================================
// Resumo do dia — foco diario consolidado de toda a carteira
// ============================================================

export interface DigestTask {
  id: string;
  company_id: string;
  company_name: string;
  description: string;
  owner_name: string | null;
  due_date: string | null;
  overdue: boolean;
}
export interface DigestCompanyAlert {
  id: string;
  name: string;
  detail: string;
}
export interface DailyDigest {
  generated_for: string; // AAAA-MM-DD
  tasks_today: DigestTask[]; // vencem hoje ou ja venceram (pendentes)
  renewals: DigestCompanyAlert[]; // contratos vencendo/vencidos
  payments: DigestCompanyAlert[]; // pagamentos pendentes/atrasados
  cooling: DigestCompanyAlert[]; // clientes esfriando
  pending_questions: DigestCompanyAlert[]; // perguntas do cliente aguardando resposta
}

/**
 * Agrega tudo que precisa de atencao hoje, em toda a carteira: tarefas vencendo,
 * renovacoes proximas, pagamentos pendentes e clientes esfriando. So leitura.
 */
export async function getDailyDigest(): Promise<DailyDigest> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [companiesRes, tasksRes, pendingRes] = await Promise.all([
    supabase.from("consulting_companies").select("*"),
    supabase
      .from("consulting_tasks")
      .select("id, company_id, description, owner_name, due_date, status")
      .eq("status", "pendente"),
    supabase
      .from("consulting_pending_questions")
      .select("company_id")
      .eq("status", "pendente"),
  ]);

  const companies = (companiesRes.data ?? []) as ConsultingCompany[];
  const byId = new Map(companies.map((c) => [c.id, c]));
  const pendingQ = (pendingRes.data ?? []) as { company_id: string }[];
  const tasks = (tasksRes.data ?? []) as Pick<
    ConsultingTask,
    "id" | "company_id" | "description" | "owner_name" | "due_date"
  >[];

  const tasks_today: DigestTask[] = tasks
    .filter((t) => t.due_date && t.due_date <= today)
    .map((t) => ({
      id: t.id,
      company_id: t.company_id,
      company_name: byId.get(t.company_id)?.name || "Empresa",
      description: t.description,
      owner_name: t.owner_name,
      due_date: t.due_date,
      overdue: !!t.due_date && t.due_date < today,
    }))
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));

  const active = companies.filter((c) => c.status === "ativa");

  const renewals: DigestCompanyAlert[] = active
    .map((c) => ({ c, d: daysUntilDate(c.contract_end) }))
    .filter((x) => x.d !== null && x.d <= RENEWAL_WINDOW_DAYS)
    .sort((a, b) => (a.d as number) - (b.d as number))
    .map(({ c, d }) => ({
      id: c.id,
      name: c.name,
      detail:
        (d as number) < 0
          ? `contrato venceu há ${Math.abs(d as number)} dia(s)`
          : (d as number) === 0
            ? "contrato vence hoje"
            : `renova em ${d} dia(s)`,
    }));

  const payments: DigestCompanyAlert[] = active
    .filter((c) => c.payment_status !== "em_dia")
    .map((c) => ({
      id: c.id,
      name: c.name,
      detail: c.payment_status === "atrasado" ? "pagamento atrasado" : "pagamento pendente",
    }));

  const cooling: DigestCompanyAlert[] = active
    .map((c) => ({ c, h: healthFromContact(c) }))
    .filter((x) => x.h.health !== "ok")
    .sort((a, b) => (b.h.daysSinceContact || 0) - (a.h.daysSinceContact || 0))
    .map(({ c, h }) => ({
      id: c.id,
      name: c.name,
      detail: `${h.daysSinceContact} dias sem contato`,
    }));

  const pending_questions: DigestCompanyAlert[] = companies
    .map((c) => ({ c, n: pendingQ.filter((p) => p.company_id === c.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ c, n }) => ({
      id: c.id,
      name: c.name,
      detail: `${n} pergunta(s) pendente(s)`,
    }));

  return { generated_for: today, tasks_today, renewals, payments, cooling, pending_questions };
}

export interface CompanyDetail {
  company: ConsultingCompany;
  contacts: ConsultingContact[];
  meetings: ConsultingMeeting[];
  tasks: ConsultingTask[];
  documents: ConsultingDocument[];
  steps: ConsultingStep[];
  wins: ConsultingWin[];
  client_chat: { id: string; question: string; answer: string | null; has_context: boolean; created_at: string }[];
  pending_questions: { id: string; question: string; asked_by_name: string | null; created_at: string }[];
  client_users: { id: string; user_id: string; name: string | null; email: string | null }[];
  health: CompanyHealth;
  days_since_contact: number | null;
  renewal_in_days: number | null;
}

export async function getCompany(id: string): Promise<CompanyDetail | null> {
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("consulting_companies")
    .select("*")
    .eq("id", id)
    .single();

  if (!company) return null;

  const [contacts, meetings, tasks, documents, steps, wins, chat, pending, clientUsers] = await Promise.all([
    supabase.from("consulting_contacts").select("*").eq("company_id", id).order("is_primary", { ascending: false }),
    supabase.from("consulting_meetings").select("*").eq("company_id", id).order("held_at", { ascending: false }),
    supabase.from("consulting_tasks").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("consulting_documents").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("consulting_steps").select("*").eq("company_id", id).order("ordem", { ascending: true }),
    supabase.from("consulting_wins").select("*").eq("company_id", id).order("achieved_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("consulting_chat_messages").select("id, question, answer, has_context, created_at").eq("company_id", id).order("created_at", { ascending: true }),
    supabase.from("consulting_pending_questions").select("id, question, asked_by_name, created_at").eq("company_id", id).eq("status", "pendente").order("created_at", { ascending: true }),
    supabase.from("consulting_client_users").select("id, user_id, name, email").eq("company_id", id).order("created_at", { ascending: true }),
  ]);

  const co = company as ConsultingCompany;
  const { health, daysSinceContact } = healthFromContact(co);

  return {
    company: co,
    contacts: (contacts.data ?? []) as ConsultingContact[],
    meetings: (meetings.data ?? []) as ConsultingMeeting[],
    tasks: (tasks.data ?? []) as ConsultingTask[],
    documents: (documents.data ?? []) as ConsultingDocument[],
    steps: (steps.data ?? []) as ConsultingStep[],
    wins: (wins.data ?? []) as ConsultingWin[],
    client_chat: (chat.data ?? []) as CompanyDetail["client_chat"],
    pending_questions: (pending.data ?? []) as CompanyDetail["pending_questions"],
    client_users: (clientUsers.data ?? []) as CompanyDetail["client_users"],
    health,
    days_since_contact: daysSinceContact,
    renewal_in_days: daysUntilDate(co.contract_end),
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
  fields: Partial<Pick<ConsultingCompany, "name" | "sector" | "goal" | "status" | "contract_status" | "contract_value" | "payment_status" | "notes" | "monthly_fee" | "billing_day" | "contract_start" | "contract_end">>
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

/**
 * Marca "contato hoje" (atualiza o termometro do cliente). Usar quando houver
 * uma interacao que nao virou reuniao registrada (call rapida, troca no grupo).
 */
export async function touchCompany(id: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("consulting_companies")
    .update({ last_contact_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Avanca o termometro (last_contact_at) para uma data de contato, sem nunca
 * regredir: ignora datas futuras (reuniao agendada nao e contato ainda) e so
 * grava se for mais recente que o ultimo contato registrado.
 */
async function advanceLastContact(supabase: DbClient, companyId: string, iso: string | null | undefined) {
  if (!iso) return;
  const when = new Date(iso).getTime();
  if (Number.isNaN(when) || when > Date.now()) return;
  const { data } = await supabase
    .from("consulting_companies")
    .select("last_contact_at")
    .eq("id", companyId)
    .single();
  const current = data?.last_contact_at ? new Date(data.last_contact_at).getTime() : 0;
  if (when > current) {
    await supabase
      .from("consulting_companies")
      .update({ last_contact_at: new Date(when).toISOString() })
      .eq("id", companyId);
  }
}

export async function createMeeting(
  companyId: string,
  input: { title: string; held_at?: string; transcript?: string }
): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  if (!input.title?.trim()) return { error: "Titulo da reuniao e obrigatorio." };

  const heldAt = input.held_at || new Date().toISOString();
  const { data, error } = await supabase
    .from("consulting_meetings")
    .insert({
      company_id: companyId,
      title: input.title.trim(),
      held_at: heldAt,
      transcript: input.transcript || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  await advanceLastContact(supabase, companyId, heldAt);
  revalidatePath(PATH);
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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    logCost("claude-haiku-4-5-20251001", response.usage.input_tokens, response.usage.output_tokens);

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseJSON<{
      summary: string;
      key_points?: string[];
      open_questions?: { question: string; answer: string }[];
      tasks?: { description: string; owner_name?: string; due_date?: string | null }[];
    }>(text);

    // Se nem o JSON deu pra interpretar, falhou de verdade (resposta vazia/cortada).
    if (!parsed) {
      return { error: "Nao consegui interpretar a resposta da IA. Tente reprocessar." };
    }
    // Reuniao sem tarefas claras nao e erro — salva o resumo e segue com 0 tarefas.
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

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

    const rows = tasks
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

    // Processar uma reuniao implica que ela aconteceu -> conta como contato.
    await advanceLastContact(supabase, meeting.company_id, meeting.held_at);
    revalidatePath(PATH);
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
// Vitorias / resultados (prova de valor para renovacao)
// ============================================================

export async function createWin(
  companyId: string,
  input: { description: string; metric?: string; achieved_on?: string }
): Promise<{ id: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  if (!input.description?.trim()) return { error: "Descreva a vitoria/resultado." };

  const { data, error } = await supabase
    .from("consulting_wins")
    .insert({
      company_id: companyId,
      description: input.description.trim(),
      metric: input.metric?.trim() || null,
      achieved_on: input.achieved_on || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { id: data.id };
}

export async function deleteWin(id: string, companyId: string): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("consulting_wins").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

// ============================================================
// Pauta de reuniao (IA) — monta a agenda da proxima call
// ============================================================

/**
 * Gera a pauta da proxima reuniao a partir do contexto da empresa: tarefas em
 * aberto, o que ficou pendente da ultima reuniao (resumo), objetivo e vitorias
 * recentes. So gera o texto (nao agenda nada). Retorna markdown pronto.
 */
export async function generateMeetingAgenda(
  companyId: string
): Promise<{ agenda: string } | { error: string }> {
  await requireUser();
  const supabase = await createClient();

  const [{ data: company }, { data: tasks }, { data: meetings }, { data: wins }] = await Promise.all([
    supabase.from("consulting_companies").select("name, goal, sector").eq("id", companyId).single(),
    supabase
      .from("consulting_tasks")
      .select("description, owner_name, due_date, status")
      .eq("company_id", companyId)
      .eq("status", "pendente")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("consulting_meetings")
      .select("title, summary, held_at")
      .eq("company_id", companyId)
      .order("held_at", { ascending: false })
      .limit(1),
    supabase
      .from("consulting_wins")
      .select("description, metric")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const openTasks = (tasks ?? [])
    .map((t) => `- ${t.description}${t.owner_name ? ` (resp: ${t.owner_name})` : ""}${t.due_date ? ` [prazo ${t.due_date}]` : ""}`)
    .join("\n");
  const last = (meetings ?? [])[0];
  const winsText = (wins ?? [])
    .map((w) => `- ${w.description}${w.metric ? ` (${w.metric})` : ""}`)
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `REGRA ABSOLUTA: responda SEMPRE em portugues brasileiro (PT-BR).

Voce e o assistente de consultoria do Pedro Rabelo. Monte a PAUTA da proxima reuniao com a empresa abaixo. A pauta deve ser pratica, priorizada e cobrir: (1) acompanhamento das tarefas/combinados em aberto, (2) pontos que ficaram pendentes da ultima reuniao, (3) avanco em direcao ao objetivo, (4) proximos passos sugeridos. Seja objetivo e acionavel.

EMPRESA: ${company?.name || "(cliente)"}${company?.sector ? ` — setor: ${company.sector}` : ""}
OBJETIVO DA CONSULTORIA: ${company?.goal || "(nao definido)"}
DATA DE HOJE: ${today}

## Tarefas / combinados em aberto:
${openTasks || "(nenhuma tarefa pendente registrada)"}

## Resumo da ultima reuniao${last?.title ? ` (${last.title})` : ""}:
${last?.summary || "(sem reuniao anterior resumida)"}

## Vitorias/resultados recentes (para reforcar com o cliente):
${winsText || "(nenhuma registrada)"}

Responda SOMENTE com a pauta em markdown: um titulo curto e 4-7 topicos com bullets. Sem preambulo.`;

  try {
    const client = getClient();
    const r = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    logCost("claude-sonnet-4-6", r.usage.input_tokens, r.usage.output_tokens);
    const agenda = (r.content[0].type === "text" ? r.content[0].text : "").trim();
    if (!agenda) return { error: "Nao consegui gerar a pauta. Tente novamente." };
    return { agenda };
  } catch (err) {
    const m = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha ao gerar a pauta: ${m}` };
  }
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
  taskId: string,
  calendarId: string = "primary"
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: task } = await supabase.from("consulting_tasks").select("*").eq("id", taskId).single();
  if (!task) return { error: "Tarefa nao encontrada." };

  const date = task.remind_at || task.due_date;
  if (!date) return { error: "Defina um prazo na tarefa primeiro." };

  const res = await createCalendarEvent(
    user.id,
    {
      summary: `Cobrar ${task.owner_name || "cliente"}: ${task.description}`,
      description: "Lembrete da consultoria (Segundo Cerebro)",
      date,
    },
    calendarId
  );
  return res;
}

/** Lista as agendas em que da pra escrever (sua + as do Pedro compartilhadas). */
export async function getCalendarList(): Promise<{ id: string; summary: string }[]> {
  const user = await requireUser();
  return listCalendars(user.id);
}

export interface CalendarSuggestion {
  eventId: string;
  title: string;
  date: string;
  calendar: string;
  suggestedCompanyId: string | null;
  suggestedCompanyName: string | null;
}

/**
 * Le os proximos eventos da agenda e sugere a empresa de cada um, casando o
 * titulo do evento com o nome da empresa ou dos contatos cadastrados.
 */
export async function getCalendarSuggestions(): Promise<{
  suggestions: CalendarSuggestion[];
  calendars: string[];
}> {
  const user = await requireUser();
  const supabase = await createClient();

  const [events, cals, companiesRes, contactsRes] = await Promise.all([
    listUpcomingEvents(user.id, 50),
    listCalendars(user.id),
    supabase.from("consulting_companies").select("id, name"),
    supabase.from("consulting_contacts").select("name, company_id"),
  ]);

  const companies = (companiesRes.data ?? []) as { id: string; name: string }[];
  const contacts = (contactsRes.data ?? []) as { name: string; company_id: string }[];

  function suggest(title: string): { id: string; name: string } | null {
    const t = title.toLowerCase();
    // 1) nome completo OU primeiro nome de contato no titulo (ex: "Tiago")
    for (const c of contacts) {
      if (!c.name) continue;
      const full = c.name.toLowerCase();
      const first = full.split(/\s+/)[0];
      if ((full.length > 2 && t.includes(full)) || (first.length > 3 && t.includes(first))) {
        const co = companies.find((x) => x.id === c.company_id);
        if (co) return co;
      }
    }
    // 2) palavra significativa do nome da empresa no titulo (ex: "Prince")
    for (const co of companies) {
      const words = co.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      if (words.some((w) => t.includes(w))) return co;
    }
    return null;
  }

  const suggestions = events
    .filter((e) => e.date)
    .map((e) => {
      const s = suggest(e.summary);
      return {
        eventId: e.id,
        title: e.summary,
        date: e.date,
        calendar: e.calendar,
        suggestedCompanyId: s?.id ?? null,
        suggestedCompanyName: s?.name ?? null,
      };
    });

  return { suggestions, calendars: cals.map((c) => c.summary) };
}

/** Cria uma reuniao na empresa a partir de um evento da agenda. */
export async function importMeetingFromCalendar(
  companyId: string,
  title: string,
  heldAt: string
): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  const supabase = await createClient();
  const when = heldAt || new Date().toISOString();
  const { error } = await supabase.from("consulting_meetings").insert({
    company_id: companyId,
    title: title || "Reuniao da agenda",
    held_at: when,
  });
  if (error) return { error: error.message };
  await advanceLastContact(supabase, companyId, when);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Agenda uma reuniao: cria o evento (com horario e recorrencia opcional) na
 * Google Agenda escolhida E registra a reuniao na empresa, vinculada ao evento.
 */
export async function scheduleMeeting(
  companyId: string,
  input: {
    title: string;
    date: string; // AAAA-MM-DD
    time: string; // HH:MM
    durationMin?: number;
    recurrence?: "none" | "weekly" | "biweekly" | "monthly";
    calendarId?: string;
    attendees?: string[]; // emails dos convidados
  }
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  if (!input.title?.trim()) return { error: "Titulo da reuniao e obrigatorio." };
  if (!input.date) return { error: "Escolha a data." };

  const time = input.time || "09:00";
  const dur = input.durationMin || 60;
  const startDateTime = `${input.date}T${time}:00`;
  // calcula o fim preservando o horario de parede (trata virada de dia)
  const startD = new Date(`${input.date}T${time}:00Z`);
  const endD = new Date(startD.getTime() + dur * 60000);
  const endDateTime = `${endD.getUTCFullYear()}-${pad2(endD.getUTCMonth() + 1)}-${pad2(endD.getUTCDate())}T${pad2(endD.getUTCHours())}:${pad2(endD.getUTCMinutes())}:00`;

  const rrule: string[] = [];
  if (input.recurrence === "weekly") rrule.push("RRULE:FREQ=WEEKLY");
  else if (input.recurrence === "biweekly") rrule.push("RRULE:FREQ=WEEKLY;INTERVAL=2");
  else if (input.recurrence === "monthly") rrule.push("RRULE:FREQ=MONTHLY");

  const { data: company } = await supabase
    .from("consulting_companies")
    .select("name")
    .eq("id", companyId)
    .single();

  const attendees = (input.attendees ?? [])
    .map((e) => e.trim())
    .filter((e) => /.+@.+\..+/.test(e));

  const res = await createTimedCalendarEvent(
    user.id,
    {
      summary: input.title.trim(),
      description: `Consultoria${company?.name ? ` — ${company.name}` : ""} (Segundo Cerebro)`,
      startDateTime,
      endDateTime,
      recurrence: rrule,
      attendees,
    },
    input.calendarId || "primary"
  );

  if ("error" in res) {
    return { error: res.error === "not_connected" ? "Conecte a Google Agenda primeiro." : res.error };
  }

  const { error } = await supabase.from("consulting_meetings").insert({
    company_id: companyId,
    title: input.title.trim(),
    held_at: startDateTime,
    google_event_id: res.eventId,
    google_calendar_id: input.calendarId || "primary",
  });
  if (error) return { error: error.message };

  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

/**
 * Edita um evento da agenda a partir de uma instrucao em portugues. A IA
 * interpreta o texto ("passa pra terca 15h", "adiciona joao@x.com", "tira o
 * Thiago") e a gente aplica no Google (horario e/ou convidados).
 */
export async function updateMeetingOnCalendar(
  meetingId: string,
  instruction: string
): Promise<{ ok: true; summary: string } | { error: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!instruction.trim()) return { error: "Escreva o que mudar." };

  const { data: meeting } = await supabase
    .from("consulting_meetings")
    .select("*")
    .eq("id", meetingId)
    .single();
  if (!meeting) return { error: "Reuniao nao encontrada." };
  if (!meeting.google_event_id || !meeting.google_calendar_id) {
    return { error: "Essa reuniao nao esta vinculada a um evento da agenda. Use 'Agendar' para criar uma." };
  }

  const current = await getCalendarEvent(user.id, meeting.google_calendar_id, meeting.google_event_id);
  if (!current) return { error: "Nao consegui ler o evento na agenda." };

  const { data: contactRows } = await supabase
    .from("consulting_contacts")
    .select("name, email")
    .eq("company_id", meeting.company_id);
  const contacts = (contactRows ?? []) as { name: string; email: string | null }[];

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Hoje e ${today}. Voce edita um evento de agenda a partir de uma instrucao em portugues.

EVENTO ATUAL:
- inicio: ${current.startDateTime}
- convidados: ${current.attendees.join(", ") || "(nenhum)"}

CONTATOS DA EMPRESA (nome -> email):
${contacts.map((c) => `- ${c.name}: ${c.email || "(sem email)"}`).join("\n") || "(nenhum)"}

INSTRUCAO: "${instruction}"

Retorne APENAS um JSON com as mudancas (use null/[] no que NAO muda):
{"new_date": "AAAA-MM-DD ou null", "new_time": "HH:MM ou null", "duration_min": numero ou null, "add_attendees": ["email"], "remove_attendees": ["email"]}

Regras: calcule datas relativas a partir de hoje (ex: "terca que vem"). Para convidados, resolva nomes para emails usando os contatos acima ou os convidados atuais; se vier um email direto, use-o.`;

  let parsed: {
    new_date?: string | null;
    new_time?: string | null;
    duration_min?: number | null;
    add_attendees?: string[];
    remove_attendees?: string[];
  } | null = null;
  try {
    const client = getClient();
    const r = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    logCost("claude-sonnet-4-6", r.usage.input_tokens, r.usage.output_tokens);
    const text = r.content[0].type === "text" ? r.content[0].text : "";
    parsed = parseJSON(text);
  } catch (err) {
    return { error: `Falha ao interpretar: ${err instanceof Error ? err.message : "erro"}` };
  }
  if (!parsed) return { error: "Nao entendi a alteracao. Tente reescrever." };

  const patch: { startDateTime?: string; endDateTime?: string; attendees?: string[] } = {};
  const changes: string[] = [];

  const newDate = parsed.new_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.new_date) ? parsed.new_date : null;
  const newTime = parsed.new_time && /^\d{2}:\d{2}$/.test(parsed.new_time) ? parsed.new_time : null;
  if (newDate || newTime) {
    const curDate = current.startDateTime.slice(0, 10);
    const curTime = current.startDateTime.length > 10 ? current.startDateTime.slice(11, 16) : "09:00";
    const date = newDate || curDate;
    const time = newTime || curTime;
    let durMin = parsed.duration_min || 60;
    if (!parsed.duration_min && current.endDateTime && current.startDateTime) {
      const s = new Date(current.startDateTime).getTime();
      const e = new Date(current.endDateTime).getTime();
      if (e > s) durMin = Math.round((e - s) / 60000);
    }
    const startD = new Date(`${date}T${time}:00Z`);
    const endD = new Date(startD.getTime() + durMin * 60000);
    patch.startDateTime = `${date}T${time}:00`;
    patch.endDateTime = `${endD.getUTCFullYear()}-${pad2(endD.getUTCMonth() + 1)}-${pad2(endD.getUTCDate())}T${pad2(endD.getUTCHours())}:${pad2(endD.getUTCMinutes())}:00`;
    changes.push(`horario -> ${date} ${time}`);
  }

  const add = (parsed.add_attendees ?? []).map((e) => e.trim()).filter((e) => /.+@.+\..+/.test(e));
  const remove = (parsed.remove_attendees ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (add.length > 0 || remove.length > 0) {
    let list = current.attendees.slice();
    for (const a of add) if (!list.some((x) => x.toLowerCase() === a.toLowerCase())) list.push(a);
    if (remove.length > 0) list = list.filter((e) => !remove.includes(e.toLowerCase()));
    patch.attendees = list;
    if (add.length) changes.push(`+${add.length} convidado(s)`);
    if (remove.length) changes.push(`-${remove.length} convidado(s)`);
  }

  if (Object.keys(patch).length === 0) {
    return { error: "Nao identifiquei uma mudanca clara. Tente: \"passa pra terca 15h\" ou \"adiciona fulano@email.com\"." };
  }

  const res = await patchCalendarEvent(user.id, meeting.google_calendar_id, meeting.google_event_id, patch);
  if ("error" in res) return { error: res.error };

  if (patch.startDateTime) {
    await supabase.from("consulting_meetings").update({ held_at: patch.startDateTime }).eq("id", meetingId);
  }
  revalidatePath(`${PATH}/${meeting.company_id}`);
  return { ok: true, summary: changes.join(", ") };
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

// ============================================================
// Portal do cliente (admin) — chat, perguntas pendentes, acesso
// ============================================================

/** Historico de conversa do cliente (chat do portal) desta empresa. So leitura. */
export async function getCompanyChat(companyId: string): Promise<
  { id: string; question: string; answer: string | null; has_context: boolean; created_at: string }[]
> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("consulting_chat_messages")
    .select("id, question, answer, has_context, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  return (data ?? []) as {
    id: string;
    question: string;
    answer: string | null;
    has_context: boolean;
    created_at: string;
  }[];
}

/** Perguntas do cliente que aguardam resposta do Pedro. So leitura. */
export async function getPendingQuestions(companyId: string): Promise<
  { id: string; question: string; asked_by_name: string | null; created_at: string }[]
> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("consulting_pending_questions")
    .select("id, question, asked_by_name, created_at")
    .eq("company_id", companyId)
    .eq("status", "pendente")
    .order("created_at", { ascending: true });
  return (data ?? []) as {
    id: string;
    question: string;
    asked_by_name: string | null;
    created_at: string;
  }[];
}

/**
 * Pedro responde uma pergunta pendente do cliente. Alem de registrar a resposta,
 * cria um playbook novo (rascunho, nao compartilhavel) espelhando o padrao do
 * insights-pedro, gera o embedding em background e vincula a resposta ao chat
 * do cliente (a mensagem que ficou pendente).
 */
export async function answerPendingQuestion(
  id: string,
  answer: string
): Promise<{ ok: true } | { error: string }> {
  const admin = await requireStaff();
  if (!answer.trim()) return { error: "Escreva a resposta." };
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("consulting_pending_questions")
    .select("company_id, question")
    .eq("id", id)
    .single();
  if (!pending) return { error: "Pergunta nao encontrada." };

  const question = pending.question as string;
  const companyId = pending.company_id as string;
  const adminName =
    (admin.user_metadata?.name as string) || admin.email || "Pedro";

  // Cria um playbook novo espelhando o padrao do insights-pedro (createNewPlaybook)
  const title = question.length > 80 ? `${question.slice(0, 77)}...` : question;
  const principio = answer.slice(0, 300);
  const { data: newPlaybook, error: pbError } = await supabase
    .from("playbooks")
    .insert({
      title,
      subtitle: "Resposta ao cliente",
      body_markdown: `**Pergunta:** ${question}\n\n**Resposta:** ${answer}`,
      estrutura: { principio },
      status: "rascunho",
      is_shareable: false,
      created_by: null,
    })
    .select("id, title")
    .single();
  if (pbError) return { error: pbError.message };

  // Embedding em background (nao bloqueia a resposta)
  updatePlaybookEmbedding(newPlaybook.id, newPlaybook.title, principio).catch(() => {});

  // Marca a pergunta como respondida
  const { error: updErr } = await supabase
    .from("consulting_pending_questions")
    .update({
      status: "respondida",
      answer,
      answered_by: adminName,
      playbook_id: newPlaybook.id,
      answered_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) return { error: updErr.message };

  // Vincula a resposta a mensagem do chat do cliente que ficou pendente
  await supabase
    .from("consulting_chat_messages")
    .update({ answer, has_context: true })
    .eq("pending_question_id", id);

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

/**
 * Cria o acesso de um cliente ao portal: usuario no Supabase Auth (role 'cliente'
 * + company_id no app_metadata) e o vinculo em consulting_client_users.
 */
export async function createClientUser(
  companyId: string,
  input: { name: string; email: string; password: string }
): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  if (!input.name?.trim()) return { error: "Nome do cliente e obrigatorio." };
  if (!input.email?.trim()) return { error: "E-mail e obrigatorio." };
  if (!input.password || input.password.length < 6)
    return { error: "A senha precisa ter ao menos 6 caracteres." };

  const db = await createClient();
  const { data: created, error } = await db.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name.trim() },
    app_metadata: { role: "cliente", company_id: companyId },
  });
  if (error) {
    const msg = /already|registered|exists/i.test(error.message)
      ? "Ja existe um usuario com este e-mail."
      : error.message;
    return { error: msg };
  }

  const { error: linkErr } = await db.from("consulting_client_users").insert({
    user_id: created.user.id,
    company_id: companyId,
    name: input.name.trim(),
    email: input.email.trim(),
  });
  if (linkErr) return { error: linkErr.message };

  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

/**
 * Remove o acesso de um cliente ao portal: apaga o usuario do Supabase Auth
 * (revoga o login) e o vinculo em consulting_client_users. Equipe (requireStaff).
 */
export async function deleteClientUser(
  companyId: string,
  userId: string
): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  const db = await createClient();

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error && !/not.*found/i.test(error.message)) {
    return { error: error.message };
  }

  await db.from("consulting_client_users").delete().eq("user_id", userId);

  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}

/**
 * Redefine a senha do login do cliente. NAO existe como "ver" a senha antiga
 * (fica em hash); a equipe define uma nova e repassa ao cliente. requireStaff.
 */
export async function resetClientPassword(
  companyId: string,
  userId: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  if (!newPassword || newPassword.length < 6)
    return { error: "A senha precisa ter ao menos 6 caracteres." };
  const db = await createClient();
  const { error } = await db.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) return { error: error.message };
  revalidatePath(`${PATH}/${companyId}`);
  return { ok: true };
}
