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

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [status, setStatus] = useState(proposal.status);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [feedback, setFeedback] = useState<"approved" | "rejected" | null>(null);
  const [origin, setOrigin] = useState<"pedro" | "outros">("pedro");

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
        {proposal.suggested_tags && proposal.suggested_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {proposal.suggested_tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-accent/80"
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
        <ProposalCard key={p.id} proposal={p} />
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
