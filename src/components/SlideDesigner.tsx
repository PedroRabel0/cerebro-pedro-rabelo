"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Download, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon } from "lucide-react";

interface SlideDesignerProps {
  slides: string[];
  hook: string;
  cta: string;
  title: string;
  hashtags: string[];
  /**
   * Hints de FOTO REAL por posicao, alinhados com [capa, ...slides, cta]
   * (vindos do parseCarouselSlides — tipo "case_empresa"). Onde houver hint,
   * o slide renderiza um SLOT demarcado para o Pedro encaixar a foto real
   * dele no design. null/ausente = slide so de texto (comportamento atual).
   */
  photoHints?: (string | null)[];
  /**
   * Identidade da empresa analisada (case_empresa): funde a cara do Pedro
   * (preto + vermelho, dominante) com a da empresa — cor da marca nos
   * acentos secundarios e logo oficial (via /api/logo) na capa.
   */
  companyBrand?: { name: string; color: string; domain: string | null } | null;
}

/**
 * Visual Instagram carousel slide designer.
 * Renders slides with Pedro's brand identity (black + red).
 * Supports PNG download via canvas.
 */
export default function SlideDesigner({ slides, hook, cta, title, hashtags, photoHints, companyBrand }: SlideDesignerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  // Fotos REAIS colocadas pelo usuario nos slots (indice do slide -> objectURL).
  // Ficam so no navegador (montagem do design); saem no PNG exportado.
  const [slidePhotos, setSlidePhotos] = useState<Record<number, string>>({});
  const pendingPhotoIndex = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  // Logo oficial da empresa (same-origin via /api/logo — exportavel no PNG)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCompanyLogoUrl(null);
    if (!companyBrand?.domain) return;
    const url = `/api/logo?domain=${encodeURIComponent(companyBrand.domain)}`;
    fetch(url)
      .then((res) => {
        if (!cancelled && res.ok) setCompanyLogoUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyBrand?.domain]);

  const company = companyBrand
    ? { name: companyBrand.name, color: companyBrand.color, logoUrl: companyLogoUrl }
    : undefined;

  function pickPhoto(index: number) {
    pendingPhotoIndex.current = index;
    photoInputRef.current?.click();
  }

  function handlePhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const index = pendingPhotoIndex.current;
    if (file && index !== null && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setSlidePhotos((prev) => {
        if (prev[index]) URL.revokeObjectURL(prev[index]);
        return { ...prev, [index]: url };
      });
    }
    if (photoInputRef.current) photoInputRef.current.value = "";
    pendingPhotoIndex.current = null;
  }

  // Build full slides array: cover + content slides + CTA slide
  const allSlides = buildSlideData(slides, hook, cta, title, photoHints);

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
                photoUrl={slidePhotos[currentSlide]}
                onPickPhoto={() => pickPhoto(currentSlide)}
                company={company}
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

      {/* Input unico para as fotos dos slots */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoChosen}
        className="hidden"
        aria-label="Escolher foto real para o slide"
      />

      {/* Hidden full-size renders for download (com as fotos, sem interacao) */}
      <div className="fixed -left-[9999px] -top-[9999px]" aria-hidden="true">
        {allSlides.map((slide, i) => (
          <div key={i} id={`slide-render-${i}`}>
            <SlideRenderer slide={slide} index={i} photoUrl={slidePhotos[i]} company={company} />
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
  /** Hint de foto real — renderiza o slot demarcado no slide */
  photoHint?: string | null;
}

function buildSlideData(
  slides: string[],
  hook: string,
  cta: string,
  title: string,
  photoHints?: (string | null)[]
): SlideData[] {
  const result: SlideData[] = [];
  const hints = photoHints ?? [];

  // Cover slide
  result.push({
    type: "cover",
    heading: hook || title,
    subtitle: "Deslize para aprender →",
    photoHint: hints[0] ?? null,
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
      photoHint: hints[i + 1] ?? null,
    });
  });

  // CTA slide
  result.push({
    type: "cta",
    heading: cta || "Salve este post e compartilhe com um empreendedor.",
    subtitle: "@pedrorabelo",
    photoHint: hints[slides.length + 1] ?? null,
  });

  return result;
}

/**
 * Slot demarcado de FOTO REAL: sai no PNG exportado marcando exatamente onde
 * (e qual) foto o Pedro deve encaixar no design final. Nada e gerado por IA.
 */
function PhotoSlot({
  hint,
  height,
  photoUrl,
  onPick,
}: {
  hint: string;
  height: number;
  photoUrl?: string;
  onPick?: () => void;
}) {
  // Foto ja colocada: renderiza a imagem real (sai no PNG exportado).
  // Clique troca a foto (so no preview interativo).
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={hint}
        onClick={onPick}
        style={{
          width: "100%",
          height,
          objectFit: "cover",
          borderRadius: 24,
          flexShrink: 0,
          cursor: onPick ? "pointer" : undefined,
        }}
      />
    );
  }

  return (
    <div
      onClick={onPick}
      style={{
        width: "100%",
        height,
        border: "3px dashed #E31B23",
        borderRadius: 24,
        background: "rgba(227,27,35,0.06)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
        cursor: onPick ? "pointer" : undefined,
      }}
    >
      <span style={{ fontSize: 44, lineHeight: 1 }}>📷</span>
      <span
        style={{
          color: "#E31B23",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Foto real aqui
      </span>
      <span
        style={{
          color: "#d4d4d4",
          fontSize: 24,
          fontWeight: 500,
          textAlign: "center",
          maxWidth: 700,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </span>
      {onPick && (
        <span
          style={{
            color: "#888",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          Clique para colocar a foto
        </span>
      )}
    </div>
  );
}

// --- Slide Renderer ---

interface CompanyVisual {
  name: string;
  color: string;
  logoUrl: string | null;
}

function SlideRenderer({
  slide,
  index,
  photoUrl,
  onPickPhoto,
  company,
}: {
  slide: SlideData;
  index: number;
  photoUrl?: string;
  onPickPhoto?: () => void;
  company?: CompanyVisual;
}) {
  if (slide.type === "cover")
    return <CoverSlide slide={slide} photoUrl={photoUrl} onPickPhoto={onPickPhoto} company={company} />;
  if (slide.type === "cta")
    return <CTASlide slide={slide} photoUrl={photoUrl} onPickPhoto={onPickPhoto} company={company} />;
  return <ContentSlide slide={slide} photoUrl={photoUrl} onPickPhoto={onPickPhoto} company={company} />;
}

interface SlidePhotoProps {
  photoUrl?: string;
  onPickPhoto?: () => void;
  company?: CompanyVisual;
}

function CoverSlide({ slide, photoUrl, onPickPhoto, company }: { slide: SlideData } & SlidePhotoProps) {
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
      {/* Top accent line — funde o vermelho do Pedro com a cor da empresa */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: company
            ? `linear-gradient(90deg, #E31B23, ${company.color}, #E31B23)`
            : "linear-gradient(90deg, #E31B23, #FF3333, #E31B23)",
        }}
      />

      {/* Identidade do case: logo + chips CASE / EMPRESA */}
      {company && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 36,
          }}
        >
          {company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              style={{
                width: 72,
                height: 72,
                objectFit: "contain",
                borderRadius: 16,
                background: "#ffffff",
                padding: 8,
              }}
            />
          )}
          <span
            style={{
              background: "#E31B23",
              color: "#fff",
              padding: "8px 20px",
              borderRadius: 10,
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "0.12em",
            }}
          >
            CASE
          </span>
          <span
            style={{
              border: `3px solid ${company.color}`,
              color: company.color,
              padding: "8px 20px",
              borderRadius: 10,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {company.name}
          </span>
        </div>
      )}

      {/* Slot de foto real (case_empresa): a capa leva a foto da empresa */}
      {slide.photoHint && (
        <div style={{ width: "100%", maxWidth: 900, marginBottom: 44 }}>
          <PhotoSlot hint={slide.photoHint} height={380} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}

      {/* Main heading — uppercase 900 (vibe Bebas, a cara do Pedro) */}
      <h1
        style={{
          color: "#ffffff",
          fontSize: slide.photoHint ? 52 : 62,
          fontWeight: 900,
          lineHeight: 1.08,
          textAlign: "center",
          letterSpacing: "-0.02em",
          textTransform: company ? "uppercase" : undefined,
          maxWidth: 920,
        }}
      >
        {slide.heading}
      </h1>

      {/* Subtitle */}
      {slide.subtitle && (
        <p
          style={{
            color: "#E31B23",
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
            background: "#E31B23",
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

function ContentSlide({ slide, photoUrl, onPickPhoto, company }: { slide: SlideData } & SlidePhotoProps) {
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
            color: "#E31B23",
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
            background: company
              ? `linear-gradient(90deg, #E31B23, ${company.color}, transparent)`
              : "linear-gradient(90deg, #E31B23, transparent)",
          }}
        />
        {company && (
          <span
            style={{
              color: company.color,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            CASE · {company.name}
          </span>
        )}
      </div>

      {/* Heading — barra lateral com a cor da empresa quando e case */}
      {slide.heading && (
        <h2
          style={{
            color: "#ffffff",
            fontSize: 48,
            fontWeight: company ? 900 : 800,
            lineHeight: 1.2,
            marginBottom: 30,
            letterSpacing: "-0.02em",
            borderLeft: company ? `8px solid ${company.color}` : undefined,
            paddingLeft: company ? 24 : undefined,
          }}
        >
          {slide.heading}
        </h2>
      )}

      {/* Slot de foto real (case_empresa) */}
      {slide.photoHint && (
        <div style={{ marginBottom: 30 }}>
          <PhotoSlot hint={slide.photoHint} height={300} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}

      {/* Body */}
      <p
        style={{
          color: "#d4d4d4",
          fontSize: slide.photoHint ? Math.min(bodyFontSize, 32) : bodyFontSize,
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

function CTASlide({ slide, photoUrl, onPickPhoto, company }: { slide: SlideData } & SlidePhotoProps) {
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
          background: "radial-gradient(circle, rgba(227,27,35,0.15) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Slot de foto real (case_empresa) */}
      {slide.photoHint && (
        <div style={{ width: "100%", maxWidth: 800, marginBottom: 40, position: "relative" }}>
          <PhotoSlot hint={slide.photoHint} height={300} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}

      {/* CTA text */}
      <h2
        style={{
          color: "#ffffff",
          fontSize: slide.photoHint ? 44 : 52,
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
            background: "#E31B23",
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
            color: "#E31B23",
            padding: "16px 40px",
            borderRadius: 12,
            fontSize: 24,
            fontWeight: 700,
            border: "2px solid #E31B23",
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
            background: "#E31B23",
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
          background: company
            ? `linear-gradient(90deg, #E31B23, ${company.color}, #E31B23)`
            : "linear-gradient(90deg, #E31B23, #FF3333, #E31B23)",
        }}
      />
    </div>
  );
}
