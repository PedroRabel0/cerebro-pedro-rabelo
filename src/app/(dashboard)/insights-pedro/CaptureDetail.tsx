"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Proposal } from "@/lib/supabase/types";
import {
  getProposalsByCapture,
  approveProposal,
  rejectProposal,
} from "./actions";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  BookOpen,
  BookMarked,
  HelpCircle,
  MessageSquare,
  ArrowRight,
  GitMerge,
  Plus,
  Copy,
  FileText,
  Link2,
  Target,
} from "lucide-react";

const proposalTypeConfig: Record<
  string,
  { label: string; className: string; Icon: typeof BookOpen }
> = {
  playbook: {
    label: "Playbook",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    Icon: BookOpen,
  },
  story: {
    label: "História",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Icon: BookMarked,
  },
  question: {
    label: "Pergunta",
    className: "bg-green-500/10 text-green-400 border-green-500/20",
    Icon: HelpCircle,
  },
};

const decisaoConfig: Record<string, { label: string; className: string; Icon: typeof Plus; desc: string }> = {
  NOVO: {
    label: "Novo",
    className: "bg-green/10 text-green border-green/20",
    Icon: Plus,
    desc: "Conhecimento novo — não existe nada parecido na base",
  },
  COMPLEMENTA: {
    label: "Complementa",
    className: "bg-blue/10 text-blue border-blue/20",
    Icon: GitMerge,
    desc: "Complementa um playbook existente com novos dados",
  },
  DUPLICATA: {
    label: "Duplicata",
    className: "bg-amber/10 text-amber border-amber/20",
    Icon: Copy,
    desc: "Já existe na base — não acrescenta nada relevante",
  },
};

function EnrichedProposalInfo({ proposal }: { proposal: Proposal }) {
  const decisao = String(proposal.decisao || "NOVO");
  const dc = decisaoConfig[decisao] || decisaoConfig.NOVO;
  const resumo = proposal.resumo_para_pedro ? String(proposal.resumo_para_pedro) : null;
  const tema = proposal.tema_sugerido ? String(proposal.tema_sugerido) : null;
  const subtema = proposal.subtema_sugerido ? String(proposal.subtema_sugerido) : null;
  const diffItems = Array.isArray(proposal.diff) ? proposal.diff as Array<{campo: string; atual: string; proposto: string}> : [];
  const candidato = (proposal.candidato && typeof proposal.candidato === "object") ? proposal.candidato as Record<string, unknown> : null;
  const estrutura = candidato?.estrutura as Record<string, unknown> | null;
  const completude = candidato?.completude as number | undefined;
  const relacoes = candidato?.relacoes as Record<string, unknown> | null;
  const fazParte = Array.isArray(relacoes?.faz_parte_de) ? relacoes.faz_parte_de as string[] : [];
  const relacionado = Array.isArray(relacoes?.relacionado_a) ? relacoes.relacionado_a as string[] : [];

  return (
    <div className="space-y-2">
      {/* Decision badge */}
      <div className={`flex items-start gap-2 rounded-lg border p-2.5 ${dc.className}`}>
        <dc.Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold uppercase">{dc.label}</span>
            {tema && (
              <span className="rounded-full bg-surface/80 px-2 py-0.5 font-mono text-[10px] text-text-muted">
                {tema}{subtema ? ` › ${subtema}` : ""}
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5 opacity-80">{dc.desc}</p>
        </div>
      </div>

      {/* Resumo para Pedro */}
      {resumo && (
        <div className="flex items-start gap-2 rounded-lg bg-surface/50 border border-border/50 p-2.5">
          <Target className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
          <p className="text-[11px] text-text-secondary leading-relaxed">{resumo}</p>
        </div>
      )}

      {/* Diff view for COMPLEMENTA */}
      {decisao === "COMPLEMENTA" && diffItems.length > 0 && (
        <div className="rounded-lg border border-blue/20 bg-blue/5 p-2.5 space-y-1.5">
          <span className="font-mono text-[10px] font-bold uppercase text-blue">Campos alterados:</span>
          {diffItems.map((d, i) => (
            <div key={i} className="text-[11px] space-y-0.5">
              <span className="font-mono text-text-muted">{d.campo}:</span>
              {d.atual && (
                <div className="pl-3 text-red/70 line-through">{d.atual.slice(0, 120)}{d.atual.length > 120 ? "..." : ""}</div>
              )}
              <div className="pl-3 text-green">{d.proposto.slice(0, 120)}{d.proposto.length > 120 ? "..." : ""}</div>
            </div>
          ))}
        </div>
      )}

      {/* Structured preview */}
      {estrutura && (
        <div className="rounded-lg border border-border/50 bg-surface/30 p-2.5 space-y-1.5">
          <span className="font-mono text-[10px] font-bold uppercase text-text-muted flex items-center gap-1">
            <FileText className="h-3 w-3" /> Estrutura extraída
          </span>
          <div className="text-[11px] space-y-1">
            {!!estrutura.principio && (
              <div><span className="font-semibold text-accent">Princípio:</span> <span className="text-text-secondary">{String(estrutura.principio).slice(0, 200)}</span></div>
            )}
            {!!estrutura.quando_aplica && (
              <div><span className="font-semibold text-text-muted">Quando:</span> <span className="text-text-secondary">{String(estrutura.quando_aplica).slice(0, 150)}</span></div>
            )}
            {!!estrutura.erro_comum && (
              <div><span className="font-semibold text-red/70">Erro comum:</span> <span className="text-text-secondary">{String(estrutura.erro_comum).slice(0, 150)}</span></div>
            )}
            {!!estrutura.passos && Array.isArray(estrutura.passos) && (
              <div><span className="font-semibold text-text-muted">Passos:</span> <span className="text-text-secondary">{(estrutura.passos as {titulo: string}[]).map(p => p.titulo).join(" → ")}</span></div>
            )}
            {completude !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-[10px] text-text-muted">Completude:</span>
                <div className="h-1.5 w-20 rounded-full bg-surface">
                  <div className={`h-1.5 rounded-full ${completude >= 80 ? "bg-green" : completude >= 50 ? "bg-blue" : "bg-accent"}`} style={{ width: `${completude}%` }} />
                </div>
                <span className="font-mono text-[10px] text-text-muted">{completude}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Relations */}
      {(fazParte.length > 0 || relacionado.length > 0) && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <Link2 className="h-3 w-3 text-text-muted" />
          {fazParte.length > 0 && (
            <span className="rounded-full bg-purple/10 text-purple border border-purple/20 px-2 py-0.5 font-mono text-[10px]">
              Parte de {fazParte.length} playbook{fazParte.length > 1 ? "s" : ""}
            </span>
          )}
          {relacionado.length > 0 && (
            <span className="rounded-full bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 font-mono text-[10px]">
              {relacionado.length} relacionado{relacionado.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  onStatusChange,
}: {
  proposal: Proposal;
  onStatusChange: (id: string, newStatus: "approved" | "rejected") => void;
}) {
  const [status, setStatus] = useState(proposal.status);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [feedback, setFeedback] = useState<"approved" | "rejected" | null>(null);

  // Auto-detect origin from tags (set during Alimentar)
  const detectedOrigin = proposal.suggested_tags?.includes("origem:outros") ? "outros" : "pedro";
  const [origin, setOrigin] = useState<"pedro" | "outros">(detectedOrigin);

  const config = proposalTypeConfig[proposal.type] ?? {
    label: proposal.type,
    className: "bg-surface text-text-muted border-border",
    Icon: MessageSquare,
  };

  const content = proposal.content_markdown || "";
  const preview =
    content.length > 300 ? content.slice(0, 300) + "..." : content;

  async function handleApprove() {
    setLoading(true);
    try {
      await approveProposal(proposal.id, origin);
      setStatus("approved");
      setFeedback("approved");
      // Notify parent to remove from pending list after brief delay (show feedback first)
      setTimeout(() => onStatusChange(proposal.id, "approved"), 1500);
    } catch (err) {
      console.error("Approve failed:", err);
    }
    setLoading(false);
  }

  async function handleReject() {
    setLoading(true);
    try {
      await rejectProposal(proposal.id);
      setStatus("rejected");
      setFeedback("rejected");
      setTimeout(() => onStatusChange(proposal.id, "rejected"), 1500);
    } catch (err) {
      console.error("Reject failed:", err);
    }
    setLoading(false);
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-card${feedback === "rejected" ? " opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${config.className}`}
          >
            <config.Icon className="h-3 w-3" />
            {config.label}
          </span>
          {status !== "pending" && (
            <span
              className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase ${
                status === "approved" ? "text-green" : "text-red"
              }`}
            >
              {status === "approved" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {status === "approved" ? "aprovado" : "rejeitado"}
            </span>
          )}
        </div>
        {status === "approved" && proposal.type !== "question" && (
          <span className="font-mono text-[9px] text-green uppercase">
            Adicionado à Base
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* Title */}
        <h4 className="text-sm font-semibold text-text">{proposal.title}</h4>

        {/* Decision badge + resumo (only for v2 pipeline proposals) */}
        {proposal.decisao ? <EnrichedProposalInfo proposal={proposal} /> : null}

        {/* Full content — always visible so user can read before approving */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-text-muted mb-1.5 hover:text-text transition"
          >
            Conteúdo {expanded ? "(ocultar)" : "(expandir)"}
          </button>
          {expanded ? (
            <div className="rounded-lg bg-surface/50 border border-border/50 p-3 max-h-[400px] overflow-y-auto">
              <p className="text-xs leading-relaxed text-text-secondary whitespace-pre-wrap">
                {content}
              </p>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-text-muted whitespace-pre-wrap line-clamp-3">
              {preview}
            </p>
          )}
        </div>

        {/* Tags */}
        {proposal.suggested_tags && proposal.suggested_tags.filter(t => !t.startsWith("origem:")).length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {proposal.suggested_tags.filter(t => !t.startsWith("origem:")).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-accent/80"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions — origin selector + approve/reject */}
      {status === "pending" && (
        <div className="border-t border-border px-4 py-3 bg-surface/30 space-y-3">
          {/* Origin selector */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-text-muted">Origem:</span>
            <button
              type="button"
              onClick={() => setOrigin("pedro")}
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition ${
                origin === "pedro"
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-surface text-text-muted border border-border hover:text-text"
              }`}
            >
              Do Pedro
            </button>
            <button
              type="button"
              onClick={() => setOrigin("outros")}
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition ${
                origin === "outros"
                  ? "bg-blue/15 text-blue border border-blue/30"
                  : "bg-surface text-text-muted border border-border hover:text-text"
              }`}
            >
              De outros
            </button>
          </div>

          {/* DUPLICATA warning */}
          {proposal.decisao === "DUPLICATA" && (
            <div className="rounded-lg bg-amber/10 border border-amber/20 px-3 py-2 flex items-center gap-2">
              <Copy className="h-3.5 w-3.5 text-amber shrink-0" />
              <p className="text-[11px] text-amber">
                A IA marcou como duplicata. Aprovar mesmo assim criará um novo item na base.
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              disabled={loading}
              onClick={handleApprove}
              className="flex items-center gap-1.5 rounded-xl bg-green/10 px-4 py-2 font-mono text-[11px] font-bold text-green transition hover:bg-green/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Aprovar como {origin === "pedro" ? "Pedro" : "Outros"}
            </button>
            <button
              disabled={loading}
              onClick={handleReject}
              className="flex items-center gap-1 rounded-xl px-3 py-2 font-mono text-[11px] font-semibold text-text-muted transition hover:bg-red/10 hover:text-red disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" />
              Rejeitar
            </button>
          </div>
        </div>
      )}

      {/* Approve feedback banner */}
      {feedback === "approved" && (
        <div className="rounded-xl bg-green/10 border border-green/30 p-4 mx-4 mb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green shrink-0" />
              <span className="text-sm text-green font-medium">
                {config.label} &ldquo;{proposal.title}&rdquo; criado na Base de Conhecimento
              </span>
            </div>
            <Link
              href="/base-de-conhecimento"
              className="flex items-center gap-1 text-accent hover:underline font-mono text-xs whitespace-nowrap"
            >
              Ver na Base <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Reject feedback banner */}
      {feedback === "rejected" && (
        <div className="rounded-xl bg-surface border border-border p-4 mx-4 mb-4 opacity-60">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-text-muted shrink-0" />
            <span className="text-sm text-text-muted">Proposta rejeitada</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaptureDetail({ captureId }: { captureId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProposalsByCapture(captureId).then((data) => {
      if (!cancelled) {
        setProposals(data as Proposal[]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [captureId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <span className="font-mono text-xs text-text-muted">
          Carregando propostas...
        </span>
      </div>
    );
  }

  // Callback: when a proposal is approved/rejected, update local state
  function handleStatusChange(id: string, newStatus: "approved" | "rejected") {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );
  }

  // Split into pending vs processed
  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const processedProposals = proposals.filter((p) => p.status !== "pending");

  if (proposals.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-muted">
        Nenhuma proposta gerada ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3 pt-3">
      {/* Pending proposals — main focus */}
      {pendingProposals.length > 0 && (
        <h4 className="font-mono text-xs uppercase tracking-wider text-text-secondary">
          Propostas pendentes ({pendingProposals.length})
        </h4>
      )}
      {pendingProposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} onStatusChange={handleStatusChange} />
      ))}

      {/* Summary of processed proposals (approved/rejected) */}
      {processedProposals.length > 0 && pendingProposals.length === 0 && (
        <div className="rounded-xl border border-green/20 bg-green/5 px-4 py-3 text-center">
          <p className="text-sm text-green font-medium">
            Todas as propostas foram processadas
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {processedProposals.filter((p) => p.status === "approved").length} aprovadas, {processedProposals.filter((p) => p.status === "rejected").length} rejeitadas — conteúdo salvo em Conhecimento
          </p>
        </div>
      )}

      {processedProposals.length > 0 && pendingProposals.length > 0 && (
        <p className="font-mono text-[10px] text-text-muted">
          + {processedProposals.length} já processadas (salvas em Conhecimento)
        </p>
      )}
    </div>
  );
}
