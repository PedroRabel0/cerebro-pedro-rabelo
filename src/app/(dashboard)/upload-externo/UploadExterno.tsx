"use client";

import { useState, useRef } from "react";
import {
  Upload,
  ImagePlus,
  X,
  Check,
  CalendarDays,
  AtSign,
  Briefcase,
  Hash,
  MonitorPlay,
} from "lucide-react";
import { uploadExternalContent } from "./actions";
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

const CONTENT_TYPES = [
  { value: "instagram_static", label: "Post Estático", platform: "instagram" },
  { value: "instagram_carousel", label: "Carrossel", platform: "instagram" },
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

function getPlatform(contentType: string): string {
  if (contentType.startsWith("instagram")) return "instagram";
  if (contentType.startsWith("linkedin")) return "linkedin";
  if (contentType.startsWith("x_")) return "x";
  if (contentType.startsWith("youtube")) return "youtube";
  return "instagram";
}

export default function UploadExterno({
  existingUploads,
}: {
  existingUploads: ExistingUpload[];
}) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [contentType, setContentType] = useState("instagram_static");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile && !caption) return;

    setUploading(true);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.set("title", title || caption.slice(0, 60) || "Post externo");
      formData.set("caption", caption);
      formData.set("content_type", contentType);
      formData.set("platform", getPlatform(contentType));
      if (imageFile) formData.set("image", imageFile);

      await uploadExternalContent(formData);

      setSuccess(true);
      setTitle("");
      setCaption("");
      setContentType("instagram_static");
      clearImage();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Erro ao fazer upload: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setUploading(false);
    }
  }

  const platform = getPlatform(contentType);
  const PlatformIcon = PLATFORM_ICONS[platform] || AtSign;

  return (
    <div className="space-y-8">
      {/* Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Drop Zone */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Imagem do post
          </label>
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-square max-h-96 w-full">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-3 top-3 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/50 py-16 transition-colors hover:border-accent/50 hover:bg-card"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                <ImagePlus className="h-6 w-6 text-accent" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text">
                  Arraste a imagem aqui ou clique para selecionar
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  PNG, JPG, WebP — até 10MB
                </p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Content Type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Tipo de conteúdo
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

        {/* Title */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Título interno{" "}
            <span className="text-text-muted font-normal">(opcional, só pra organização)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Post sobre mentalidade de dono"
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Caption / Text */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Legenda / Texto do post
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Cole aqui a legenda que vai junto com o post..."
            rows={6}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={uploading || (!imageFile && !caption)}
            className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Salvando...
              </>
            ) : success ? (
              <>
                <Check className="h-4 w-4" />
                Salvo!
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Salvar conteúdo
              </>
            )}
          </button>

          {success && (
            <Link
              href="/calendario"
              className="flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              <CalendarDays className="h-4 w-4" />
              Ir para calendário agendar
            </Link>
          )}
        </div>
      </form>

      {/* Existing Uploads */}
      {existingUploads.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
            <Upload className="h-5 w-5 text-accent" />
            Uploads anteriores
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {existingUploads.map((upload) => {
              const p = getPlatform(upload.content_type);
              const Icon = PLATFORM_ICONS[p] || AtSign;
              const typeLabel =
                CONTENT_TYPES.find((ct) => ct.value === upload.content_type)?.label ||
                upload.content_type;

              return (
                <div
                  key={upload.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  {upload.image_url && (
                    <div className="relative aspect-square w-full bg-surface">
                      <Image
                        src={upload.image_url}
                        alt="Post"
                        fill
                        className="object-cover"
                        unoptimized
                      />
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
                      <p className="line-clamp-2 text-xs text-text-secondary">
                        {upload.content_text}
                      </p>
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
