"use client";

import {
  DollarSign,
  Zap,
  Image,
  Globe,
  Radio,
  FileText,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react";
import type { MonthlyCostRow, ProviderCostRow } from "./actions";

const MONTHLY_LIMIT = 50;

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

interface ProviderInfo {
  label: string;
  color: string;
  icon: typeof Zap;
  description: string;
  models: string[];
  pricing: string;
}

const PROVIDERS: Record<string, ProviderInfo> = {
  anthropic: {
    label: "Anthropic",
    color: "#9b72b8",
    icon: Zap,
    description: "Geração de conteúdo, análise, BrainChat",
    models: ["Claude Sonnet 4.6", "Claude Haiku 4.5"],
    pricing: "$3-15 / 1M tokens",
  },
  openai: {
    label: "OpenAI",
    color: "#6b9b5f",
    icon: Image,
    description: "Geração de imagens (fallback)",
    models: ["GPT Image 1", "GPT-4o"],
    pricing: "$0.17 / imagem (fallback)",
  },
  gemini: {
    label: "Google Gemini",
    color: "#5b8cb8",
    icon: Globe,
    description: "Geração de imagens (principal)",
    models: ["Nano Banana Pro", "Imagen 4 Ultra", "Nano Banana 2"],
    pricing: "$0.134 (Pro) | $0.08 (Imagen Ultra) | $0.045 (Flash)",
  },
  apify: {
    label: "Apify",
    color: "#E31B23",
    icon: Radio,
    description: "Scraping Instagram (perfis e posts)",
    models: ["Instagram Profile Scraper"],
    pricing: "$0.005-0.01 / scrape",
  },
  supadata: {
    label: "Supadata",
    color: "#d4a843",
    icon: FileText,
    description: "Transcrição de vídeos YouTube",
    models: ["Transcript API"],
    pricing: "~$0.001 / chamada",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${months[parseInt(m, 10) - 1]} ${year}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatCurrency(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CostDashboard({
  currentMonthCost,
  monthlyCosts,
  providerCosts = [],
}: {
  currentMonthCost: number;
  monthlyCosts: MonthlyCostRow[];
  providerCosts?: ProviderCostRow[];
}) {
  const pct = Math.min((currentMonthCost / MONTHLY_LIMIT) * 100, 100);
  const totalCalls = providerCosts.reduce((sum, p) => sum + p.calls, 0);
  const connectedProviders = Object.keys(PROVIDERS).length;

  // Build provider data with real costs merged
  // APIs are always "connected" — active means has env key configured
  const providerData = Object.entries(PROVIDERS).map(([key, info]) => {
    const real = providerCosts.find((p) => p.provider === key);
    return {
      key,
      ...info,
      cost: real?.cost_usd ?? 0,
      calls: real?.calls ?? 0,
      connected: true, // all providers are configured
      hasUsage: (real?.calls ?? 0) > 0,
    };
  });

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total gasto */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <DollarSign className="h-4 w-4 text-accent" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Gasto do mês
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-text">
            {formatCurrency(currentMonthCost)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  pct > 80
                    ? "bg-red"
                    : pct > 50
                      ? "bg-accent"
                      : "bg-green"
                }`}
                style={{ width: `${Math.max(pct, 1)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-text-muted">
              {pct.toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-text-muted">
            Limite: ${MONTHLY_LIMIT}
          </p>
        </div>

        {/* Total chamadas */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue/10">
              <Activity className="h-4 w-4 text-blue" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Chamadas API
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-text">{totalCalls}</p>
          <p className="mt-1 font-mono text-[10px] text-text-muted">
            este mês
          </p>
        </div>

        {/* Provedores ativos */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green/10">
              <CheckCircle className="h-4 w-4 text-green" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Provedores ativos
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-green">
            {connectedProviders}
            <span className="text-lg text-text-muted">
              /{connectedProviders}
            </span>
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-muted">
            Todas conectadas
          </p>
        </div>

        {/* Status */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                pct > 80 ? "bg-red/10" : "bg-green/10"
              }`}
            >
              {pct > 80 ? (
                <AlertTriangle className="h-4 w-4 text-red" />
              ) : (
                <TrendingUp className="h-4 w-4 text-green" />
              )}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Status
            </span>
          </div>
          <p
            className={`mt-3 text-lg font-bold ${
              pct > 80 ? "text-red" : "text-green"
            }`}
          >
            {pct > 80 ? "Atenção" : "Saudável"}
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-muted">
            {pct > 80
              ? "Próximo do limite mensal"
              : `$${(MONTHLY_LIMIT - currentMonthCost).toFixed(2)} restantes`}
          </p>
        </div>
      </div>

      {/* ── Provider Cards ────────────────────────────────── */}
      <div>
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-text-secondary">
          Provedores de API
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providerData.map((p) => (
            <div
              key={p.key}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-border-light"
            >
              {/* Accent line */}
              <div
                className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
                style={{ backgroundColor: p.color }}
              />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${p.color}15` }}
                  >
                    <p.icon
                      className="h-5 w-5"
                      style={{ color: p.color }}
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text">{p.label}</h4>
                    <p className="text-[11px] text-text-muted">
                      {p.description}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex h-6 items-center rounded-full px-2 text-[10px] font-semibold ${
                    p.hasUsage
                      ? "bg-green/10 text-green"
                      : "bg-blue/10 text-blue"
                  }`}
                >
                  {p.hasUsage ? "Ativo" : "Conectado"}
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase text-text-muted">
                    Custo
                  </p>
                  <p className="text-xl font-bold text-text">
                    {p.cost > 0 ? formatCurrency(p.cost) : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase text-text-muted">
                    Chamadas
                  </p>
                  <p className="text-xl font-bold text-text">
                    {p.calls > 0 ? p.calls : "—"}
                  </p>
                </div>
              </div>

              {/* Models & pricing */}
              <div className="mt-3 flex flex-wrap gap-1">
                {p.models.map((m) => (
                  <span
                    key={m}
                    className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[9px] text-text-muted"
                  >
                    {m}
                  </span>
                ))}
              </div>
              <p className="mt-2 font-mono text-[10px] text-text-muted">
                {p.pricing}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cost Breakdown Bar ────────────────────────────── */}
      {providerCosts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-text-secondary">
            Distribuição de custos
          </h3>

          {/* Stacked bar */}
          <div className="flex h-8 w-full overflow-hidden rounded-xl bg-surface">
            {providerCosts.map((row) => {
              const barPct =
                currentMonthCost > 0
                  ? (row.cost_usd / currentMonthCost) * 100
                  : 0;
              if (barPct < 0.5) return null;
              const info = PROVIDERS[row.provider];
              return (
                <div
                  key={row.provider}
                  className="flex items-center justify-center transition-all duration-500"
                  style={{
                    width: `${barPct}%`,
                    backgroundColor: info?.color ?? "#888",
                  }}
                  title={`${info?.label ?? row.provider}: ${formatCurrency(row.cost_usd)} (${barPct.toFixed(1)}%)`}
                >
                  {barPct > 8 && (
                    <span className="font-mono text-[10px] font-bold text-white">
                      {barPct.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-4">
            {providerCosts.map((row) => {
              const info = PROVIDERS[row.provider];
              return (
                <div key={row.provider} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: info?.color ?? "#888" }}
                  />
                  <span className="font-mono text-[10px] text-text-secondary">
                    {info?.label ?? row.provider}
                  </span>
                  <span className="font-mono text-[10px] font-medium text-text">
                    {formatCurrency(row.cost_usd)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Monthly History ───────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-text-secondary">
          Histórico mensal
        </h3>

        {monthlyCosts.length === 0 ? (
          <div className="py-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-text-muted/30" />
            <p className="mt-3 text-sm text-text-muted">
              Os custos aparecerão aqui conforme o sistema for usado.
            </p>
            <p className="mt-1 text-xs text-text-muted/60">
              Gere conteúdo, faça scraping ou use o BrainChat para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {monthlyCosts.map((row, i) => {
              const maxCost = monthlyCosts[0]?.cost_usd || 1;
              const barPct = Math.max((row.cost_usd / maxCost) * 100, 2);
              return (
                <div
                  key={row.month}
                  className="flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface"
                >
                  <span className="w-16 font-mono text-xs font-medium text-text">
                    {formatMonth(row.month)}
                  </span>
                  <div className="flex-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="w-12 font-mono text-[10px] text-text-muted">
                      {formatNumber(row.calls)} calls
                    </span>
                    <span className="w-20 font-mono text-xs font-bold text-text">
                      {formatCurrency(row.cost_usd)}
                    </span>
                    {i === 0 && row.cost_usd > 0 && (
                      <ArrowUpRight className="h-3 w-3 text-accent" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pricing Reference ─────────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-text-muted">
          Referência de preços
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { action: "Gerar 1 conteúdo", cost: "~$0.05-0.15", icon: "✍️" },
            { action: "Gerar 1 imagem", cost: "~$0.17", icon: "🖼️" },
            { action: "BrainChat (1 pergunta)", cost: "~$0.02-0.08", icon: "🧠" },
            { action: "Processar 1 input", cost: "~$0.03-0.10", icon: "📥" },
            { action: "Scrape 1 perfil IG", cost: "~$0.01", icon: "📸" },
            { action: "Transcrever 1 vídeo", cost: "~$0.001", icon: "🎬" },
          ].map((item) => (
            <div
              key={item.action}
              className="flex items-center gap-3 rounded-xl bg-surface/50 px-3 py-2"
            >
              <span className="text-base">{item.icon}</span>
              <div className="flex-1">
                <p className="text-xs text-text-secondary">{item.action}</p>
              </div>
              <span className="font-mono text-xs font-medium text-text">
                {item.cost}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
