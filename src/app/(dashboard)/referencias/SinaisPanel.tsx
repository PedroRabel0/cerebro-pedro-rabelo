"use client";

import { useState, useTransition } from "react";
import type { WeeklyPattern } from "./actions";
import { createFormatFromPattern } from "./actions";
import {
  Zap,
  TrendingUp,
  MessageSquare,
  Palette,
  Target,
  Hash,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";

const ICON_MAP: Record<string, typeof Zap> = {
  hook: MessageSquare,
  estrutura: Palette,
  tema: Hash,
  tom: TrendingUp,
  cta: Target,
};

function getIcon(patternType: string) {
  const key = patternType.toLowerCase();
  for (const [k, Icon] of Object.entries(ICON_MAP)) {
    if (key.includes(k)) return Icon;
  }
  return Zap;
}

export default function SinaisPanel({
  patterns,
}: {
  patterns: WeeklyPattern[];
}) {
  const [createdFormats, setCreatedFormats] = useState<Set<number>>(new Set());
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  if (patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
          <Sparkles className="h-7 w-7 text-text-muted" />
        </div>
        <h3 className="font-display text-lg font-semibold text-text">
          Nenhum sinal ainda
        </h3>
        <p className="mt-1 max-w-sm text-sm text-text-secondary">
          Quando os perfis de referencia forem escaneados, os padroes da semana
          vao aparecer aqui.
        </p>
      </div>
    );
  }

  function handleCreateFormat(index: number, pattern: WeeklyPattern) {
    setLoadingIndex(index);
    startTransition(async () => {
      try {
        await createFormatFromPattern(
          pattern.pattern_type,
          pattern.description,
          pattern.suggestion,
        );
        setCreatedFormats((prev) => new Set(prev).add(index));
      } catch (err) {
        console.error("Erro ao criar formato:", err);
      } finally {
        setLoadingIndex(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-xs uppercase tracking-wider text-text-secondary">
        {patterns.length} {patterns.length === 1 ? "padrao detectado" : "padroes detectados"} esta semana
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {patterns.map((pattern, idx) => {
          const Icon = getIcon(pattern.pattern_type);
          const isCreated = createdFormats.has(idx);
          const isLoading = loadingIndex === idx && isPending;

          return (
            <div
              key={idx}
              className="rounded-2xl border border-border bg-card p-6"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {pattern.count}x
                    </span>
                    <span className="ml-2 font-mono text-xs uppercase tracking-wider text-text-secondary">
                      {pattern.pattern_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="mb-3 text-sm leading-relaxed text-text">
                {pattern.description}
              </p>

              {/* Example posts */}
              {pattern.example_posts.length > 0 && (
                <div className="mb-4 space-y-1.5">
                  {pattern.example_posts.map((example, i) => (
                    <p
                      key={i}
                      className="truncate rounded-lg bg-surface px-3 py-1.5 text-xs text-text-muted"
                    >
                      {example}
                    </p>
                  ))}
                </div>
              )}

              {/* AI suggestion */}
              <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                <p className="text-xs font-medium text-accent">Sugestao da IA</p>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {pattern.suggestion}
                </p>
              </div>

              {/* Create format button */}
              <button
                onClick={() => handleCreateFormat(idx, pattern)}
                disabled={isCreated || isLoading}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  isCreated
                    ? "border border-green/30 bg-green/10 text-green"
                    : "bg-accent text-white hover:bg-accent-hover"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando formato...
                  </>
                ) : isCreated ? (
                  <>
                    <Check className="h-4 w-4" />
                    Formato criado
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Criar formato
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
