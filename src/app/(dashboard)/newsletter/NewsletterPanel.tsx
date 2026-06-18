"use client";

import { useState, useTransition } from "react";
import { useConfirm } from "@/components/ConfirmProvider";
import type { Newsletter, NewsletterStatus } from "@/lib/supabase/types";
import {
  generateNewsletter,
  updateNewsletterStatus,
  updateNewsletterBody,
  deleteNewsletter,
} from "./actions";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Trash2,
  Inbox,
  Pencil,
  Save,
  X,
} from "lucide-react";

const statusBadge: Record<NewsletterStatus, string> = {
  draft: "bg-accent/10 text-accent",
  approved: "bg-green/10 text-green",
  sent: "bg-blue/10 text-blue",
};

const statusLabel: Record<NewsletterStatus, string> = {
  draft: "rascunho",
  approved: "aprovada",
  sent: "enviada",
};

export default function NewsletterPanel({
  newsletters,
}: {
  newsletters: Newsletter[];
}) {
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [theme, setTheme] = useState("");
  const [weekLabel, setWeekLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!theme.trim()) return;
    startTransition(async () => {
      await generateNewsletter(theme.trim(), weekLabel.trim() || undefined);
      setTheme("");
      setWeekLabel("");
    });
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      await updateNewsletterStatus(id, "approved");
    });
  }

  async function handleDelete(id: string) {
    if (!(await confirm("Apagar esta newsletter?"))) return;
    startTransition(async () => {
      await deleteNewsletter(id);
      if (expandedId === id) setExpandedId(null);
    });
  }

  async function handleCopy(body: string, id: string) {
    await navigator.clipboard.writeText(body);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function startEditing(newsletter: Newsletter) {
    setEditingId(newsletter.id);
    setEditBody(newsletter.body_markdown);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditBody("");
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      await updateNewsletterBody(id, editBody);
      setEditingId(null);
      setEditBody("");
    });
  }

  return (
    <div className="space-y-6">
      {/* Generator form */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-text-secondary">
          Gerar Nova Newsletter
        </h3>
        <form onSubmit={handleGenerate} className="space-y-3">
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            required
            aria-label="Tema da newsletter"
            placeholder="Tema da newsletter (ex: lideranca esta semana)"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <input
            value={weekLabel}
            onChange={(e) => setWeekLabel(e.target.value)}
            aria-label="Label da semana"
            placeholder="Label da semana (opcional, ex: Semana 1 - Junho 2026)"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending || !theme.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isPending ? "Gerando..." : "Gerar Newsletter"}
          </button>
        </form>
      </div>

      {/* Newsletter list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[10px] text-text-muted">
            {newsletters.length} newsletter{newsletters.length !== 1 ? "s" : ""}
          </span>
        </div>

        {newsletters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface">
              <Inbox className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm text-text-muted">
              Nenhuma newsletter ainda. Gere a primeira!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {newsletters.map((n) => {
              const isExpanded = expandedId === n.id;
              const isEditing = editingId === n.id;
              return (
                <div
                  key={n.id}
                  className="card-hover rounded-2xl border border-border bg-card"
                >
                  {/* Card header */}
                  <div
                    className="flex cursor-pointer items-center justify-between px-4 py-3"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : n.id)
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-sans text-sm font-medium text-text">
                            {n.title}
                          </h3>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${
                              statusBadge[n.status]
                            }`}
                          >
                            {statusLabel[n.status]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-text-muted">
                          {n.subject}
                        </p>
                        {n.week_label && (
                          <p className="mt-0.5 text-xs text-text-muted">
                            {n.week_label}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-1">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-text-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-text-muted" />
                      )}
                    </div>
                  </div>

                  {/* Preview (collapsed) */}
                  {!isExpanded && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-text-secondary line-clamp-3">
                        {n.body_markdown.slice(0, 200)}
                        {n.body_markdown.length > 200 ? "..." : ""}
                      </p>
                    </div>
                  )}

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="animate-slide-in border-t border-border px-4 pb-4">
                      {/* Topics */}
                      {n.topics && n.topics.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {n.topics.map((topic, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-text-muted"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Body */}
                      <div className="mt-3">
                        <h4 className="mb-1 font-mono text-xs uppercase tracking-wider text-text-secondary">
                          Corpo da Newsletter
                        </h4>
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              rows={20}
                              aria-label="Corpo da newsletter"
                              className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(n.id)}
                                disabled={isPending}
                                className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
                              >
                                <Save className="h-3 w-3" />
                                {isPending ? "Salvando..." : "Salvar"}
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
                              >
                                <X className="h-3 w-3" />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-3 font-mono text-xs text-text-secondary">
                            {n.body_markdown}
                          </pre>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {n.status === "draft" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(n.id);
                            }}
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-xl bg-green/10 px-3 py-1.5 font-mono text-xs font-bold text-green transition hover:bg-green/20 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" />
                            Aprovar
                          </button>
                        )}
                        {!isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(n);
                            }}
                            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(n.body_markdown, n.id);
                          }}
                          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
                        >
                          <Copy className="h-3 w-3" />
                          {copiedId === n.id ? "Copiado!" : "Copiar"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(n.id);
                          }}
                          disabled={isPending}
                          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs text-text-muted transition hover:bg-red/10 hover:text-red disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Deletar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
