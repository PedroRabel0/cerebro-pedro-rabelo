"use client";

import { useState } from "react";
import type { GeneratedContent, ContentStatus } from "@/lib/supabase/types";
import { updateContentStatus, deleteContent } from "./actions";
import { contentTypeBadgeColor, contentTypeLabel } from "./FormatList";
import {
  MessageSquare,
  ThumbsUp,
  Pencil,
  ThumbsDown,
  Trash2,
  Image as ImageIcon,
  X,
  Save,
  ChevronDown,
} from "lucide-react";

function statusBadge(status: ContentStatus) {
  switch (status) {
    case "draft":
      return "bg-[#b8860b]/10 text-[#b8860b]";
    case "approved":
      return "bg-green/10 text-green";
    case "published":
      return "bg-blue/10 text-blue";
  }
}

function statusLabel(status: ContentStatus) {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "approved":
      return "Aprovado";
    case "published":
      return "Publicado";
  }
}

function FeedbackForm({
  content,
  onClose,
}: {
  content: GeneratedContent;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(content.feedback_rating ?? "");
  const [text, setText] = useState(content.feedback_text ?? "");
  const [status, setStatus] = useState<ContentStatus>(content.status);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateContentStatus(content.id, status, rating || undefined, text);
    setSaving(false);
    onClose();
  }

  const ratingOptions = [
    { value: "good", label: "Bom", Icon: ThumbsUp, color: "text-green" },
    {
      value: "good_with_edits",
      label: "Bom c/ edits",
      Icon: Pencil,
      color: "text-accent",
    },
    { value: "bad", label: "Ruim", Icon: ThumbsDown, color: "text-red" },
  ] as const;

  return (
    <div className="animate-slide-in mt-3 rounded-xl border border-border bg-card p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Status
          </label>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full appearance-none rounded-xl border border-border bg-card px-3 py-2 pr-8 text-sm text-text focus:border-accent focus:outline-none"
            >
              <option value="draft">Rascunho</option>
              <option value="approved">Aprovado</option>
              <option value="published">Publicado</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Avaliação
          </label>
          <div className="flex gap-1">
            {ratingOptions.map(({ value, label, Icon, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs transition ${
                  rating === value
                    ? "bg-accent text-bg"
                    : "border border-border text-text-muted hover:border-accent/50"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Feedback
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comentários sobre o conteúdo..."
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-1.5 font-mono text-xs font-bold text-bg transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-1.5 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
          >
            <X className="h-3 w-3" />
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
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
          <ImageIcon className="h-6 w-6 text-accent" />
        </div>
        <p className="text-sm font-medium text-text">Nenhum conteúdo gerado</p>
        <p className="mt-1 text-xs text-text-muted">
          Use a aba &quot;Novo Conteúdo&quot; para criar!
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="mb-4 block font-mono text-[10px] text-text-muted">
        {contents.length} conteúdo{contents.length !== 1 ? "s" : ""}
      </span>
      <div className="space-y-3">
        {contents.map((c) => (
          <div
            key={c.id}
            className="card-hover rounded-2xl border border-border bg-card px-4 py-3"
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
                  {c.image_model && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple/10 px-2 py-0.5 font-mono text-[10px] text-purple">
                      <ImageIcon className="h-2.5 w-2.5" />
                      {c.image_model}
                    </span>
                  )}
                  {c.feedback_rating && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-muted">
                      {c.feedback_rating === "good" ? (
                        <ThumbsUp className="h-2.5 w-2.5 text-green" />
                      ) : c.feedback_rating === "good_with_edits" ? (
                        <Pencil className="h-2.5 w-2.5 text-accent" />
                      ) : (
                        <ThumbsDown className="h-2.5 w-2.5 text-red" />
                      )}
                      {c.feedback_rating === "good"
                        ? "Bom"
                        : c.feedback_rating === "good_with_edits"
                          ? "Bom c/ edits"
                          : "Ruim"}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-3">
                  {c.image_url && (
                    <img
                      src={c.image_url}
                      alt="Imagem gerada"
                      className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-border"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed text-text line-clamp-2">
                      {c.content_text}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-text-muted">
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
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() =>
                    setFeedbackId(feedbackId === c.id ? null : c.id)
                  }
                  className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-blue transition hover:bg-blue/10"
                >
                  <MessageSquare className="h-3 w-3" />
                  <span className="hidden sm:inline">Feedback</span>
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-red transition hover:bg-red/10"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Apagar</span>
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
