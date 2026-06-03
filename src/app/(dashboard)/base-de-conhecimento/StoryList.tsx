"use client";

import { useState } from "react";
import type { Story } from "@/lib/supabase/types";
import { createStory, updateStory, deleteStory, toggleStoryOrigin } from "./actions";
import { BookMarked } from "lucide-react";

const PERIODS = [
  { value: "", label: "Sem período" },
  { value: "infancia", label: "Infância" },
  { value: "adolescencia", label: "Adolescência" },
  { value: "inicio_carreira", label: "Início de carreira" },
  { value: "maturidade", label: "Maturidade" },
  { value: "recente", label: "Recente" },
];

function StoryForm({
  story,
  onClose,
}: {
  story?: Story;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    if (story) {
      await updateStory(story.id, fd);
    } else {
      await createStory(fd);
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-text-secondary">
        {story ? "Editar História" : "Nova História"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="title"
          required
          defaultValue={story?.title}
          placeholder="Título da história"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          name="summary"
          defaultValue={story?.summary ?? ""}
          placeholder="Resumo curto (opcional)"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <div className="flex gap-3">
          <select
            name="period"
            defaultValue={story?.period ?? ""}
            className="rounded-lg border border-border bg-card px-2 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            name="tags"
            defaultValue={story?.tags?.join(", ") ?? ""}
            placeholder="Tags (separadas por vírgula)"
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <textarea
          name="body_markdown"
          defaultValue={story?.body_markdown ?? ""}
          placeholder="Conte a história em detalhes..."
          rows={8}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          name="lesson"
          defaultValue={story?.lesson ?? ""}
          placeholder="Lição ou aprendizado (opcional)"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-1.5 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-1.5 font-mono text-xs text-text-muted transition hover:text-text hover:border-border-light"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default function StoryList({ stories }: { stories: Story[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  async function handleDelete(id: string) {
    await deleteStory(id);
    setDeleteTarget(null);
  }

  if (editing) {
    return <StoryForm story={editing} onClose={() => setEditing(null)} />;
  }

  if (showForm) {
    return <StoryForm onClose={() => setShowForm(false)} />;
  }

  return (
    <div>
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">
              Apagar a história <strong>&quot;{deleteTarget.title}&quot;</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:bg-surface hover:text-text"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                className="rounded-lg bg-red px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-red/80"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-muted">
          {stories.length} história{stories.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-accent px-3 py-1.5 font-mono text-xs font-bold text-white transition hover:bg-accent-hover"
        >
          + Nova História
        </button>
      </div>

      {stories.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
          <BookMarked className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            Nenhuma história ainda.
          </p>
          <p className="text-xs text-text-muted">
            Histórias dão vida aos seus playbooks.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {stories.map((s) => {
            const isExpanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-card transition hover:border-border-light"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-sans text-sm font-medium text-text">
                        {s.title}
                      </h3>
                      {s.created_at &&
                        Date.now() - new Date(s.created_at).getTime() < 24 * 60 * 60 * 1000 && (
                        <span className="bg-green/15 text-green text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                          Novo
                        </span>
                      )}
                    </div>
                    {s.summary && (
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {s.summary}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.period && (
                        <span className="rounded bg-blue/10 px-1.5 py-0.5 font-mono text-[10px] text-blue">
                          {PERIODS.find((p) => p.value === s.period)?.label ??
                            s.period}
                        </span>
                      )}
                      {s.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                  <div className="ml-3 flex shrink-0 gap-1">
                    <button
                      onClick={async () => {
                        const newOrigin = (!s.created_by || s.created_by === "pedro") ? "outros" : "pedro";
                        await toggleStoryOrigin(s.id, newOrigin);
                      }}
                      className="rounded-lg px-2 py-1 font-mono text-[10px] text-purple transition hover:bg-purple/10"
                      title={(!s.created_by || s.created_by === "pedro") ? "Mover para Outros" : "Mover para Pedro"}
                    >
                      {(!s.created_by || s.created_by === "pedro") ? "→ Outros" : "→ Pedro"}
                    </button>
                    <button
                      onClick={() => setEditing(s)}
                      className="rounded-lg px-2 py-1 font-mono text-[10px] text-blue transition hover:bg-card"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: s.id, title: s.title })}
                      className="rounded-lg px-2 py-1 font-mono text-[10px] text-red transition hover:bg-card"
                    >
                      Apagar
                    </button>
                  </div>
                </div>

                {/* Expandable content */}
                {isExpanded && s.body_markdown && (
                  <div className="border-t border-border px-4 pb-4">
                    <div className="mt-3 rounded-lg bg-surface p-3">
                      <pre className="whitespace-pre-wrap text-xs text-text-secondary font-sans leading-relaxed">
                        {s.body_markdown}
                      </pre>
                    </div>
                    {s.lesson && (
                      <div className="mt-3 rounded-lg border border-green/20 bg-green/5 p-3">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-green">
                          Lição
                        </p>
                        <p className="text-xs text-text-secondary">{s.lesson}</p>
                      </div>
                    )}
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
