"use client";

import { useState, useTransition } from "react";
import type { ReferenceProfile } from "@/lib/supabase/types";
import { createProfile, deleteProfile, rescrapeProfile } from "./actions";

const PLATFORMS = ["instagram", "youtube", "linkedin", "x", "other"] as const;

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="inline-block rounded-full border border-blue bg-blue/10 px-2 py-0.5 font-mono text-[10px] text-blue">
      {platform}
    </span>
  );
}

function formatLastScraped(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d atrás`;
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
  const [scrapingMessage, setScrapingMessage] = useState<string | null>(null);
  const [rescrapingId, setRescrapingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const platform = formData.get("platform") as string;
    const handle = formData.get("handle") as string;

    setSaving(true);
    if (platform === "instagram") {
      setScrapingMessage(`Criando perfil e scraping @${handle.replace(/^@/, "")}...`);
    }

    await createProfile(formData);
    setSaving(false);
    setShowForm(false);

    if (platform === "instagram") {
      // Show scraping message for a while — the actual scraping happens in background
      setTimeout(() => setScrapingMessage(null), 5000);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Apagar este perfil e todos os posts associados?")) return;
    if (selectedId === id) onSelect(null);
    await deleteProfile(id);
  }

  async function handleRescrape(e: React.MouseEvent, profileId: string) {
    e.stopPropagation();
    if (!confirm("Isso vai re-scraper todos os posts deste perfil. Continuar?")) return;
    setRescrapingId(profileId);
    startTransition(async () => {
      try {
        await rescrapeProfile(profileId);
      } catch (err) {
        console.error("Rescrape error:", err);
      } finally {
        // Keep indicator for a bit since background scraping continues
        setTimeout(() => setRescrapingId(null), 5000);
      }
    });
  }

  return (
    <div className="rounded-xl border border-blue/30 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-text-secondary">
          Perfis de Referência
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="font-mono text-[10px] text-blue transition hover:opacity-70"
        >
          {showForm ? "Cancelar" : "+ Novo"}
        </button>
      </div>

      {scrapingMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue/20 bg-blue/5 px-3 py-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
          <span className="font-mono text-[10px] text-blue">
            {scrapingMessage}
          </span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-3 space-y-2">
          <select
            name="platform"
            required
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-text focus:border-blue focus:outline-none"
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
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-blue focus:outline-none"
          />
          <input
            name="display_name"
            required
            placeholder="Nome de exibição"
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-blue focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
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
              className="ml-auto rounded-lg bg-blue px-3 py-1 font-mono text-[10px] font-bold text-white disabled:opacity-50"
            >
              {saving ? (scrapingMessage ? "Scraping..." : "...") : "Criar"}
            </button>
          </div>
        </form>
      )}

      {profiles.length === 0 ? (
        <p className="text-xs text-text-muted">
          Nenhum perfil adicionado. Adicione perfis de referência para acompanhar
          conteúdo de outros criadores.
        </p>
      ) : (
        <div className="space-y-1">
          {profiles.map((p) => {
            const isScraping = rescrapingId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p.id === selectedId ? null : p.id)}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-surface ${
                  selectedId === p.id
                    ? "border border-blue/40 bg-surface"
                    : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isScraping
                        ? "animate-pulse bg-blue"
                        : p.active
                          ? "bg-green"
                          : "bg-text-muted"
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-text">
                      {p.display_name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-mono text-[10px] text-text-muted">
                        {p.handle}
                      </span>
                      {p.platform === "instagram" && (
                        <span className="font-mono text-[9px] text-text-muted/60">
                          {isScraping ? "scraping..." : formatLastScraped(p.last_scraped_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <PlatformBadge platform={p.platform} />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {p.platform === "instagram" && (
                    <button
                      onClick={(e) => handleRescrape(e, p.id)}
                      disabled={isScraping}
                      title="Re-scraper posts"
                      className="font-mono text-[10px] text-blue transition hover:opacity-70 disabled:opacity-30"
                    >
                      {isScraping ? "..." : "re-scrape"}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.id);
                    }}
                    className="font-mono text-[10px] text-text-muted transition hover:text-accent"
                  >
                    x
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
