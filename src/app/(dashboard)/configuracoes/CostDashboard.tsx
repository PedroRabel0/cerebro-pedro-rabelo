"use client";

import { DollarSign, AlertTriangle, XCircle } from "lucide-react";
import type { MonthlyCostRow, ProviderCostRow } from "./actions";

const MONTHLY_LIMIT = 50;

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

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#9b72b8",
  openai: "#6b9b5f",
  gemini: "#5b8cb8",
  apify: "#c9412b",
  supadata: "#d4a843",
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  apify: "Apify",
  supadata: "Supadata",
};

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider] || "#888888";
}

function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || provider;
}

function getProgressColor(pct: number): string {
  if (pct > 80) return "bg-[#dc2626]";
  if (pct > 50) return "bg-accent";
  return "bg-green";
}

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
  const progressColor = getProgressColor(pct);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
          <DollarSign className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Custos de IA</h2>
          <p className="text-sm text-text-muted">
            Acompanhe o consumo mensal de tokens
          </p>
        </div>
      </div>

      {/* Alert banners */}
      {currentMonthCost >= MONTHLY_LIMIT && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#dc2626]/30 bg-[#dc2626]/10 p-4">
          <XCircle className="h-5 w-5 shrink-0 text-[#dc2626]" />
          <p className="text-sm font-medium text-[#dc2626]">
            Limite mensal atingido
          </p>
        </div>
      )}
      {currentMonthCost >= MONTHLY_LIMIT * 0.8 &&
        currentMonthCost < MONTHLY_LIMIT && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-accent" />
            <p className="text-sm font-medium text-accent">
              Atenção: uso próximo do limite mensal
            </p>
          </div>
        )}

      {/* Current month card */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-secondary">
          Custo do mês atual
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-text">
            ${currentMonthCost.toFixed(2)}
          </span>
          <span className="text-sm text-text-muted">
            / ${MONTHLY_LIMIT.toFixed(2)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-right font-mono text-xs text-text-muted">
          {pct.toFixed(1)}% utilizado
        </p>
      </div>

      {/* Provider breakdown */}
      {providerCosts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="mb-4 font-mono text-xs uppercase tracking-wider text-text-secondary">
            Custo por provedor (mês atual)
          </p>
          <div className="space-y-3">
            {providerCosts.map((row) => {
              const maxCost = providerCosts[0]?.cost_usd || 1;
              const barPct = Math.max((row.cost_usd / maxCost) * 100, 2);
              const color = getProviderColor(row.provider);
              return (
                <div key={row.provider} className="flex items-center gap-3">
                  <span
                    className="inline-flex min-w-[90px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {getProviderLabel(row.provider)}
                  </span>
                  <div className="flex-1">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                  <div className="min-w-[100px] text-right">
                    <span className="font-mono text-sm font-medium text-text">
                      ${row.cost_usd.toFixed(4)}
                    </span>
                    <span className="ml-2 font-mono text-xs text-text-muted">
                      ({row.calls} {row.calls === 1 ? "chamada" : "chamadas"})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly breakdown table */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="mb-4 font-mono text-xs uppercase tracking-wider text-text-secondary">
          Histórico mensal
        </p>

        {monthlyCosts.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Nenhum registro de custo encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left font-mono text-xs uppercase tracking-wider text-text-secondary">
                    Mês
                  </th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-wider text-text-secondary">
                    Chamadas
                  </th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-wider text-text-secondary">
                    Tokens In
                  </th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-wider text-text-secondary">
                    Tokens Out
                  </th>
                  <th className="pb-3 text-right font-mono text-xs uppercase tracking-wider text-text-secondary">
                    Custo
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyCosts.map((row) => (
                  <tr key={row.month} className="border-b border-border">
                    <td className="py-3 font-medium text-text">
                      {formatMonth(row.month)}
                    </td>
                    <td className="py-3 text-right font-mono text-text-secondary">
                      {formatNumber(row.calls)}
                    </td>
                    <td className="py-3 text-right font-mono text-text-secondary">
                      {formatNumber(row.input_tokens)}
                    </td>
                    <td className="py-3 text-right font-mono text-text-secondary">
                      {formatNumber(row.output_tokens)}
                    </td>
                    <td className="py-3 text-right font-mono font-medium text-text">
                      ${row.cost_usd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
