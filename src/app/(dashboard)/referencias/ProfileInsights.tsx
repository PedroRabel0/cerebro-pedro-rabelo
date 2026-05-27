"use client";

import { useState } from "react";
import type { ReferencePost } from "@/lib/supabase/types";
import { analyzeProfileForPedro } from "./actions";
import {
  TrendingUp,
  Heart,
  MessageCircle,
  BarChart3,
  Lightbulb,
  Loader2,
  Sparkles,
  Trophy,
  Target,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileStats {
  totalPosts: number;
  avgLikes: number;
  avgComments: number;
  avgEngagement: number;
  topPosts: ReferencePost[];
  hookBreakdown: Record<string, number>;
  themeBreakdown: Record<string, number>;
  toneBreakdown: Record<string, number>;
  structureBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStats(posts: ReferencePost[]): ProfileStats {
  const totalPosts = posts.length;
  const avgLikes =
    totalPosts > 0
      ? posts.reduce((s, p) => s + (p.likes ?? 0), 0) / totalPosts
      : 0;
  const avgComments =
    totalPosts > 0
      ? posts.reduce((s, p) => s + (p.comments ?? 0), 0) / totalPosts
      : 0;
  const postsWithEng = posts.filter((p) => p.engagement_rate != null);
  const avgEngagement =
    postsWithEng.length > 0
      ? postsWithEng.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) /
        postsWithEng.length
      : 0;

  // Top posts by likes
  const topPosts = [...posts]
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, 5);

  // Breakdowns
  const hookBreakdown: Record<string, number> = {};
  const themeBreakdown: Record<string, number> = {};
  const toneBreakdown: Record<string, number> = {};
  const structureBreakdown: Record<string, number> = {};

  for (const p of posts) {
    if (p.dna_hook_type) hookBreakdown[p.dna_hook_type] = (hookBreakdown[p.dna_hook_type] || 0) + 1;
    if (p.dna_main_theme) themeBreakdown[p.dna_main_theme] = (themeBreakdown[p.dna_main_theme] || 0) + 1;
    if (p.dna_tone) toneBreakdown[p.dna_tone] = (toneBreakdown[p.dna_tone] || 0) + 1;
    if (p.dna_structure) structureBreakdown[p.dna_structure] = (structureBreakdown[p.dna_structure] || 0) + 1;
  }

  return {
    totalPosts,
    avgLikes,
    avgComments,
    avgEngagement,
    topPosts,
    hookBreakdown,
    themeBreakdown,
    toneBreakdown,
    structureBreakdown,
  };
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString("pt-BR");
}

function sortedEntries(obj: Record<string, number>): [string, number][] {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-accent",
}: {
  icon: typeof Heart;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-text">{value}</p>
      {sub && (
        <p className="mt-0.5 font-mono text-[10px] text-text-muted">{sub}</p>
      )}
    </div>
  );
}

function BreakdownBar({
  title,
  icon: Icon,
  data,
  total,
  color,
}: {
  title: string;
  icon: typeof Zap;
  data: Record<string, number>;
  total: number;
  color: string;
}) {
  const entries = sortedEntries(data).slice(0, 5);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
          {title}
        </span>
      </div>
      <div className="space-y-2">
        {entries.map(([key, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-text">{key}</span>
                <span className="font-mono text-[10px] text-text-muted">
                  {count}x ({pct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color.replace("text-", "bg-")}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopPostCard({ post, rank }: { post: ReferencePost; rank: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface/50 p-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-bold text-accent">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs text-text">
          {post.caption_text?.slice(0, 150) || "(sem legenda)"}
        </p>
        <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3 text-red" />
            {formatNum(post.likes ?? 0)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3 text-blue" />
            {formatNum(post.comments ?? 0)}
          </span>
          {post.engagement_rate != null && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green" />
              {post.engagement_rate.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProfileInsights({
  profileId,
  profileHandle,
  posts,
}: {
  profileId: string;
  profileHandle: string;
  posts: ReferencePost[];
}) {
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  if (posts.length === 0) return null;

  const stats = computeStats(posts);

  async function handleAnalyze() {
    setLoadingAI(true);
    try {
      const result = await analyzeProfileForPedro(profileId);
      if ("error" in result) {
        setAiInsights(`Erro: ${result.error}`);
      } else {
        setAiInsights(result.analysis);
      }
    } catch {
      setAiInsights("Erro ao gerar análise.");
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue" />
          <h3 className="text-sm font-bold text-text">
            Análise de @{profileHandle}
          </h3>
          <span className="rounded-full bg-blue/10 px-2 py-0.5 font-mono text-[10px] text-blue">
            {stats.totalPosts} posts
          </span>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loadingAI}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {loadingAI ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loadingAI ? "Analisando..." : "Analisar pro Pedro"}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={BarChart3}
          label="Posts analisados"
          value={stats.totalPosts.toString()}
          color="text-blue"
        />
        <StatCard
          icon={Heart}
          label="Média de likes"
          value={formatNum(stats.avgLikes)}
          color="text-red"
        />
        <StatCard
          icon={MessageCircle}
          label="Média de comentários"
          value={formatNum(stats.avgComments)}
          color="text-blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Engajamento médio"
          value={
            stats.avgEngagement > 0
              ? `${stats.avgEngagement.toFixed(2)}%`
              : "—"
          }
          color="text-green"
        />
      </div>

      {/* Two columns: Top Posts + Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Posts */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
              Posts com melhor performance
            </span>
          </div>
          <div className="space-y-2">
            {stats.topPosts.map((post, i) => (
              <TopPostCard key={post.id} post={post} rank={i + 1} />
            ))}
          </div>
        </div>

        {/* Breakdowns */}
        <div className="space-y-4">
          <BreakdownBar
            title="Tipos de Hook"
            icon={Zap}
            data={stats.hookBreakdown}
            total={stats.totalPosts}
            color="text-accent"
          />
          <BreakdownBar
            title="Temas principais"
            icon={Target}
            data={stats.themeBreakdown}
            total={stats.totalPosts}
            color="text-blue"
          />
          <BreakdownBar
            title="Tom de voz"
            icon={MessageCircle}
            data={stats.toneBreakdown}
            total={stats.totalPosts}
            color="text-green"
          />
          <BreakdownBar
            title="Estrutura"
            icon={BarChart3}
            data={stats.structureBreakdown}
            total={stats.totalPosts}
            color="text-purple"
          />
        </div>
      </div>

      {/* AI Analysis */}
      {aiInsights && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-accent" />
            <h4 className="text-sm font-bold text-accent">
              Recomendações pro Pedro
            </h4>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            {aiInsights.split("\n").map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              if (line.startsWith("##")) {
                return (
                  <h3 key={i} className="mt-4 mb-2 text-sm font-bold text-text">
                    {line.replace(/^#+\s*/, "")}
                  </h3>
                );
              }
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <p key={i} className="ml-4 text-xs text-text-secondary">
                    • {line.replace(/^[-*]\s*/, "")}
                  </p>
                );
              }
              if (line.startsWith("**")) {
                return (
                  <p key={i} className="mt-2 text-xs font-semibold text-text">
                    {line.replace(/\*\*/g, "")}
                  </p>
                );
              }
              return (
                <p key={i} className="text-xs text-text-secondary">
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
