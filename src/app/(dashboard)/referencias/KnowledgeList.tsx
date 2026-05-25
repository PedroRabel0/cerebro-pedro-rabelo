"use client";

import { useState } from "react";
import type { ReferenceKnowledge } from "@/lib/supabase/types";
import { createKnowledge, deleteKnowledge } from "./actions";

function KnowledgeForm({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    await createKnowledge(new FormData(e.currentTarget));
    setSaving(false);
    onClose();
  }

  const inputCls =
    "w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-blue focus:outline-none";

  return (
    <div className="rounded border border-blue/30 bg-paper-dark p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-soft">
        Novo Conhecimento Externo
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="title"
          required
          placeholder="Título"
          className={inputCls}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="author"
            placeholder="Autor"
            className={inputCls}
          />
          <select
            name="source_type"
            className={inputCls}
          >
            <option value="">Tipo de fonte...</option>
            <option value="book">Livro</option>
            <option value="article">Artigo</option>
            <option value="podcast">Podcast</option>
            <option value="video">Vídeo</option>
            <option value="course">Curso</option>
            <option value="newsletter">Newsletter</option>
            <option value="other">Outro</option>
          </select>
        </div>
        <input
          name="source_url"
          placeholder="URL da fonte (opcional)"
          className={inputCls}
        />
        <input
          name="tags"
          placeholder="Tags (separadas por vírgula)"
          className={inputCls}
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            <input
              name="citation_allowed"
              type="checkbox"
              defaultChecked
              className="accent-blue"
            />
            Citação permitida
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue px-4 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
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

export default function KnowledgeList({
  knowledge,
}: {
  knowledge: ReferenceKnowledge[];
}) {
  const [showForm, setShowForm] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Apagar este item de conhecimento?")) return;
    await deleteKnowledge(id);
  }

  if (showForm) {
    return <KnowledgeForm onClose={() => setShowForm(false)} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-ink-muted">
          {knowledge.length} item{knowledge.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-blue px-3 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90"
        >
          + Novo Conhecimento
        </button>
      </div>

      {knowledge.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Nenhum conhecimento externo registrado. Adicione livros, artigos,
          podcasts e outras fontes de inspiração.
        </p>
      ) : (
        <div className="space-y-2">
          {knowledge.map((k) => (
            <div
              key={k.id}
              className="flex items-start justify-between rounded border border-blue/20 bg-paper-dark px-4 py-3 transition hover:border-blue/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-sans text-sm font-medium text-ink">
                    {k.title}
                  </h3>
                  {k.source_type && (
                    <span className="inline-block shrink-0 rounded-full border border-blue/20 bg-blue/10 px-2 py-0.5 font-mono text-[10px] text-blue">
                      {k.source_type}
                    </span>
                  )}
                  {k.citation_allowed && (
                    <span className="inline-block shrink-0 rounded-full border border-green/30 bg-green/10 px-2 py-0.5 font-mono text-[10px] text-green">
                      citável
                    </span>
                  )}
                </div>
                {k.author && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    por {k.author}
                  </p>
                )}
                {k.source_url && (
                  <a
                    href={k.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block truncate font-mono text-[10px] text-blue underline"
                  >
                    {k.source_url}
                  </a>
                )}
                {k.tags && k.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {k.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(k.id)}
                className="ml-3 shrink-0 rounded px-2 py-1 font-mono text-[10px] text-accent transition hover:bg-paper"
              >
                Apagar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
