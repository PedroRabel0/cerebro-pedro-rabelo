"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Plus,
  Trash2,
  X,
  Sparkles,
  TrendingUp,
  Eye,
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  Download,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Filter,
} from "lucide-react";
import type { ContentMetric } from "@/lib/supabase/types";
import {
  createMetric,
  deleteMetric,
  getMetrics,
  getAnalyticsInsights,
  importInstagramMetrics,
  type ImportResult,
} from "./actions";

// --- Constants ---

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  linkedin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  x: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  youtube: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

// --- Props ---

interface AnalyticsDashboardProps {
  initialMetrics: ContentMetric[];
  handle: string;
}

// ===========================================
// Main Component
// ===========================================

export default function AnalyticsDashboard({
  initialMetrics,
  handle,
}: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<ContentMetric[]>(initialMetrics);
  const [showForm, setShowForm] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isInsightsPending, startInsightsTransition] = useTransition();
  const [isImporting, startImportTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>("");

  // --- Filtered metrics ---
  const filtered = filterPlatform
    ? metrics.filter((m) => m.platform === filterPlatform)
    : metrics;

  // --- Stats ---
  const stats = useMemo(() => {
    if (metrics.length === 0) {
      return {
        totalPosts: 0,
        avgEngagement: "0",
        bestPlatform: "-",
        totalLikes: 0,
        totalComments: 0,
        platforms: [] as string[],
      };
    }

    const totalPosts = metrics.length;
    const totalLikes = metrics.reduce((sum, m) => sum + m.likes, 0);
    const totalComments = metrics.reduce((sum, m) => sum + m.comments, 0);

    const avgEngagement = (
      metrics.reduce((sum, m) => sum + m.engagement_rate, 0) / metrics.length
    ).toFixed(2);

    // Best platform by avg engagement
    const platformEngagement: Record<string, { total: number; count: number }> = {};
    for (const m of metrics) {
      if (!platformEngagement[m.platform]) {
        platformEngagement[m.platform] = { total: 0, count: 0 };
      }
      platformEngagement[m.platform].total += m.engagement_rate;
      platformEngagement[m.platform].count += 1;
    }
    let bestPlatform = "-";
    let bestAvg = 0;
    for (const [platform, data] of Object.entries(platformEngagement)) {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestPlatform = PLATFORM_LABELS[platform] || platform;
      }
    }

    const platforms = Object.keys(platformEngagement);

    return { totalPosts, avgEngagement, bestPlatform, totalLikes, totalComments, platforms };
  }, [metrics]);

  // --- Handlers ---

  const handleDelete = (id: string) => {
    setDeleteTarget(null);
    startTransition(async () => {
      await deleteMetric(id);
      const updated = await getMetrics();
      setMetrics(updated);
    });
  };

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createMetric({
        title: formData.get("title") as string,
        platform: formData.get("platform") as string,
        content_type: formData.get("content_type") as string,
        likes: Number(formData.get("likes")) || 0,
        saves: Number(formData.get("saves")) || 0,
        shares: Number(formData.get("shares")) || 0,
        comments: Number(formData.get("comments")) || 0,
        views: Number(formData.get("views")) || 0,
        posted_at: (formData.get("posted_at") as string) || new Date().toISOString(),
      });
      const updated = await getMetrics();
      setMetrics(updated);
      setShowForm(false);
    });
  };

  const handleGetInsights = () => {
    startInsightsTransition(async () => {
      const result = await getAnalyticsInsights();
      setInsights(result);
    });
  };

  const handleImport = () => {
    setImportResult(null);
    startImportTransition(async () => {
      const result = await importInstagramMetrics();
      setImportResult(result);
      if (!result.error) {
        const updated = await getMetrics();
        setMetrics(updated);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">
              Apagar a métrica <strong>&quot;{deleteTarget.title}&quot;</strong>? Esta ação não pode ser desfeita.
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

      {/* Loading bar */}
      {(isPending || isInsightsPending || isImporting) && (
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
      )}

      {/* === AUTO-IMPORT SECTION === */}
      <div className="rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/5 via-transparent to-transparent p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20">
              <Camera className="h-5 w-5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">
                Importar do Instagram
              </h3>
              <p className="text-xs text-text-muted">
                Puxa métricas automáticas de <span className="font-medium text-pink-400">@{handle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex items-center gap-2 rounded-xl bg-pink-500/20 px-5 py-2.5 text-sm font-semibold text-pink-400 transition-colors hover:bg-pink-500/30 disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Puxar Métricas
              </>
            )}
          </button>
        </div>

        {/* Import result feedback */}
        {importResult && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 ${
            importResult.error
              ? "bg-red-500/10 border border-red-500/20"
              : "bg-green-500/10 border border-green-500/20"
          }`}>
            {importResult.error ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
            )}
            <div className="text-xs">
              {importResult.error ? (
                <p className="text-red-400">
                  Erro ao importar: {importResult.error}
                </p>
              ) : (
                <>
                  <p className="font-medium text-green-400">
                    {importResult.posts_imported > 0
                      ? `${importResult.posts_imported} posts importados!`
                      : "Nenhum post novo encontrado."}
                  </p>
                  <p className="mt-0.5 text-text-muted">
                    {importResult.posts_found} encontrados · {importResult.posts_imported} novos · {importResult.posts_skipped} já existiam
                  </p>
                </>
              )}
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="ml-auto shrink-0 text-text-muted hover:text-text transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-accent" />}
          label="Total Posts"
          value={String(stats.totalPosts)}
        />
        <StatCard
          icon={<Eye className="h-4 w-4 text-blue-400" />}
          label="Eng. Médio"
          value={`${stats.avgEngagement}%`}
        />
        <StatCard
          icon={<Heart className="h-4 w-4 text-pink-400" />}
          label="Total Likes"
          value={formatNumber(stats.totalLikes)}
        />
        <StatCard
          icon={<MessageCircle className="h-4 w-4 text-green-400" />}
          label="Total Comments"
          value={formatNumber(stats.totalComments)}
        />
        <StatCard
          icon={<Bookmark className="h-4 w-4 text-purple-400" />}
          label="Melhor Plataforma"
          value={stats.bestPlatform}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Cancelar
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Manual
            </>
          )}
        </button>
        <button
          onClick={handleGetInsights}
          disabled={isInsightsPending || metrics.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {isInsightsPending ? "Analisando..." : "Gerar Insights com IA"}
        </button>

        {/* Platform filter */}
        {stats.platforms.length > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-text-muted" />
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-xs text-text-secondary focus:border-accent focus:outline-none"
            >
              <option value="">Todas ({metrics.length})</option>
              {stats.platforms.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p] || p} ({metrics.filter((m) => m.platform === p).length})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Add Metric Form (Manual) */}
      {showForm && <MetricForm onSubmit={handleCreate} isPending={isPending} />}

      {/* AI Insights */}
      {insights && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-text">
              <Sparkles className="h-4 w-4 text-accent" />
              Insights da IA
            </h3>
            <button
              onClick={() => setInsights(null)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
            {insights}
          </div>
        </div>
      )}

      {/* Metrics List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            {filterPlatform
              ? `Nenhuma métrica de ${PLATFORM_LABELS[filterPlatform] || filterPlatform}.`
              : "Nenhuma métrica registrada ainda."}
          </p>
          <p className="text-xs text-text-muted">
            {filterPlatform
              ? "Tente outro filtro ou importe do Instagram."
              : "Clique em \"Puxar Métricas\" para importar automaticamente."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[10px] text-text-muted">
            {filtered.length} métrica{filtered.length !== 1 ? "s" : ""}
            {filterPlatform ? ` de ${PLATFORM_LABELS[filterPlatform] || filterPlatform}` : ""}
          </p>
          {filtered.map((metric) => (
            <MetricCard
              key={metric.id}
              metric={metric}
              onDelete={(id) => setDeleteTarget({ id, title: metric.title })}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================
// Stat Card
// ===========================================

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface">
          {icon}
        </div>
        <div className="min-w-0">
          <span className="block truncate font-mono text-base font-bold text-text">
            {value}
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// Metric Card
// ===========================================

function MetricCard({
  metric,
  onDelete,
  isPending,
}: {
  metric: ContentMetric;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const [showCaption, setShowCaption] = useState(false);

  const postedDate = metric.posted_at
    ? new Date(metric.posted_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Sem data";

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-light">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-text">
              {metric.title}
            </h3>
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                PLATFORM_COLORS[metric.platform] || PLATFORM_COLORS.instagram
              }`}
            >
              {PLATFORM_LABELS[metric.platform] || metric.platform}
            </span>
            {metric.content_type && (
              <span className="shrink-0 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                {metric.content_type}
              </span>
            )}
          </div>

          {/* Numbers grid */}
          <div className="mt-3 flex flex-wrap gap-3">
            <MetricBadge
              icon={<Heart className="h-3 w-3" />}
              label="Likes"
              value={formatNumber(metric.likes)}
            />
            <MetricBadge
              icon={<MessageCircle className="h-3 w-3" />}
              label="Coments"
              value={formatNumber(metric.comments)}
            />
            {metric.saves > 0 && (
              <MetricBadge
                icon={<Bookmark className="h-3 w-3" />}
                label="Saves"
                value={formatNumber(metric.saves)}
              />
            )}
            {metric.shares > 0 && (
              <MetricBadge
                icon={<Share2 className="h-3 w-3" />}
                label="Shares"
                value={formatNumber(metric.shares)}
              />
            )}
            {metric.views > 0 && (
              <MetricBadge
                icon={<Eye className="h-3 w-3" />}
                label="Views"
                value={formatNumber(metric.views)}
              />
            )}
            {metric.engagement_rate > 0 && (
              <MetricBadge
                icon={<TrendingUp className="h-3 w-3" />}
                label="Eng."
                value={`${metric.engagement_rate.toFixed(2)}%`}
              />
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <p className="text-[10px] text-text-muted">{postedDate}</p>
            {metric.notes && (
              <button
                onClick={() => setShowCaption(!showCaption)}
                className="text-[10px] text-accent hover:text-accent-hover transition-colors"
              >
                {showCaption ? "Ocultar legenda" : "Ver legenda"}
              </button>
            )}
          </div>

          {/* Expandable caption */}
          {showCaption && metric.notes && (
            <div className="mt-2 rounded-lg bg-surface p-3">
              <p className="whitespace-pre-wrap text-xs text-text-secondary leading-relaxed">
                {metric.notes}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => onDelete(metric.id)}
          disabled={isPending}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ===========================================
// Metric Badge
// ===========================================

function MetricBadge({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1 text-text-secondary">
      {icon}
      <span className="text-xs font-medium text-text">{value}</span>
      <span className="text-[10px] text-text-muted">{label}</span>
    </div>
  );
}

// ===========================================
// Add Metric Form (Manual)
// ===========================================

function MetricForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  return (
    <form
      action={onSubmit}
      className="rounded-xl border border-border bg-card p-5"
    >
      <h3 className="mb-1 font-display text-sm font-semibold text-text">
        Adicionar Métrica Manual
      </h3>
      <p className="mb-4 text-[10px] text-text-muted">
        Para LinkedIn, X ou YouTube — ou quando quiser adicionar dados extras.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Título do conteúdo
          </label>
          <input
            name="title"
            type="text"
            required
            placeholder="Ex: Carousel sobre produtividade"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        {/* Platform */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Plataforma
          </label>
          <select
            name="platform"
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
          >
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>

        {/* Content Type */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Tipo de conteúdo
          </label>
          <input
            name="content_type"
            type="text"
            placeholder="Ex: carousel, reel, post"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        {/* Numbers */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Likes
          </label>
          <input
            name="likes"
            type="number"
            min="0"
            placeholder="0"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Saves
          </label>
          <input
            name="saves"
            type="number"
            min="0"
            placeholder="0"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Shares
          </label>
          <input
            name="shares"
            type="number"
            min="0"
            placeholder="0"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Comments
          </label>
          <input
            name="comments"
            type="number"
            min="0"
            placeholder="0"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Views
          </label>
          <input
            name="views"
            type="number"
            min="0"
            placeholder="0"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Data de publicação
          </label>
          <input
            name="posted_at"
            type="datetime-local"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Salvando..." : "Salvar Métrica"}
      </button>
    </form>
  );
}

// ===========================================
// Helpers
// ===========================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
