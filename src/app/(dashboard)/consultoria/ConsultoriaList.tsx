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
} from "lucide-react";
import { createCompany, type CompanyWithCounts, type ConsultoriaOverview } from "./actions";

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
}: {
  companies: CompanyWithCounts[];
  overview: ConsultoriaOverview;
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
