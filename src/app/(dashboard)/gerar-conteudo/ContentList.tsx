"use client";

import { useState } from "react";
import type { GeneratedContent, ContentStatus } from "@/lib/supabase/types";
import { updateContentStatus, deleteContent } from "./actions";
import { contentTypeBadgeColor, contentTypeLabel } from "./FormatList";

function statusBadge(status: ContentStatus) {
  switch (status) {
    case "draft":
      return "bg-[#b8860b] text-paper";
    case "approved":
      return "bg-green text-paper";
    case "rejected":
      return "bg-accent text-paper";
  }
}

function statusLabel(status: ContentStatus) {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "approved":
      return "Aprovado";
    case "rejected":
      return "Rejeitado";
  }
}

function FeedbackForm({
  content,
  onClose,
}: {
  content: GeneratedContent;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(content.feedback_rating ?? 3);
  const [text, setText] = useState(content.feedback_text ?? "");
  const [status, setStatus] = useState<ContentStatus>(content.status);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateContentStatus(content.id, status, rating, text);
    setSaving(false);
    onClose();
  }

  return (
    <div className="mt-3 rounded border border-rule bg-paper p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase text-ink-muted">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContentStatus)}
            className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="draft">Rascunho</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Rejeitado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase text-ink-muted">
            Nota (1-5)
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`h-8 w-8 rounded font-mono text-xs transition ${
                  rating === n
                    ? "bg-accent text-paper"
                    : "border border-rule text-ink-muted hover:border-accent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase text-ink-muted">
            Feedback
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comentários sobre o conteúdo..."
            rows={3}
            className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>
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

export default function ContentList({
  contents,
}: {
  contents: GeneratedContent[];
}) {
  const [feedbackId, setFeedbackId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Apagar este conteúdo?")) return;
    await deleteContent(id);
  }

  if (contents.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        Nenhum conteúdo gerado ainda. Use a aba &quot;Novo Conteúdo&quot; para
        criar!
      </p>
    );
  }

  return (
    <div>
      <span className="mb-4 block font-mono text-[10px] text-ink-muted">
        {contents.length} conteúdo{contents.length !== 1 ? "s" : ""}
      </span>
      <div className="space-y-3">
        {contents.map((c) => (
          <div
            key={c.id}
            className="rounded border border-rule bg-paper-dark px-4 py-3 transition hover:border-ink-muted"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${contentTypeBadgeColor(c.content_type)}`}
                  >
                    {contentTypeLabel(c.content_type)}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${statusBadge(c.status)}`}
                  >
                    {statusLabel(c.status)}
                  </span>
                  {c.feedback_rating && (
                    <span className="font-mono text-[10px] text-ink-muted">
                      Nota: {c.feedback_rating}/5
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink line-clamp-2">
                  {c.content_text}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-ink-muted">
                  {c.playbook && (
                    <span>Playbook: {c.playbook.title}</span>
                  )}
                  {c.story && <span>História: {c.story.title}</span>}
                  {c.format && <span>Formato: {c.format.name}</span>}
                  <span>
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() =>
                    setFeedbackId(feedbackId === c.id ? null : c.id)
                  }
                  className="rounded px-2 py-1 font-mono text-[10px] text-blue transition hover:bg-paper"
                >
                  Feedback
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded px-2 py-1 font-mono text-[10px] text-accent transition hover:bg-paper"
                >
                  Apagar
                </button>
              </div>
            </div>
            {feedbackId === c.id && (
              <FeedbackForm
                content={c}
                onClose={() => setFeedbackId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
