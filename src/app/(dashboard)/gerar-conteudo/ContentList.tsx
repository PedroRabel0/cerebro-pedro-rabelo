"use client";

import { useState, useRef, useEffect } from "react";
import type { GeneratedContent, ContentStatus } from "@/lib/supabase/types";
import {
  updateContentStatus,
  updateContentText,
  updateImagePrompt,
  deleteContent,
  savePublishedUrl,
  uploadImageToContent,
  removeContentImage,
  refineContent,
} from "./actions";
import { contentTypeBadgeColor, contentTypeLabel } from "./FormatList";
import { filesToImageFiles } from "@/lib/pdf-client";
import SlideDesigner from "@/components/SlideDesigner";
import CaseSlideDesigner from "@/components/CaseSlideDesigner";
import {
  parseCarouselSlides,
  extractCaption,
  extractLegacyDesignPrompt,
} from "./carousel";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  MessageSquare,
  ThumbsUp,
  Pencil,
  ThumbsDown,
  Trash2,
  Image as ImageIcon,
  X,
  Save,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Link,
  ExternalLink,
  Layout,
  Copy,
  Check,
  Upload,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";

// --- Helpers ---

function statusBadge(status: ContentStatus) {
  switch (status) {
    case "draft":
      return "bg-[#b8860b]/10 text-[#b8860b]";
    case "approved":
      return "bg-green/10 text-green";
    case "published":
      return "bg-blue/10 text-blue";
  }
}

function statusLabel(status: ContentStatus) {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "approved":
      return "Aprovado";
    case "published":
      return "Publicado";
  }
}

/**
 * Envia as imagens em LOTES (~8MB por chamada) pra caber no bodySizeLimit
 * do servidor — necessario desde que os slides sobem em alta resolucao.
 * O primeiro lote substitui a imagem do post; os seguintes vao somando.
 */
async function uploadFilesInBatches(
  contentId: string,
  files: File[]
): Promise<{ imageUrl: string } | { error: string }> {
  const MAX_BATCH_BYTES = 8 * 1024 * 1024;
  const batches: File[][] = [];
  let batch: File[] = [];
  let batchBytes = 0;
  for (const f of files) {
    if (batch.length > 0 && batchBytes + f.size > MAX_BATCH_BYTES) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }
    batch.push(f);
    batchBytes += f.size;
  }
  if (batch.length > 0) batches.push(batch);

  let last: { imageUrl: string } | { error: string } = {
    error: "Nenhuma imagem enviada",
  };
  for (let i = 0; i < batches.length; i++) {
    const formData = new FormData();
    for (const f of batches[i]) formData.append("images", f);
    last = await uploadImageToContent(contentId, formData, { append: i > 0 });
    if ("error" in last) return last;
  }
  return last;
}

/** Parse image_url — could be a single URL, a base64 data URL, or a JSON array of URLs */
function parseImageUrls(imageUrl: string | null): string[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not JSON — single URL or data URL
  }
  return [imageUrl];
}

function SourceMapDisplay({
  sourceMap,
}: {
  sourceMap: Record<string, unknown> | null;
}) {
  if (!sourceMap || Object.keys(sourceMap).length === 0) return null;
  const entries = Object.entries(sourceMap);
  return (
    <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-text-muted">
      <span className="text-accent">Fontes:</span>
      {entries.map(([key, val], i) => (
        <span key={key}>
          {i > 0 && <span className="mx-0.5">&middot;</span>}
          {String(val)} {key}
        </span>
      ))}
    </div>
  );
}

// --- Lightbox: visualizador grande do design (imagem/slides) ---

function ImageLightbox({
  urls,
  index,
  onClose,
  onIndex,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const url = urls[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < urls.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, urls.length, onClose, onIndex]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.includes("png")
        ? "png"
        : blob.type.includes("webp")
          ? "webp"
          : "jpg";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `design-slide-${index + 1}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: abre numa aba nova pro usuario salvar manualmente
      window.open(url, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador do design"
    >
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 font-mono text-xs text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Baixar
        </button>
        <button
          onClick={onClose}
          aria-label="Fechar visualizador"
          className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {urls.length > 1 && index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index - 1);
          }}
          aria-label="Slide anterior"
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {urls.length > 1 && index < urls.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index + 1);
          }}
          aria-label="Proximo slide"
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={urls.length > 1 ? `Slide ${index + 1}` : "Design do post"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />

      {urls.length > 1 && (
        <span
          className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {index + 1}/{urls.length}
        </span>
      )}
    </div>
  );
}

// --- Sub-components ---

function InlineEditor({
  contentId,
  initialText,
  onClose,
}: {
  contentId: string;
  initialText: string;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      await updateContentText(contentId, text);
      setSaving(false);
      onClose();
    } catch {
      // Falha NAO fecha o editor: fechar com cara de sucesso descartava a
      // edicao do usuario em silencio.
      setSaving(false);
      setSaveError("Falha ao salvar a edicao. Tente de novo — seu texto continua aqui.");
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        aria-label="Editar conteudo"
        className="w-full rounded-xl border border-accent/30 bg-card px-3 py-2 text-sm text-text leading-relaxed focus:border-accent focus:outline-none resize-none"
      />
      {saveError && (
        <p className="text-xs text-red" role="alert">{saveError}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 font-mono text-xs font-bold text-bg transition hover:bg-accent-hover disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
        >
          <X className="h-3 w-3" />
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FeedbackForm({
  content,
  onClose,
}: {
  content: GeneratedContent;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(content.feedback_rating ?? "");
  const [text, setText] = useState(content.feedback_text ?? "");
  const [status, setStatus] = useState<ContentStatus>(content.status);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateContentStatus(content.id, status, rating || undefined, text);
    setSaving(false);
    onClose();
  }

  const ratingOptions = [
    { value: "good", label: "Bom", Icon: ThumbsUp, color: "text-green" },
    {
      value: "good_with_edits",
      label: "Bom c/ edits",
      Icon: Pencil,
      color: "text-accent",
    },
    { value: "bad", label: "Ruim", Icon: ThumbsDown, color: "text-red" },
  ] as const;

  return (
    <div className="animate-slide-in rounded-xl border border-border bg-card p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Status
          </label>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              aria-label="Status do conteudo"
              className="w-full appearance-none rounded-xl border border-border bg-card px-3 py-2 pr-8 text-sm text-text focus:border-accent focus:outline-none"
            >
              <option value="draft">Rascunho</option>
              <option value="approved">Aprovado</option>
              <option value="published">Publicado</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Avaliacao
          </label>
          <div className="flex gap-1">
            {ratingOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs transition ${
                  rating === value
                    ? "bg-accent text-bg"
                    : "border border-border text-text-muted hover:border-accent/50"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Feedback
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comentarios sobre o conteudo..."
            rows={3}
            aria-label="Comentarios sobre o conteudo"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-1.5 font-mono text-xs font-bold text-bg transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-1.5 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
          >
            <X className="h-3 w-3" />
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function PublishedUrlInput({
  contentId,
  currentUrl,
  onClose,
}: {
  contentId: string;
  currentUrl: string | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    if (!url.trim()) return;
    setSaving(true);
    try {
      await savePublishedUrl(contentId, url.trim());
      setSaving(false);
      onClose();
    } catch {
      // Falha nao fecha o input com cara de sucesso
      setSaving(false);
      setSaveError("Falha ao salvar a URL. Tente de novo.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Cole a URL de publicação..."
        aria-label="URL de publicação"
        aria-invalid={saveError ? true : undefined}
        title={saveError || undefined}
        className={`min-w-0 flex-1 rounded-xl border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent ${saveError ? "border-red/50" : "border-border"}`}
      />
      <button
        onClick={handleSave}
        disabled={saving || !url.trim()}
        className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        <Save className="h-3 w-3" />
        {saving ? "..." : "Salvar"}
      </button>
      <button
        onClick={onClose}
        className="rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:text-text"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// --- Image Upload Button for content card ---

function ImageUploader({
  contentId,
  isCarousel,
  onUploaded,
}: {
  contentId: string;
  isCarousel: boolean;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      // PDF do carrossel vira slides (imagens) no navegador; imagens passam direto
      const { files: imageFiles, ignored } = await filesToImageFiles(files);
      if (imageFiles.length === 0) {
        setError(
          ignored.length
            ? "Arquivo nao suportado. Use PDF, PNG ou JPG."
            : "Nenhuma imagem encontrada."
        );
        return;
      }
      const res = await uploadFilesInBatches(contentId, imageFiles);
      if ("error" in res) {
        setError(res.error);
      } else {
        onUploaded(res.imageUrl);
      }
    } catch (err) {
      setError(
        "Erro ao processar: " + (err instanceof Error ? err.message : "erro desconhecido")
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface/30 px-4 py-8 transition-colors hover:border-accent/40 hover:bg-surface/50">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple={isCarousel}
          onChange={handleUpload}
          aria-label="Enviar PDF ou imagem do post"
          className="hidden"
          disabled={uploading}
        />
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span className="text-sm text-accent">Processando...</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-text-muted" />
            <span className="text-sm text-text-muted">
              {isCarousel
                ? "Upload do PDF ou imagens do carrossel"
                : "Upload do PDF/imagem do post"}
            </span>
          </>
        )}
      </label>
      {error && (
        <p className="mt-1 text-xs text-red">{error}</p>
      )}
    </div>
  );
}

// --- Refine Chat ---

function RefineChat({
  contentId,
  currentText,
  contentType,
  currentPrompt,
  onRefined,
}: {
  contentId: string;
  currentText: string;
  contentType: string;
  currentPrompt: string | null;
  onRefined: (newText: string, newPrompt?: string | null) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [history, setHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  async function handleRefine() {
    if (!instruction.trim()) return;
    const userMsg = instruction.trim();
    setHistory((prev) => [...prev, { role: "user", text: userMsg }]);
    setInstruction("");
    setRefining(true);

    const res = await refineContent(
      contentId,
      currentText,
      userMsg,
      contentType,
      true,
      currentPrompt,
    );

    if ("error" in res) {
      setHistory((prev) => [...prev, { role: "ai", text: `Erro: ${res.error}` }]);
    } else {
      setHistory((prev) => [...prev, { role: "ai", text: res.imagePrompt ? "Pronto, ajustei texto e prompt de imagem." : "Pronto, ajustei o conteudo." }]);
      onRefined(res.text, res.imagePrompt);
    }
    setRefining(false);
  }

  return (
    <div className="space-y-2 rounded-xl border border-accent/20 bg-accent/5 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
          Ajustar com IA
        </span>
      </div>

      {/* Chat history */}
      {history.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-lg bg-surface/50 p-2">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`text-xs leading-relaxed ${
                msg.role === "user"
                  ? "text-text font-medium"
                  : "text-text-muted italic"
              }`}
            >
              <span className={`font-mono text-[9px] uppercase ${msg.role === "user" ? "text-accent" : "text-green"}`}>
                {msg.role === "user" ? "Voce" : "IA"}:
              </span>{" "}
              {msg.text}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleRefine();
            }
          }}
          placeholder="Ex: encurta, muda o tom, tira hashtags..."
          disabled={refining}
          aria-label="Instrução para ajustar com IA"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleRefine}
          disabled={refining || !instruction.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 font-mono text-xs font-bold text-bg transition hover:bg-accent-hover disabled:opacity-50"
        >
          {refining ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// --- Main ContentList ---

export default function ContentList({
  contents,
}: {
  contents: GeneratedContent[];
}) {
  const confirm = useConfirm();
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishUrlId, setPublishUrlId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [refineId, setRefineId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Track refined texts (not yet in server data — avoids full reload)
  const [refinedTexts, setRefinedTexts] = useState<Record<string, string>>({});
  const [refinedPrompts, setRefinedPrompts] = useState<Record<string, string>>({});
  // Track images that were just uploaded (not yet in server data)
  const [freshImages, setFreshImages] = useState<Record<string, string>>({});
  // Lightbox: qual card e qual slide estao abertos no visualizador grande
  const [lightbox, setLightbox] = useState<{ id: string; index: number } | null>(null);
  // Edicao manual do prompt de imagem (rascunho por card, antes de Salvar)
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [savingPromptId, setSavingPromptId] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!(await confirm("Apagar este conteudo?"))) return;
    await deleteContent(id);
  }

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (contents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
          <ImageIcon className="h-6 w-6 text-accent" />
        </div>
        <p className="text-sm font-medium text-text">Nenhum conteudo gerado</p>
        <p className="mt-1 text-xs text-text-muted">
          Use a aba &quot;Novo Conteudo&quot; para criar!
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="mb-4 block font-mono text-[10px] text-text-muted">
        {contents.length} conteudo{contents.length !== 1 ? "s" : ""}
      </span>

      <div className="space-y-4">
        {contents.map((c) => {
          const imageUrls = parseImageUrls(freshImages[c.id] || c.image_url);
          const hasImage = imageUrls.length > 0;
          const isCopied = copiedId === c.id;
          const isCarousel =
            c.content_type === "instagram_carousel" ||
            c.content_type === "instagram_carousel_educativo" ||
            c.content_type === "case_empresa";
          const displayText = refinedTexts[c.id] || c.content_text;
          // A area de legenda mostra SO a legenda — nunca slides nem o bloco
          // de design que registros antigos salvaram grudado no content_text.
          const caption = extractCaption(displayText);
          const displayPrompt =
            refinedPrompts[c.id] ||
            c.image_prompt ||
            extractLegacyDesignPrompt(c.content_text);

          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {/* Image section */}
              {hasImage && (
                <div className="relative">
                  <div className={`${imageUrls.length > 1 ? "grid grid-cols-3 gap-0.5" : ""} bg-surface`}>
                    {imageUrls.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightbox({ id: c.id, index: i })}
                        title="Clique para ampliar"
                        aria-label={`Ampliar ${imageUrls.length > 1 ? `slide ${i + 1}` : "imagem do post"}`}
                        className="relative block aspect-square w-full cursor-zoom-in"
                      >
                        <img
                          src={url}
                          alt={imageUrls.length > 1 ? `Slide ${i + 1}` : "Imagem do post"}
                          className="h-full w-full object-cover transition hover:opacity-90"
                        />
                        {imageUrls.length > 1 && (
                          <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {i + 1}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Overlay buttons to replace/remove image */}
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1.5 font-mono text-[10px] text-white backdrop-blur-sm transition hover:bg-black/90">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        multiple={isCarousel}
                        aria-label="Trocar imagem do post"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;
                          const { files: imageFiles } = await filesToImageFiles(files);
                          if (imageFiles.length === 0) {
                            e.target.value = "";
                            return;
                          }
                          // Remove old image first, then upload new
                          await removeContentImage(c.id);
                          const res = await uploadFilesInBatches(c.id, imageFiles);
                          if (!("error" in res)) {
                            setFreshImages((prev) => ({ ...prev, [c.id]: res.imageUrl }));
                          }
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                      <Upload className="h-3 w-3" />
                      Trocar
                    </label>
                    <button
                      onClick={async () => {
                        if (!(await confirm("Remover esta imagem?"))) return;
                        await removeContentImage(c.id);
                        setFreshImages((prev) => {
                          const next = { ...prev };
                          delete next[c.id];
                          return next;
                        });
                        // Force re-render by clearing the image from local state
                        // The page will revalidate and show no image
                        window.location.reload();
                      }}
                      className="flex items-center gap-1 rounded-lg bg-red/80 px-2.5 py-1.5 font-mono text-[10px] text-white backdrop-blur-sm transition hover:bg-red"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remover
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 space-y-3">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${contentTypeBadgeColor(c.content_type)}`}
                  >
                    {contentTypeLabel(c.content_type)}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${statusBadge(c.status)}`}
                  >
                    {statusLabel(c.status)}
                  </span>
                  {c.image_model && c.image_model !== "external" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple/10 px-2 py-0.5 font-mono text-[10px] text-purple">
                      <ImageIcon className="h-2.5 w-2.5" />
                      {c.image_model}
                    </span>
                  )}
                  {c.published_url && (
                    <a
                      href={c.published_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-green/10 px-2 py-0.5 font-mono text-[10px] font-medium text-green hover:bg-green/20 transition"
                    >
                      <Link className="h-2.5 w-2.5" />
                      Publicado
                    </a>
                  )}
                  {c.feedback_rating && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-muted">
                      {c.feedback_rating === "good" ? (
                        <ThumbsUp className="h-2.5 w-2.5 text-green" />
                      ) : c.feedback_rating === "good_with_edits" ? (
                        <Pencil className="h-2.5 w-2.5 text-accent" />
                      ) : (
                        <ThumbsDown className="h-2.5 w-2.5 text-red" />
                      )}
                      {c.feedback_rating === "good"
                        ? "Bom"
                        : c.feedback_rating === "good_with_edits"
                          ? "Bom c/ edits"
                          : "Ruim"}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-text-muted">
                    {new Date(c.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Caption / Content — click to expand, edit is separate */}
                {editingId === c.id ? (
                  <InlineEditor
                    contentId={c.id}
                    initialText={displayText || ""}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="w-full text-left rounded-xl bg-surface/40 px-3 py-2.5 transition hover:bg-surface/70 cursor-pointer"
                  >
                    <div
                      className={`whitespace-pre-wrap text-sm leading-relaxed text-text ${
                        expandedId === c.id ? "" : "line-clamp-3"
                      }`}
                    >
                      {caption || (
                        <span className="italic text-text-muted">
                          Sem legenda salva neste post. Clique em Editar para adicionar.
                        </span>
                      )}
                    </div>
                    {caption && caption.length > 150 && expandedId !== c.id && (
                      <span className="mt-1 block font-mono text-[10px] text-accent">
                        Clique pra ver tudo ↓
                      </span>
                    )}
                    {expandedId === c.id && (
                      <span className="mt-1 block font-mono text-[10px] text-text-muted">
                        Clique pra recolher ↑
                      </span>
                    )}
                  </button>
                )}

                <SourceMapDisplay sourceMap={c.source_map} />

                {/* Source info */}
                <div className="flex flex-wrap gap-3 text-[10px] text-text-muted">
                  {c.playbook && <span>Playbook: {c.playbook.title}</span>}
                  {c.story && <span>Historia: {c.story.title}</span>}
                  {c.format && <span>Formato: {c.format.name}</span>}
                </div>

                {/* Upload image area (when no image yet) */}
                {!hasImage && editingId !== c.id && (
                  <ImageUploader
                    contentId={c.id}
                    isCarousel={isCarousel}
                    onUploaded={(url) =>
                      setFreshImages((prev) => ({ ...prev, [c.id]: url }))
                    }
                  />
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                  {/* Copy caption — copia SO a legenda, nunca slides/prompt */}
                  <button
                    onClick={() => handleCopy(caption, c.id)}
                    className="flex items-center gap-1 rounded-xl bg-accent/10 px-3 py-1.5 font-mono text-[11px] font-medium text-accent transition hover:bg-accent/20"
                  >
                    {isCopied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {isCopied ? "Copiado!" : "Copiar legenda"}
                  </button>

                  {editingId !== c.id && (
                    <button
                      onClick={() => setEditingId(c.id)}
                      className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-text-muted transition hover:text-text hover:bg-surface"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setPublishUrlId(publishUrlId === c.id ? null : c.id)
                    }
                    className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-green transition hover:bg-green/10"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {c.published_url ? "URL" : "Publicar"}
                  </button>
                  <button
                    onClick={() =>
                      setFeedbackId(feedbackId === c.id ? null : c.id)
                    }
                    className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-blue transition hover:bg-blue/10"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Feedback
                  </button>
                  <button
                    onClick={() =>
                      setRefineId(refineId === c.id ? null : c.id)
                    }
                    className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] transition ${
                      refineId === c.id
                        ? "bg-accent/10 text-accent"
                        : "text-accent hover:bg-accent/10"
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    Ajustar
                  </button>
                  {displayPrompt && (
                    <button
                      onClick={() =>
                        setPromptId(promptId === c.id ? null : c.id)
                      }
                      className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-purple transition hover:bg-purple/10"
                    >
                      <ImageIcon className="h-3 w-3" />
                      {promptId === c.id ? "Fechar Prompt" : "Ver Prompt"}
                    </button>
                  )}
                  {isCarousel && (
                    <button
                      onClick={() =>
                        setDesignId(designId === c.id ? null : c.id)
                      }
                      className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-purple transition hover:bg-purple/10"
                    >
                      <Layout className="h-3 w-3" />
                      Ver Design
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-red transition hover:bg-red/10 ml-auto"
                  >
                    <Trash2 className="h-3 w-3" />
                    Apagar
                  </button>
                </div>

                {/* Expandable panels */}
                {feedbackId === c.id && (
                  <FeedbackForm
                    content={c}
                    onClose={() => setFeedbackId(null)}
                  />
                )}
                {publishUrlId === c.id && (
                  <PublishedUrlInput
                    contentId={c.id}
                    currentUrl={c.published_url}
                    onClose={() => setPublishUrlId(null)}
                  />
                )}
                {promptId === c.id && displayPrompt && (
                  <div className="animate-slide-in rounded-xl border border-purple/20 bg-purple/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-3.5 w-3.5 text-purple" />
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-purple">
                          Prompt de Imagem
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            promptDrafts[c.id] ?? displayPrompt
                          );
                          setCopiedPromptId(c.id);
                          setTimeout(() => setCopiedPromptId(null), 2000);
                        }}
                        className="flex items-center gap-1 rounded-lg bg-purple/10 px-2.5 py-1 font-mono text-[10px] text-purple transition hover:bg-purple/20"
                      >
                        {copiedPromptId === c.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {copiedPromptId === c.id ? "Copiado!" : "Copiar prompt"}
                      </button>
                    </div>
                    <textarea
                      value={promptDrafts[c.id] ?? displayPrompt}
                      onChange={(e) =>
                        setPromptDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      rows={8}
                      aria-label="Prompt de imagem (editável)"
                      className="w-full rounded-xl border border-purple/20 bg-card px-3 py-2 text-xs text-text-secondary leading-relaxed focus:border-purple focus:outline-none resize-y"
                    />
                    {promptError && savingPromptId === null && promptDrafts[c.id] !== undefined && (
                      <p className="text-xs text-red" role="alert">{promptError}</p>
                    )}
                    <button
                      onClick={async () => {
                        const novo = (promptDrafts[c.id] ?? displayPrompt).trim();
                        setSavingPromptId(c.id);
                        setPromptError(null);
                        try {
                          await updateImagePrompt(c.id, novo);
                          setRefinedPrompts((prev) => ({ ...prev, [c.id]: novo }));
                          setPromptDrafts((prev) => {
                            const next = { ...prev };
                            delete next[c.id];
                            return next;
                          });
                        } catch {
                          setPromptError(
                            "Falha ao salvar o prompt. Tente de novo — seu texto continua aí."
                          );
                        } finally {
                          setSavingPromptId(null);
                        }
                      }}
                      disabled={
                        savingPromptId === c.id ||
                        promptDrafts[c.id] === undefined ||
                        promptDrafts[c.id] === displayPrompt
                      }
                      className="flex items-center gap-1.5 rounded-xl bg-purple/10 px-3 py-1.5 font-mono text-xs font-bold text-purple transition hover:bg-purple/20 disabled:opacity-50"
                    >
                      {savingPromptId === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {savingPromptId === c.id ? "Salvando..." : "Salvar prompt"}
                    </button>
                  </div>
                )}
                {refineId === c.id && (
                  <RefineChat
                    contentId={c.id}
                    currentText={displayText || ""}
                    contentType={c.content_type}
                    currentPrompt={displayPrompt}
                    onRefined={(newText, newPrompt) => {
                      setRefinedTexts((prev) => ({ ...prev, [c.id]: newText }));
                      if (newPrompt) {
                        setRefinedPrompts((prev) => ({ ...prev, [c.id]: newPrompt }));
                      }
                    }}
                  />
                )}
                {designId === c.id && isCarousel && (
                  <div className="rounded-xl border border-border bg-surface/30 p-4">
                    {c.content_text && /SLIDE\s*\d/i.test(c.content_text) ? (
                      (() => {
                        const parsed = parseCarouselSlides(c.content_text);
                        const designTitle =
                          c.free_text_input || c.playbook?.title || "Carousel";
                        // Atualidades reusa o template editorial branco do
                        // Cases (rotulo "Agora"), roteado por generation_params.
                        const isAtualidades = !!(
                          c.generation_params as { atualidades?: boolean } | null
                        )?.atualidades;
                        return c.content_type === "case_empresa" || isAtualidades ? (
                          <CaseSlideDesigner
                            slides={parsed.slides}
                            hook={parsed.hook}
                            cta={parsed.cta}
                            title={designTitle}
                            photoHints={parsed.photoHints}
                            slideRoles={parsed.slideRoles}
                            companyBrand={parsed.companyBrand}
                            rotulo={isAtualidades ? "Agora" : undefined}
                          />
                        ) : (
                          <SlideDesigner
                            slides={parsed.slides}
                            hook={parsed.hook}
                            cta={parsed.cta}
                            photoHints={parsed.photoHints}
                            title={designTitle}
                            hashtags={[]}
                          />
                        );
                      })()
                    ) : (
                      <p className="text-xs leading-relaxed text-text-muted">
                        Este post foi salvo sem a estrutura dos slides (gerado
                        antes da correção), então o design não pode ser remontado
                        aqui. Gere um conteúdo novo para ver o design — ou use o
                        &quot;Ver Prompt&quot; pra recuperar o prompt de design dele.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visualizador grande (lightbox) — abre ao clicar na imagem do card */}
      {lightbox &&
        (() => {
          const c = contents.find((x) => x.id === lightbox.id);
          const urls = parseImageUrls(c ? freshImages[c.id] || c.image_url : null);
          if (urls.length === 0) return null;
          const idx = Math.min(lightbox.index, urls.length - 1);
          return (
            <ImageLightbox
              urls={urls}
              index={idx}
              onClose={() => setLightbox(null)}
              onIndex={(i) => setLightbox({ id: lightbox.id, index: i })}
            />
          );
        })()}
    </div>
  );
}
