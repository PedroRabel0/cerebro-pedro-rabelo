"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Wand2,
  MessageSquare,
  Copy,
  Check,
  CalendarPlus,
  CalendarClock,
  FileText,
  Upload,
  ExternalLink,
  User,
  Mail,
  CheckSquare,
  Square,
  Sparkles,
  Send,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Trophy,
  ClipboardList,
  PhoneCall,
  MessagesSquare,
  HelpCircle,
  KeyRound,
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import type { CompanyDetail as CompanyDetailData } from "../actions";
import {
  updateCompany,
  touchCompany,
  createContact,
  deleteContact,
  createMeeting,
  deleteMeeting,
  processMeeting,
  scheduleMeeting,
  updateMeetingOnCalendar,
  generateMeetingAgenda,
  createTask,
  updateTask,
  deleteTask,
  generateTaskMessage,
  uploadDocument,
  getDocumentUrl,
  deleteDocument,
  createStep,
  toggleStep,
  deleteStep,
  createWin,
  deleteWin,
  addTaskReminderToCalendar,
  askConsultoria,
  getCalendarList,
  answerPendingQuestion,
  createClientUser,
  deleteClientUser,
  resetClientPassword,
} from "../actions";
import type { ConsultingContact, ConsultingTask, ConsultingMeeting, ConsultingWin } from "@/lib/supabase/types";

/** Formata um valor em reais (R$). Sem casas decimais quando inteiro. */
function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const HEALTH_DOT: Record<string, string> = { ok: "bg-green", atencao: "bg-yellow-500", risco: "bg-red" };
const HEALTH_LABEL: Record<string, string> = { ok: "Cliente em dia", atencao: "Merece atenção", risco: "Esfriando" };

const input =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none";
const card = "rounded-xl border border-border bg-card p-4";

function waDigits(n: string | null | undefined): string {
  return (n || "").replace(/\D/g, "");
}
function waLink(text: string, number?: string | null): string {
  const t = encodeURIComponent(text);
  const d = waDigits(number);
  return d ? `https://wa.me/${d}?text=${t}` : `https://wa.me/?text=${t}`;
}
function gcalLink(title: string, dateStr: string | null, details: string): string {
  const t = encodeURIComponent(title);
  const det = encodeURIComponent(details);
  if (!dateStr) return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${t}&details=${det}`;
  const start = dateStr.replace(/-/g, "");
  const dt = new Date(dateStr + "T00:00:00");
  dt.setDate(dt.getDate() + 1);
  const end = dt.toISOString().slice(0, 10).replace(/-/g, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${t}&dates=${start}/${end}&details=${det}`;
}

function SectionTitle({ icon: Icon, children, count }: { icon: typeof User; children: React.ReactNode; count?: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
      <Icon className="h-4 w-4 text-accent" />
      {children}
      {count !== undefined && <span className="text-xs font-normal text-text-muted">· {count}</span>}
    </h2>
  );
}

export default function CompanyDetail({
  data,
  googleConnected,
}: {
  data: CompanyDetailData;
  googleConnected: boolean;
}) {
  const { company } = data;
  const router = useRouter();
  const refresh = () => router.refresh();

  const [calendars, setCalendars] = useState<{ id: string; summary: string }[]>([]);
  const [calendarId, setCalendarIdState] = useState("primary");

  useEffect(() => {
    if (!googleConnected) return;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("consultoria_cal") : null;
    if (saved) setCalendarIdState(saved);
    getCalendarList().then((cals) => setCalendars(cals));
  }, [googleConnected]);

  function setCalendarId(id: string) {
    setCalendarIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem("consultoria_cal", id);
  }

  return (
    <div className="space-y-5">
      <Link href="/consultoria" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <CompanyHeader
        company={company}
        health={data.health}
        daysSinceContact={data.days_since_contact}
        onSaved={refresh}
      />
      <ContractCard company={company} renewalInDays={data.renewal_in_days} onSaved={refresh} />

      <div className="grid gap-5 lg:grid-cols-2">
        <ContactsSection companyId={company.id} contacts={data.contacts} onChange={refresh} />
        <RoadmapSection companyId={company.id} steps={data.steps} onChange={refresh} />
      </div>

      <WinsSection companyId={company.id} wins={data.wins} onChange={refresh} />

      <MeetingsSection companyId={company.id} meetings={data.meetings} contacts={data.contacts} googleConnected={googleConnected} calendars={calendars} onChange={refresh} />
      <TasksSection
        companyId={company.id}
        tasks={data.tasks}
        meetings={data.meetings}
        contacts={data.contacts}
        googleConnected={googleConnected}
        calendars={calendars}
        calendarId={calendarId}
        onCalendarChange={setCalendarId}
        onChange={refresh}
      />
      <AskBrainSection companyId={company.id} />
      <PendingQuestionsSection companyId={company.id} questions={data.pending_questions} onChange={refresh} />
      <ClientChatSection chat={data.client_chat} />
      <ClientAccessSection companyId={company.id} clientUsers={data.client_users} onChange={refresh} />
      <DocumentsSection companyId={company.id} documents={data.documents} onChange={refresh} />
    </div>
  );
}

function AskBrainSection({ companyId }: { companyId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    const res = await askConsultoria(companyId, question);
    setLoading(false);
    setAnswer("error" in res ? res.error : res.answer);
  }

  return (
    <div className="rounded-xl border border-red/20 bg-red/5 p-4">
      <SectionTitle icon={Sparkles}>Perguntar ao Cérebro</SectionTitle>
      <p className="mb-3 -mt-1 text-xs text-text-muted">
        Embasado nos playbooks do Pedro + o contexto desta empresa
      </p>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ex: que estratégia de recompra faz sentido pra essa empresa?"
          aria-label="Pergunta ao Cérebro"
          className={input}
        />
        <button
          onClick={ask}
          disabled={loading || !question.trim()}
          aria-label="Perguntar"
          className="flex items-center gap-1.5 rounded-lg bg-red px-3 text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {answer && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg bg-card px-4 py-3 text-sm text-text-secondary">
          {answer}
        </div>
      )}
    </div>
  );
}

function PendingQuestionsSection({
  companyId,
  questions,
  onChange,
}: {
  companyId: string;
  questions: CompanyDetailData["pending_questions"];
  onChange: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  function respond(id: string) {
    const text = (answers[id] || "").trim();
    if (!text) return;
    setError(null);
    setBusy(id);
    start(async () => {
      const res = await answerPendingQuestion(id, text);
      setBusy(null);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onChange();
    });
  }

  return (
    <div className={card}>
      <SectionTitle icon={HelpCircle} count={questions.length}>Perguntas pendentes</SectionTitle>
      <p className="mb-3 -mt-1 text-xs text-text-muted">
        Perguntas do cliente que o Cérebro não respondeu sozinho — sua resposta vira um playbook.
      </p>
      {questions.length === 0 ? (
        <p className="text-xs text-text-muted">Nenhuma pergunta aguardando resposta.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="rounded-lg border border-border/60 p-3">
              <p className="text-sm text-text">{q.question}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {q.asked_by_name || "Cliente"} · {new Date(q.created_at).toLocaleString("pt-BR")}
              </p>
              <textarea
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Escreva a resposta para o cliente..."
                aria-label="Resposta à pergunta"
                rows={3}
                className={`${input} mt-2 resize-none`}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => respond(q.id)}
                  disabled={busy === q.id || !(answers[q.id] || "").trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Responder
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red">{error}</p>}
    </div>
  );
}

function ClientChatSection({ chat }: { chat: CompanyDetailData["client_chat"] }) {
  return (
    <div className={card}>
      <SectionTitle icon={MessagesSquare} count={chat.length}>Conversas do cliente</SectionTitle>
      {chat.length === 0 ? (
        <p className="text-xs text-text-muted">O cliente ainda não conversou pelo portal.</p>
      ) : (
        <div className="space-y-3">
          {chat.map((m) => (
            <div key={m.id} className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium text-text">{m.question}</p>
              {m.answer ? (
                <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-surface/60 px-3 py-2 text-xs text-text-secondary">
                  {m.answer}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-yellow-500">Aguardando resposta.</p>
              )}
              <p className="mt-1 text-[11px] text-text-muted">{new Date(m.created_at).toLocaleString("pt-BR")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientAccessSection({ companyId, clientUsers, onChange }: { companyId: string; clientUsers: CompanyDetailData["client_users"]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetDone, setResetDone] = useState<string | null>(null);
  const [, start] = useTransition();

  function doReset(userId: string) {
    if (resetPw.length < 6) {
      setError("A nova senha precisa ter ao menos 6 caracteres.");
      return;
    }
    setError(null);
    start(async () => {
      try {
        const res = await resetClientPassword(companyId, userId, resetPw);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setResetDone(userId);
        setResetId(null);
        setResetPw("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao redefinir senha.");
      }
    });
  }

  function remove(userId: string) {
    setError(null);
    setDone(false);
    setRemovingId(userId);
    start(async () => {
      try {
        const res = await deleteClientUser(companyId, userId);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        onChange();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao remover acesso.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  function create() {
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setError(null);
    setDone(false);
    setBusy(true);
    start(async () => {
      try {
        const res = await createClientUser(companyId, { name, email, password });
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setName(""); setEmail(""); setPassword(""); setDone(true);
        onChange();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao criar acesso.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className={card}>
      <SectionTitle icon={KeyRound}>Acesso do cliente</SectionTitle>
      <p className="mb-3 -mt-1 text-xs text-text-muted">
        Crie o login do cliente no portal (ele vê o próprio painel e conversa com o Cérebro).
      </p>
      {clientUsers.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {clientUsers.map((u) => (
            <div key={u.id} className="rounded-lg border border-border bg-surface px-3 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-text">{u.name || "Cliente"}</p>
                  <p className="truncate text-[11px] text-text-muted">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => { setResetId(resetId === u.user_id ? null : u.user_id); setResetPw(""); setResetDone(null); setError(null); }}
                    aria-label="Redefinir senha"
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-text-muted transition hover:border-accent/40 hover:text-accent"
                  >
                    <KeyRound className="h-3 w-3" /> Senha
                  </button>
                  <button
                    onClick={() => remove(u.user_id)}
                    disabled={removingId === u.user_id}
                    aria-label="Remover acesso"
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-text-muted transition hover:border-red/40 hover:text-red disabled:opacity-50"
                  >
                    {removingId === u.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Remover
                  </button>
                </div>
              </div>
              {resetId === u.user_id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    placeholder="Nova senha (mín. 6) — visível p/ copiar"
                    aria-label="Nova senha do cliente"
                    className={input}
                  />
                  <button
                    onClick={() => doReset(u.user_id)}
                    disabled={resetPw.length < 6}
                    className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
              )}
              {resetDone === u.user_id && (
                <p className="mt-1 text-[11px] text-green">Senha atualizada — repasse ao cliente.</p>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" aria-label="Nome do cliente" className={input} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" aria-label="E-mail do cliente" className={input} />
          <div className="relative">
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha (mín. 6 caracteres)" aria-label="Senha do cliente" className={`${input} pr-9`} />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted transition hover:text-text">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={create}
            disabled={busy || !name.trim() || !email.trim() || !password.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Criar acesso
          </button>
          {done && <span className="flex items-center gap-1 text-xs text-green"><Check className="h-3.5 w-3.5" /> Acesso criado.</span>}
        </div>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------

function CompanyHeader({
  company,
  health,
  daysSinceContact,
  onSaved,
}: {
  company: CompanyDetailData["company"];
  health: CompanyDetailData["health"];
  daysSinceContact: number | null;
  onSaved: () => void;
}) {
  const [, start] = useTransition();
  const [touching, setTouching] = useState(false);
  const save = (fields: Parameters<typeof updateCompany>[1]) =>
    start(async () => {
      await updateCompany(company.id, fields);
      onSaved();
    });

  async function registerContact() {
    setTouching(true);
    await touchCompany(company.id);
    setTouching(false);
    onSaved();
  }

  const contactLabel =
    daysSinceContact === null
      ? "sem contato registrado"
      : daysSinceContact <= 0
        ? "último contato: hoje"
        : `último contato há ${daysSinceContact} dia${daysSinceContact > 1 ? "s" : ""}`;

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-xl font-bold text-text">{company.name}</h1>
        <select
          value={company.status}
          onChange={(e) => save({ status: e.target.value as typeof company.status })}
          aria-label="Status da consultoria"
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
        >
          <option value="ativa">Ativa</option>
          <option value="pausada">Pausada</option>
          <option value="concluida">Concluída</option>
        </select>
      </div>
      {company.sector && <p className="mt-1 text-xs text-text-muted">{company.sector}</p>}

      {company.status === "ativa" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] text-text-secondary">
            <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[health]}`} />
            {HEALTH_LABEL[health]} · {contactLabel}
          </span>
          <button
            onClick={registerContact}
            disabled={touching}
            className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-text-muted transition hover:border-accent/40 hover:text-text disabled:opacity-50"
          >
            {touching ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneCall className="h-3 w-3" />}
            Registrar contato hoje
          </button>
        </div>
      )}

      <textarea
        defaultValue={company.goal || ""}
        onBlur={(e) => e.target.value !== (company.goal || "") && save({ goal: e.target.value })}
        placeholder="Objetivo da consultoria..."
        aria-label="Objetivo da consultoria"
        rows={2}
        className={`${input} mt-3 resize-none`}
      />
    </div>
  );
}

function ContractCard({
  company,
  renewalInDays,
  onSaved,
}: {
  company: CompanyDetailData["company"];
  renewalInDays: number | null;
  onSaved: () => void;
}) {
  const [, start] = useTransition();
  const save = (fields: Parameters<typeof updateCompany>[1]) =>
    start(async () => {
      await updateCompany(company.id, fields);
      onSaved();
    });

  const renewalSoon = company.status === "ativa" && renewalInDays !== null && renewalInDays <= 30;

  return (
    <div className={card}>
      <SectionTitle icon={FileText}>Contrato, financeiro &amp; renovação</SectionTitle>

      {renewalSoon && (
        <div
          className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            (renewalInDays as number) < 0
              ? "border-red/30 bg-red/5 text-red"
              : "border-yellow-500/30 bg-yellow-500/5 text-yellow-500"
          }`}
        >
          <CalendarClock className="h-4 w-4 shrink-0" />
          {(renewalInDays as number) < 0
            ? `Contrato venceu há ${Math.abs(renewalInDays as number)} dia(s) — hora de renovar ou encerrar.`
            : (renewalInDays as number) === 0
              ? "O contrato vence hoje — puxe a renovação."
              : `O contrato renova em ${renewalInDays} dia(s) — bom momento para alinhar a renovação.`}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-text-muted">
          Contrato
          <select
            value={company.contract_status}
            onChange={(e) => save({ contract_status: e.target.value as typeof company.contract_status })}
            aria-label="Status do contrato"
            className={`${input} mt-1`}
          >
            <option value="sem_contrato">Sem contrato</option>
            <option value="enviado">Enviado</option>
            <option value="assinado">Assinado</option>
          </select>
        </label>
        <label className="text-xs text-text-muted">
          Pagamento
          <select
            value={company.payment_status}
            onChange={(e) => save({ payment_status: e.target.value as typeof company.payment_status })}
            aria-label="Status do pagamento"
            className={`${input} mt-1`}
          >
            <option value="em_dia">Em dia</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </label>
        <label className="text-xs text-text-muted">
          Dia do vencimento
          <input
            type="number"
            min={1}
            max={31}
            defaultValue={company.billing_day ?? ""}
            onBlur={(e) => {
              const v = e.target.value ? Math.min(31, Math.max(1, Number(e.target.value))) : null;
              if (v !== (company.billing_day ?? null)) save({ billing_day: v });
            }}
            placeholder="ex: 5"
            aria-label="Dia do vencimento mensal"
            className={`${input} mt-1`}
          />
        </label>
        <label className="text-xs text-text-muted">
          Mensalidade (R$/mês)
          <input
            type="number"
            defaultValue={company.monthly_fee ?? ""}
            onBlur={(e) => save({ monthly_fee: e.target.value ? Number(e.target.value) : null })}
            placeholder="0"
            aria-label="Mensalidade recorrente"
            className={`${input} mt-1`}
          />
        </label>
        <label className="text-xs text-text-muted">
          Valor total do contrato (R$)
          <input
            type="number"
            defaultValue={company.contract_value ?? ""}
            onBlur={(e) => save({ contract_value: e.target.value ? Number(e.target.value) : null })}
            placeholder="opcional"
            aria-label="Valor total do contrato"
            className={`${input} mt-1`}
          />
        </label>
        <div />
        <label className="text-xs text-text-muted">
          Início do contrato
          <input
            type="date"
            defaultValue={company.contract_start ?? ""}
            onBlur={(e) => e.target.value !== (company.contract_start ?? "") && save({ contract_start: e.target.value || null })}
            aria-label="Início do contrato"
            className={`${input} mt-1`}
          />
        </label>
        <label className="text-xs text-text-muted">
          Renovação / fim do contrato
          <input
            type="date"
            defaultValue={company.contract_end ?? ""}
            onBlur={(e) => e.target.value !== (company.contract_end ?? "") && save({ contract_end: e.target.value || null })}
            aria-label="Data de renovação ou fim do contrato"
            className={`${input} mt-1`}
          />
        </label>
        {company.monthly_fee ? (
          <div className="flex flex-col justify-end text-xs text-text-muted">
            <span className="flex items-center gap-1 text-green">
              <CircleDollarSign className="h-3.5 w-3.5" /> {formatBRL(company.monthly_fee)}/mês
            </span>
          </div>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

function WinsSection({
  companyId,
  wins,
  onChange,
}: {
  companyId: string;
  wins: ConsultingWin[];
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState("");
  const [achievedOn, setAchievedOn] = useState("");
  const [, start] = useTransition();

  function add() {
    if (!description.trim()) return;
    start(async () => {
      await createWin(companyId, { description, metric, achieved_on: achievedOn || undefined });
      setDescription(""); setMetric(""); setAchievedOn(""); setAdding(false);
      onChange();
    });
  }
  async function remove(id: string) {
    if (!(await confirm("Apagar esta vitória?"))) return;
    start(async () => { await deleteWin(id, companyId); onChange(); });
  }

  return (
    <div className={card}>
      <SectionTitle icon={Trophy} count={wins.length}>Vitórias &amp; resultados</SectionTitle>
      <p className="mb-3 -mt-1 text-xs text-text-muted">
        Registre conquistas do cliente — prova de valor pra hora da renovação.
      </p>
      <div className="space-y-2">
        {wins.map((w) => (
          <div key={w.id} className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text">{w.description}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {w.metric && <span className="rounded bg-green/10 px-1.5 py-0.5 text-green">{w.metric}</span>}
                {w.metric && (w.achieved_on ? " · " : "")}
                {w.achieved_on && <span>{new Date(w.achieved_on + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
              </p>
            </div>
            <button onClick={() => remove(w.id)} aria-label="Apagar vitória" className="rounded p-1 text-text-muted hover:text-red">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {wins.length === 0 && <p className="text-xs text-text-muted">Nenhuma vitória registrada ainda.</p>}
      </div>

      {adding ? (
        <div className="mt-3 space-y-2">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que foi conquistado" aria-label="Descrição da vitória" className={input} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="Métrica (ex: +30% faturamento)" aria-label="Métrica da vitória" className={input} />
            <input type="date" value={achievedOn} onChange={(e) => setAchievedOn(e.target.value)} aria-label="Data da vitória" className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={!description.trim()} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">Adicionar</button>
            <button onClick={() => setAdding(false)} className="px-2 py-1.5 text-xs text-text-muted hover:text-text">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1.5 text-xs text-accent hover:underline">
          <Plus className="h-3.5 w-3.5" /> Registrar vitória
        </button>
      )}
    </div>
  );
}

function ContactsSection({
  companyId,
  contacts,
  onChange,
}: {
  companyId: string;
  contacts: ConsultingContact[];
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [, start] = useTransition();

  function add() {
    if (!name.trim()) return;
    start(async () => {
      await createContact(companyId, { name, role, whatsapp, email });
      setName(""); setRole(""); setWhatsapp(""); setEmail(""); setAdding(false);
      onChange();
    });
  }
  async function remove(id: string, n: string) {
    if (!(await confirm(`Apagar o contato ${n}?`))) return;
    start(async () => { await deleteContact(id, companyId); onChange(); });
  }

  return (
    <div className={card}>
      <SectionTitle icon={User} count={contacts.length}>Contatos</SectionTitle>
      <div className="space-y-2">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text">{c.name} {c.role && <span className="text-text-muted">· {c.role}</span>}</p>
              <p className="truncate text-[11px] text-text-muted">{c.whatsapp || "sem WhatsApp"}{c.email ? ` · ${c.email}` : ""}</p>
            </div>
            {c.whatsapp && (
              <a href={waLink("Olá!", c.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${c.name}`} className="rounded-lg p-1.5 text-green hover:bg-green/10">
                <MessageSquare className="h-4 w-4" />
              </a>
            )}
            <button onClick={() => remove(c.id, c.name)} aria-label={`Apagar ${c.name}`} className="rounded-lg p-1.5 text-text-muted hover:bg-red/10 hover:text-red">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {contacts.length === 0 && <p className="text-xs text-text-muted">Nenhum contato ainda.</p>}
      </div>

      {adding ? (
        <div className="mt-3 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" aria-label="Nome do contato" className={input} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Cargo" aria-label="Cargo" className={input} />
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (com DDD)" aria-label="WhatsApp" className={input} />
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (opcional)" aria-label="Email" className={input} />
          <div className="flex gap-2">
            <button onClick={add} disabled={!name.trim()} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">Adicionar</button>
            <button onClick={() => setAdding(false)} className="px-2 py-1.5 text-xs text-text-muted hover:text-text">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1.5 text-xs text-accent hover:underline">
          <Plus className="h-3.5 w-3.5" /> Adicionar contato
        </button>
      )}
    </div>
  );
}

function RoadmapSection({
  companyId,
  steps,
  onChange,
}: {
  companyId: string;
  steps: CompanyDetailData["steps"];
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [, start] = useTransition();

  function add() {
    if (!title.trim()) return;
    start(async () => { await createStep(companyId, { title, target_date: date || undefined }); setTitle(""); setDate(""); onChange(); });
  }

  return (
    <div className={card}>
      <SectionTitle icon={CheckSquare} count={steps.length}>Roadmap</SectionTitle>
      <div className="space-y-1.5">
        {steps.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => start(async () => { await toggleStep(s.id, companyId, s.status !== "feita"); onChange(); })}
              aria-label={s.status === "feita" ? "Marcar como pendente" : "Marcar como feito"}
              className="text-text-muted hover:text-accent"
            >
              {s.status === "feita" ? <CheckSquare className="h-4 w-4 text-green" /> : <Square className="h-4 w-4" />}
            </button>
            <span className={`flex-1 text-sm ${s.status === "feita" ? "text-text-muted line-through" : "text-text"}`}>{s.title}</span>
            {s.target_date && <span className="text-[11px] text-text-muted">{s.target_date}</span>}
            <button
              onClick={async () => { if (await confirm("Apagar este passo?")) start(async () => { await deleteStep(s.id, companyId); onChange(); }); }}
              aria-label="Apagar passo"
              className="rounded p-1 text-text-muted hover:text-red"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {steps.length === 0 && <p className="text-xs text-text-muted">Defina os passos do plano.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Novo passo" aria-label="Novo passo do roadmap" className={input} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data-alvo do passo" className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent focus:outline-none" />
        <button onClick={add} disabled={!title.trim()} aria-label="Adicionar passo" className="rounded-lg bg-accent px-3 text-white hover:brightness-110 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function MeetingsSection({
  companyId,
  meetings,
  contacts,
  googleConnected,
  calendars,
  onChange,
}: {
  companyId: string;
  meetings: CompanyDetailData["meetings"];
  contacts: ConsultingContact[];
  googleConnected: boolean;
  calendars: { id: string; summary: string }[];
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Agendar reuniao (cria evento no Google + registra)
  const [sched, setSched] = useState(false);
  const [sTitle, setSTitle] = useState("");
  const [sDate, setSDate] = useState("");
  const [sTime, setSTime] = useState("09:00");
  const [sRecur, setSRecur] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");
  const [sCal, setSCal] = useState("primary");
  const [sEmails, setSEmails] = useState("");
  const [sBusy, setSBusy] = useState(false);
  const [sErr, setSErr] = useState<string | null>(null);

  const contactsWithEmail = contacts.filter((c) => c.email);
  function addEmail(email: string) {
    setSEmails((prev) => {
      const list = prev.split(/[\s,;]+/).filter(Boolean);
      if (list.includes(email)) return prev;
      return [...list, email].join(", ");
    });
  }

  function add() {
    if (!title.trim()) return;
    start(async () => {
      await createMeeting(companyId, { title, transcript });
      setTitle(""); setTranscript(""); setAdding(false); onChange();
    });
  }

  async function doSchedule() {
    if (!sTitle.trim() || !sDate) return;
    setSBusy(true); setSErr(null);
    const attendees = sEmails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    const res = await scheduleMeeting(companyId, {
      title: sTitle, date: sDate, time: sTime, recurrence: sRecur, calendarId: sCal, attendees,
    });
    setSBusy(false);
    if ("error" in res) { setSErr(res.error); return; }
    setSTitle(""); setSDate(""); setSTime("09:00"); setSRecur("none"); setSEmails(""); setSched(false);
    onChange();
  }
  async function process(id: string) {
    setProcessing(id); setMsg(null);
    const res = await processMeeting(id);
    setProcessing(null);
    if ("error" in res) setMsg(res.error);
    else {
      setMsg(
        res.created > 0
          ? `${res.created} tarefa(s) criada(s) — veja abaixo.`
          : "Resumo gerado. Nenhuma tarefa identificada nesta reunião."
      );
      onChange();
    }
  }

  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editResult, setEditResult] = useState<string | null>(null);

  async function doEdit(mId: string) {
    if (!editText.trim()) return;
    setEditBusy(true); setEditResult(null);
    const res = await updateMeetingOnCalendar(mId, editText);
    setEditBusy(false);
    if ("error" in res) { setEditResult("Erro: " + res.error); return; }
    setEditResult("Feito: " + res.summary);
    setEditText("");
    onChange();
  }

  // Pauta da proxima reuniao (IA)
  const [agenda, setAgenda] = useState<string | null>(null);
  const [agendaBusy, setAgendaBusy] = useState(false);
  const [agendaErr, setAgendaErr] = useState<string | null>(null);
  const [agendaCopied, setAgendaCopied] = useState(false);

  async function genAgenda() {
    setAgendaBusy(true); setAgendaErr(null);
    const res = await generateMeetingAgenda(companyId);
    setAgendaBusy(false);
    if ("error" in res) { setAgendaErr(res.error); return; }
    setAgenda(res.agenda);
  }
  function copyAgenda() {
    if (agenda) { navigator.clipboard.writeText(agenda); setAgendaCopied(true); setTimeout(() => setAgendaCopied(false), 1500); }
  }

  return (
    <div className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={Sparkles} count={meetings.length}>Reuniões</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={genAgenda} disabled={agendaBusy} className="flex items-center gap-1.5 text-xs text-red hover:underline disabled:opacity-50">
            {agendaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />} Gerar pauta
          </button>
          {googleConnected && !sched && (
            <button onClick={() => { setSched(true); setSCal(calendars[0]?.id || "primary"); }} className="flex items-center gap-1.5 text-xs text-accent hover:underline">
              <CalendarPlus className="h-3.5 w-3.5" /> Agendar
            </button>
          )}
          {!adding && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text">
              <Plus className="h-3.5 w-3.5" /> Registrar reunião
            </button>
          )}
        </div>
      </div>

      {agendaErr && <p className="mb-3 text-xs text-red">{agendaErr}</p>}
      {agenda && (
        <div className="mb-4 rounded-lg border border-red/20 bg-red/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red">
              <ClipboardList className="h-3.5 w-3.5" /> Pauta sugerida pra próxima reunião
            </span>
            <div className="flex items-center gap-2">
              <button onClick={copyAgenda} className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text">
                {agendaCopied ? <Check className="h-3 w-3 text-green" /> : <Copy className="h-3 w-3" />} Copiar
              </button>
              <button onClick={() => setAgenda(null)} className="text-[11px] text-text-muted hover:text-text">Fechar</button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-xs text-text-secondary">{agenda}</p>
        </div>
      )}

      {sched && (
        <div className="mb-4 space-y-2 rounded-lg border border-accent/30 bg-surface/40 p-3">
          <p className="text-xs font-medium text-text">Agendar reunião — cria o evento na Google Agenda</p>
          <input value={sTitle} onChange={(e) => setSTitle(e.target.value)} placeholder="Título (ex: Reunião Agência Prince)" aria-label="Título da reunião agendada" className={input} autoFocus />
          <div className="flex flex-wrap gap-2">
            <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} aria-label="Data" className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            <input type="time" value={sTime} onChange={(e) => setSTime(e.target.value)} aria-label="Horário" className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            <select value={sRecur} onChange={(e) => setSRecur(e.target.value as typeof sRecur)} aria-label="Recorrência" className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent focus:outline-none">
              <option value="none">Não repete</option>
              <option value="weekly">Toda semana</option>
              <option value="biweekly">A cada 2 semanas</option>
              <option value="monthly">Todo mês</option>
            </select>
            {calendars.length > 1 && (
              <select value={sCal} onChange={(e) => setSCal(e.target.value)} aria-label="Agenda" className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent focus:outline-none">
                {calendars.map((c) => <option key={c.id} value={c.id}>{c.summary}</option>)}
              </select>
            )}
          </div>
          <input value={sEmails} onChange={(e) => setSEmails(e.target.value)} placeholder="Emails dos convidados (separados por vírgula)" aria-label="Emails dos convidados" className={input} />
          {contactsWithEmail.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-text-muted">Adicionar contato:</span>
              {contactsWithEmail.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addEmail(c.email as string)}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted transition hover:border-accent/40 hover:text-text"
                >
                  + {c.name}
                </button>
              ))}
            </div>
          )}
          {sErr && <p className="text-xs text-red">{sErr}</p>}
          <div className="flex gap-2">
            <button onClick={doSchedule} disabled={!sTitle.trim() || !sDate || sBusy} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {sBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />} Agendar e criar na agenda
            </button>
            <button onClick={() => setSched(false)} className="px-2 py-1.5 text-xs text-text-muted hover:text-text">Cancelar</button>
          </div>
        </div>
      )}

      {adding && (
        <div className="mb-4 space-y-2 rounded-lg border border-accent/30 bg-surface/40 p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da reunião (ex: Kickoff)" aria-label="Título da reunião" className={input} autoFocus />
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Cole aqui a transcrição da reunião..." aria-label="Transcrição da reunião" rows={5} className={`${input} resize-none`} />
          <div className="flex gap-2">
            <button onClick={add} disabled={!title.trim()} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">Salvar reunião</button>
            <button onClick={() => setAdding(false)} className="px-2 py-1.5 text-xs text-text-muted hover:text-text">Cancelar</button>
          </div>
        </div>
      )}

      {msg && <p className="mb-3 rounded-lg bg-surface px-3 py-2 text-xs text-text-secondary">{msg}</p>}

      <div className="space-y-3">
        {meetings.map((m) => (
          <div key={m.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium text-text">{m.title}</span>
              <span className="text-[11px] text-text-muted">
                {new Date(m.held_at).toLocaleDateString("pt-BR")}
                {m.google_event_id && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-green"><CalendarCheck className="h-3 w-3" /> na agenda</span>
                )}
              </span>
              {m.transcript && (
                <button
                  onClick={() => process(m.id)}
                  disabled={processing === m.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-text transition hover:border-accent/40 disabled:opacity-50"
                >
                  {processing === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Processar reunião
                </button>
              )}
              <button onClick={async () => { if (await confirm("Apagar esta reunião?")) start(async () => { await deleteMeeting(m.id, companyId); onChange(); }); }} aria-label="Apagar reunião" className="rounded p-1 text-text-muted hover:text-red">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {m.summary && (
              <div className="mt-2">
                <button
                  onClick={() => toggleCollapsed(m.id)}
                  aria-expanded={!collapsed.has(m.id)}
                  className="flex items-center gap-1 text-[11px] font-medium text-text-muted transition hover:text-text"
                >
                  {collapsed.has(m.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Resumo processado
                </button>
                {!collapsed.has(m.id) && (
                  <p className="mt-1 whitespace-pre-wrap rounded bg-surface/50 px-3 py-2 text-xs text-text-secondary">{m.summary}</p>
                )}
              </div>
            )}
            {!m.transcript && !m.google_event_id && <p className="mt-1 text-[11px] text-text-muted">Sem transcrição — edite a reunião pra colar.</p>}
            {m.google_event_id && (
              <div className="mt-2">
                {editId === m.id ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && doEdit(m.id)}
                        placeholder={'Ex: "passa pra terça 15h", "adiciona joao@x.com", "tira o Thiago"'}
                        aria-label="Alteração na agenda"
                        className={input}
                        autoFocus
                      />
                      <button onClick={() => doEdit(m.id)} disabled={editBusy || !editText.trim()} aria-label="Aplicar alteração" className="rounded-lg bg-accent px-3 text-white hover:brightness-110 disabled:opacity-50">
                        {editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      </button>
                      <button onClick={() => { setEditId(null); setEditResult(null); setEditText(""); }} className="px-2 text-xs text-text-muted hover:text-text">Fechar</button>
                    </div>
                    {editResult && <p className={`text-[11px] ${editResult.startsWith("Erro") ? "text-red" : "text-green"}`}>{editResult}</p>}
                  </div>
                ) : (
                  <button onClick={() => { setEditId(m.id); setEditResult(null); setEditText(""); }} className="flex items-center gap-1.5 text-[11px] text-accent hover:underline">
                    <Wand2 className="h-3 w-3" /> Alterar na agenda
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {meetings.length === 0 && !adding && <p className="text-xs text-text-muted">Nenhuma reunião ainda. Cole a transcrição de uma reunião pra extrair as tarefas.</p>}
      </div>
    </div>
  );
}

function TasksSection({
  companyId,
  tasks,
  meetings,
  contacts,
  googleConnected,
  calendars,
  calendarId,
  onCalendarChange,
  onChange,
}: {
  companyId: string;
  tasks: ConsultingTask[];
  meetings: ConsultingMeeting[];
  contacts: ConsultingContact[];
  googleConnected: boolean;
  calendars: { id: string; summary: string }[];
  calendarId: string;
  onCalendarChange: (id: string) => void;
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [desc, setDesc] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function add() {
    if (!desc.trim()) return;
    start(async () => { await createTask(companyId, { description: desc, owner_name: owner, due_date: due || undefined }); setDesc(""); setOwner(""); setDue(""); onChange(); });
  }

  const pending = tasks.filter((t) => t.status !== "feita");

  const renderTask = (t: ConsultingTask) => (
    <TaskRow
      key={t.id}
      task={t}
      companyId={companyId}
      contacts={contacts}
      googleConnected={googleConnected}
      calendarId={calendarId}
      onChange={onChange}
      onDelete={async () => {
        if (await confirm("Apagar esta tarefa?")) start(async () => { await deleteTask(t.id, companyId); onChange(); });
      }}
    />
  );

  // Pendentes primeiro, concluidas depois (mas visiveis no mesmo grupo, pra poder desmarcar)
  const sortPendingFirst = (ts: ConsultingTask[]) =>
    [...ts].sort((a, b) => (a.status === "feita" ? 1 : 0) - (b.status === "feita" ? 1 : 0));
  // Agrupa as tarefas pela reuniao de origem (as manuais ficam em "avulsas")
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const groups: { key: string; label: string; date: string | null; tasks: ConsultingTask[]; pendingCount: number }[] = [];
  for (const m of meetings) {
    const ts = tasks.filter((t) => t.meeting_id === m.id);
    if (ts.length) groups.push({ key: m.id, label: m.title, date: m.held_at, tasks: sortPendingFirst(ts), pendingCount: ts.filter((t) => t.status !== "feita").length });
  }
  const avulsas = tasks.filter((t) => !t.meeting_id || !meetingById.has(t.meeting_id));
  if (avulsas.length) groups.push({ key: "__avulsas__", label: "Tarefas avulsas", date: null, tasks: sortPendingFirst(avulsas), pendingCount: avulsas.filter((t) => t.status !== "feita").length });
  const hasMeetingGroups = groups.some((g) => g.key !== "__avulsas__");

  return (
    <div className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={CheckSquare} count={pending.length}>Tarefas</SectionTitle>
        {googleConnected && calendars.length > 1 && (
          <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <CalendarCheck className="h-3.5 w-3.5" /> Lembretes em:
            <select
              value={calendarId}
              onChange={(e) => onCalendarChange(e.target.value)}
              aria-label="Agenda para os lembretes"
              className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-text focus:border-accent focus:outline-none"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>{c.summary}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-text-muted">Nenhuma tarefa ainda.</p>
      ) : hasMeetingGroups ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.key}>
              <button
                onClick={() => toggleGroup(g.key)}
                aria-expanded={!collapsedGroups.has(g.key)}
                className="flex w-full items-center gap-1.5 text-[11px] font-medium text-text-muted transition hover:text-text"
              >
                {collapsedGroups.has(g.key) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {g.key !== "__avulsas__" && <Sparkles className="h-3 w-3 text-accent" />}
                <span className="text-text">{g.label}</span>
                {g.date && <span>· {new Date(g.date).toLocaleDateString("pt-BR")}</span>}
                {g.pendingCount > 0 ? (
                  <span>· {g.pendingCount} pendente(s)</span>
                ) : (
                  <span className="text-green">· tudo feito ✓</span>
                )}
              </button>
              {!collapsedGroups.has(g.key) && (
                <div className="mt-2 space-y-2 border-l border-border/40 pl-3">
                  {g.tasks.map(renderTask)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{sortPendingFirst(tasks).map(renderTask)}</div>
      )}

      <div className="mt-3 space-y-2 rounded-lg border border-border/60 p-3">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Nova tarefa" aria-label="Descrição da tarefa" className={input} />
        <div className="flex gap-2">
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Responsável" aria-label="Responsável" className={input} />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Prazo" className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent focus:outline-none" />
          <button onClick={add} disabled={!desc.trim()} aria-label="Adicionar tarefa" className="rounded-lg bg-accent px-3 text-white hover:brightness-110 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
        </div>
      </div>

    </div>
  );
}

function TaskRow({
  task,
  companyId,
  contacts,
  googleConnected,
  calendarId,
  onChange,
  onDelete,
}: {
  task: ConsultingTask;
  companyId: string;
  contacts: ConsultingContact[];
  googleConnected: boolean;
  calendarId: string;
  onChange: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [gen, setGen] = useState(false);
  const [message, setMessage] = useState<string | null>(task.message_draft);
  const [copied, setCopied] = useState(false);
  const [reminder, setReminder] = useState<{ state: "idle" | "loading" | "done" | "error"; msg?: string }>({ state: "idle" });
  const [, start] = useTransition();

  async function addReminder() {
    setReminder({ state: "loading" });
    const res = await addTaskReminderToCalendar(task.id, calendarId);
    if ("error" in res) setReminder({ state: "error", msg: res.error });
    else setReminder({ state: "done" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdue = task.due_date && task.due_date < today;
  const ownerContact = contacts.find((c) => c.name === task.owner_name && c.whatsapp);

  async function generate() {
    setGen(true);
    const res = await generateTaskMessage(task.id);
    setGen(false);
    if (!("error" in res)) { setMessage(res.message); setOpen(true); }
  }
  function toggleDone() {
    start(async () => { await updateTask(task.id, companyId, { status: task.status === "feita" ? "pendente" : "feita" }); onChange(); });
  }
  function copy() {
    if (message) { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  }

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-start gap-2">
        <button onClick={toggleDone} aria-label={task.status === "feita" ? "Desmarcar (reabrir tarefa)" : "Marcar tarefa como feita"} className="mt-0.5 text-text-muted hover:text-accent">
          {task.status === "feita" ? <CheckSquare className="h-4 w-4 text-green" /> : <Square className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${task.status === "feita" ? "text-text-muted line-through" : "text-text"}`}>{task.description}</p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {task.owner_name && <span><User className="mr-0.5 inline h-3 w-3 align-[-2px]" />{task.owner_name} · </span>}
            {task.due_date ? (
              <span className={overdue ? "text-red" : ""}>{overdue ? "venceu " : "até "}{new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
            ) : "sem prazo"}
            {task.source === "ai" && <span className="ml-1.5 rounded bg-red/10 px-1.5 py-0.5 text-[9px] text-red">IA</span>}
          </p>
        </div>
        <button onClick={onDelete} aria-label="Apagar tarefa" className="rounded p-1 text-text-muted hover:text-red"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>

      {task.status !== "feita" && (
        <>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={message ? () => setOpen(!open) : generate} disabled={gen} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-text hover:border-accent/40 disabled:opacity-50">
          {gen ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
          {message ? (open ? "Ocultar mensagem" : "Ver mensagem") : "Gerar mensagem"}
        </button>
        {googleConnected ? (
          <button
            onClick={addReminder}
            disabled={reminder.state === "loading" || reminder.state === "done"}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-muted hover:border-accent/40 hover:text-text disabled:opacity-70"
          >
            {reminder.state === "loading" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : reminder.state === "done" ? (
              <CalendarCheck className="h-3 w-3 text-green" />
            ) : (
              <CalendarPlus className="h-3 w-3" />
            )}
            {reminder.state === "done" ? "Na agenda" : "Lembrete na agenda"}
          </button>
        ) : (
          <a
            href={gcalLink(`Cobrar ${task.owner_name || "cliente"}: ${task.description}`, task.remind_at || task.due_date, task.description)}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-muted hover:border-accent/40 hover:text-text"
          >
            <CalendarPlus className="h-3 w-3" /> Lembrete na agenda
          </a>
        )}
      </div>
      {reminder.state === "error" && <p className="mt-1 text-[11px] text-red">{reminder.msg}</p>}

      {open && message && (
        <div className="mt-2 rounded-lg bg-surface/60 p-2.5">
          <p className="whitespace-pre-wrap text-xs text-text-secondary">{message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={waLink(message, ownerContact?.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-green/10 px-2.5 py-1 text-[11px] text-green hover:bg-green/20">
              <MessageSquare className="h-3 w-3" /> {ownerContact ? `Enviar p/ ${ownerContact.name}` : "Abrir WhatsApp"}
            </a>
            <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-muted hover:text-text">
              {copied ? <Check className="h-3 w-3 text-green" /> : <Copy className="h-3 w-3" />} Copiar
            </button>
            <button onClick={generate} disabled={gen} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-muted hover:text-text disabled:opacity-50">
              <Wand2 className="h-3 w-3" /> Regerar
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function DocumentsSection({
  companyId,
  documents,
  onChange,
}: {
  companyId: string;
  documents: CompanyDetailData["documents"];
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [uploading, setUploading] = useState(false);
  const [, start] = useTransition();

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", "outro");
    await uploadDocument(companyId, fd);
    setUploading(false);
    e.target.value = "";
    onChange();
  }
  async function openDoc(id: string) {
    const res = await getDocumentUrl(id);
    if (!("error" in res)) window.open(res.url, "_blank", "noopener");
  }

  return (
    <div className={card}>
      <SectionTitle icon={FileText} count={documents.length}>Documentos &amp; contrato</SectionTitle>
      <div className="space-y-2">
        {documents.map((d) => (
          <div key={d.id} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
            <FileText className="h-4 w-4 text-text-muted" />
            <button onClick={() => openDoc(d.id)} className="flex-1 truncate text-left text-sm text-text hover:text-accent">{d.name}</button>
            <button onClick={() => openDoc(d.id)} aria-label="Abrir documento" className="rounded p-1 text-text-muted hover:text-accent"><ExternalLink className="h-3.5 w-3.5" /></button>
            <button onClick={async () => { if (await confirm(`Apagar ${d.name}?`)) start(async () => { await deleteDocument(d.id, companyId); onChange(); }); }} aria-label="Apagar documento" className="rounded p-1 text-text-muted hover:text-red"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {documents.length === 0 && <p className="text-xs text-text-muted">Nenhum documento. Suba o contrato ou propostas aqui (privado).</p>}
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-xs text-text-muted transition hover:border-accent/40 hover:text-text">
        <input type="file" onChange={upload} className="hidden" disabled={uploading} aria-label="Subir documento" />
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Subindo..." : "Subir documento"}
      </label>
    </div>
  );
}
