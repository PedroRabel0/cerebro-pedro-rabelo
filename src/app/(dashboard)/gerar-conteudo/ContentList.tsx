"use client";

import { useState, useRef } from "react";
import type { GeneratedContent, ContentStatus } from "@/lib/supabase/types";
import {
  updateContentStatus,
  updateContentText,
  deleteContent,
  savePublishedUrl,
  uploadImageToContent,
} from "./actions";
import { contentTypeBadgeColor, contentTypeLabel } from "./FormatList";
import SlideDesigner from "@/components/SlideDesigner";
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
  Link,
  ExternalLink,
  Layout,
  Copy,
  Check,
  Upload,
  Loader2,
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

  async function handleSave() {
    setSaving(true);
    try {
      await updateContentText(contentId, text);
    } catch {
      // silent
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className="w-full rounded-xl border border-accent/30 bg-card px-3 py-2 text-sm text-text leading-relaxed focus:border-accent focus:outline-none resize-none"
      />
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

  async function handleSave() {
    if (!url.trim()) return;
    setSaving(true);
    try {
      await savePublishedUrl(contentId, url.trim());
    } catch {
      // silent
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Cole a URL de publicação..."
        className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent"
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

function parseCarouselSlides(content: string): {
  slides: string[];
  hook: string;
  cta: string;
} {
  const parts = content
    .split(/---|\n\n(?=\d+\.)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      hook: parts[0],
      slides: parts.slice(1, -1),
      cta: parts[parts.length - 1],
    };
  }
  const lines = content.split(/\n\n+/).filter((s) => s.trim());
  return {
    hook: lines[0] || "",
    slides: lines.slice(1, -1),
    cta: lines[lines.length - 1] || "",
  };
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
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("images", files[i]);
      }
      const res = await uploadImageToContent(contentId, formData);
      if ("error" in res) {
        setError(res.error);
      } else {
        onUploaded(res.imageUrl);
      }
    } catch {
      setError("Erro ao fazer upload");
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
          accept="image/*"
          multiple={isCarousel}
          onChange={handleUpload}
          className="hidden"
          disabled={uploading}
        />
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span className="text-sm text-accent">Subindo...</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-text-muted" />
            <span className="text-sm text-text-muted">
              {isCarousel
                ? "Upload das imagens (múltiplas)"
                : "Upload da imagem do post"}
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

// --- Main ContentList ---

export default function ContentList({
  contents,
}: {
  contents: GeneratedContent[];
}) {
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishUrlId, setPublishUrlId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Track images that were just uploaded (not yet in server data)
  const [freshImages, setFreshImages] = useState<Record<string, string>>({});

  async function handleDelete(id: string) {
    if (!confirm("Apagar este conteudo?")) return;
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
          const isCarousel = c.content_type === "instagram_carousel";

          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {/* Image section */}
              {hasImage && (
                <div className={`${imageUrls.length > 1 ? "grid grid-cols-3 gap-0.5" : ""} bg-surface`}>
                  {imageUrls.map((url, i) => (
                    <div key={i} className="relative aspect-square">
                      <img
                        src={url}
                        alt={imageUrls.length > 1 ? `Slide ${i + 1}` : "Imagem do post"}
                        className="h-full w-full object-cover"
                      />
                      {imageUrls.length > 1 && (
                        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {i + 1}
                        </span>
                      )}
                    </div>
                  ))}
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
                    initialText={c.content_text || ""}
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
                      {c.content_text}
                    </div>
                    {c.content_text && c.content_text.length > 150 && expandedId !== c.id && (
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
                  {/* Copy caption */}
                  <button
                    onClick={() => handleCopy(c.content_text || "", c.id)}
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
                {designId === c.id &&
                  isCarousel &&
                  c.content_text && (
                    <div className="rounded-xl border border-border bg-surface/30 p-4">
                      {(() => {
                        const parsed = parseCarouselSlides(c.content_text);
                        return (
                          <SlideDesigner
                            slides={parsed.slides}
                            hook={parsed.hook}
                            cta={parsed.cta}
                            title={
                              c.free_text_input ||
                              c.playbook?.title ||
                              "Carousel"
                            }
                            hashtags={[]}
                          />
                        );
                      })()}
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
