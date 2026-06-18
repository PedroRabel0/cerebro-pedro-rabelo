"use client";

import { useState, useTransition } from "react";
import {
  generateHooks,
  createHook,
  deleteHook,
  incrementHookUsage,
  getHooks,
} from "./actions";
import type { Hook } from "./actions";
import {
  Sparkles,
  Copy,
  Trash2,
  Check,
  Plus,
  Loader2,
  Zap,
  X,
} from "lucide-react";

const CATEGORIES: Record<
  string,
  { label: string; color: string }
> = {
  curiosidade: { label: "Curiosidade", color: "bg-blue-500/20 text-blue-400" },
  polêmica: { label: "Polêmica", color: "bg-red-500/20 text-red-400" },
  autoridade: { label: "Autoridade", color: "bg-amber-500/20 text-amber-400" },
  dor: { label: "Dor", color: "bg-purple-500/20 text-purple-400" },
  história: { label: "História", color: "bg-green-500/20 text-green-400" },
  dado: { label: "Dado", color: "bg-cyan-500/20 text-cyan-400" },
  pergunta: { label: "Pergunta", color: "bg-pink-500/20 text-pink-400" },
  contraintuitivo: {
    label: "Contraintuitivo",
    color: "bg-orange-500/20 text-orange-400",
  },
};

// Also handle accent-less keys from the DB/AI
const CATEGORY_ALIASES: Record<string, string> = {
  polemica: "polêmica",
  historia: "história",
};

function normalizeCategoryKey(key: string): string {
  const lower = key.toLowerCase().trim();
  return CATEGORY_ALIASES[lower] ?? lower;
}

function getCategoryMeta(key: string) {
  const normalized = normalizeCategoryKey(key);
  return (
    CATEGORIES[normalized] ?? {
      label: key,
      color: "bg-zinc-500/20 text-zinc-400",
    }
  );
}

export default function HooksBank({
  initialHooks,
}: {
  initialHooks: Hook[];
}) {
  const [hooks, setHooks] = useState<Hook[]>(initialHooks);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generator state
  const [topic, setTopic] = useState("");
  const [genCategory, setGenCategory] = useState("");
  const [genCount, setGenCount] = useState(10);
  const [isGenerating, startGenerating] = useTransition();
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  const [genError, setGenError] = useState<string | null>(null);

  // Manual creation state
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualCategory, setManualCategory] = useState("curiosidade");
  const [isCreating, startCreating] = useTransition();

  // Deletion
  const [isPending, startTransition] = useTransition();

  const filteredHooks = activeCategory
    ? hooks.filter(
        (h) => normalizeCategoryKey(h.category) === activeCategory
      )
    : hooks;

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenError(null);

    startGenerating(async () => {
      const result = await generateHooks(
        topic.trim(),
        genCategory || undefined,
        genCount
      );

      if ("error" in result) {
        setGenError(result.error);
        return;
      }

      // Add generated hooks to local state with animation tracking
      const newIds = new Set(result.hooks.map((h) => h.id));
      setGeneratedIds(newIds);
      setHooks((prev) => [...result.hooks, ...prev]);
      setTopic("");

      // Clear animation markers after 2s
      setTimeout(() => setGeneratedIds(new Set()), 2000);
    });
  }

  async function handleCreate() {
    if (!manualText.trim()) return;

    startCreating(async () => {
      await createHook(manualText.trim(), manualCategory);
      const refreshed = await getHooks();
      setHooks(refreshed);
      setManualText("");
      setShowManual(false);
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      await deleteHook(id);
      setHooks((prev) => prev.filter((h) => h.id !== id));
    });
  }

  async function handleCopy(hook: Hook) {
    await navigator.clipboard.writeText(hook.text);
    setCopiedId(hook.id);
    incrementHookUsage(hook.id);
    setHooks((prev) =>
      prev.map((h) =>
        h.id === hook.id ? { ...h, used_count: h.used_count + 1 } : h
      )
    );
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Count hooks per category
  const categoryCounts: Record<string, number> = {};
  for (const h of hooks) {
    const key = normalizeCategoryKey(h.category);
    categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;
  }

  return (
    <div className="space-y-8">
      {/* ====== GENERATOR SECTION ====== */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-text">Gerar Hooks com IA</h2>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Topic */}
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Tema
            </label>
            <input
              type="text"
              aria-label="Tema dos hooks"
              placeholder="Ex: decisoes, lideranca, fracasso..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Category */}
          <div className="w-full sm:w-44">
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Categoria
            </label>
            <select
              aria-label="Filtrar por categoria"
              value={genCategory}
              onChange={(e) => setGenCategory(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Todas</option>
              {Object.entries(CATEGORIES).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Count */}
          <div className="w-full sm:w-24">
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Qtd
            </label>
            <select
              aria-label="Quantidade de hooks"
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </div>

          {/* Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? "Gerando..." : "Gerar Hooks"}
          </button>
        </div>

        {genError && (
          <p className="mt-3 text-sm text-red-400">{genError}</p>
        )}
      </div>

      {/* ====== LIBRARY SECTION ====== */}
      <div>
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">
            Biblioteca{" "}
            <span className="text-sm font-normal text-text-secondary">
              ({hooks.length} hooks)
            </span>
          </h2>
          <button
            onClick={() => setShowManual((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            {showManual ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {showManual ? "Cancelar" : "Adicionar manual"}
          </button>
        </div>

        {/* Manual creation form */}
        {showManual && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Texto do hook
                </label>
                <input
                  type="text"
                  aria-label="Texto do hook"
                  placeholder="Digite o hook..."
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Categoria
                </label>
                <select
                  aria-label="Categoria do hook"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {Object.entries(CATEGORIES).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCreate}
                disabled={isCreating || !manualText.trim()}
                className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* Category filter pills */}
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === null
                ? "bg-accent text-white"
                : "bg-card text-text-secondary hover:text-text"
            }`}
          >
            Todas ({hooks.length})
          </button>
          {Object.entries(CATEGORIES).map(([key, { label }]) => {
            const count = categoryCounts[key] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() =>
                  setActiveCategory(activeCategory === key ? null : key)
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === key
                    ? "bg-accent text-white"
                    : "bg-card text-text-secondary hover:text-text"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Hooks grid */}
        {filteredHooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-text-secondary/40" />
            <p className="text-sm text-text-secondary">
              Nenhum hook encontrado.
            </p>
            <p className="mt-1 text-xs text-text-secondary/60">
              Use o gerador acima para criar hooks com IA.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredHooks.map((hook) => {
              const meta = getCategoryMeta(hook.category);
              const isNew = generatedIds.has(hook.id);

              return (
                <div
                  key={hook.id}
                  className={`group relative rounded-xl border border-border bg-card p-4 transition-all hover:border-accent/40 ${
                    isNew ? "animate-pulse border-accent/60" : ""
                  }`}
                >
                  {/* Hook text */}
                  <p className="mb-3 text-sm leading-relaxed text-text">
                    {hook.text}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      {hook.used_count > 0 && (
                        <span className="font-mono text-[10px] text-text-secondary">
                          {hook.used_count}x usado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleCopy(hook)}
                        className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-accent/10 hover:text-accent"
                        title="Copiar hook"
                      >
                        {copiedId === hook.id ? (
                          <Check className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(hook.id)}
                        disabled={isPending}
                        className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Excluir hook"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
