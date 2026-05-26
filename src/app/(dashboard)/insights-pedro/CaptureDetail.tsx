"use client";

import { useEffect, useState } from "react";
import type { Proposal } from "@/lib/supabase/types";
import { getProposalsByCapture, updateProposalStatus } from "./actions";
import {
  CheckCircle2,
  XCircle,
  Hash,
  Loader2,
  Copy,
  Check,
  Camera,
  Briefcase,
  MessageCircle,
  MessageSquare,
  Layers,
  Megaphone,
  Download,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import SlideDesigner from "@/components/SlideDesigner";

const platformConfig: Record<
  string,
  { label: string; className: string; Icon: typeof Camera }
> = {
  instagram_carousel: {
    label: "Instagram Carousel",
    className: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    Icon: Camera,
  },
  linkedin_post: {
    label: "LinkedIn Post",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Icon: Briefcase,
  },
  x_thread: {
    label: "X / Twitter Thread",
    className: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    Icon: MessageCircle,
  },
};

function parseStructuredContent(proposal: Proposal) {
  const md = proposal.content_markdown || "";

  const hookMatch = md.match(/\*\*Hook:\*\*\s*(.*)/);
  const ctaMatch = md.match(/\*\*CTA:\*\*\s*(.*)/);
  const captionMatch = md.match(/\*\*Legenda:\*\*\n([\s\S]*?)(?=\n\*\*Hashtags:|\n\*\*CTA:|\n\*\*Slides:|\n\*\*Imagens dos Slides:|$)/);
  const hashtagsMatch = md.match(/\*\*Hashtags:\*\*\s*(.*)/);
  const slidesMatch = md.match(/\*\*Slides:\*\*\n([\s\S]*?)(?=\n\*\*Imagens dos Slides:|$)/);
  const imagesMatch = md.match(/\*\*Imagens dos Slides:\*\*\n([\s\S]*?)$/);

  const hook = hookMatch ? hookMatch[1].trim() : null;
  const cta = ctaMatch ? ctaMatch[1].trim() : null;
  const caption = captionMatch ? captionMatch[1].trim() : md;
  const hashtags = hashtagsMatch
    ? hashtagsMatch[1]
        .trim()
        .split(/\s+/)
        .filter((h) => h.startsWith("#"))
    : proposal.suggested_tags.map((t) => (t.startsWith("#") ? t : `#${t}`));
  const slides = slidesMatch
    ? slidesMatch[1]
        .trim()
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean)
    : null;
  const slideImages = imagesMatch
    ? imagesMatch[1]
        .trim()
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s*/, "").trim())
        .filter((url) => url.startsWith("http"))
    : null;

  return { hook, cta, caption, hashtags, slides, slideImages };
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-accent transition hover:bg-accent/20"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copiado!
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          {label || "Copiar"}
        </>
      )}
    </button>
  );
}

function AISlideGallery({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            Slides gerados por IA ({images.length})
          </span>
        </div>
        <a
          href={images[current]}
          download={`slide-${current + 1}.png`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-accent transition hover:bg-accent/20"
        >
          <Download className="h-3 w-3" />
          Baixar slide {current + 1}
        </a>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        <div className="relative mx-auto" style={{ maxWidth: 400 }}>
          {/* Navigation arrows */}
          {current > 0 && (
            <button
              onClick={() => setCurrent((p) => p - 1)}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-1.5 backdrop-blur-sm transition hover:bg-white/30"
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
          )}
          {current < images.length - 1 && (
            <button
              onClick={() => setCurrent((p) => p + 1)}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-1.5 backdrop-blur-sm transition hover:bg-white/30"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          )}

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-4 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Image */}
          <div style={{ aspectRatio: "1/1" }}>
            <img
              src={images[current]}
              alt={`Slide ${current + 1}`}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Counter */}
      <div className="flex items-center justify-center gap-1 font-mono text-[10px] text-text-muted">
        <span>{current + 1}</span>
        <span>/</span>
        <span>{images.length}</span>
      </div>
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [status, setStatus] = useState(proposal.status);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const platform = proposal.type;
  const config = platformConfig[platform] ?? {
    label: proposal.type,
    className: "bg-surface text-text-muted border-border",
    Icon: MessageSquare,
  };

  const { hook, cta, caption, hashtags, slides, slideImages } =
    parseStructuredContent(proposal);

  async function handleStatus(newStatus: "approved" | "rejected") {
    setLoading(true);
    await updateProposalStatus(proposal.id, newStatus);
    setStatus(newStatus);
    setLoading(false);
  }

  // Build the full copyable text
  const fullText = [
    caption,
    "",
    hashtags.join(" "),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${config.className}`}
          >
            <config.Icon className="h-3 w-3" />
            {config.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-green-400">
            <Megaphone className="h-2.5 w-2.5" />
            Pronto para postar
          </span>
          {status !== "pending" && (
            <span
              className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase ${
                status === "approved" ? "text-green" : "text-red"
              }`}
            >
              {status === "approved" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {status === "approved" ? "aprovado" : "rejeitado"}
            </span>
          )}
        </div>
        <CopyButton text={fullText} label="Copiar post" />
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* Hook */}
        {hook && (
          <div className="rounded-lg bg-accent/5 border border-accent/10 px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-accent/60 block mb-0.5">
              Hook
            </span>
            <p className="text-sm font-semibold text-text leading-snug">
              {hook}
            </p>
          </div>
        )}

        {/* Caption */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-text-muted mb-1 hover:text-text transition"
          >
            <Layers className="h-2.5 w-2.5" />
            Legenda {expanded ? "(ocultar)" : "(expandir)"}
          </button>
          <p
            className={`text-xs leading-relaxed text-text-muted whitespace-pre-wrap ${
              expanded ? "" : "line-clamp-4"
            }`}
          >
            {caption}
          </p>
        </div>

        {/* AI-Generated Slide Images (priority) */}
        {slideImages && slideImages.length > 0 && (
          <AISlideGallery images={slideImages} />
        )}

        {/* Visual Slide Designer as fallback (carousel only, when no AI images) */}
        {!slideImages && slides && slides.length > 0 && platform === "instagram_carousel" && (
          <SlideDesigner
            slides={slides}
            hook={hook || ""}
            cta={cta || ""}
            title={proposal.title}
            hashtags={hashtags}
          />
        )}

        {/* Slides text (carousel only) */}
        {slides && slides.length > 0 && (
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted block mb-1.5">
              Texto dos Slides ({slides.length})
            </span>
            <div className="space-y-1">
              {slides.map((slide, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-surface/80 px-3 py-2"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-[10px] font-bold text-accent">
                    {i + 1}
                  </span>
                  <p className="text-xs leading-relaxed text-text-muted">
                    {slide}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {cta && (
          <div className="rounded-lg bg-green-500/5 border border-green-500/10 px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-green-400/60 block mb-0.5">
              CTA
            </span>
            <p className="text-xs font-medium text-text-muted">{cta}</p>
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-accent/80"
              >
                {tag}
              </span>
            ))}
            <CopyButton text={hashtags.join(" ")} label="Copiar tags" />
          </div>
        )}
      </div>

      {/* Actions */}
      {status === "pending" && (
        <div className="flex gap-2 border-t border-border px-4 py-2.5 bg-surface/30">
          <button
            disabled={loading}
            onClick={() => handleStatus("approved")}
            className="flex items-center gap-1 rounded-xl bg-green/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-green transition hover:bg-green/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Aprovar
          </button>
          <button
            disabled={loading}
            onClick={() => handleStatus("rejected")}
            className="flex items-center gap-1 rounded-xl bg-red/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-red transition hover:bg-red/20 disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" />
            Rejeitar
          </button>
        </div>
      )}
    </div>
  );
}

export default function CaptureDetail({ captureId }: { captureId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProposalsByCapture(captureId).then((data) => {
      if (!cancelled) {
        setProposals(data as Proposal[]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [captureId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <span className="font-mono text-xs text-text-muted">
          Carregando posts...
        </span>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-muted">
        Nenhum post gerado ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3 pt-3">
      <h4 className="font-mono text-xs uppercase tracking-wider text-text-secondary">
        Posts prontos ({proposals.length})
      </h4>
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} />
      ))}
    </div>
  );
}
