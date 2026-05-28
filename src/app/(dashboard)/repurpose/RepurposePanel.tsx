"use client";

import { useState, useTransition } from "react";
import { repurposeContent, type RepurposeResult } from "./actions";
import { Check, Copy, Loader2, Repeat2, ChevronDown } from "lucide-react";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  instagram_carousel: "Carrossel",
  instagram_reel: "Reels",
  instagram_static: "Post Estatico",
  youtube_long: "YouTube Longo",
  youtube_short: "YouTube Short",
  linkedin_post: "LinkedIn",
  x_thread: "Thread X",
  x_tweet: "Tweet",
};

const CONTENT_TYPE_EMOJI: Record<string, string> = {
  instagram_carousel: "📸",
  instagram_reel: "🎬",
  instagram_static: "📷",
  youtube_long: "🎥",
  youtube_short: "⚡",
  linkedin_post: "💼",
  x_thread: "🧵",
  x_tweet: "💬",
};

const ALL_TYPES = [
  "instagram_carousel",
  "instagram_reel",
  "instagram_static",
  "youtube_long",
  "youtube_short",
  "linkedin_post",
  "x_thread",
  "x_tweet",
];

interface ContentItem {
  id: string;
  content_type: string;
  content_text: string | null;
  status: string;
  created_at: string;
}

interface Props {
  contents: ContentItem[];
}

export default function RepurposePanel({ contents }: Props) {
  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    null
  );
  const [targetTypes, setTargetTypes] = useState<string[]>([]);
  const [results, setResults] = useState<RepurposeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showContentList, setShowContentList] = useState(false);

  const selectedContent = contents.find((c) => c.id === selectedContentId);

  const availableTargetTypes = ALL_TYPES.filter(
    (t) => t !== selectedContent?.content_type
  );

  function toggleTargetType(type: string) {
    setTargetTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function selectAllTargets() {
    setTargetTypes(availableTargetTypes);
  }

  function clearAllTargets() {
    setTargetTypes([]);
  }

  function handleSelectContent(id: string) {
    setSelectedContentId(id);
    setShowContentList(false);
    setResults([]);
    setError(null);
    // Reset target types when changing content
    setTargetTypes([]);
  }

  function handleRepurpose() {
    if (!selectedContentId || targetTypes.length === 0) return;

    setError(null);
    setResults([]);

    startTransition(async () => {
      const res = await repurposeContent(selectedContentId, targetTypes);
      if ("error" in res) {
        setError(res.error);
      } else {
        setResults(res.results);
      }
    });
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select content */}
      <div className="rounded-2xl border border-white/[0.06] bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
          1. Escolha o conteudo original
        </h2>

        {/* Selected content display / dropdown trigger */}
        <button
          type="button"
          onClick={() => setShowContentList(!showContentList)}
          className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-bg px-4 py-3 text-left transition-colors hover:border-accent/30"
        >
          {selectedContent ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="shrink-0 rounded-lg bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                {CONTENT_TYPE_EMOJI[selectedContent.content_type]}{" "}
                {CONTENT_TYPE_LABELS[selectedContent.content_type] ||
                  selectedContent.content_type}
              </span>
              <span className="truncate text-sm text-text">
                {(selectedContent.content_text || "").slice(0, 100)}
              </span>
            </div>
          ) : (
            <span className="text-sm text-text-secondary">
              Clique para selecionar um conteudo...
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${
              showContentList ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Content list dropdown */}
        {showContentList && (
          <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-white/[0.06] bg-bg">
            {contents.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">
                Nenhum conteudo gerado encontrado. Gere conteudo primeiro na
                pagina de geracao.
              </p>
            ) : (
              contents.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectContent(c.id)}
                  className={`flex w-full items-start gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03] ${
                    selectedContentId === c.id ? "bg-accent/5" : ""
                  }`}
                >
                  <span className="mt-0.5 shrink-0 rounded-lg bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                    {CONTENT_TYPE_EMOJI[c.content_type]}{" "}
                    {CONTENT_TYPE_LABELS[c.content_type] || c.content_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text">
                      {(c.content_text || "").slice(0, 100)}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Step 2: Select target types */}
      {selectedContentId && (
        <div className="rounded-2xl border border-white/[0.06] bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              2. Escolha os formatos destino
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllTargets}
                className="text-xs text-accent hover:text-accent/80"
              >
                Selecionar todos
              </button>
              <span className="text-xs text-text-secondary">|</span>
              <button
                type="button"
                onClick={clearAllTargets}
                className="text-xs text-text-secondary hover:text-text"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {availableTargetTypes.map((type) => {
              const isChecked = targetTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTargetType(type)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    isChecked
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-white/[0.06] bg-bg text-text-secondary hover:border-white/[0.12] hover:text-text"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                      isChecked
                        ? "border-accent bg-accent text-white"
                        : "border-white/20 bg-transparent"
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </span>
                  <span>
                    {CONTENT_TYPE_EMOJI[type]} {CONTENT_TYPE_LABELS[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Repurpose button */}
      {selectedContentId && targetTypes.length > 0 && (
        <button
          type="button"
          onClick={handleRepurpose}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-purple px-6 py-3.5 font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Gerando {targetTypes.length} formato
              {targetTypes.length > 1 ? "s" : ""}...
            </>
          ) : (
            <>
              <Repeat2 className="h-5 w-5" />
              Reaproveitar para {targetTypes.length} formato
              {targetTypes.length > 1 ? "s" : ""}
            </>
          )}
        </button>
      )}

      {/* Loading skeleton */}
      {isPending && (
        <div className="space-y-4">
          {targetTypes.map((type) => (
            <div
              key={type}
              className="animate-pulse rounded-2xl border border-white/[0.06] bg-card p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="h-6 w-24 rounded-lg bg-white/[0.06]" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-white/[0.06]" />
                <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
                <div className="h-4 w-5/6 rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Conteudos gerados ({results.length})
          </h2>

          {results.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/[0.06] bg-card p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                  {CONTENT_TYPE_EMOJI[r.contentType]}{" "}
                  {CONTENT_TYPE_LABELS[r.contentType] || r.contentType}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(r.content, r.id)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text"
                >
                  {copiedId === r.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-green-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                {r.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
