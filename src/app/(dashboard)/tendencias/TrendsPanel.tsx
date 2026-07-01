"use client";

import { useState, useTransition } from "react";
import {
  createTrend,
  analyzeTrend,
  deleteTrend,
  getTrends,
  runRadarScan,
  addReferenceProfile,
  removeReferenceProfile,
  toggleProfileActive,
  getAllProfiles,
  acceptRecommendation,
  rejectRecommendation,
} from "./actions";
import type { Trend, ReferenceProfile } from "@/lib/supabase/types";
import type { ScanResult, RadarStats, RecommendationAction } from "./actions";
import {
  Plus,
  Loader2,
  Trash2,
  Sparkles,
  ExternalLink,
  TrendingUp,
  Lightbulb,
  X,
  Radar,
  Users,
  BarChart3,
  Clock,
  Zap,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Hash,
  FileText,
  Check,
  XCircle,
  ArrowRight,
  CheckCircle2,
  Ban,
} from "lucide-react";

// ============================================================
// MAIN COMPONENT
// ============================================================

interface TrendsPanelProps {
  initialTrends: Trend[];
  initialProfiles: ReferenceProfile[];
  initialScan: ScanResult | null;
  initialStats: RadarStats;
  initialAcceptedTitles: string[];
}

type TabKey = "radar" | "perfis" | "manual";

export default function TrendsPanel({
  initialTrends,
  initialProfiles,
  initialScan,
  initialStats,
  initialAcceptedTitles,
}: TrendsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("radar");
  const [trends, setTrends] = useState<Trend[]>(initialTrends);
  const [profiles, setProfiles] = useState<ReferenceProfile[]>(initialProfiles);
  const [scanResult, setScanResult] = useState<ScanResult | null>(initialScan);
  const [stats, setStats] = useState<RadarStats>(initialStats);
  const [acceptedTitles, setAcceptedTitles] = useState<Set<string>>(
    new Set(initialAcceptedTitles)
  );
  const [rejectedTitles, setRejectedTitles] = useState<Set<string>>(new Set());

  const tabs: { key: TabKey; label: string; Icon: typeof Radar; count?: number }[] = [
    { key: "radar", label: "Radar", Icon: Radar },
    { key: "perfis", label: "Perfis", Icon: Users, count: profiles.filter((p) => p.active).length },
    { key: "manual", label: "Manual", Icon: FileText, count: trends.length },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Perfis Ativos" value={stats.active_profiles} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Posts (30d)" value={stats.total_posts_30d} icon={<BarChart3 className="h-4 w-4" />} />
        <StatCard
          label="Plataformas"
          value={stats.platforms.length > 0 ? stats.platforms.join(", ") : "—"}
          icon={<Hash className="h-4 w-4" />}
        />
        <StatCard
          label="Ultimo Scan"
          value={stats.last_scan_at ? formatTimeAgo(stats.last_scan_at) : "Nunca"}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-accent text-white shadow-sm"
                : "text-text-secondary hover:bg-card hover:text-text"
            }`}
          >
            <tab.Icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-border text-text-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "radar" && (
        <RadarTab
          scanResult={scanResult}
          setScanResult={setScanResult}
          profiles={profiles}
          stats={stats}
          setStats={setStats}
          acceptedTitles={acceptedTitles}
          setAcceptedTitles={setAcceptedTitles}
          rejectedTitles={rejectedTitles}
          setRejectedTitles={setRejectedTitles}
        />
      )}
      {activeTab === "perfis" && (
        <ProfilesTab
          profiles={profiles}
          setProfiles={setProfiles}
        />
      )}
      {activeTab === "manual" && (
        <ManualTab trends={trends} setTrends={setTrends} />
      )}
    </div>
  );
}

// ============================================================
// RADAR TAB
// ============================================================

function RadarTab({
  scanResult,
  setScanResult,
  profiles,
  stats,
  setStats,
  acceptedTitles,
  setAcceptedTitles,
  rejectedTitles,
  setRejectedTitles,
}: {
  scanResult: ScanResult | null;
  setScanResult: (s: ScanResult) => void;
  profiles: ReferenceProfile[];
  stats: RadarStats;
  setStats: (s: RadarStats) => void;
  acceptedTitles: Set<string>;
  setAcceptedTitles: (s: Set<string>) => void;
  rejectedTitles: Set<string>;
  setRejectedTitles: (s: Set<string>) => void;
}) {
  const [isScanning, startScan] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedInsights, setExpandedInsights] = useState(true);
  const [expandedRecs, setExpandedRecs] = useState(true);
  const [processingRec, setProcessingRec] = useState<number | null>(null);

  function handleScan() {
    if (profiles.filter((p) => p.active).length === 0) {
      setError("Adicione pelo menos um perfil de referencia na aba 'Perfis'.");
      return;
    }

    setError(null);
    startScan(async () => {
      try {
        const result = await runRadarScan();
        setScanResult(result);
        setStats({
          ...stats,
          last_scan_at: new Date().toISOString(),
          total_posts_30d: result.total_posts_analyzed,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao escanear.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Scan CTA */}
      <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-card to-accent/5 p-6">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-red-500/5" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-text">
                <Radar className="h-5 w-5 text-red-400" />
                Radar de Referências
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Escaneia todos os perfis ativos, analisa os ultimos 30 dias de conteudo e gera insights
                cruzados + recomendacoes de conteudo para o Pedro.
              </p>
            </div>
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-600 disabled:opacity-60"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Escanear Tudo
                </>
              )}
            </button>
          </div>

          {isScanning && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                <p className="text-xs text-red-300">
                  Scraping perfis, analisando posts e gerando insights com IA... Isso pode levar de
                  30s a 2min.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Scan Results */}
      {scanResult && (
        <>
          {/* Scan summary */}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-400">
              {scanResult.profiles_scanned} perfis escaneados
            </span>
            <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-400">
              {scanResult.total_posts_analyzed} posts analisados
            </span>
            {scanResult.new_posts_found > 0 && (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400">
                {scanResult.new_posts_found} novos posts
              </span>
            )}
          </div>

          {/* Per-Profile Cards */}
          {scanResult.per_profile_summary.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
                Resumo por Perfil
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scanResult.per_profile_summary.map((p) => (
                  <div
                    key={p.profile_id}
                    className="rounded-xl border border-border bg-card p-4 transition hover:border-accent/30"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                        <Users className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text">{p.display_name}</p>
                        <p className="font-mono text-[10px] text-text-muted">
                          @{p.handle} · {p.platform}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-surface px-2 py-1.5 text-center">
                        <p className="text-lg font-bold text-text">{p.posts_count}</p>
                        <p className="text-[10px] text-text-muted">posts</p>
                      </div>
                      <div className="rounded-lg bg-surface px-2 py-1.5 text-center">
                        <p className="text-lg font-bold text-text">{p.avg_engagement}%</p>
                        <p className="text-[10px] text-text-muted">eng medio</p>
                      </div>
                    </div>
                    {p.top_themes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.top_themes.map((t, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.highlight && p.highlight !== "Sem posts recentes" && (
                      <p className="mt-2 line-clamp-2 text-xs italic text-text-secondary">
                        &ldquo;{p.highlight}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Themes */}
          {scanResult.top_themes.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
                Temas em Alta
              </h3>
              <div className="flex flex-wrap gap-2">
                {scanResult.top_themes.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                      {t.count}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-text">{t.theme}</p>
                      <p className="text-[10px] text-text-muted">{t.profiles.map((p) => `@${p}`).join(", ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cross-Profile Insights */}
          {scanResult.cross_profile_insights && (
            <div className="rounded-xl border border-red-500/20 bg-card">
              <button
                onClick={() => setExpandedInsights(!expandedInsights)}
                className="flex w-full items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-text">Insights Cruzados</h3>
                </div>
                {expandedInsights ? (
                  <ChevronUp className="h-4 w-4 text-text-muted" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-text-muted" />
                )}
              </button>
              {expandedInsights && (
                <div className="border-t border-border px-5 pb-5 pt-3">
                  <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-text">
                    <MarkdownRenderer text={scanResult.cross_profile_insights} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content Recommendations — Accept / Reject Pipeline */}
          {scanResult.content_recommendations.length > 0 && (
            <div className="rounded-xl border border-green-500/20 bg-card">
              <button
                onClick={() => setExpandedRecs(!expandedRecs)}
                className="flex w-full items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-green-400" />
                  <h3 className="text-sm font-semibold text-text">
                    Recomendacoes de Conteudo ({scanResult.content_recommendations.length})
                  </h3>
                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                    Aceite para alimentar o cerebro
                  </span>
                </div>
                {expandedRecs ? (
                  <ChevronUp className="h-4 w-4 text-text-muted" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-text-muted" />
                )}
              </button>
              {expandedRecs && (
                <div className="space-y-3 border-t border-border px-5 pb-5 pt-3">
                  {/* Counter */}
                  <div className="flex items-center gap-4 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      {acceptedTitles.size} aceitas
                    </span>
                    <span className="flex items-center gap-1">
                      <Ban className="h-3 w-3 text-red-400" />
                      {rejectedTitles.size} rejeitadas
                    </span>
                    <span>
                      {scanResult.content_recommendations.length - acceptedTitles.size - rejectedTitles.size} pendentes
                    </span>
                  </div>

                  {scanResult.content_recommendations.map((rec, i) => {
                    const titleKey = rec.title.toLowerCase();
                    const isAccepted = acceptedTitles.has(titleKey);
                    const isRejected = rejectedTitles.has(titleKey);
                    const isProcessing = processingRec === i;

                    async function handleAccept() {
                      setProcessingRec(i);
                      const result = await acceptRecommendation({
                        title: rec.title,
                        hook: rec.hook,
                        format: rec.format,
                        why: rec.why,
                        inspired_by: rec.inspired_by,
                      });
                      if ("proposal_id" in result) {
                        setAcceptedTitles(new Set([...acceptedTitles, titleKey]));
                      }
                      setProcessingRec(null);
                    }

                    async function handleReject() {
                      setProcessingRec(i);
                      await rejectRecommendation({
                        title: rec.title,
                        hook: rec.hook,
                        format: rec.format,
                        why: rec.why,
                        inspired_by: rec.inspired_by,
                      });
                      setRejectedTitles(new Set([...rejectedTitles, titleKey]));
                      setProcessingRec(null);
                    }

                    return (
                      <div
                        key={i}
                        className={`rounded-lg border p-4 transition ${
                          isAccepted
                            ? "border-green-500/40 bg-green-500/5"
                            : isRejected
                              ? "border-border/50 bg-bg/30 opacity-50"
                              : "border-border bg-bg/50 hover:border-green-500/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                  isAccepted
                                    ? "bg-green-500/30 text-green-300"
                                    : isRejected
                                      ? "bg-red-500/20 text-red-400"
                                      : "bg-green-500/20 text-green-400"
                                }`}
                              >
                                {isAccepted ? (
                                  <Check className="h-3 w-3" />
                                ) : isRejected ? (
                                  <XCircle className="h-3 w-3" />
                                ) : (
                                  i + 1
                                )}
                              </span>
                              <h4 className="text-sm font-semibold text-text">{rec.title}</h4>
                              {isAccepted && (
                                <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Enviado pro Cerebro
                                </span>
                              )}
                              {isRejected && (
                                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                                  Rejeitada
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-xs text-text-secondary">
                              <span className="font-medium text-accent">Hook:</span> {rec.hook}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">{rec.why}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                              {rec.format}
                            </span>
                            <span className="text-[10px] text-text-muted">{rec.inspired_by}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {!isAccepted && !isRejected && (
                          <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                            <button
                              onClick={handleAccept}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 rounded-lg bg-green-500/15 px-4 py-2 text-xs font-semibold text-green-400 transition hover:bg-green-500/25 disabled:opacity-50"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Aceitar — Enviar pro Cerebro
                            </button>
                            <button
                              onClick={handleReject}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-text-muted transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Rejeitar
                            </button>
                          </div>
                        )}

                        {/* Post-accept CTA */}
                        {isAccepted && (
                          <div className="mt-3 border-t border-green-500/20 pt-3">
                            <a
                              href="/insights-pedro"
                              className="flex items-center gap-1.5 text-[10px] font-medium text-green-400 transition hover:text-green-300"
                            >
                              <ArrowRight className="h-3 w-3" />
                              Ver em Insights Pedro para revisar e aprovar
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!scanResult && !isScanning && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <Radar className="mb-3 h-10 w-10 text-text-secondary/30" />
          <p className="text-sm text-text-secondary">Nenhum scan realizado ainda.</p>
          <p className="mt-1 text-xs text-text-muted">
            Adicione perfis de referencia e clique em &quot;Escanear Tudo&quot;.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PROFILES TAB
// ============================================================

function ProfilesTab({
  profiles,
  setProfiles,
}: {
  profiles: ReferenceProfile[];
  setProfiles: (p: ReferenceProfile[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState("instagram");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function handleAdd() {
    if (!handle.trim() || !displayName.trim()) return;
    setError(null);
    setSuccessMsg(null);

    startSave(async () => {
      const result = await addReferenceProfile(platform, handle.trim(), displayName.trim());
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg(`@${handle.replace(/^@/, "")} adicionado! Scraping em andamento...`);
        setHandle("");
        setDisplayName("");
        setShowForm(false);
        const refreshed = await getAllProfiles();
        setProfiles(refreshed);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    });
  }

  async function handleDelete(id: string) {
    setDeleteConfirm(null);
    await removeReferenceProfile(id);
    const refreshed = await getAllProfiles();
    setProfiles(refreshed);
  }

  async function handleToggle(id: string, active: boolean) {
    await toggleProfileActive(id, active);
    const refreshed = await getAllProfiles();
    setProfiles(refreshed);
  }

  const PLATFORMS = [
    { value: "instagram", label: "Instagram" },
    { value: "youtube", label: "YouTube" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "x", label: "X (Twitter)" },
  ];

  return (
    <div className="space-y-4">
      {/* Add Profile */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">Perfis Monitorados</h3>
          <p className="text-xs text-text-muted">
            Adicione criadores de referencia para acompanhar automaticamente.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancelar" : "Adicionar"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-accent/30 bg-card p-5">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Plataforma
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  aria-label="Plataforma"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Handle</label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@alexhormozi"
                  aria-label="Handle do perfil"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Nome</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Hormozi"
                  aria-label="Nome do perfil"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAdd}
                disabled={isSaving || !handle.trim() || !displayName.trim()}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {isSaving ? "Salvando..." : "Adicionar Perfil"}
              </button>
              {platform !== "instagram" && (
                <p className="text-[10px] text-amber-400">
                  Scraping automatico disponivel apenas para Instagram.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">{successMsg}</div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">Remover este perfil e todos os posts associados?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:bg-surface hover:text-text"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-red/80"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile List */}
      {profiles.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-12 text-center">
          <Users className="mb-3 h-8 w-8 text-text-secondary/30" />
          <p className="text-sm text-text-secondary">Nenhum perfil cadastrado.</p>
          <p className="mt-1 text-xs text-text-muted">
            Adicione criadores de referencia para o radar monitorar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl border bg-card px-4 py-3 transition ${
                p.active ? "border-border" : "border-border/50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${p.active ? "bg-green" : "bg-text-muted"}`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{p.display_name}</span>
                    <span className="rounded-full border border-blue bg-blue/10 px-2 py-0.5 font-mono text-[10px] text-blue">
                      {p.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    <span className="font-mono">@{p.handle}</span>
                    {p.last_scraped_at && (
                      <span>· Scrape: {formatTimeAgo(p.last_scraped_at)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(p.id, !p.active)}
                  className="rounded-lg p-1.5 text-text-secondary transition hover:bg-surface"
                  title={p.active ? "Desativar" : "Ativar"}
                >
                  {p.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setDeleteConfirm(p.id)}
                  className="rounded-lg p-1.5 text-text-secondary transition hover:bg-red-500/10 hover:text-red-400"
                  title="Remover perfil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MANUAL TAB (existing trends functionality)
// ============================================================

function ManualTab({
  trends,
  setTrends,
}: {
  trends: Trend[];
  setTrends: (t: Trend[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [isCreating, startCreating] = useTransition();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [isAnalyzing, startAnalyzing] = useTransition();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) return;
    setError(null);
    startCreating(async () => {
      try {
        await createTrend(title.trim(), url.trim() || undefined, description.trim() || undefined, sourceText.trim() || undefined);
        const refreshed = await getTrends();
        setTrends(refreshed);
        setTitle("");
        setUrl("");
        setDescription("");
        setSourceText("");
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar tendencia.");
      }
    });
  }

  async function handleAnalyze(id: string) {
    setError(null);
    setAnalyzingId(id);
    startAnalyzing(async () => {
      const result = await analyzeTrend(id);
      if ("error" in result) setError(result.error);
      else {
        const refreshed = await getTrends();
        setTrends(refreshed);
      }
      setAnalyzingId(null);
    });
  }

  async function handleDelete(id: string) {
    setDeleteConfirm(null);
    startTransition(async () => {
      await deleteTrend(id);
      const refreshed = await getTrends();
      setTrends(refreshed);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">Tendências Manuais</h3>
          <p className="text-xs text-text-muted">
            Registre trends que voce viu e analise com IA.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancelar" : "Nova tendencia"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <input
            type="text"
            placeholder='Titulo da tendencia (ex: "Quiet quitting voltou a viralizar")'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Titulo da tendencia"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <input
            type="url"
            placeholder="URL (opcional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="URL da tendencia"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <input
            type="text"
            placeholder="Descricao (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Descricao da tendencia"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <textarea
            placeholder="Texto original / post viral (opcional)"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={3}
            aria-label="Texto original ou post viral"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
          />
          <button
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {isCreating ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      {/* Delete modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">Excluir esta tendencia?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-red/80"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trends list */}
      {trends.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-12 text-center">
          <TrendingUp className="mb-3 h-8 w-8 text-text-secondary/30" />
          <p className="text-sm text-text-secondary">Nenhuma tendencia registrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trends.map((trend) => (
            <div
              key={trend.id}
              className="rounded-xl border border-border bg-card p-4 transition-all hover:border-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-text">{trend.title}</h4>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                        trend.status === "analyzed"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {trend.status === "analyzed" ? "Analisada" : "Pendente"}
                    </span>
                  </div>
                  {trend.description && (
                    <p className="mt-1 text-xs text-text-secondary">{trend.description}</p>
                  )}
                  {trend.url && (
                    <a
                      href={trend.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
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
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
                    >
                      {isAnalyzing && analyzingId === trend.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Analisar
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirm(trend.id)}
                    className="rounded-md p-1.5 text-text-secondary transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {trend.source_text && !trend.analysis && (
                <div className="mt-2 rounded-lg bg-bg/50 px-3 py-2">
                  <p className="text-[10px] font-medium text-text-secondary mb-0.5">Texto original:</p>
                  <p className="text-xs text-text-secondary line-clamp-3 whitespace-pre-wrap">{trend.source_text}</p>
                </div>
              )}

              {trend.analysis && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg bg-bg/50 px-3 py-2">
                    <p className="mb-1 text-[10px] font-medium text-text-secondary">Analise</p>
                    <p className="text-xs leading-relaxed text-text whitespace-pre-wrap">{trend.analysis}</p>
                  </div>
                  {trend.suggested_angles?.length > 0 && (
                    <div className="rounded-lg bg-bg/50 px-3 py-2">
                      <div className="mb-1.5 flex items-center gap-1">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                        <p className="text-[10px] font-medium text-text-secondary">Angulos sugeridos</p>
                      </div>
                      <ul className="space-y-1.5">
                        {trend.suggested_angles.map((item, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[9px] font-bold text-accent">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="text-xs font-medium text-text">{item.angle}</p>
                              <p className="text-[10px] text-text-secondary">{item.why}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-2 text-[10px] text-text-secondary/50">
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

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-text-muted">{icon}<span className="text-[10px] font-medium uppercase tracking-wider">{label}</span></div>
      <p className="mt-1 text-lg font-bold text-text">{value}</p>
    </div>
  );
}

function MarkdownRenderer({ text }: { text: string }) {
  // Simple markdown to HTML — handles headings, bold, lists
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="mt-3 mb-1 text-sm font-bold text-text">{line.slice(4)}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="mt-4 mb-1.5 text-base font-bold text-text">{line.slice(3)}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="mt-4 mb-2 text-lg font-bold text-text">{line.slice(2)}</h2>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 text-xs text-text-secondary list-disc">
          <InlineBold text={line.slice(2)} />
        </li>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li key={i} className="ml-4 text-xs text-text-secondary list-decimal">
          <InlineBold text={content} />
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<br key={i} />);
    } else {
      elements.push(
        <p key={i} className="text-xs text-text-secondary leading-relaxed">
          <InlineBold text={line} />
        </p>
      );
    }
  }

  return <>{elements}</>;
}

function InlineBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-text">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}
