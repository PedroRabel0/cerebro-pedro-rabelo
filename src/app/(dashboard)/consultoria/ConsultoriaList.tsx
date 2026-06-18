"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Loader2,
  ChevronRight,
  AlertTriangle,
  CheckSquare,
  FileSignature,
  Wallet,
  CalendarCheck,
  CalendarPlus,
  Check,
} from "lucide-react";
import {
  createCompany,
  getCalendarSuggestions,
  importMeetingFromCalendar,
  type CompanyWithCounts,
  type ConsultoriaOverview,
  type CalendarSuggestion,
} from "./actions";
import { CalendarSearch, Download } from "lucide-react";

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
  googleConnected,
  googleFlash,
}: {
  companies: CompanyWithCounts[];
  overview: ConsultoriaOverview;
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
      <div className="grid grid-cols-3 gap-3">
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
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
                <ChevronRight className="h-4 w-4 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
              {c.goal && <p className="mb-3 line-clamp-1 text-xs text-text-secondary">{c.goal}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
                <span className="flex items-center gap-1">
                  <CheckSquare className="h-3 w-3" /> {c.pending_tasks} pendentes
                </span>
                {c.overdue_tasks > 0 && (
                  <span className="flex items-center gap-1 text-red">
                    <AlertTriangle className="h-3 w-3" /> {c.overdue_tasks} atrasada{c.overdue_tasks > 1 ? "s" : ""}
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

function ImportFromAgenda({ companies }: { companies: CompanyWithCounts[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CalendarSuggestion[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    setLoading(true);
    const data = await getCalendarSuggestions();
    setSuggestions(data);
    setChoice(Object.fromEntries(data.map((s) => [s.eventId, s.suggestedCompanyId || ""])));
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

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-text">
          <CalendarSearch className="h-4 w-4 text-accent" /> Reuniões da sua agenda
        </span>
        <button onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text">Fechar</button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo sua agenda...
        </div>
      ) : suggestions.length === 0 ? (
        <p className="py-3 text-xs text-text-muted">Nenhum evento próximo na sua agenda.</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div key={s.eventId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text">{s.title}</p>
                <p className="text-[11px] text-text-muted">
                  {new Date(s.date).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
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
