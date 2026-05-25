"use client";

import { useState } from "react";
import type { Playbook, Theme } from "@/lib/supabase/types";
import { createPlaybook, updatePlaybook, deletePlaybook } from "./actions";

function CompletenessBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green" : score >= 50 ? "bg-blue" : "bg-accent";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-paper-dark">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-ink-muted">{score}%</span>
    </div>
  );
}

function PlaybookForm({
  themes,
  playbook,
  onClose,
}: {
  themes: Theme[];
  playbook?: Playbook;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    if (playbook) {
      await updatePlaybook(playbook.id, fd);
    } else {
      await createPlaybook(fd);
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="rounded border border-rule bg-paper-dark p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-soft">
        {playbook ? "Editar Playbook" : "Novo Playbook"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="title"
          required
          defaultValue={playbook?.title}
          placeholder="Título do playbook"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <input
          name="subtitle"
          defaultValue={playbook?.subtitle ?? ""}
          placeholder="Subtítulo (opcional)"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <select
          name="theme_id"
          defaultValue={playbook?.theme_id ?? ""}
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="">Sem tema</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <textarea
          name="body_markdown"
          defaultValue={playbook?.body_markdown ?? ""}
          placeholder="Conteúdo em markdown..."
          rows={8}
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

export default function PlaybookList({
  playbooks,
  themes,
}: {
  playbooks: Playbook[];
  themes: Theme[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [filterTheme, setFilterTheme] = useState<string>("");

  const filtered = filterTheme
    ? playbooks.filter((p) => p.theme_id === filterTheme)
    : playbooks;

  async function handleDelete(id: string) {
    if (!confirm("Apagar este playbook?")) return;
    await deletePlaybook(id);
  }

  if (editing) {
    return (
      <PlaybookForm
        themes={themes}
        playbook={editing}
        onClose={() => setEditing(null)}
      />
    );
  }

  if (showForm) {
    return (
      <PlaybookForm themes={themes} onClose={() => setShowForm(false)} />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={filterTheme}
            onChange={(e) => setFilterTheme(e.target.value)}
            className="rounded border border-rule bg-paper px-2 py-1 font-mono text-xs text-ink-soft focus:border-accent focus:outline-none"
          >
            <option value="">Todos os temas</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="font-mono text-[10px] text-ink-muted">
            {filtered.length} playbook{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90"
        >
          + Novo Playbook
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Nenhum playbook ainda. Crie o primeiro!
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded border border-rule bg-paper-dark px-4 py-3 transition hover:border-ink-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-sans text-sm font-medium text-ink">
                    {p.title}
                  </h3>
                  {p.theme && (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] text-paper"
                      style={{ backgroundColor: p.theme.color ?? "#3a5a7a" }}
                    >
                      {p.theme.name}
                    </span>
                  )}
                </div>
                {p.subtitle && (
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {p.subtitle}
                  </p>
                )}
                <CompletenessBar score={p.completeness_score} />
              </div>
              <div className="ml-3 flex shrink-0 gap-1">
                <button
                  onClick={() => setEditing(p)}
                  className="rounded px-2 py-1 font-mono text-[10px] text-blue transition hover:bg-paper"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
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
