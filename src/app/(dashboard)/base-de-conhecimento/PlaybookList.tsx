"use client";

import { useState } from "react";
import type { Playbook, Theme } from "@/lib/supabase/types";
import { createPlaybook, updatePlaybook, deletePlaybook } from "./actions";
import BookQuestionsPanel from "./BookQuestionsPanel";
import DiffView from "./DiffView";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { BookOpen } from "lucide-react";

function CompletenessBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green" : score >= 50 ? "bg-blue" : "bg-accent";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-surface">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-text-muted">{score}%</span>
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
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-text-secondary">
        {playbook ? "Editar Playbook" : "Novo Playbook"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="title"
          required
          defaultValue={playbook?.title}
          placeholder="Título do playbook"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          name="subtitle"
          defaultValue={playbook?.subtitle ?? ""}
          placeholder="Subtítulo (opcional)"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <select
          name="theme_id"
          defaultValue={playbook?.theme_id ?? ""}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffId, setDiffId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const { isPedro } = useUserRole();

  const filtered = filterTheme
    ? playbooks.filter((p) => p.theme_id === filterTheme)
    : playbooks;

  async function handleDelete(id: string) {
    await deletePlaybook(id);
    setDeleteTarget(null);
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
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">
              Apagar o playbook <strong>&quot;{deleteTarget.title}&quot;</strong>? Esta ação não pode ser desfeita.
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={filterTheme}
            onChange={(e) => setFilterTheme(e.target.value)}
            className="rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs text-text-secondary focus:border-accent focus:outline-none"
          >
            <option value="">Todos os temas</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="font-mono text-[10px] text-text-muted">
            {filtered.length} playbook{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-accent px-3 py-1.5 font-mono text-xs font-bold text-white transition hover:bg-accent-hover"
        >
          + Novo Playbook
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            {filterTheme ? "Nenhum playbook neste tema." : "Nenhum playbook ainda."}
          </p>
          <p className="text-xs text-text-muted">
            {filterTheme ? "Tente outro filtro ou crie um novo." : "Crie o primeiro para começar a organizar conhecimento."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const isBookReady =
              p.has_example &&
              p.has_story &&
              p.has_origin &&
              p.has_counterexample &&
              p.completeness_score >= 80;
            const isExpanded = expandedId === p.id;

            return (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-card transition hover:border-border-light"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : p.id)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-sans text-sm font-medium text-text">
                        {p.title}
                      </h3>
                      {p.created_at &&
                        Date.now() - new Date(p.created_at).getTime() < 24 * 60 * 60 * 1000 && (
                        <span className="bg-green/15 text-green text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                          Novo
                        </span>
                      )}
                      {p.theme && (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] text-white"
                          style={{
                            backgroundColor: p.theme.color ?? "#3a5a7a",
                          }}
                        >
                          {p.theme.name}
                        </span>
                      )}
                      {isBookReady && (
                        <span className="inline-block rounded-full bg-green/20 px-2 py-0.5 font-mono text-[10px] font-bold text-green">
                          Pronto pro Livro
                        </span>
                      )}
                    </div>
                    {p.subtitle && (
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {p.subtitle}
                      </p>
                    )}
                    <CompletenessBar score={p.completeness_score} />
                  </button>
                  <div className="ml-3 flex shrink-0 gap-1">
                    {p.version_previous && (
                      <button
                        onClick={() =>
                          setDiffId(diffId === p.id ? null : p.id)
                        }
                        className="rounded-lg px-2 py-1 font-mono text-[10px] text-accent transition hover:bg-accent/10"
                      >
                        Ver alteracoes
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(p)}
                      className="rounded-lg px-2 py-1 font-mono text-[10px] text-blue transition hover:bg-card"
                    >
                      Editar
                    </button>
                    {isPedro && (
                      <button
                        onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
                        className="rounded-lg px-2 py-1 font-mono text-[10px] text-red transition hover:bg-card"
                      >
                        Apagar
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4">
                    {p.body_markdown && (
                      <div className="mt-3 rounded-lg bg-surface p-3">
                        <pre className="whitespace-pre-wrap text-xs text-text-secondary font-sans leading-relaxed">
                          {p.body_markdown}
                        </pre>
                      </div>
                    )}
                    {diffId === p.id && p.version_previous && (
                      <DiffView
                        versionCurrent={p.version_current}
                        versionPrevious={p.version_previous}
                        onClose={() => setDiffId(null)}
                      />
                    )}
                    <BookQuestionsPanel playbook={p} />
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
