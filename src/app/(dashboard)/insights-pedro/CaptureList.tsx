"use client";

import { useState } from "react";
import type { Capture, CaptureStatus } from "@/lib/supabase/types";
import { createCapture, deleteCapture } from "./actions";
import CaptureDetail from "./CaptureDetail";

const statusBadge: Record<CaptureStatus, string> = {
  pending: "bg-paper border border-rule text-ink-muted",
  processing: "bg-blue/10 text-blue",
  processed: "bg-green/10 text-green",
  error: "bg-accent/10 text-accent",
};

const statusLabel: Record<CaptureStatus, string> = {
  pending: "pendente",
  processing: "processando",
  processed: "processado",
  error: "erro",
};

const sourceLabel: Record<string, string> = {
  transcription: "Transcrição",
  pdf: "PDF",
  youtube: "YouTube",
  manual: "Manual",
};

function CaptureForm({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    await createCapture(fd);
    setSaving(false);
    onClose();
  }

  return (
    <div className="rounded border border-rule bg-paper-dark p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-soft">
        Nova Captura
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="title"
          required
          placeholder="Titulo da captura"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <input
          name="context"
          placeholder="Contexto (opcional)"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <select
          name="source_type"
          required
          defaultValue="transcription"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="transcription">Transcrição</option>
          <option value="pdf">PDF</option>
          <option value="youtube">YouTube</option>
          <option value="manual">Manual</option>
        </select>
        <input
          name="source_url"
          placeholder="URL da fonte (opcional)"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <textarea
          name="raw_content"
          placeholder="Cole a transcrição ou conteúdo bruto aqui..."
          rows={10}
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-accent px-4 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-rule px-4 py-1.5 font-mono text-xs text-ink-muted transition hover:text-ink-soft"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CaptureList({ captures }: { captures: Capture[] }) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Apagar esta captura?")) return;
    await deleteCapture(id);
  }

  if (showForm) {
    return <CaptureForm onClose={() => setShowForm(false)} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-ink-muted">
          {captures.length} captura{captures.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90"
        >
          + Nova Captura
        </button>
      </div>

      {captures.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Nenhuma captura ainda. Crie a primeira!
        </p>
      ) : (
        <div className="space-y-2">
          {captures.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <div
                key={c.id}
                className="rounded border border-rule bg-paper-dark transition hover:border-ink-muted"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-sans text-sm font-medium text-ink">
                        {c.title}
                      </h3>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${
                          statusBadge[c.status as CaptureStatus]
                        }`}
                      >
                        {statusLabel[c.status as CaptureStatus]}
                      </span>
                      <span className="font-mono text-[10px] text-ink-muted">
                        {sourceLabel[c.source_type] ?? c.source_type}
                      </span>
                    </div>
                    {c.context && (
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {c.context}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c.id);
                      }}
                      className="rounded px-2 py-1 font-mono text-[10px] text-accent transition hover:bg-paper"
                    >
                      Apagar
                    </button>
                    <span className="font-mono text-[10px] text-ink-muted">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-rule px-4 pb-4">
                    {c.raw_content && (
                      <div className="mt-3">
                        <h4 className="mb-1 font-mono text-xs uppercase tracking-wider text-ink-soft">
                          Conteúdo bruto
                        </h4>
                        <pre className="max-h-40 overflow-auto rounded bg-paper p-3 font-mono text-xs text-ink-soft">
                          {c.raw_content}
                        </pre>
                      </div>
                    )}
                    <CaptureDetail captureId={c.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
