"use client";

import { useState } from "react";
import type { ContentFormat, ContentType } from "@/lib/supabase/types";
import { createFormat, deleteFormat } from "./actions";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "instagram_reel", label: "Instagram Reel" },
  { value: "instagram_carousel", label: "Instagram Carousel" },
  { value: "instagram_static", label: "Instagram Static" },
  { value: "youtube_long", label: "YouTube Long" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "x_thread", label: "X Thread" },
  { value: "x_tweet", label: "X Tweet" },
];

export function contentTypeBadgeColor(ct: string): string {
  switch (ct) {
    case "instagram_reel":
    case "instagram_carousel":
    case "instagram_static":
      return "bg-[#c13584] text-white";
    case "youtube_long":
    case "youtube_short":
      return "bg-accent text-white";
    case "linkedin_post":
      return "bg-blue text-white";
    case "x_thread":
    case "x_tweet":
      return "bg-text text-white";
    default:
      return "bg-text-muted text-white";
  }
}

export function contentTypeLabel(ct: string): string {
  return CONTENT_TYPES.find((t) => t.value === ct)?.label ?? ct;
}

function FormatForm({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    await createFormat(fd);
    setSaving(false);
    onClose();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-text-secondary">
        Novo Formato
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="name"
          required
          placeholder="Nome do formato"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <select
          name="content_type"
          required
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
        >
          <option value="">Tipo de conteúdo</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          name="description"
          placeholder="Descrição (opcional)"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <textarea
          name="structure_markdown"
          placeholder="Estrutura em markdown (opcional)"
          rows={6}
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

export default function FormatList({
  formats,
}: {
  formats: ContentFormat[];
}) {
  const [showForm, setShowForm] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Apagar este formato?")) return;
    await deleteFormat(id);
  }

  if (showForm) {
    return <FormatForm onClose={() => setShowForm(false)} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-muted">
          {formats.length} formato{formats.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-accent px-3 py-1.5 font-mono text-xs font-bold text-white transition hover:bg-accent-hover"
        >
          + Novo Formato
        </button>
      </div>

      {formats.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Nenhum formato ainda. Crie o primeiro!
        </p>
      ) : (
        <div className="space-y-2">
          {formats.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition hover:border-border-light"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-sans text-sm font-medium text-text">
                    {f.name}
                  </h3>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${contentTypeBadgeColor(f.content_type)}`}
                  >
                    {contentTypeLabel(f.content_type)}
                  </span>
                </div>
                {f.description && (
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {f.description}
                  </p>
                )}
                <span className="font-mono text-[10px] text-text-muted">
                  {f.usage_count} uso{f.usage_count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="ml-3 flex shrink-0 gap-1">
                <button
                  onClick={() => handleDelete(f.id)}
                  className="rounded-lg px-2 py-1 font-mono text-[10px] text-red transition hover:bg-card"
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
