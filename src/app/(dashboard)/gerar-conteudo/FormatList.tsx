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
      return "bg-[#c13584] text-paper";
    case "youtube_long":
    case "youtube_short":
      return "bg-accent text-paper";
    case "linkedin_post":
      return "bg-blue text-paper";
    case "x_thread":
    case "x_tweet":
      return "bg-ink text-paper";
    default:
      return "bg-ink-muted text-paper";
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
    <div className="rounded border border-rule bg-paper-dark p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-soft">
        Novo Formato
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="name"
          required
          placeholder="Nome do formato"
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <select
          name="content_type"
          required
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
          className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <textarea
          name="structure_markdown"
          placeholder="Estrutura em markdown (opcional)"
          rows={6}
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
        <span className="font-mono text-[10px] text-ink-muted">
          {formats.length} formato{formats.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-accent px-3 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90"
        >
          + Novo Formato
        </button>
      </div>

      {formats.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Nenhum formato ainda. Crie o primeiro!
        </p>
      ) : (
        <div className="space-y-2">
          {formats.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded border border-rule bg-paper-dark px-4 py-3 transition hover:border-ink-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-sans text-sm font-medium text-ink">
                    {f.name}
                  </h3>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${contentTypeBadgeColor(f.content_type)}`}
                  >
                    {contentTypeLabel(f.content_type)}
                  </span>
                </div>
                {f.description && (
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {f.description}
                  </p>
                )}
                <span className="font-mono text-[10px] text-ink-muted">
                  {f.usage_count} uso{f.usage_count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="ml-3 flex shrink-0 gap-1">
                <button
                  onClick={() => handleDelete(f.id)}
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
