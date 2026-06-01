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
} from "lucide-react";
import type { ContentMetric } from "@/lib/supabase/types";
import {
  createMetric,
  deleteMetric,
  getMetrics,
  getAnalyticsInsights,
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
}

// ===========================================
// Main Component
// ===========================================

export default function AnalyticsDashboard({
  initialMetrics,
}: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<ContentMetric[]>(initialMetrics);
  const [showForm, setShowForm] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isInsightsPending, startInsightsTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // --- Stats ---

  const stats = useMemo(() => {
    if (metrics.length === 0) {
      return {
        totalPosts: 0,
        avgEngagement: "0",
        bestPlatform: "-",
        mostSaves: "-",
      };
    }

    const totalPosts = metrics.length;

    const avgEngagement = (
      metrics.reduce((sum, m) => sum + m.engagement_rate, 0) / metrics.length
    ).toFixed(2);

    // Best platform by avg engagement
    const platformEngagement: Record<string, { total: number; count: number }> =
      {};
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

    // Most saves post
    const topSaves = [...metrics].sort((a, b) => b.saves - a.saves)[0];
    const mostSaves = topSaves
      ? topSaves.title.length > 30
        ? topSaves.title.slice(0, 30) + "..."
        : topSaves.title
      : "-";

    return { totalPosts, avgEngagement, bestPlatform, mostSaves };
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

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
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
      {(isPending || isInsightsPending) && (
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-accent" />}
          label="Total Posts"
          value={String(stats.totalPosts)}
        />
        <StatCard
          icon={<Eye className="h-4 w-4 text-blue-400" />}
          label="Eng. Medio"
          value={`${stats.avgEngagement}%`}
        />
        <StatCard
          icon={<Heart className="h-4 w-4 text-pink-400" />}
          label="Melhor Plataforma"
          value={stats.bestPlatform}
        />
        <StatCard
          icon={<Bookmark className="h-4 w-4 text-green-400" />}
          label="Mais Saves"
          value={stats.mostSaves}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Cancelar
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Adicionar Metrica
            </>
          )}
        </button>
        <button
          onClick={handleGetInsights}
          disabled={isInsightsPending || metrics.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {isInsightsPending ? "Analisando..." : "Gerar Insights com IA"}
        </button>
      </div>

      {/* Add Metric Form */}
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
      {metrics.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            Nenhuma metrica registrada ainda.
          </p>
          <p className="text-xs text-text-muted">
            Adicione dados de performance dos seus conteudos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map((metric) => (
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
              icon={<Eye className="h-3 w-3" />}
              label="Views"
              value={formatNumber(metric.views)}
            />
            <MetricBadge
              icon={<Heart className="h-3 w-3" />}
              label="Likes"
              value={formatNumber(metric.likes)}
            />
            <MetricBadge
              icon={<Bookmark className="h-3 w-3" />}
              label="Saves"
              value={formatNumber(metric.saves)}
            />
            <MetricBadge
              icon={<Share2 className="h-3 w-3" />}
              label="Shares"
              value={formatNumber(metric.shares)}
            />
            <MetricBadge
              icon={<MessageCircle className="h-3 w-3" />}
              label="Coments"
              value={formatNumber(metric.comments)}
            />
            <MetricBadge
              icon={<TrendingUp className="h-3 w-3" />}
              label="Eng."
              value={`${metric.engagement_rate.toFixed(2)}%`}
            />
          </div>

          <p className="mt-2 text-[10px] text-text-muted">{postedDate}</p>
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
// Add Metric Form
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
      <h3 className="mb-4 font-display text-sm font-semibold text-text">
        Adicionar Metrica de Conteudo
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Titulo do conteudo
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
            Tipo de conteudo
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
            defaultValue="0"
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
            defaultValue="0"
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
            defaultValue="0"
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
            defaultValue="0"
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
            defaultValue="0"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Data de publicacao
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
        {isPending ? "Salvando..." : "Salvar Metrica"}
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
