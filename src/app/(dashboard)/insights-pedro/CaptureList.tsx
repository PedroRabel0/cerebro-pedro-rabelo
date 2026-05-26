"use client";

import { useState } from "react";
import type { Capture, CaptureStatus } from "@/lib/supabase/types";
import { createCapture, deleteCapture } from "./actions";
import CaptureDetail from "./CaptureDetail";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Video,
  Mic,
  FileText,
  Edit3,
  Save,
  X,
  Inbox,
} from "lucide-react";

const statusBadge: Record<CaptureStatus, string> = {
  pending: "bg-accent/10 text-accent",
  processed: "bg-green/10 text-green",
  archived: "bg-blue/10 text-blue",
};

const statusLabel: Record<CaptureStatus, string> = {
  pending: "pendente",
  processed: "processado",
  archived: "arquivado",
};

const sourceConfig: Record<string, { label: string; Icon: typeof Video }> = {
  transcript: { label: "Transcrição", Icon: Mic },
  pdf: { label: "PDF", Icon: FileText },
  youtube: { label: "YouTube", Icon: Video },
  manual: { label: "Manual", Icon: Edit3 },
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
    <div className="animate-slide-in rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-text-secondary">
        Nova Captura
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="title"
          required
          placeholder="Título da captura"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          name="context"
          placeholder="Contexto (opcional)"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <select
          name="source_type"
          required
          defaultValue="transcript"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
        >
          <option value="transcript">Transcrição</option>
          <option value="pdf">PDF</option>
          <option value="youtube">YouTube</option>
          <option value="manual">Manual</option>
        </select>
        <input
          name="source_url"
          placeholder="URL da fonte (opcional)"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <textarea
          name="raw_content"
          placeholder="Cole a transcrição ou conteúdo bruto aqui..."
          rows={10}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
          >
            <X className="h-3 w-3" />
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
        <span className="font-mono text-[10px] text-text-muted">
          {captures.length} captura{captures.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 font-mono text-xs font-bold text-white transition hover:bg-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Captura
        </button>
      </div>

      {captures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface">
            <Inbox className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm text-text-muted">
            Nenhuma captura ainda. Crie a primeira!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {captures.map((c) => {
            const isExpanded = expandedId === c.id;
            const source = sourceConfig[c.source_type] || sourceConfig.manual;
            return (
              <div
                key={c.id}
                className="card-hover rounded-2xl border border-border bg-card"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface">
                      <source.Icon className="h-4 w-4 text-text-muted" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-sans text-sm font-medium text-text">
                          {c.title}
                        </h3>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${
                            statusBadge[c.status as CaptureStatus]
                          }`}
                        >
                          {statusLabel[c.status as CaptureStatus]}
                        </span>
                      </div>
                      {c.context && (
                        <p className="mt-0.5 truncate text-xs text-text-muted">
                          {c.context}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c.id);
                      }}
                      className="rounded-xl p-1.5 text-text-muted transition hover:bg-red/10 hover:text-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="animate-slide-in border-t border-border px-4 pb-4">
                    {c.raw_content && (
                      <div className="mt-3">
                        <h4 className="mb-1 font-mono text-xs uppercase tracking-wider text-text-secondary">
                          Conteúdo bruto
                        </h4>
                        <pre className="max-h-40 overflow-auto rounded-xl bg-surface p-3 font-mono text-xs text-text-secondary">
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
