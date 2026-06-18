"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileUp,
  X,
  Check,
  CalendarDays,
  AtSign,
  Briefcase,
  Hash,
  MonitorPlay,
  Link2,
  Loader2,
  Images,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  uploadSingleSlide,
  saveDesignUpload,
  type LinkableContent,
} from "./actions";
import Image from "next/image";
import Link from "next/link";

interface ExistingUpload {
  id: string;
  content_type: string;
  content_text: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
}

interface Slide {
  id: string;
  blob: Blob;
  previewUrl: string;
  name: string;
}

const CONTENT_TYPES = [
  { value: "instagram_carousel_educativo", label: "Carrossel Educativo", platform: "instagram" },
  { value: "instagram_carousel", label: "Carrossel", platform: "instagram" },
  { value: "instagram_static", label: "Post Estático", platform: "instagram" },
  { value: "instagram_reel", label: "Reel", platform: "instagram" },
  { value: "linkedin_post", label: "Post LinkedIn", platform: "linkedin" },
  { value: "x_tweet", label: "Tweet", platform: "x" },
  { value: "x_thread", label: "Thread X", platform: "x" },
  { value: "youtube_short", label: "YouTube Short", platform: "youtube" },
  { value: "youtube_long", label: "YouTube Long", platform: "youtube" },
];

const PLATFORM_ICONS: Record<string, typeof AtSign> = {
  instagram: AtSign,
  linkedin: Briefcase,
  x: Hash,
  youtube: MonitorPlay,
};

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONTENT_TYPES.map((c) => [c.value, c.label])
);

function getPlatform(contentType: string): string {
  if (contentType.startsWith("instagram")) return "instagram";
  if (contentType.startsWith("linkedin")) return "linkedin";
  if (contentType.startsWith("x_")) return "x";
  if (contentType.startsWith("youtube")) return "youtube";
  return "instagram";
}

// Render each PDF page to a 1080px-wide JPEG (Instagram-native size, keeps payload small)
async function splitPdfToSlides(file: File): Promise<Slide[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const slides: Slide[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = 1080 / base.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.85)
    );
    if (blob) {
      slides.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        blob,
        previewUrl: URL.createObjectURL(blob),
        name: `${file.name.replace(/\.pdf$/i, "")}-slide-${i}.jpg`,
      });
    }
  }
  return slides;
}

export default function UploadExterno({
  existingUploads,
  linkableContents,
}: {
  existingUploads: ExistingUpload[];
  linkableContents: LinkableContent[];
}) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("instagram_carousel_educativo");
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function ingestFiles(files: FileList | File[]) {
    setError(null);
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setProcessing(true);
    try {
      const newSlides: Slide[] = [];
      // Keep deterministic order (slide-1, slide-2, ...) for image batches
      const sorted = arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      for (const file of sorted) {
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          const pdfSlides = await splitPdfToSlides(file);
          newSlides.push(...pdfSlides);
        } else if (file.type.startsWith("image/")) {
          newSlides.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            blob: file,
            previewUrl: URL.createObjectURL(file),
            name: file.name,
          });
        }
      }
      if (newSlides.length === 0) {
        setError("Nenhum PDF ou imagem válido encontrado.");
      }
      setSlides((prev) => [...prev, ...newSlides]);
    } catch (e) {
      setError("Falha ao processar o arquivo: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setProcessing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files?.length) ingestFiles(e.dataTransfer.files);
  }

  function removeSlide(id: string) {
    setSlides((prev) => {
      const slide = prev.find((s) => s.id === id);
      if (slide) URL.revokeObjectURL(slide.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  function clearAll() {
    slides.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setSlides([]);
    setCaption("");
    setTitle("");
    setLinkedId(null);
    setContentType("instagram_carousel_educativo");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selectLinked(content: LinkableContent | null) {
    if (!content) {
      setLinkedId(null);
      return;
    }
    setLinkedId(content.id);
    setContentType(content.content_type);
    if (content.caption) setCaption(content.caption);
  }

  async function handleSubmit() {
    if (slides.length === 0) {
      setError("Adicione pelo menos um slide (PDF ou imagem).");
      return;
    }
    setUploading(true);
    setSuccess(false);
    setError(null);
    setProgress({ done: 0, total: slides.length });

    try {
      const supabase = createClient();
      const slideUrls: string[] = [];

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        // Direct browser → Storage upload (bypasses the 4.5MB server-action limit)
        const ext = (slide.blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        const path = `external-uploads/${Date.now()}-${i}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("generated-images")
          .upload(path, slide.blob, {
            contentType: slide.blob.type || "image/jpeg",
            upsert: false,
          });

        if (upErr) {
          // Fallback: route this slide through the server action
          const fd = new FormData();
          fd.set("slide", slide.blob, slide.name);
          const res = await uploadSingleSlide(fd);
          if ("error" in res) throw new Error(res.error);
          slideUrls.push(res.url);
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from("generated-images").getPublicUrl(path);
          slideUrls.push(publicUrl);
        }
        setProgress({ done: i + 1, total: slides.length });
      }

      const saved = await saveDesignUpload({
        slideUrls,
        caption,
        contentType,
        title: title || caption.slice(0, 60),
        linkedContentId: linkedId,
      });

      if ("error" in saved) throw new Error(saved.error);

      setSuccess(true);
      clearAll();
      setTimeout(() => setSuccess(false), 5000);
    } catch (e) {
      setError("Erro ao subir: " + (e instanceof Error ? e.message : "erro desconhecido"));
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  const platform = getPlatform(contentType);
  const recentLinkable = linkableContents.slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !processing && fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/50 py-12 transition-colors hover:border-accent/50 hover:bg-card"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
          {processing ? (
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          ) : (
            <FileUp className="h-6 w-6 text-accent" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text">
            {processing
              ? "Processando arquivo..."
              : "Arraste o PDF do carrossel ou as imagens dos slides"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            PDF (vira slides automaticamente) ou PNG/JPG — pode soltar vários
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          aria-label="Selecionar PDF do carrossel ou imagens dos slides"
          onChange={(e) => e.target.files && ingestFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Slides preview */}
      {slides.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium text-text">
              <Images className="h-4 w-4 text-accent" />
              {slides.length} slide{slides.length > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-text-muted hover:text-text"
            >
              Limpar tudo
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-surface"
              >
                <Image
                  src={slide.previewUrl}
                  alt={`Slide ${idx + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSlide(slide.id)}
                  className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to existing generated content (inherits caption) */}
      {recentLinkable.length > 0 && (
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <Link2 className="h-4 w-4 text-accent" />
            Vincular a um conteúdo gerado{" "}
            <span className="font-normal text-text-muted">(traz a legenda pronta)</span>
          </label>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => selectLinked(null)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                linkedId === null
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-card text-text-secondary hover:border-accent/30"
              }`}
            >
              <span className="font-medium">Novo conteúdo</span>
              <span className="text-xs text-text-muted">— escrever a legenda manualmente</span>
            </button>
            {recentLinkable.map((c) => {
              const Icon = PLATFORM_ICONS[getPlatform(c.content_type)] || AtSign;
              const selected = linkedId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectLinked(c)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card hover:border-accent/30"
                  }`}
                >
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${selected ? "text-accent" : "text-text-muted"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${selected ? "text-accent" : "text-text"}`}>
                        {TYPE_LABELS[c.content_type] || c.content_type}
                      </span>
                      {c.hasSlides && (
                        <span className="rounded bg-green/10 px-1.5 py-0.5 text-[9px] font-medium text-green">
                          já tem slides
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-1 text-xs text-text-secondary">
                      {c.caption || "(sem legenda)"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content type (only relevant for a brand-new content) */}
      {linkedId === null && (
        <div>
          <label className="mb-2 block text-sm font-medium text-text">Tipo de conteúdo</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CONTENT_TYPES.map((ct) => {
              const Icon = PLATFORM_ICONS[ct.platform] || AtSign;
              const selected = contentType === ct.value;
              return (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setContentType(ct.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                    selected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-card text-text-secondary hover:border-accent/30"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ct.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Caption */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text">
          Legenda / Texto do post
          {linkedId && (
            <span className="ml-2 font-normal text-green">— preenchida do conteúdo vinculado</span>
          )}
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          aria-label="Legenda ou texto do post"
          placeholder="Cole ou ajuste a legenda que vai junto com o post..."
          rows={6}
          className="w-full resize-none rounded-lg border border-border bg-card px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Title */}
      <div>
        <label className="mb-2 block text-sm font-medium text-text">
          Título interno <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Título interno"
          placeholder="Ex: Carrossel sobre recompra"
          className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploading || processing || slides.length === 0}
          className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {progress ? `Subindo ${progress.done}/${progress.total}...` : "Subindo..."}
            </>
          ) : success ? (
            <>
              <Check className="h-4 w-4" />
              Salvo!
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {linkedId ? "Anexar slides ao conteúdo" : "Salvar conteúdo"}
            </>
          )}
        </button>

        {success && (
          <Link
            href="/calendario"
            className="flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <CalendarDays className="h-4 w-4" />
            Ir para o calendário agendar
          </Link>
        )}
      </div>

      {/* Existing Uploads */}
      {existingUploads.length > 0 && (
        <div className="border-t border-border pt-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
            <Upload className="h-5 w-5 text-accent" />
            Uploads anteriores
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {existingUploads.map((upload) => {
              const p = getPlatform(upload.content_type);
              const Icon = PLATFORM_ICONS[p] || AtSign;
              const typeLabel = TYPE_LABELS[upload.content_type] || upload.content_type;

              return (
                <div key={upload.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  {upload.image_url && (
                    <div className="relative aspect-square w-full bg-surface">
                      <Image src={upload.image_url} alt="Post" fill className="object-cover" unoptimized />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-text-muted" />
                      <span className="text-xs text-text-muted">{typeLabel}</span>
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          upload.status === "published"
                            ? "bg-green/10 text-green"
                            : upload.status === "approved"
                            ? "bg-accent/10 text-accent"
                            : "bg-yellow-500/10 text-yellow-500"
                        }`}
                      >
                        {upload.status === "draft"
                          ? "Rascunho"
                          : upload.status === "approved"
                          ? "Aprovado"
                          : "Publicado"}
                      </span>
                    </div>
                    {upload.content_text && (
                      <p className="line-clamp-2 text-xs text-text-secondary">{upload.content_text}</p>
                    )}
                    <p className="mt-1 text-[10px] text-text-muted">
                      {new Date(upload.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
