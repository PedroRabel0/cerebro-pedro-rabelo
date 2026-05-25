"use client";

import { useEffect, useState } from "react";
import type { Proposal } from "@/lib/supabase/types";
import { getProposalsByCapture, updateProposalStatus } from "./actions";

const typeBadge: Record<string, string> = {
  playbook: "bg-blue/10 text-blue",
  story: "bg-green/10 text-green",
  question: "bg-accent/10 text-accent",
};

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [status, setStatus] = useState(proposal.status);
  const [loading, setLoading] = useState(false);

  async function handleStatus(newStatus: "approved" | "rejected") {
    setLoading(true);
    await updateProposalStatus(proposal.id, newStatus);
    setStatus(newStatus);
    setLoading(false);
  }

  return (
    <div className="rounded border border-rule bg-paper px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                typeBadge[proposal.type] ?? "bg-paper-dark text-ink-muted"
              }`}
            >
              {proposal.type}
            </span>
            {status !== "pending" && (
              <span
                className={`font-mono text-[10px] uppercase ${
                  status === "approved" ? "text-green" : "text-accent"
                }`}
              >
                {status === "approved" ? "aprovado" : "rejeitado"}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-ink">{proposal.title}</h4>
          {proposal.content_markdown && (
            <p className="mt-1 line-clamp-3 text-xs text-ink-muted">
              {proposal.content_markdown}
            </p>
          )}
          {proposal.suggested_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {proposal.suggested_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-paper-dark px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {status === "pending" && (
          <div className="flex shrink-0 gap-1">
            <button
              disabled={loading}
              onClick={() => handleStatus("approved")}
              className="rounded bg-green/10 px-2 py-1 font-mono text-[10px] font-semibold text-green transition hover:bg-green/20 disabled:opacity-50"
            >
              Aprovar
            </button>
            <button
              disabled={loading}
              onClick={() => handleStatus("rejected")}
              className="rounded bg-accent/10 px-2 py-1 font-mono text-[10px] font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
            >
              Rejeitar
            </button>
          </div>
        )}
      </div>
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
      <p className="py-4 text-center font-mono text-xs text-ink-muted">
        Carregando propostas...
      </p>
    );
  }

  if (proposals.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-ink-muted">
        Nenhuma proposta gerada ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      <h4 className="font-mono text-xs uppercase tracking-wider text-ink-soft">
        Propostas ({proposals.length})
      </h4>
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} />
      ))}
    </div>
  );
}
