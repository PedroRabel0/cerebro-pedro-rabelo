"use client";

import { useState, useRef, useEffect } from "react";
import { submitUniversalInput, submitFileInput } from "@/app/(dashboard)/actions";
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
  Upload,
  File,
} from "lucide-react";

type ProcessingState = "idle" | "processing" | "done" | "error";

type ProcessingStep = {
  label: string;
  status: "pending" | "active" | "done";
};

// Confirmation modal component
function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <p className="text-sm text-text">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:bg-surface hover:text-text"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-red/80"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const config = proposalTypeConfig[proposal.type] || proposalTypeConfig.playbook;
  const isLong = proposal.content_markdown.length > 200;
  const displayText = expanded || !isLong
    ? proposal.content_markdown
    : proposal.content_markdown.slice(0, 200) + "...";

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

        {/* Content preview — expandable */}
        <p className="text-xs leading-relaxed text-text-muted whitespace-pre-wrap">
          {displayText}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-medium text-accent hover:text-accent-hover transition-colors"
          >
            {expanded ? "Ver menos" : "Ver conteúdo completo"}
          </button>
        )}

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

function ElapsedTime() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <span className="font-mono text-[10px] text-text-muted tabular-nums">
      {mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`}
    </span>
  );
}

export default function UniversalInput() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedType = selectedFile
    ? `Arquivo: ${selectedFile.name}`
    : input.trim()
      ? detectInputType(input)
      : null;

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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setInput(`Arquivo: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    }
  }

  async function handleSubmit() {
    if (!input.trim() && !selectedFile) return;
    setState("processing");
    setResult(null);

    // Only 2 real steps: Enviando → Processando com IA (server does the rest)
    const processingSteps = selectedFile
      ? [
          { label: "Enviando arquivo", status: "active" as const },
          { label: "Processando com Claude AI", status: "pending" as const },
        ]
      : [
          { label: "Enviando input", status: "active" as const },
          { label: "Processando com Claude AI", status: "pending" as const },
        ];
    setSteps(processingSteps);
    setCurrentStep(0);

    try {
      // Step 1 is active (sending)
      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        // Move to step 2 right before the server call
        setCurrentStep(1);
        res = await submitFileInput(formData);
      } else {
        // Move to step 2 right before the server call
        setCurrentStep(1);
        res = await submitUniversalInput(input.trim());
      }
      // Mark all steps as done
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      setResult(res as ProcessResult);
      setState("done");
      setInput("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    textareaRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      {/* Input Area with Glow */}
      <div className={`glow-input relative rounded-2xl ${state === "processing" ? "processing-glow" : ""}`}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.csv,.json,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* File selected banner */}
        {selectedFile && state === "idle" && (
          <div className="flex items-center gap-2 rounded-t-2xl border border-b-0 border-border bg-surface/50 px-4 py-2">
            <File className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs text-text font-medium truncate flex-1">
              {selectedFile.name}
            </span>
            <span className="font-mono text-[10px] text-text-muted">
              {(selectedFile.size / 1024).toFixed(1)}KB
            </span>
            <button
              onClick={() => {
                setSelectedFile(null);
                setInput("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-text-muted hover:text-red transition-colors text-xs"
            >
              Remover
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={selectedFile ? "" : input}
          onChange={(e) => { if (!selectedFile) setInput(e.target.value); }}
          onKeyDown={handleKeyDown}
          disabled={state === "processing" || !!selectedFile}
          placeholder={selectedFile ? "Arquivo selecionado — clique Processar" : "Cole aqui qualquer coisa — link do YouTube, post do Instagram, URL de artigo, texto, transcrição, ideia..."}
          rows={selectedFile ? 2 : 4}
          className={`w-full resize-none border border-border bg-card px-5 py-4 pr-36 text-sm text-text placeholder:text-text-muted focus:border-accent/50 focus:outline-none disabled:opacity-50 ${
            selectedFile && state === "idle" ? "rounded-b-2xl" : "rounded-2xl"
          }`}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {detectedType && state === "idle" && (
            <span className="animate-fade-in rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-medium text-accent">
              {detectedType}
            </span>
          )}
          {/* Upload button */}
          {!selectedFile && state === "idle" && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 font-mono text-[10px] text-text-muted transition-colors hover:border-accent hover:text-accent"
              title="Enviar arquivo (.txt, .md, .csv, .pdf)"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Arquivo</span>
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={(!input.trim() && !selectedFile) || state === "processing"}
            title="Ctrl+Enter para enviar"
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
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-accent" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-accent">
                Processando
              </span>
            </div>
            <ElapsedTime />
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
          <p className="mt-3 text-[10px] text-text-muted">
            Isso pode levar de 10s a 2min dependendo do conteúdo.
          </p>
        </div>
      )}

      {/* Success with AI */}
      {state === "done" && result?.result && (
        <div className="animate-slide-in space-y-4">
          {/* Cerebro atualizado banner */}
          <div className="rounded-2xl border border-green/30 bg-gradient-to-br from-green/10 via-accent/5 to-transparent p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Brain className="h-6 w-6 text-green" />
                <div>
                  <h3 className="text-base font-bold text-text">
                    Cerebro atualizado!
                  </h3>
                  <p className="mt-1 font-mono text-xs text-text-secondary">
                    {(() => {
                      const proposals = result.result!.proposals;
                      const themes = result.result!.extracted_themes;
                      const playbookCount = proposals.filter((p) => p.type === "playbook").length;
                      const storyCount = proposals.filter((p) => p.type === "story").length;
                      const questionCount = proposals.filter((p) => p.type === "question").length;
                      const parts: string[] = [];
                      if (playbookCount > 0) parts.push(`+${playbookCount} playbook${playbookCount > 1 ? "s" : ""} proposto${playbookCount > 1 ? "s" : ""}`);
                      if (storyCount > 0) parts.push(`+${storyCount} historia${storyCount > 1 ? "s" : ""} proposta${storyCount > 1 ? "s" : ""}`);
                      if (questionCount > 0) parts.push(`+${questionCount} pergunta${questionCount > 1 ? "s" : ""} proposta${questionCount > 1 ? "s" : ""}`);
                      if (themes.length > 0) parts.push(`${themes.length} tema${themes.length > 1 ? "s" : ""} detectado${themes.length > 1 ? "s" : ""}`);
                      return parts.join(" · ") || "Processado com sucesso";
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="rounded-lg px-3 py-1 font-mono text-[10px] text-text-muted transition hover:bg-card hover:text-text"
              >
                Novo input
              </button>
            </div>
          </div>

          {/* Original result details */}
          <div className="rounded-2xl border border-green/20 bg-gradient-to-br from-green/5 to-transparent p-5">
            <div className="mb-4 flex items-center gap-3">
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
