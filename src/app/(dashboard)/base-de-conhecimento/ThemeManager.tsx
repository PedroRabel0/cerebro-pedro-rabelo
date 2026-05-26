"use client";

import { useState } from "react";
import type { Theme } from "@/lib/supabase/types";
import { createTheme, deleteTheme } from "./actions";

export default function ThemeManager({ themes }: { themes: Theme[] }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    await createTheme(new FormData(e.currentTarget));
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Apagar este tema? Playbooks associados ficarão sem tema."))
      return;
    await deleteTheme(id);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-text-secondary">
          Temas
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="font-mono text-[10px] text-accent transition hover:opacity-70"
        >
          {showForm ? "Cancelar" : "+ Novo"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-3 space-y-2">
          <input
            name="name"
            required
            placeholder="Nome do tema"
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <input
            name="description"
            placeholder="Descrição (opcional)"
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              name="color"
              type="color"
              defaultValue="#3a5a7a"
              className="h-7 w-7 cursor-pointer rounded border border-border"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-3 py-1 font-mono text-[10px] font-bold text-bg disabled:opacity-50"
            >
              {saving ? "..." : "Criar"}
            </button>
          </div>
        </form>
      )}

      {themes.length === 0 ? (
        <p className="text-xs text-text-muted">Nenhum tema criado.</p>
      ) : (
        <div className="space-y-1">
          {themes.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-surface"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: t.color ?? "#3a5a7a" }}
                />
                <span className="text-xs text-text">{t.name}</span>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="font-mono text-[10px] text-text-muted transition hover:text-accent"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
