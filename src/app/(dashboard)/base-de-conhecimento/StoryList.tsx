"use client";

import { useState } from "react";
import type { Story } from "@/lib/supabase/types";
import { createStory, updateStory, deleteStory } from "./actions";

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
    <div className="rounded border border-rule bg-paper-dark p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-soft">
        {story ? "Editar História" : "Nova História"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="title"
          required
          defaultValue={story?.title}
          placeholder="Título da história"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <input
          name="summary"
          defaultValue={story?.summary ?? ""}
          placeholder="Resumo curto (opcional)"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <div className="flex gap-3">
          <select
            name="period"
            defaultValue={story?.period ?? ""}
            className="rounded border border-rule bg-paper px-2 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
            className="flex-1 rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>
        <textarea
          name="body_markdown"
          defaultValue={story?.body_markdown ?? ""}
          placeholder="Conte a história em detalhes..."
          rows={8}
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <input
          name="lesson"
          defaultValue={story?.lesson ?? ""}
          placeholder="Lição ou aprendizado (opcional)"
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

export default function StoryList({ stories }: { stories: Story[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Apagar esta história?")) return;
    await deleteStory(id);
  }

  if (editing) {
    return <StoryForm story={editing} onClose={() => setEditing(null)} />;
  }

  if (showForm) {
    return <StoryForm onClose={() => setShowForm(false)} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] text-ink-muted">
          {stories.length} história{stories.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90"
        >
          + Nova História
        </button>
      </div>

      {stories.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Nenhuma história ainda. Crie a primeira!
        </p>
      ) : (
        <div className="space-y-2">
          {stories.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded border border-rule bg-paper-dark px-4 py-3 transition hover:border-ink-muted"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-sans text-sm font-medium text-ink">
                  {s.title}
                </h3>
                {s.summary && (
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
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
                      className="rounded bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-3 flex shrink-0 gap-1">
                <button
                  onClick={() => setEditing(s)}
                  className="rounded px-2 py-1 font-mono text-[10px] text-blue transition hover:bg-paper"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="rounded px-2 py-1 font-mono text-[10px] text-accent transition hover:bg-paper"
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
