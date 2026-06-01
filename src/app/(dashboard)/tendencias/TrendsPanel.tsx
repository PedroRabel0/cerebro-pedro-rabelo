"use client";

import { useState, useTransition } from "react";
import {
  createTrend,
  analyzeTrend,
  deleteTrend,
  getTrends,
} from "./actions";
import type { Trend } from "@/lib/supabase/types";
import {
  Plus,
  Loader2,
  Trash2,
  Sparkles,
  ExternalLink,
  TrendingUp,
  Lightbulb,
  X,
} from "lucide-react";

export default function TrendsPanel({
  initialTrends,
}: {
  initialTrends: Trend[];
}) {
  const [trends, setTrends] = useState<Trend[]>(initialTrends);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [sourceText, setSourceText] = useState("");

  const [isCreating, startCreating] = useTransition();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [isAnalyzing, startAnalyzing] = useTransition();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) return;
    setError(null);

    startCreating(async () => {
      try {
        await createTrend(
          title.trim(),
          url.trim() || undefined,
          description.trim() || undefined,
          sourceText.trim() || undefined
        );
        const refreshed = await getTrends();
        setTrends(refreshed);
        setTitle("");
        setUrl("");
        setDescription("");
        setSourceText("");
        setShowForm(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao criar tendencia."
        );
      }
    });
  }

  async function handleAnalyze(id: string) {
    setError(null);
    setAnalyzingId(id);

    startAnalyzing(async () => {
      const result = await analyzeTrend(id);
      if ("error" in result) {
        setError(result.error);
      } else {
        const refreshed = await getTrends();
        setTrends(refreshed);
      }
      setAnalyzingId(null);
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTrend(id);
      setTrends((prev) => prev.filter((t) => t.id !== id));
    });
  }

  return (
    <div className="space-y-6">
      {/* ====== ADD TREND SECTION ====== */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">
          Tendencias{" "}
          <span className="text-sm font-normal text-text-secondary">
            ({trends.length})
          </span>
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          {showForm ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {showForm ? "Cancelar" : "Nova tendencia"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            <h3 className="text-base font-semibold text-text">
              Registrar Tendencia
            </h3>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Titulo *
              </label>
              <input
                type="text"
                placeholder='Ex: "Quiet quitting voltou a viralizar"'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* URL */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                URL (opcional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Descricao (opcional)
              </label>
              <input
                type="text"
                placeholder="Breve descricao do que esta acontecendo"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Source Text */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Texto original / post viral (opcional)
              </label>
              <textarea
                placeholder="Cole aqui o conteudo do post viral, tweet, artigo..."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={isCreating || !title.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isCreating ? "Salvando..." : "Salvar tendencia"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* ====== TRENDS LIST ====== */}
      {trends.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <TrendingUp className="mb-3 h-8 w-8 text-text-secondary/40" />
          <p className="text-sm text-text-secondary">
            Nenhuma tendencia registrada.
          </p>
          <p className="mt-1 text-xs text-text-secondary/60">
            Clique em &quot;Nova tendencia&quot; para comecar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {trends.map((trend) => (
            <div
              key={trend.id}
              className="rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/30"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-text">
                      {trend.title}
                    </h3>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                        trend.status === "analyzed"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {trend.status === "analyzed"
                        ? "Analisada"
                        : "Pendente"}
                    </span>
                  </div>
                  {trend.description && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {trend.description}
                    </p>
                  )}
                  {trend.url && (
                    <a
                      href={trend.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver fonte
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {trend.status === "pending" && (
                    <button
                      onClick={() => handleAnalyze(trend.id)}
                      disabled={isAnalyzing && analyzingId === trend.id}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAnalyzing && analyzingId === trend.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {isAnalyzing && analyzingId === trend.id
                        ? "Analisando..."
                        : "Analisar"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(trend.id)}
                    disabled={isPending}
                    className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Excluir tendencia"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Source text preview */}
              {trend.source_text && !trend.analysis && (
                <div className="mb-3 rounded-lg bg-bg/50 px-3 py-2">
                  <p className="text-xs font-medium text-text-secondary mb-1">
                    Texto original:
                  </p>
                  <p className="text-sm text-text-secondary line-clamp-3 whitespace-pre-wrap">
                    {trend.source_text}
                  </p>
                </div>
              )}

              {/* Analysis */}
              {trend.analysis && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg bg-bg/50 px-4 py-3">
                    <p className="mb-1 text-xs font-medium text-text-secondary">
                      Analise
                    </p>
                    <p className="text-sm leading-relaxed text-text whitespace-pre-wrap">
                      {trend.analysis}
                    </p>
                  </div>

                  {/* Suggested angles */}
                  {trend.suggested_angles &&
                    trend.suggested_angles.length > 0 && (
                      <div className="rounded-lg bg-bg/50 px-4 py-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          <Lightbulb className="h-4 w-4 text-amber-400" />
                          <p className="text-xs font-medium text-text-secondary">
                            Angulos sugeridos
                          </p>
                        </div>
                        <ul className="space-y-2">
                          {trend.suggested_angles.map((item, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-text">
                                  {item.angle}
                                </p>
                                <p className="text-xs text-text-secondary">
                                  {item.why}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              {/* Timestamp */}
              <p className="mt-3 text-[10px] text-text-secondary/60">
                {new Date(trend.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
