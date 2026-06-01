"use client";

import { useState, useTransition } from "react";
import {
  generateResponses,
  createResponse,
  deleteResponse,
  incrementUsage,
  getResponses,
} from "./actions";
import type { FaqResponse } from "@/lib/supabase/types";
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

const CATEGORIES: Record<string, { label: string; color: string }> = {
  geral: { label: "Geral", color: "bg-zinc-500/20 text-zinc-400" },
  vendas: { label: "Vendas", color: "bg-green-500/20 text-green-400" },
  mindset: { label: "Mindset", color: "bg-purple-500/20 text-purple-400" },
  lideranca: { label: "Lideranca", color: "bg-amber-500/20 text-amber-400" },
  negocios: { label: "Negocios", color: "bg-blue-500/20 text-blue-400" },
  pessoal: { label: "Pessoal", color: "bg-pink-500/20 text-pink-400" },
};

const CATEGORY_ALIASES: Record<string, string> = {
  liderança: "lideranca",
  negócios: "negocios",
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

export default function ResponsesBank({
  initialResponses,
}: {
  initialResponses: FaqResponse[];
}) {
  const [responses, setResponses] = useState<FaqResponse[]>(initialResponses);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generator state
  const [topic, setTopic] = useState("");
  const [genCount, setGenCount] = useState(5);
  const [isGenerating, startGenerating] = useTransition();
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  const [genError, setGenError] = useState<string | null>(null);

  // Manual creation state
  const [showManual, setShowManual] = useState(false);
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [manualCategory, setManualCategory] = useState("geral");
  const [isCreating, startCreating] = useTransition();

  // Deletion
  const [isPending, startTransition] = useTransition();

  const filteredResponses = activeCategory
    ? responses.filter(
        (r) => normalizeCategoryKey(r.category) === activeCategory
      )
    : responses;

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenError(null);

    startGenerating(async () => {
      const result = await generateResponses(topic.trim(), genCount);

      if ("error" in result) {
        setGenError(result.error);
        return;
      }

      const newIds = new Set(result.responses.map((r) => r.id));
      setGeneratedIds(newIds);
      setResponses((prev) => [...result.responses, ...prev]);
      setTopic("");

      setTimeout(() => setGeneratedIds(new Set()), 2000);
    });
  }

  async function handleCreate() {
    if (!manualQuestion.trim() || !manualAnswer.trim()) return;

    startCreating(async () => {
      await createResponse(
        manualQuestion.trim(),
        manualAnswer.trim(),
        manualCategory
      );
      const refreshed = await getResponses();
      setResponses(refreshed);
      setManualQuestion("");
      setManualAnswer("");
      setShowManual(false);
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      await deleteResponse(id);
      setResponses((prev) => prev.filter((r) => r.id !== id));
    });
  }

  async function handleCopy(response: FaqResponse) {
    await navigator.clipboard.writeText(response.answer);
    setCopiedId(response.id);
    incrementUsage(response.id);
    setResponses((prev) =>
      prev.map((r) =>
        r.id === response.id
          ? { ...r, used_count: r.used_count + 1 }
          : r
      )
    );
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Count responses per category
  const categoryCounts: Record<string, number> = {};
  for (const r of responses) {
    const key = normalizeCategoryKey(r.category);
    categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;
  }

  return (
    <div className="space-y-8">
      {/* ====== GENERATOR SECTION ====== */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-text">
            Gerar Respostas com IA
          </h2>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Topic */}
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Tema
            </label>
            <input
              type="text"
              placeholder="Ex: precificacao, rotina, como comecar..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Count */}
          <div className="w-full sm:w-24">
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Qtd
            </label>
            <select
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
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
            {isGenerating ? "Gerando..." : "Gerar Respostas"}
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
            Banco de Respostas{" "}
            <span className="text-sm font-normal text-text-secondary">
              ({responses.length} respostas)
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
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Pergunta
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Como comecar a empreender?"
                    value={manualQuestion}
                    onChange={(e) => setManualQuestion(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div className="w-full sm:w-40">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Categoria
                  </label>
                  <select
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
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Resposta
                </label>
                <textarea
                  placeholder="A resposta na voz do Pedro..."
                  value={manualAnswer}
                  onChange={(e) => setManualAnswer(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleCreate}
                  disabled={
                    isCreating ||
                    !manualQuestion.trim() ||
                    !manualAnswer.trim()
                  }
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
            Todas ({responses.length})
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

        {/* Responses grid */}
        {filteredResponses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-text-secondary/40" />
            <p className="text-sm text-text-secondary">
              Nenhuma resposta encontrada.
            </p>
            <p className="mt-1 text-xs text-text-secondary/60">
              Use o gerador acima para criar respostas com IA.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredResponses.map((response) => {
              const meta = getCategoryMeta(response.category);
              const isNew = generatedIds.has(response.id);

              return (
                <div
                  key={response.id}
                  className={`group relative rounded-xl border border-border bg-card p-4 transition-all hover:border-accent/40 ${
                    isNew ? "animate-pulse border-accent/60" : ""
                  }`}
                >
                  {/* Question */}
                  <p className="mb-2 text-sm font-semibold leading-relaxed text-text">
                    {response.question}
                  </p>

                  {/* Answer */}
                  <p className="mb-3 text-sm leading-relaxed text-text-secondary">
                    {response.answer}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      {response.source === "generated" && (
                        <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          IA
                        </span>
                      )}
                      {response.used_count > 0 && (
                        <span className="font-mono text-[10px] text-text-secondary">
                          {response.used_count}x copiada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleCopy(response)}
                        className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-accent/10 hover:text-accent"
                        title="Copiar resposta"
                      >
                        {copiedId === response.id ? (
                          <Check className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(response.id)}
                        disabled={isPending}
                        className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Excluir resposta"
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
