"use client";

import { useState, useRef, useEffect } from "react";
import { submitUniversalInput } from "@/app/(dashboard)/actions";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Video,
  Camera,
  FileText,
  BookOpen,
  Mic,
  MessageSquare,
  Paperclip,
  Hash,
  Sparkles,
  Brain,
  BookMarked,
  HelpCircle,
} from "lucide-react";

type ProcessingState = "idle" | "processing" | "done" | "error";

type ProcessingStep = {
  label: string;
  status: "pending" | "active" | "done";
};

interface ProposalResult {
  type: "playbook" | "story" | "question";
  title: string;
  summary?: string;
  content_markdown: string;
  suggested_tags: string[];
}

interface ProcessResult {
  captureId: string;
  status: "processed" | "saved_without_ai";
  result?: {
    detected_type: string;
    title: string;
    summary: string;
    proposals: ProposalResult[];
    extracted_themes: string[];
  };
}

const typeIcons: Record<string, typeof Video> = {
  youtube: Video,
  instagram: Camera,
  article: FileText,
  book: BookOpen,
  podcast: Mic,
  free_text: MessageSquare,
  unknown: Paperclip,
};

const proposalTypeConfig: Record<
  string,
  { label: string; className: string; Icon: typeof BookOpen }
> = {
  playbook: {
    label: "Playbook",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    Icon: BookOpen,
  },
  story: {
    label: "História",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Icon: BookMarked,
  },
  question: {
    label: "Pergunta",
    className: "bg-green-500/10 text-green-400 border-green-500/20",
    Icon: HelpCircle,
  },
};

function detectInputType(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be"))
    return "YouTube";
  if (trimmed.includes("instagram.com")) return "Instagram";
  if (trimmed.startsWith("http")) return "Link";
  if (trimmed.length > 500) return "Texto longo";
  return null;
}

function getProcessingSteps(input: string): ProcessingStep[] {
  const trimmed = input.trim().toLowerCase();
  const isYouTube =
    trimmed.includes("youtube.com") || trimmed.includes("youtu.be");
  const isInstagram = trimmed.includes("instagram.com");

  const steps: ProcessingStep[] = [
    { label: "Salvando input", status: "pending" },
  ];

  if (isYouTube) {
    steps.push({ label: "Extraindo transcrição do YouTube", status: "pending" });
  }
  if (isInstagram) {
    steps.push({ label: "Scraping Instagram via Apify", status: "pending" });
    steps.push({ label: "Análise DNA do post", status: "pending" });
  }

  steps.push(
    { label: "Analisando conteúdo com Claude AI", status: "pending" },
    { label: "Gerando propostas para a Base", status: "pending" }
  );

  return steps;
}

function ProposalPreviewCard({
  proposal,
  index,
}: {
  proposal: ProposalResult;
  index: number;
}) {
  const config = proposalTypeConfig[proposal.type] || proposalTypeConfig.playbook;
  const preview =
    proposal.content_markdown.length > 200
      ? proposal.content_markdown.slice(0, 200) + "..."
      : proposal.content_markdown;

  return (
    <div
      className="animate-fade-in overflow-hidden rounded-xl border border-border bg-card"
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface/50 px-4 py-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${config.className}`}
        >
          <config.Icon className="h-3 w-3" />
          {config.label}
        </span>
        <span className="font-mono text-[9px] text-text-muted uppercase">
          Será adicionado à Base
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Title */}
        <h4 className="text-sm font-semibold text-text">{proposal.title}</h4>

        {/* Content preview */}
        <p className="text-xs leading-relaxed text-text-muted whitespace-pre-wrap">
          {preview}
        </p>

        {/* Tags */}
        {proposal.suggested_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {proposal.suggested_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-accent/80"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function UniversalInput() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const detectedType = input.trim() ? detectInputType(input) : null;

  // Simulate step progression during processing
  useEffect(() => {
    if (state !== "processing" || steps.length === 0) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [state, steps.length]);

  // Update steps statuses based on currentStep
  useEffect(() => {
    if (steps.length === 0) return;
    setSteps((prev) =>
      prev.map((step, i) => ({
        ...step,
        status: i < currentStep ? "done" : i === currentStep ? "active" : "pending",
      }))
    );
  }, [currentStep, steps.length]);

  async function handleSubmit() {
    if (!input.trim()) return;
    setState("processing");
    setResult(null);

    const processingSteps = getProcessingSteps(input);
    setSteps(processingSteps);
    setCurrentStep(0);

    try {
      const res = await submitUniversalInput(input.trim());
      // Mark all steps as done
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      setResult(res as ProcessResult);
      setState("done");
      setInput("");
    } catch (err) {
      console.error(err);
      setState("error");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleReset() {
    setState("idle");
    setResult(null);
    setSteps([]);
    setCurrentStep(0);
    textareaRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      {/* Input Area with Glow */}
      <div className={`glow-input relative rounded-2xl ${state === "processing" ? "processing-glow" : ""}`}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={state === "processing"}
          placeholder="Cole aqui qualquer coisa — link do YouTube, post do Instagram, URL de artigo, texto, transcrição, ideia..."
          rows={4}
          className="w-full resize-none rounded-2xl border border-border bg-card px-5 py-4 pr-36 text-sm text-text placeholder:text-text-muted focus:border-accent/50 focus:outline-none disabled:opacity-50"
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-3">
          {detectedType && state === "idle" && (
            <span className="animate-fade-in rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-medium text-accent">
              {detectedType}
            </span>
          )}
          <span className="hidden font-mono text-[10px] text-text-muted sm:inline">
            {input.length > 0 ? `${input.length}` : "Ctrl+Enter"}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || state === "processing"}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 disabled:opacity-40 disabled:hover:shadow-none"
          >
            {state === "processing" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Processando</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Processar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Processing Steps */}
      {state === "processing" && steps.length > 0 && (
        <div className="animate-slide-in rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-accent" />
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-accent">
              Processando
            </span>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {step.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green" />
                ) : step.status === "active" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                ) : (
                  <div className="h-4 w-4 shrink-0 rounded-full border border-border" />
                )}
                <span
                  className={`text-sm transition-colors ${
                    step.status === "done"
                      ? "text-text-muted line-through"
                      : step.status === "active"
                        ? "text-text font-medium"
                        : "text-text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success with AI */}
      {state === "done" && result?.result && (
        <div className="animate-slide-in rounded-2xl border border-green/20 bg-gradient-to-br from-green/5 to-transparent p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {(() => {
                const IconComp =
                  typeIcons[result.result.detected_type] || Paperclip;
                return <IconComp className="h-5 w-5 text-green" />;
              })()}
              <div>
                <h3 className="text-sm font-semibold text-text">
                  {result.result.title}
                </h3>
                <span className="font-mono text-[10px] text-green">
                  Processado com sucesso
                </span>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="rounded-lg px-3 py-1 font-mono text-[10px] text-text-muted transition hover:bg-card hover:text-text"
            >
              Novo input
            </button>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-text-secondary">
            {result.result.summary}
          </p>

          {result.result.proposals.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-accent" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {result.result.proposals.length} proposta(s) para a Base de Conhecimento
                </span>
              </div>
              {result.result.proposals.map((p, i) => (
                <ProposalPreviewCard key={i} proposal={p} index={i} />
              ))}
            </div>
          )}

          {result.result.extracted_themes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {result.result.extracted_themes.map((theme, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-text-muted transition hover:border-accent/30 hover:text-accent"
                >
                  <Hash className="h-2.5 w-2.5" />
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved without AI */}
      {state === "done" && result?.status === "saved_without_ai" && (
        <div className="animate-slide-in rounded-2xl border border-accent/20 bg-accent/5 p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium text-text">Input salvo</p>
              <p className="text-xs text-text-muted">
                O processamento por IA falhou. Ele aparecerá em Insights para
                processamento manual.
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="mt-3 rounded-lg bg-card px-3 py-1.5 font-mono text-[10px] text-text-muted transition hover:text-text"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="animate-slide-in rounded-2xl border border-red/20 bg-red/5 p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red" />
            <div>
              <p className="text-sm font-medium text-text">
                Erro ao processar
              </p>
              <p className="text-xs text-text-muted">
                Verifique sua conexão e tente novamente.
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="mt-3 rounded-lg bg-card px-3 py-1.5 font-mono text-[10px] text-text-muted transition hover:text-text"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
