"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Download, ChevronLeft, ChevronRight, Loader2, FileText } from "lucide-react";

/**
 * Template DOSSIÊ — design exclusivo do "Case de Empresa". Nao e o carrossel
 * padrao: cada slide tem um LAYOUT proprio pelo papel ([TIPO: ...]):
 *   capa     → dossie editorial: foto grande + carimbo CASE + logo da empresa
 *   contexto → ficha tecnica: label vertical "O CASO" + fatos + foto
 *   insight  → pull-quote: aspas gigantes + tese em destaque + watermark
 *   acao     → INVERSAO: slide inteiro vermelho, "O QUE EU FARIA"
 *   licao    → fecho emoldurado: a licao + CTA
 * Gramatica do Pedro (preto/vermelho/900/caixa alta) fundida com a cor e o
 * logo da empresa analisada. Fotos reais entram nos slots clicaveis.
 */

const RED = "#E31B23";

interface CompanyBrandInput {
  name: string;
  color: string;
  domain: string | null;
}

interface CaseSlideDesignerProps {
  slides: string[];
  hook: string;
  cta: string;
  title: string;
  photoHints?: (string | null)[];
  slideRoles?: (string | null)[];
  companyBrand?: CompanyBrandInput | null;
}

type Role = "capa" | "contexto" | "insight" | "acao" | "licao";

interface CaseSlide {
  role: Role;
  heading?: string;
  body?: string;
  number: number;
  total: number;
  photoHint?: string | null;
  /** posicao entre os insights (para alternar alinhamento) */
  insightIndex?: number;
}

function splitHeading(text: string): { heading?: string; body: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines[0].length < 90) {
    return { heading: lines[0], body: lines.slice(1).join("\n") };
  }
  const parts = text.split(/[:.\n]/, 2);
  if (parts.length > 1 && parts[0].length < 80) {
    return { heading: parts[0].trim(), body: text.slice(parts[0].length + 1).trim() };
  }
  return { body: text };
}

function normalizeRole(raw: string | null | undefined, fallback: Role): Role {
  const r = (raw || "").toLowerCase();
  if (r === "contexto" || r === "insight" || r === "acao" || r === "licao" || r === "capa")
    return r as Role;
  return fallback;
}

function buildCaseSlides(
  slides: string[],
  hook: string,
  cta: string,
  photoHints: (string | null)[],
  slideRoles: (string | null)[]
): CaseSlide[] {
  const total = slides.length + 2;
  const out: CaseSlide[] = [];

  out.push({
    role: "capa",
    heading: hook,
    number: 1,
    total,
    photoHint: photoHints[0] ?? null,
  });

  let insightCount = 0;
  slides.forEach((text, i) => {
    const { heading, body } = splitHeading(text);
    // fallback de papel: 1o slide do meio = contexto, demais = insight
    const role = normalizeRole(slideRoles[i + 1], i === 0 ? "contexto" : "insight");
    const slide: CaseSlide = {
      role,
      heading,
      body,
      number: i + 2,
      total,
      photoHint: photoHints[i + 1] ?? null,
    };
    if (role === "insight") slide.insightIndex = insightCount++;
    out.push(slide);
  });

  const ctaParts = splitHeading(cta);
  out.push({
    role: "licao",
    heading: ctaParts.heading,
    body: ctaParts.body,
    number: total,
    total,
    photoHint: photoHints[slides.length + 1] ?? null,
  });

  return out;
}

export default function CaseSlideDesigner({
  slides,
  hook,
  cta,
  title,
  photoHints = [],
  slideRoles = [],
  companyBrand,
}: CaseSlideDesignerProps) {
  const [current, setCurrent] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [slidePhotos, setSlidePhotos] = useState<Record<number, string>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const pendingPhotoIndex = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const allSlides = buildCaseSlides(slides, hook, cta, photoHints, slideRoles);
  const company = companyBrand
    ? { name: companyBrand.name, color: companyBrand.color, logoUrl }
    : { name: title, color: RED, logoUrl: null };

  useEffect(() => {
    let cancelled = false;
    setLogoUrl(null);
    if (!companyBrand?.domain) return;
    const url = `/api/logo?domain=${encodeURIComponent(companyBrand.domain)}`;
    fetch(url)
      .then((res) => {
        if (!cancelled && res.ok) setLogoUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyBrand?.domain]);

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

  const downloadSlide = useCallback(async (index: number) => {
    const el = document.getElementById(`case-slide-render-${index}`);
    if (!el) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        width: 1080,
        height: 1080,
        pixelRatio: 1,
        style: { transform: "scale(1)", transformOrigin: "top left", width: "1080px", height: "1080px" },
      });
      const link = document.createElement("a");
      link.download = `case-slide-${index + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, []);

  const downloadAll = useCallback(async () => {
    setDownloadingAll(true);
    try {
      const { toPng } = await import("html-to-image");
      for (let i = 0; i < allSlides.length; i++) {
        const el = document.getElementById(`case-slide-render-${i}`);
        if (!el) continue;
        const dataUrl = await toPng(el, {
          width: 1080,
          height: 1080,
          pixelRatio: 1,
          style: { transform: "scale(1)", transformOrigin: "top left", width: "1080px", height: "1080px" },
        });
        const link = document.createElement("a");
        link.download = `case-slide-${i + 1}.png`;
        link.href = dataUrl;
        link.click();
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            Dossiê do Case ({allSlides.length} slides)
          </span>
        </div>
        <button
          onClick={downloadAll}
          disabled={downloadingAll}
          className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
        >
          {downloadingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Baixar todos
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        <div className="relative mx-auto" style={{ maxWidth: 400 }}>
          {current > 0 && (
            <button
              onClick={() => setCurrent((p) => Math.max(p - 1, 0))}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-1.5 backdrop-blur-sm transition hover:bg-white/30"
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
          )}
          {current < allSlides.length - 1 && (
            <button
              onClick={() => setCurrent((p) => Math.min(p + 1, allSlides.length - 1))}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-1.5 backdrop-blur-sm transition hover:bg-white/30"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          )}

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {allSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${i === current ? "w-4 bg-white" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>

          <div className="overflow-hidden" style={{ aspectRatio: "1/1" }}>
            <div style={{ width: 1080, height: 1080, transform: "scale(0.37037)", transformOrigin: "top left" }}>
              <CaseSlideRenderer
                slide={allSlides[current]}
                company={company}
                photoUrl={slidePhotos[current]}
                onPickPhoto={() => pickPhoto(current)}
              />
            </div>
          </div>
        </div>

        <div className="absolute right-3 top-3 z-10">
          <button
            onClick={() => downloadSlide(current)}
            disabled={downloading}
            className="rounded-lg bg-black/60 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/80"
          >
            {downloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" /> PNG
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 font-mono text-[10px] text-text-muted">
        <span>{current + 1}</span>
        <span>/</span>
        <span>{allSlides.length}</span>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoChosen}
        className="hidden"
        aria-label="Escolher foto real para o slide"
      />

      <div className="fixed -left-[9999px] -top-[9999px]" aria-hidden="true">
        {allSlides.map((slide, i) => (
          <div key={i} id={`case-slide-render-${i}`}>
            <CaseSlideRenderer slide={slide} company={company} photoUrl={slidePhotos[i]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================ RENDERERS ============================

interface RenderProps {
  slide: CaseSlide;
  company: { name: string; color: string; logoUrl: string | null };
  photoUrl?: string;
  onPickPhoto?: () => void;
}

function CaseSlideRenderer(props: RenderProps) {
  switch (props.slide.role) {
    case "capa":
      return <CapaDossie {...props} />;
    case "contexto":
      return <ContextoFicha {...props} />;
    case "acao":
      return <AcaoInvertida {...props} />;
    case "licao":
      return <LicaoFecho {...props} />;
    default:
      return <InsightQuote {...props} />;
  }
}

const BASE: React.CSSProperties = {
  width: 1080,
  height: 1080,
  position: "relative",
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  overflow: "hidden",
};

/** Marcas de registro nos cantos — assinatura editorial do dossie */
function CornerMarks({ color = "#333" }: { color?: string }) {
  const mark = (pos: React.CSSProperties) => (
    <span
      style={{
        position: "absolute",
        width: 26,
        height: 26,
        color,
        fontSize: 26,
        lineHeight: "26px",
        fontWeight: 300,
        ...pos,
      }}
    >
      +
    </span>
  );
  return (
    <>
      {mark({ top: 28, left: 32 })}
      {mark({ top: 28, right: 32 })}
      {mark({ bottom: 28, left: 32 })}
      {mark({ bottom: 28, right: 32 })}
    </>
  );
}

function Rodape({ company, number, total, dark = false }: { company: RenderProps["company"]; number: number; total: number; dark?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 44,
        left: 80,
        right: 80,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: `1px solid ${dark ? "rgba(0,0,0,0.25)" : "#222"}`,
        paddingTop: 18,
      }}
    >
      <span style={{ color: dark ? "rgba(0,0,0,0.7)" : "#666", fontSize: 20, fontWeight: 700, letterSpacing: "0.08em" }}>
        @pedrorabelo
      </span>
      <span
        style={{
          color: dark ? "rgba(0,0,0,0.7)" : company.color,
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        CASE · {company.name}
      </span>
      <span style={{ color: dark ? "rgba(0,0,0,0.6)" : "#555", fontSize: 20, fontFamily: "monospace" }}>
        {String(number).padStart(2, "0")}/{String(total).padStart(2, "0")}
      </span>
    </div>
  );
}

function FotoArea({
  hint,
  height,
  photoUrl,
  onPick,
  accent,
}: {
  hint: string;
  height: number;
  photoUrl?: string;
  onPick?: () => void;
  accent: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={hint}
        onClick={onPick}
        style={{ width: "100%", height, objectFit: "cover", borderRadius: 18, cursor: onPick ? "pointer" : undefined, display: "block" }}
      />
    );
  }
  return (
    <div
      onClick={onPick}
      style={{
        width: "100%",
        height,
        border: `3px dashed ${accent}`,
        borderRadius: 18,
        background: "rgba(255,255,255,0.03)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
        cursor: onPick ? "pointer" : undefined,
      }}
    >
      <span style={{ fontSize: 40, lineHeight: 1 }}>📷</span>
      <span style={{ color: accent, fontSize: 20, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Foto real aqui
      </span>
      <span style={{ color: "#bbb", fontSize: 22, fontWeight: 500, textAlign: "center", maxWidth: 640, lineHeight: 1.35 }}>
        {hint}
      </span>
      {onPick && (
        <span style={{ color: "#777", fontSize: 18, fontWeight: 600 }}>Clique para colocar a foto</span>
      )}
    </div>
  );
}

/* ---------- CAPA: dossie editorial ---------- */
function CapaDossie({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={{ ...BASE, background: "#0a0a0a", padding: "64px 80px" }}>
      <CornerMarks />
      {/* Foto grande no topo — a cara REAL da empresa */}
      <FotoArea
        hint={slide.photoHint || `foto da ${company.name}`}
        height={450}
        photoUrl={photoUrl}
        onPick={onPickPhoto}
        accent={RED}
      />

      {/* Linha de identificacao: logo + carimbos */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 36 }}>
        {company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt={company.name}
            style={{ width: 60, height: 60, objectFit: "contain", background: "#fff", borderRadius: 12, padding: 7 }}
          />
        )}
        <span
          style={{
            background: RED,
            color: "#fff",
            padding: "8px 18px",
            fontSize: 21,
            fontWeight: 900,
            letterSpacing: "0.16em",
          }}
        >
          DOSSIÊ
        </span>
        <span
          style={{
            border: `3px solid ${company.color}`,
            color: company.color,
            padding: "6px 18px",
            fontSize: 21,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {company.name}
        </span>
        <span style={{ marginLeft: "auto", color: "#555", fontSize: 19, fontFamily: "monospace", letterSpacing: "0.1em" }}>
          Nº {String(slide.number).padStart(2, "0")}
        </span>
      </div>

      {/* Titulo — o gancho do Pedro */}
      <h1
        style={{
          color: "#fff",
          fontSize: 58,
          fontWeight: 900,
          lineHeight: 1.04,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          margin: "30px 0 0",
        }}
      >
        {slide.heading}
      </h1>

      {/* Assinatura da analise */}
      <div style={{ position: "absolute", bottom: 44, left: 80, right: 80, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 52, height: 6, background: RED }} />
        <span style={{ color: "#888", fontSize: 20, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}>
          Análise por Pedro Rabelo
        </span>
        <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${RED}, ${company.color}, transparent)` }} />
      </div>
    </div>
  );
}

/* ---------- CONTEXTO: ficha tecnica ---------- */
function ContextoFicha({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={{ ...BASE, background: "#0a0a0a", padding: "72px 80px 120px" }}>
      <CornerMarks />
      {/* Label vertical */}
      <div
        style={{
          position: "absolute",
          left: 34,
          top: "44%",
          transform: "rotate(-90deg) translateX(50%)",
          transformOrigin: "left center",
          color: company.color,
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: "0.35em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        O CASO
      </div>

      {/* Numero fantasma */}
      <span
        style={{
          position: "absolute",
          top: 30,
          right: 64,
          fontSize: 210,
          fontWeight: 900,
          color: "#161616",
          lineHeight: 1,
          letterSpacing: "-0.05em",
        }}
      >
        {String(slide.number).padStart(2, "0")}
      </span>

      <div style={{ marginLeft: 56, position: "relative" }}>
        {slide.heading && (
          <h2
            style={{
              color: "#fff",
              fontSize: 47,
              fontWeight: 900,
              lineHeight: 1.1,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              margin: 0,
              paddingBottom: 18,
              borderBottom: `6px solid ${RED}`,
              display: "inline-block",
            }}
          >
            {slide.heading}
          </h2>
        )}
        <p style={{ color: "#d4d4d4", fontSize: 31, fontWeight: 400, lineHeight: 1.55, marginTop: 30, maxWidth: 860 }}>
          {slide.body}
        </p>

        {slide.photoHint && (
          <div style={{ marginTop: 30 }}>
            <FotoArea hint={slide.photoHint} height={280} photoUrl={photoUrl} onPick={onPickPhoto} accent={company.color} />
          </div>
        )}
      </div>

      <Rodape company={company} number={slide.number} total={slide.total} />
    </div>
  );
}

/* ---------- INSIGHT: pull-quote com watermark ---------- */
function InsightQuote({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  const alignRight = (slide.insightIndex ?? 0) % 2 === 1;
  return (
    <div
      style={{
        ...BASE,
        background: "#0a0a0a",
        padding: "80px 80px 120px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <CornerMarks />
      {/* Watermark gigante */}
      <span
        style={{
          position: "absolute",
          bottom: 60,
          [alignRight ? "left" : "right"]: 40,
          fontSize: 300,
          fontWeight: 900,
          color: "#141414",
          lineHeight: 1,
          letterSpacing: "-0.06em",
        }}
      >
        {String(slide.number).padStart(2, "0")}
      </span>

      {/* Aspas do Pedro */}
      <span
        style={{
          color: RED,
          fontSize: 170,
          fontWeight: 900,
          lineHeight: 0.6,
          display: "block",
          textAlign: alignRight ? "right" : "left",
          marginBottom: 8,
        }}
      >
        “
      </span>

      <div style={{ position: "relative", textAlign: alignRight ? "right" : "left" }}>
        {slide.heading && (
          <h2
            style={{
              color: "#fff",
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: "-0.015em",
              margin: 0,
              maxWidth: 880,
              marginLeft: alignRight ? "auto" : 0,
            }}
          >
            {slide.heading}
          </h2>
        )}
        <div
          style={{
            width: 96,
            height: 7,
            background: company.color,
            margin: alignRight ? "26px 0 26px auto" : "26px 0",
          }}
        />
        <p
          style={{
            color: "#b9b9b9",
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.55,
            margin: 0,
            maxWidth: 820,
            marginLeft: alignRight ? "auto" : 0,
          }}
        >
          {slide.body}
        </p>

        {slide.photoHint && (
          <div style={{ marginTop: 28 }}>
            <FotoArea hint={slide.photoHint} height={240} photoUrl={photoUrl} onPick={onPickPhoto} accent={company.color} />
          </div>
        )}
      </div>

      <Rodape company={company} number={slide.number} total={slide.total} />
    </div>
  );
}

/* ---------- ACAO: inversao total — slide vermelho ---------- */
function AcaoInvertida({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div
      style={{
        ...BASE,
        background: `linear-gradient(150deg, ${RED} 0%, #b8121a 100%)`,
        padding: "80px 80px 120px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <CornerMarks color="rgba(0,0,0,0.3)" />
      {/* Monograma fantasma */}
      <span
        style={{
          position: "absolute",
          bottom: -40,
          right: 24,
          fontSize: 380,
          fontWeight: 900,
          color: "rgba(0,0,0,0.14)",
          lineHeight: 1,
        }}
      >
        PR
      </span>

      <span
        style={{
          background: "#0a0a0a",
          color: "#fff",
          alignSelf: "flex-start",
          padding: "10px 22px",
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        O que EU faria
      </span>

      <div style={{ position: "relative", marginTop: 36 }}>
        {slide.heading && (
          <h2
            style={{
              color: "#fff",
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              textTransform: "uppercase",
              margin: 0,
              maxWidth: 880,
            }}
          >
            {slide.heading}
          </h2>
        )}
        <p style={{ color: "rgba(255,255,255,0.94)", fontSize: 31, fontWeight: 500, lineHeight: 1.55, marginTop: 28, maxWidth: 860 }}>
          {slide.body}
        </p>

        {slide.photoHint && (
          <div style={{ marginTop: 28 }}>
            <FotoArea hint={slide.photoHint} height={240} photoUrl={photoUrl} onPick={onPickPhoto} accent="#ffffff" />
          </div>
        )}
      </div>

      <Rodape company={company} number={slide.number} total={slide.total} dark />
    </div>
  );
}

/* ---------- LICAO: fecho emoldurado ---------- */
function LicaoFecho({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div
      style={{
        ...BASE,
        background: "#0a0a0a",
        padding: 56,
      }}
    >
      {/* Moldura dupla: vermelho do Pedro + cor da empresa */}
      <div
        style={{
          position: "absolute",
          inset: 40,
          border: `3px solid ${RED}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 54,
          border: `1px solid ${company.color}`,
        }}
      />

      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "0 90px",
        }}
      >
        <span
          style={{
            background: RED,
            color: "#fff",
            padding: "9px 24px",
            fontSize: 21,
            fontWeight: 900,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 36,
          }}
        >
          A LIÇÃO
        </span>

        {slide.heading && (
          <h2
            style={{
              color: "#fff",
              fontSize: 50,
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: "-0.015em",
              textTransform: "uppercase",
              margin: 0,
              maxWidth: 840,
            }}
          >
            {slide.heading}
          </h2>
        )}
        {slide.body && (
          <p style={{ color: "#c9c9c9", fontSize: 30, fontWeight: 400, lineHeight: 1.55, marginTop: 26, maxWidth: 780 }}>
            {slide.body}
          </p>
        )}

        {slide.photoHint && (
          <div style={{ marginTop: 28, width: "100%", maxWidth: 700 }}>
            <FotoArea hint={slide.photoHint} height={220} photoUrl={photoUrl} onPick={onPickPhoto} accent={company.color} />
          </div>
        )}

        <div style={{ display: "flex", gap: 18, marginTop: 44 }}>
          <span style={{ background: RED, color: "#fff", padding: "14px 36px", borderRadius: 10, fontSize: 23, fontWeight: 800 }}>
            💾 SALVAR
          </span>
          <span
            style={{
              border: `2px solid ${company.color}`,
              color: company.color,
              padding: "14px 36px",
              borderRadius: 10,
              fontSize: 23,
              fontWeight: 800,
            }}
          >
            ↗ COMPARTILHAR
          </span>
        </div>

        <span style={{ position: "absolute", bottom: 34, color: "#666", fontSize: 20, fontWeight: 700, letterSpacing: "0.1em" }}>
          @pedrorabelo · CASE {company.name.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
