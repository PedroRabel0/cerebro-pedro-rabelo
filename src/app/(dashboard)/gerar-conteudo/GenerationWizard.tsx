"use client";

import { useState } from "react";
import type { ContentFormat, ContentType } from "@/lib/supabase/types";
import { createQuickContent } from "./actions";
import {
  Sparkles,
  Copy,
  RotateCcw,
  Loader2,
  Check,
} from "lucide-react";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "instagram_carousel", label: "Instagram Carousel" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "x_thread", label: "X Thread" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "instagram_reel", label: "Instagram Reel" },
  { value: "instagram_static", label: "Instagram Static" },
  { value: "youtube_long", label: "YouTube Long" },
  { value: "x_tweet", label: "X Tweet" },
];

export default function QuickGenerate({
  formats,
}: {
  formats: ContentFormat[];
}) {
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState<ContentType>("instagram_carousel");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contentId, setContentId] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError("");
    setResult("");
    setSaved(false);
    setContentId(null);

    try {
      const fd = new FormData();
      fd.set("topic", topic);
      fd.set("content_type", contentType);

      const res = await createQuickContent(fd);
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult(res.content);
        setContentId(res.id);
      }
    } catch {
      setError("Erro inesperado ao gerar conteudo.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setTopic("");
    setResult("");
    setError("");
    setSaved(false);
    setContentId(null);
  }

  // If we have a result, show it
  if (result) {
    return (
      <div className="animate-slide-in space-y-4">
        <div className="rounded-2xl border border-green/20 bg-gradient-to-br from-green/5 to-transparent p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green/10">
              <Sparkles className="h-4 w-4 text-green" />
            </div>
            <span className="font-mono text-xs uppercase tracking-wider text-green">
              Conteudo gerado
            </span>
          </div>

          <div className="rounded-xl bg-card border border-border p-4 whitespace-pre-wrap text-sm text-text leading-relaxed">
            {result}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-bg transition hover:bg-accent-hover"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copiar
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
            >
              <RotateCcw className="h-3 w-3" />
              Gerar outro
            </button>

            <span className="flex items-center gap-1.5 font-mono text-[10px] text-green">
              <Check className="h-3 w-3" />
              Salvo automaticamente
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        {/* Topic textarea */}
        <div className="mb-4">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Sobre o que voce quer criar?
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: Post sobre frameworks de decisao, Thread sobre como lidar com incerteza, Carousel sobre lideranca..."
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
          />
        </div>

        {/* Content type pills */}
        <div className="mb-5">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Tipo de conteudo
          </label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setContentType(t.value)}
                className={`rounded-xl px-3 py-1.5 font-mono text-xs transition-all ${
                  contentType === t.value
                    ? "bg-accent text-bg font-bold shadow-sm shadow-accent/20"
                    : "bg-surface text-text-muted hover:text-text hover:bg-surface/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !topic.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-mono text-sm font-bold text-bg transition hover:bg-accent-hover disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando com IA...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar com IA
            </>
          )}
        </button>

        {error && (
          <div className="mt-3 rounded-xl border border-red/20 bg-red/5 px-4 py-2 text-xs text-red">
            {error}
          </div>
        )}
      </div>

      {/* Generating animation */}
      {generating && (
        <div className="animate-pulse rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
            <Sparkles className="h-6 w-6 text-accent animate-pulse" />
          </div>
          <p className="text-sm font-medium text-text">
            Analisando base de conhecimento...
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Buscando playbooks, historias e identidade para gerar o melhor conteudo.
          </p>
        </div>
      )}
    </div>
  );
}
