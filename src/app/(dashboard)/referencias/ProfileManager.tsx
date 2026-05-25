"use client";

import { useState } from "react";
import type { ReferenceProfile } from "@/lib/supabase/types";
import { createProfile, deleteProfile } from "./actions";

const PLATFORMS = ["instagram", "youtube", "linkedin", "x", "other"] as const;

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="inline-block rounded-full border border-blue bg-blue/10 px-2 py-0.5 font-mono text-[10px] text-blue">
      {platform}
    </span>
  );
}

export default function ProfileManager({
  profiles,
  selectedId,
  onSelect,
}: {
  profiles: ReferenceProfile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    await createProfile(new FormData(e.currentTarget));
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Apagar este perfil e todos os posts associados?")) return;
    if (selectedId === id) onSelect(null);
    await deleteProfile(id);
  }

  return (
    <div className="rounded border border-blue/30 bg-paper-dark p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-ink-soft">
          Perfis de Referência
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="font-mono text-[10px] text-blue transition hover:opacity-70"
        >
          {showForm ? "Cancelar" : "+ Novo"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-3 space-y-2">
          <select
            name="platform"
            required
            className="w-full rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink focus:border-blue focus:outline-none"
          >
            <option value="">Plataforma...</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            name="handle"
            required
            placeholder="@handle"
            className="w-full rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-blue focus:outline-none"
          />
          <input
            name="display_name"
            required
            placeholder="Nome de exibição"
            className="w-full rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-blue focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              <input
                name="active"
                type="checkbox"
                defaultChecked
                className="accent-blue"
              />
              Ativo
            </label>
            <button
              type="submit"
              disabled={saving}
              className="ml-auto rounded bg-blue px-3 py-1 font-mono text-[10px] font-semibold text-paper disabled:opacity-50"
            >
              {saving ? "..." : "Criar"}
            </button>
          </div>
        </form>
      )}

      {profiles.length === 0 ? (
        <p className="text-xs text-ink-muted">
          Nenhum perfil adicionado. Adicione perfis de referência para acompanhar
          conteúdo de outros criadores.
        </p>
      ) : (
        <div className="space-y-1">
          {profiles.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelect(p.id === selectedId ? null : p.id)}
              className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 transition hover:bg-paper ${
                selectedId === p.id
                  ? "border border-blue/40 bg-paper"
                  : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    p.active ? "bg-green" : "bg-ink-muted"
                  }`}
                />
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-ink">
                    {p.display_name}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-ink-muted">
                    {p.handle}
                  </span>
                </div>
                <PlatformBadge platform={p.platform} />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p.id);
                }}
                className="shrink-0 font-mono text-[10px] text-ink-muted transition hover:text-accent"
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
