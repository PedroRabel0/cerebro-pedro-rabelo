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

/** Data local em "YYYY-MM-DD" (formato do input type=date). */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Segunda-feira da semana da data (semana comeca na segunda). */
function mondayOf(d: Date): Date {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday;
}

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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [focus, setFocus] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Atalhos de periodo (semana comecando na segunda)
  function fillLastWeek() {
    const thisMonday = mondayOf(new Date());
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    setFromDate(toDateInput(lastMonday));
    setToDate(toDateInput(lastSunday));
  }

  function fillThisWeek() {
    const now = new Date();
    setFromDate(toDateInput(mondayOf(now)));
    setToDate(toDateInput(now));
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate || !toDate) return;
    setGenError(null);
    startTransition(async () => {
      const result = await generateNewsletter(
        fromDate,
        toDate,
        focus.trim() || undefined
      );
      if (result && "error" in result) {
        setGenError(result.error);
        return;
      }
      setFocus("");
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
        <h3 className="mb-1 font-mono text-xs uppercase tracking-wider text-text-secondary">
          Gerar Recap da Semana
        </h3>
        <p className="mb-4 text-xs text-text-muted">
          Escolha o período: o Claude lê tudo que passou pela semana (conteúdo,
          ideias, reuniões anonimizadas) e escreve a análise geral.
        </p>
        <form onSubmit={handleGenerate} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fillLastWeek}
              className="rounded-xl border border-border px-3 py-1.5 font-mono text-xs text-text-muted transition hover:border-accent/50 hover:text-text"
            >
              Semana passada
            </button>
            <button
              type="button"
              onClick={fillThisWeek}
              className="rounded-xl border border-border px-3 py-1.5 font-mono text-xs text-text-muted transition hover:border-accent/50 hover:text-text"
            >
              Esta semana
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                De
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                required
                aria-label="Início do período"
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-text focus:border-accent focus:outline-none [color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Até
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                required
                aria-label="Fim do período"
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-text focus:border-accent focus:outline-none [color-scheme:dark]"
              />
            </label>
          </div>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            aria-label="Foco da newsletter (opcional)"
            placeholder="Foco (opcional, ex: lideranca)"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          {genError && (
            <p className="text-xs text-red" role="alert">
              {genError}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending || !fromDate || !toDate}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isPending ? "Lendo a semana e escrevendo…" : "Gerar Newsletter"}
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
