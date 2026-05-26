"use client";

import { useRef, useState, useCallback } from "react";
import { Download, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon } from "lucide-react";

interface SlideDesignerProps {
  slides: string[];
  hook: string;
  cta: string;
  title: string;
  hashtags: string[];
}

/**
 * Visual Instagram carousel slide designer.
 * Renders slides with Pedro's brand identity (black + red).
 * Supports PNG download via canvas.
 */
export default function SlideDesigner({ slides, hook, cta, title, hashtags }: SlideDesignerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  // Build full slides array: cover + content slides + CTA slide
  const allSlides = buildSlideData(slides, hook, cta, title);

  const goNext = () => setCurrentSlide((p) => Math.min(p + 1, allSlides.length - 1));
  const goPrev = () => setCurrentSlide((p) => Math.max(p - 1, 0));

  const downloadSlide = useCallback(async (index: number) => {
    const el = document.getElementById(`slide-render-${index}`);
    if (!el) return;

    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        width: 1080,
        height: 1080,
        pixelRatio: 1,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '1080px',
          height: '1080px',
        },
      });

      const link = document.createElement("a");
      link.download = `slide-${index + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, []);

  const downloadAllSlides = useCallback(async () => {
    setDownloadingAll(true);
    try {
      const { toPng } = await import("html-to-image");
      for (let i = 0; i < allSlides.length; i++) {
        const el = document.getElementById(`slide-render-${i}`);
        if (!el) continue;

        const dataUrl = await toPng(el, {
          width: 1080,
          height: 1080,
          pixelRatio: 1,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
            width: '1080px',
            height: '1080px',
          },
        });

        const link = document.createElement("a");
        link.download = `slide-${i + 1}.png`;
        link.href = dataUrl;
        link.click();

        // Small delay between downloads
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      console.error("Download all failed:", err);
    } finally {
      setDownloadingAll(false);
    }
  }, [allSlides.length]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            Design dos Slides ({allSlides.length})
          </span>
        </div>
        <button
          onClick={downloadAllSlides}
          disabled={downloadingAll}
          className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
        >
          {downloadingAll ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          Baixar todos
        </button>
      </div>

      {/* Slide Preview (scaled down) */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        <div className="relative mx-auto" style={{ maxWidth: 400 }}>
          {/* Slide Navigation Arrows */}
          {currentSlide > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-1.5 backdrop-blur-sm transition hover:bg-white/30"
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
          )}
          {currentSlide < allSlides.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-1.5 backdrop-blur-sm transition hover:bg-white/30"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          )}

          {/* Slide Dots */}
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {allSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentSlide
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Scaled Preview */}
          <div className="overflow-hidden" style={{ aspectRatio: "1/1" }}>
            <div
              style={{
                width: 1080,
                height: 1080,
                transform: "scale(0.37037)",
                transformOrigin: "top left",
              }}
            >
              <SlideRenderer
                slide={allSlides[currentSlide]}
                index={currentSlide}
              />
            </div>
          </div>
        </div>

        {/* Download current slide */}
        <div className="absolute right-3 top-3 z-10">
          <button
            onClick={() => downloadSlide(currentSlide)}
            disabled={downloading}
            className="rounded-lg bg-black/60 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/80"
          >
            {downloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                PNG
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Slide Counter */}
      <div className="flex items-center justify-center gap-1 font-mono text-[10px] text-text-muted">
        <span>{currentSlide + 1}</span>
        <span>/</span>
        <span>{allSlides.length}</span>
      </div>

      {/* Hidden full-size renders for download */}
      <div className="fixed -left-[9999px] -top-[9999px]" aria-hidden="true">
        {allSlides.map((slide, i) => (
          <div key={i} id={`slide-render-${i}`}>
            <SlideRenderer slide={slide} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Slide Data ---

interface SlideData {
  type: "cover" | "content" | "cta";
  heading?: string;
  body?: string;
  number?: number;
  total?: number;
  subtitle?: string;
}

function buildSlideData(
  slides: string[],
  hook: string,
  cta: string,
  title: string
): SlideData[] {
  const result: SlideData[] = [];

  // Cover slide
  result.push({
    type: "cover",
    heading: hook || title,
    subtitle: "Deslize para aprender →",
  });

  // Content slides
  slides.forEach((text, i) => {
    // Try to split slide into heading + body
    const parts = text.split(/[:\.\n]/, 2);
    const hasHeading = parts.length > 1 && parts[0].length < 80;

    result.push({
      type: "content",
      heading: hasHeading ? parts[0].trim() : undefined,
      body: hasHeading ? text.slice(parts[0].length + 1).trim() : text,
      number: i + 1,
      total: slides.length,
    });
  });

  // CTA slide
  result.push({
    type: "cta",
    heading: cta || "Salve este post e compartilhe com um empreendedor.",
    subtitle: "@pedrorabelo",
  });

  return result;
}

// --- Slide Renderer ---

function SlideRenderer({ slide, index }: { slide: SlideData; index: number }) {
  if (slide.type === "cover") return <CoverSlide slide={slide} />;
  if (slide.type === "cta") return <CTASlide slide={slide} />;
  return <ContentSlide slide={slide} />;
}

function CoverSlide({ slide }: { slide: SlideData }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        background: "linear-gradient(160deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        position: "relative",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "linear-gradient(90deg, #c9412b, #e05040, #c9412b)",
        }}
      />

      {/* Main heading */}
      <h1
        style={{
          color: "#ffffff",
          fontSize: 64,
          fontWeight: 800,
          lineHeight: 1.15,
          textAlign: "center",
          letterSpacing: "-0.03em",
          maxWidth: 900,
        }}
      >
        {slide.heading}
      </h1>

      {/* Subtitle */}
      {slide.subtitle && (
        <p
          style={{
            color: "#c9412b",
            fontSize: 28,
            fontWeight: 600,
            marginTop: 40,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {slide.subtitle}
        </p>
      )}

      {/* Bottom branding */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#c9412b",
          }}
        />
        <span
          style={{
            color: "#666",
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}
        >
          PEDRO RABELO
        </span>
      </div>
    </div>
  );
}

function ContentSlide({ slide }: { slide: SlideData }) {
  const bodyFontSize = (slide.body?.length || 0) > 300 ? 32 : (slide.body?.length || 0) > 150 ? 36 : 40;

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        padding: 80,
        position: "relative",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Slide number */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 40,
        }}
      >
        <span
          style={{
            color: "#c9412b",
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          {String(slide.number || 0).padStart(2, "0")}
        </span>
        <div
          style={{
            flex: 1,
            height: 2,
            background: "linear-gradient(90deg, #c9412b, transparent)",
          }}
        />
      </div>

      {/* Heading */}
      {slide.heading && (
        <h2
          style={{
            color: "#ffffff",
            fontSize: 48,
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: 30,
            letterSpacing: "-0.02em",
          }}
        >
          {slide.heading}
        </h2>
      )}

      {/* Body */}
      <p
        style={{
          color: "#d4d4d4",
          fontSize: bodyFontSize,
          fontWeight: 400,
          lineHeight: 1.6,
          flex: 1,
        }}
      >
        {slide.body}
      </p>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 30,
          paddingTop: 20,
          borderTop: "1px solid #222",
        }}
      >
        <span style={{ color: "#555", fontSize: 18, fontWeight: 500 }}>
          @pedrorabelo
        </span>
        <span style={{ color: "#555", fontSize: 18 }}>
          {slide.number}/{slide.total}
        </span>
      </div>
    </div>
  );
}

function CTASlide({ slide }: { slide: SlideData }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        background: "linear-gradient(160deg, #1a0a08 0%, #0a0a0a 40%, #1a0a08 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        position: "relative",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Red glow */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,65,43,0.15) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* CTA text */}
      <h2
        style={{
          color: "#ffffff",
          fontSize: 52,
          fontWeight: 800,
          lineHeight: 1.3,
          textAlign: "center",
          maxWidth: 800,
          letterSpacing: "-0.02em",
          position: "relative",
        }}
      >
        {slide.heading}
      </h2>

      {/* Action buttons visual */}
      <div
        style={{
          marginTop: 50,
          display: "flex",
          gap: 20,
          position: "relative",
        }}
      >
        <div
          style={{
            background: "#c9412b",
            color: "#fff",
            padding: "16px 40px",
            borderRadius: 12,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          💾 SALVAR
        </div>
        <div
          style={{
            background: "transparent",
            color: "#c9412b",
            padding: "16px 40px",
            borderRadius: 12,
            fontSize: 24,
            fontWeight: 700,
            border: "2px solid #c9412b",
            letterSpacing: "0.02em",
          }}
        >
          ↗ COMPARTILHAR
        </div>
      </div>

      {/* Handle */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#c9412b",
          }}
        />
        <span
          style={{
            color: "#666",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          {slide.subtitle || "@pedrorabelo"}
        </span>
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "linear-gradient(90deg, #c9412b, #e05040, #c9412b)",
        }}
      />
    </div>
  );
}
