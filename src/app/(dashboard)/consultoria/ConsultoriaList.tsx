"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckSquare,
  FileSignature,
  Wallet,
  CalendarCheck,
  CalendarPlus,
  CalendarClock,
  CircleDollarSign,
  Flame,
  Check,
  Sun,
} from "lucide-react";
import {
  createCompany,
  getCalendarSuggestions,
  importMeetingFromCalendar,
  type CompanyWithCounts,
  type ConsultoriaOverview,
  type CalendarSuggestion,
  type DailyDigest,
} from "./actions";
import { CalendarSearch, Download } from "lucide-react";

/** Formata um valor em reais (R$). Sem casas decimais quando inteiro. */
function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const HEALTH_DOT: Record<string, string> = {
  ok: "bg-green",
  atencao: "bg-yellow-500",
  risco: "bg-red",
};
const HEALTH_LABEL: Record<string, string> = {
  ok: "Em dia",
  atencao: "Atenção",
  risco: "Esfriando",
};

const STATUS_STYLE: Record<string, string> = {
  ativa: "bg-green/10 text-green",
  pausada: "bg-yellow-500/10 text-yellow-500",
  concluida: "bg-blue/10 text-blue",
};
const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  concluida: "Concluída",
};
const CONTRACT_LABEL: Record<string, string> = {
  sem_contrato: "Sem contrato",
  enviado: "Contrato enviado",
  assinado: "Contrato assinado",
};
const PAYMENT_STYLE: Record<string, string> = {
  em_dia: "text-green",
  pendente: "text-yellow-500",
  atrasado: "text-red",
};
const PAYMENT_LABEL: Record<string, string> = {
  em_dia: "Pagamento em dia",
  pendente: "Pagamento pendente",
  atrasado: "Pagamento atrasado",
};

export default function ConsultoriaList({
  companies,
  overview,
  digest,
  googleConnected,
  googleFlash,
}: {
  companies: CompanyWithCounts[];
  overview: ConsultoriaOverview;
  digest: DailyDigest;
  googleConnected: boolean;
  googleFlash?: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createCompany({ name, sector, goal });
      if ("error" in res) {
        setError(res.error);
      } else {
        setName("");
        setSector("");
        setGoal("");
        setAdding(false);
        router.push(`/consultoria/${res.id}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Foco do dia */}
      <DailyDigestPanel digest={digest} />

      {/* Google Calendar connection */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          {googleConnected ? (
            <>
              <CalendarCheck className="h-4 w-4 text-green" />
              <span className="text-text">Google Agenda conectada</span>
              <span className="text-xs text-text-muted">— lembretes entram direto na sua agenda</span>
            </>
          ) : (
            <>
              <CalendarPlus className="h-4 w-4 text-text-muted" />
              <span className="text-text-secondary">Conecte sua Google Agenda para lembretes automáticos</span>
            </>
          )}
        </div>
        <a
          href="/api/google/connect"
          className={
            googleConnected
              ? "flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition hover:text-text"
              : "flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
          }
        >
          <CalendarPlus className="h-3.5 w-3.5" /> {googleConnected ? "Reconectar" : "Conectar Google Agenda"}
        </a>
      </div>

      {googleConnected && <ImportFromAgenda companies={companies} />}

      {googleFlash === "connected" && (
        <div className="rounded-lg border border-green/20 bg-green/5 px-4 py-2 text-sm text-green">
          Google Agenda conectada com sucesso.
        </div>
      )}
      {googleFlash === "error" && (
        <div className="rounded-lg border border-red/20 bg-red/5 px-4 py-2 text-sm text-red">
          Não foi possível conectar a Google Agenda. Tente novamente.
        </div>
      )}

      {/* Overview strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-surface px-4 py-3">
          <div className="flex items-center gap-1 text-xs text-text-muted"><CircleDollarSign className="h-3.5 w-3.5" /> Receita mensal (MRR)</div>
          <div className="mt-0.5 text-2xl font-bold text-green">{formatBRL(overview.mrr)}</div>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3">
          <div className="text-xs text-text-muted">Empresas ativas</div>
          <div className="mt-0.5 text-2xl font-bold text-text">{overview.active_companies}</div>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3">
          <div className="text-xs text-text-muted">Tarefas pendentes</div>
          <div className="mt-0.5 text-2xl font-bold text-text">{overview.pending_tasks}</div>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3">
          <div className="text-xs text-red">Tarefas atrasadas</div>
          <div className="mt-0.5 text-2xl font-bold text-red">{overview.overdue_tasks}</div>
        </div>
      </div>

      {/* Alertas resumidos */}
      {(overview.renewals_soon > 0 || overview.cooling_clients > 0 || overview.overdue_payments > 0) && (
        <div className="flex flex-wrap gap-2">
          {overview.renewals_soon > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-500">
              <CalendarClock className="h-3.5 w-3.5" /> {overview.renewals_soon} contrato(s) p/ renovar
            </span>
          )}
          {overview.cooling_clients > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-red/30 bg-red/10 px-3 py-1 text-xs text-red">
              <Flame className="h-3.5 w-3.5" /> {overview.cooling_clients} cliente(s) esfriando
            </span>
          )}
          {overview.overdue_payments > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-red/30 bg-red/10 px-3 py-1 text-xs text-red">
              <Wallet className="h-3.5 w-3.5" /> {overview.overdue_payments} pagamento(s) atrasado(s)
            </span>
          )}
        </div>
      )}

      {/* New company */}
      {adding ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da empresa"
            aria-label="Nome da empresa"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Nicho / setor (opcional)"
              aria-label="Nicho ou setor"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Objetivo da consultoria (opcional)"
              aria-label="Objetivo da consultoria"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>
          {error && <p className="text-xs text-red">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={pending || !name.trim()}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar empresa
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-text-muted hover:text-text">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-text-muted transition hover:border-accent/40 hover:text-text"
        >
          <Plus className="h-4 w-4" /> Nova empresa
        </button>
      )}

      {/* Companies grid */}
      {companies.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border bg-card py-12 text-center">
          <Building2 className="mb-2 h-6 w-6 text-text-muted/40" />
          <p className="text-sm text-text-muted">Nenhuma empresa cadastrada ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/consultoria/${c.id}`}
              className="group rounded-xl border border-border bg-card p-4 transition hover:border-accent/40"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-text-muted" />
                <span className="flex-1 truncate text-sm font-semibold text-text">{c.name}</span>
                {c.status === "ativa" && (
                  <span
                    title={`${HEALTH_LABEL[c.health]}${c.days_since_contact !== null ? ` · ${c.days_since_contact} dias sem contato` : ""}`}
                    aria-label={HEALTH_LABEL[c.health]}
                    className={`h-2 w-2 rounded-full ${HEALTH_DOT[c.health]}`}
                  />
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
                <ChevronRight className="h-4 w-4 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
              {c.goal && <p className="mb-3 line-clamp-1 text-xs text-text-secondary">{c.goal}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
                {c.monthly_fee ? (
                  <span className="flex items-center gap-1 text-green">
                    <CircleDollarSign className="h-3 w-3" /> {formatBRL(c.monthly_fee)}/mês
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <CheckSquare className="h-3 w-3" /> {c.pending_tasks} pendentes
                </span>
                {c.overdue_tasks > 0 && (
                  <span className="flex items-center gap-1 text-red">
                    <AlertTriangle className="h-3 w-3" /> {c.overdue_tasks} atrasada{c.overdue_tasks > 1 ? "s" : ""}
                  </span>
                )}
                {c.status === "ativa" && c.renewal_in_days !== null && c.renewal_in_days <= 30 && (
                  <span className={`flex items-center gap-1 ${c.renewal_in_days < 0 ? "text-red" : "text-yellow-500"}`}>
                    <CalendarClock className="h-3 w-3" />
                    {c.renewal_in_days < 0
                      ? "contrato vencido"
                      : c.renewal_in_days === 0
                        ? "renova hoje"
                        : `renova em ${c.renewal_in_days}d`}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <FileSignature className="h-3 w-3" /> {CONTRACT_LABEL[c.contract_status]}
                </span>
                <span className={`flex items-center gap-1 ${PAYMENT_STYLE[c.payment_status]}`}>
                  <Wallet className="h-3 w-3" /> {PAYMENT_LABEL[c.payment_status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatEventDate(d: string): string {
  if (!d) return "";
  // Evento de dia inteiro: "AAAA-MM-DD" (sem hora) — parse local p/ nao trocar o dia
  if (d.length === 10) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + " · dia inteiro";
  }
  // Evento com horario: ISO completo
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ImportFromAgenda({ companies }: { companies: CompanyWithCounts[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CalendarSuggestion[]>([]);
  const [calendars, setCalendars] = useState<string[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setOpen(true);
    setLoading(true);
    const data = await getCalendarSuggestions();
    setSuggestions(data.suggestions);
    setCalendars(data.calendars);
    setChoice(Object.fromEntries(data.suggestions.map((s) => [s.eventId, s.suggestedCompanyId || ""])));
    setLoading(false);
  }

  async function importEvent(s: CalendarSuggestion) {
    const companyId = choice[s.eventId];
    if (!companyId) return;
    setBusy(s.eventId);
    const res = await importMeetingFromCalendar(companyId, s.title, s.date);
    setBusy(null);
    if (!("error" in res)) {
      setImported((prev) => new Set(prev).add(s.eventId));
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        onClick={load}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm text-text-secondary transition hover:border-accent/40 hover:text-text"
      >
        <CalendarSearch className="h-4 w-4 text-accent" /> Importar reuniões da agenda
      </button>
    );
  }

  const matched = suggestions.filter((s) => s.suggestedCompanyId);
  const visible = showAll ? suggestions : matched;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-text">
          <CalendarSearch className="h-4 w-4 text-accent" /> Reuniões da sua agenda
        </span>
        <button onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text">Fechar</button>
      </div>
      {!loading && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-text-muted">
            {calendars.length > 0
              ? `${matched.length} reunião(ões) das suas empresas · ${suggestions.length} eventos na agenda`
              : "Nenhuma agenda acessível — clique em \"Reconectar\" no topo e autorize o acesso às agendas."}
          </p>
          {suggestions.length > matched.length && (
            <button onClick={() => setShowAll((v) => !v)} className="text-[11px] text-accent hover:underline">
              {showAll ? "Mostrar só reuniões" : "Ver todos os eventos"}
            </button>
          )}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo suas agendas...
        </div>
      ) : visible.length === 0 ? (
        <p className="py-3 text-xs text-text-muted">
          {suggestions.length === 0
            ? "Nenhum evento futuro nas suas agendas. Cadastre a reunião direto na empresa."
            : "Nenhuma reunião casou com suas empresas. Nomeie o evento com o nome da empresa ou do contato (ex: \"Reunião Prince\"), ou clique em \"Ver todos os eventos\" para escolher manualmente."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((s) => (
            <div key={s.eventId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text">{s.title}</p>
                <p className="text-[11px] text-text-muted">
                  {formatEventDate(s.date)}
                  {s.calendar ? ` · ${s.calendar}` : ""}
                </p>
              </div>
              {imported.has(s.eventId) ? (
                <span className="flex items-center gap-1 text-xs text-green"><Check className="h-3.5 w-3.5" /> Importada</span>
              ) : (
                <>
                  <select
                    value={choice[s.eventId] || ""}
                    onChange={(e) => setChoice((prev) => ({ ...prev, [s.eventId]: e.target.value }))}
                    aria-label="Empresa da reunião"
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                  >
                    <option value="">Escolher empresa...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => importEvent(s)}
                    disabled={!choice[s.eventId] || busy === s.eventId}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {busy === s.eventId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Importar
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DailyDigestPanel({ digest }: { digest: DailyDigest }) {
  const total =
    digest.tasks_today.length + digest.renewals.length + digest.payments.length + digest.cooling.length;
  const [open, setOpen] = useState(total > 0);

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-accent" /> : <ChevronRight className="h-4 w-4 text-accent" />}
        <Sun className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-text">Foco de hoje</span>
        <span className="text-xs text-text-muted">
          · {total === 0 ? "tudo sob controle" : `${total} item(ns) pedindo atenção`}
        </span>
      </button>

      {open && (
        total === 0 ? (
          <p className="mt-3 text-xs text-text-muted">
            Nada vencendo, nenhuma renovação próxima e nenhum cliente esfriando. Bom dia tranquilo. ☕
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <DigestColumn
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              title="Tarefas de hoje"
              count={digest.tasks_today.length}
              empty="Nenhuma tarefa vencendo."
            >
              {digest.tasks_today.map((t) => (
                <Link
                  key={t.id}
                  href={`/consultoria/${t.company_id}`}
                  className="block rounded-lg border border-border/60 bg-card px-3 py-2 transition hover:border-accent/40"
                >
                  <p className="truncate text-xs text-text">{t.description}</p>
                  <p className="text-[11px] text-text-muted">
                    {t.company_name}
                    {t.owner_name ? ` · ${t.owner_name}` : ""}
                    {" · "}
                    <span className={t.overdue ? "text-red" : "text-text-muted"}>
                      {t.overdue ? "atrasada" : "vence hoje"}
                    </span>
                  </p>
                </Link>
              ))}
            </DigestColumn>

            <div className="space-y-4">
              <DigestColumn
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                title="Renovações"
                count={digest.renewals.length}
                empty="Nenhuma renovação próxima."
              >
                {digest.renewals.map((a) => (
                  <DigestAlertRow key={a.id} alert={a} tone="yellow" />
                ))}
              </DigestColumn>

              <DigestColumn
                icon={<Wallet className="h-3.5 w-3.5" />}
                title="Pagamentos"
                count={digest.payments.length}
                empty="Tudo em dia."
              >
                {digest.payments.map((a) => (
                  <DigestAlertRow key={a.id} alert={a} tone="red" />
                ))}
              </DigestColumn>

              <DigestColumn
                icon={<Flame className="h-3.5 w-3.5" />}
                title="Clientes esfriando"
                count={digest.cooling.length}
                empty="Ninguém esfriando."
              >
                {digest.cooling.map((a) => (
                  <DigestAlertRow key={a.id} alert={a} tone="red" />
                ))}
              </DigestColumn>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function DigestColumn({
  icon,
  title,
  count,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {icon} {title} {count > 0 && <span className="text-text-secondary">· {count}</span>}
      </p>
      {count === 0 ? (
        <p className="text-[11px] text-text-muted/70">{empty}</p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  );
}

function DigestAlertRow({ alert, tone }: { alert: { id: string; name: string; detail: string }; tone: "yellow" | "red" }) {
  return (
    <Link
      href={`/consultoria/${alert.id}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5 transition hover:border-accent/40"
    >
      <span className="truncate text-xs text-text">{alert.name}</span>
      <span className={`shrink-0 text-[11px] ${tone === "red" ? "text-red" : "text-yellow-500"}`}>{alert.detail}</span>
    </Link>
  );
}
