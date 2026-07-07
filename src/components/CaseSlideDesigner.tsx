"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Download, ChevronLeft, ChevronRight, Loader2, FileText } from "lucide-react";

/**
 * Template CARD EDITORIAL — design exclusivo do "Case de Empresa".
 * Fundo BRANCO proposital: todos os outros posts do app sao pretos; este
 * destaca no feed. Manchete em BEBAS NEUE (a fonte de titulos do site do
 * Pedro), detalhes em vermelho da marca e seta de swipe em todo slide menos
 * o ultimo. Registro por papel ([TIPO: ...]):
 *   capa     → manchete gigante + isca + foto com moldura fina + logo
 *   historia → desenvolvimento: kicker "O CASO", manchete, corpo, foto
 *   analise  → "A LEITURA DO PEDRO": barra vermelha + tese
 *   ponte    → "E A SUA EMPRESA?": fundo creme, conecta o case ao leitor
 *   fecho    → "A LICAO" + fecho assinado, sem seta
 * Papeis do template anterior (dossie) mapeiam pros novos (origem/virada/
 * contexto→historia, insight/acao→analise, licao→fecho) — cases salvos
 * continuam abrindo. A IA marca **palavras-chave** que viram VERMELHO.
 * Nenhuma imagem e gerada por IA: fotos reais entram nos slots clicaveis.
 */

const RED = "#FF0000";
const BG = "#FDFCF9";
const BG_PONTE = "#F6F1E7";
const INK = "#111111";
const MUTED = "#A39B86";
const HAIR = "#E4DFD3";
/** Fonte de titulos do site do Pedro (carregada no layout como --font-bebas). */
const DISPLAY = "var(--font-bebas), 'Bebas Neue', 'Arial Narrow', sans-serif";

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

type Role = "capa" | "historia" | "analise" | "ponte" | "fecho";

interface CaseSlide {
  role: Role;
  heading?: string;
  body?: string;
  number: number;
  total: number;
  photoHint?: string | null;
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
  if (r === "historia" || r === "analise" || r === "ponte" || r === "fecho" || r === "capa")
    return r as Role;
  // papeis do template anterior (dossie) — mapeiam pro registro novo
  if (r === "origem" || r === "virada" || r === "contexto") return "historia";
  if (r === "insight" || r === "acao") return "analise";
  if (r === "licao") return "fecho";
  return fallback;
}

/** A seta de swipe e do design; remove qualquer "→"/"->" que a IA escreva. */
function stripArrow(text?: string): string | undefined {
  return text?.replace(/\s*(?:→|->)\s*$/g, "").trim() || undefined;
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

  const capa = splitHeading(hook);
  out.push({
    role: "capa",
    heading: stripArrow(capa.heading) ?? stripArrow(capa.body),
    body: capa.heading ? stripArrow(capa.body) : undefined,
    number: 1,
    total,
    photoHint: photoHints[0] ?? null,
  });

  slides.forEach((text, i) => {
    const { heading, body } = splitHeading(text);
    out.push({
      role: normalizeRole(slideRoles[i + 1], "historia"),
      heading: stripArrow(heading),
      body: stripArrow(body),
      number: i + 2,
      total,
      photoHint: photoHints[i + 1] ?? null,
    });
  });

  const fecho = splitHeading(cta);
  out.push({
    role: "fecho",
    heading: stripArrow(fecho.heading),
    body: stripArrow(fecho.body),
    number: total,
    total,
    photoHint: photoHints[slides.length + 1] ?? null,
  });

  return out;
}

/** Renderiza texto com **trechos** em vermelho — o sublinhado do Pedro. */
function RedText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={{ color: RED }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
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
            Case Editorial ({allSlides.length} slides)
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

      <div className="relative overflow-hidden rounded-xl border border-border" style={{ background: BG }}>
        <div className="relative mx-auto" style={{ maxWidth: 400 }}>
          {current > 0 && (
            <button
              onClick={() => setCurrent((p) => Math.max(p - 1, 0))}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm transition hover:bg-black/60"
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
          )}
          {current < allSlides.length - 1 && (
            <button
              onClick={() => setCurrent((p) => Math.min(p + 1, allSlides.length - 1))}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm transition hover:bg-black/60"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          )}

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {allSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === current ? 16 : 6, background: i === current ? RED : "rgba(0,0,0,0.25)" }}
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
      return <CapaCard {...props} />;
    case "analise":
      return <AnaliseCard {...props} />;
    case "ponte":
      return <PonteCard {...props} />;
    case "fecho":
      return <FechoCard {...props} />;
    default:
      return <HistoriaCard {...props} />;
  }
}

const BASE: React.CSSProperties = {
  width: 1080,
  height: 1080,
  position: "relative",
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  overflow: "hidden",
  background: BG,
  padding: "72px 90px 150px",
};

/** Cabecalho estilo "post": selinho vermelho + nome + handle. Sem rosto. */
function PostHeader({ company, showLogo = false }: { company: RenderProps["company"]; showLogo?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ width: 20, height: 20, background: RED, display: "block" }} />
        <span style={{ fontSize: 27, fontWeight: 800, color: INK, letterSpacing: "-0.01em" }}>Pedro Rabelo</span>
        <span style={{ fontSize: 25, fontWeight: 500, color: MUTED }}>@pedrorabelo</span>
        {showLogo && company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt={company.name}
            style={{
              marginLeft: "auto",
              width: 58,
              height: 58,
              objectFit: "contain",
              background: "#fff",
              border: `1px solid ${HAIR}`,
              borderRadius: 10,
              padding: 6,
            }}
          />
        )}
      </div>
      <div style={{ height: 2, background: HAIR, marginTop: 24 }} />
    </div>
  );
}

function Kicker({ children, color = MUTED }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: "block",
        marginTop: 46,
        color,
        fontSize: 21,
        fontWeight: 800,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

/** Rodape: numeracao + seta vermelha de swipe (todo slide menos o ultimo). */
function CardFooter({ slide }: { slide: CaseSlide }) {
  const arrow = slide.number < slide.total;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 52,
        left: 90,
        right: 90,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontFamily: "monospace", fontSize: 22, color: MUTED }}>
        {String(slide.number).padStart(2, "0")}/{String(slide.total).padStart(2, "0")}
      </span>
      {arrow ? (
        <span style={{ color: RED, fontSize: 62, fontWeight: 900, lineHeight: 1 }}>→</span>
      ) : (
        <span style={{ fontSize: 22, fontWeight: 700, color: MUTED, letterSpacing: "0.08em" }}>@pedrorabelo</span>
      )}
    </div>
  );
}

/** Caixa de foto real: moldura fina; vazia mostra a instrucao da IA. */
function FotoArea({
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
          border: `3px solid ${INK}`,
          borderRadius: 4,
          cursor: onPick ? "pointer" : undefined,
          display: "block",
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
        border: `2px solid #C9C2B0`,
        borderRadius: 4,
        background: "#F2EEE3",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        cursor: onPick ? "pointer" : undefined,
      }}
    >
      <span style={{ color: RED, fontSize: 22, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        📷 FOTO
      </span>
      <span style={{ color: "#55503F", fontSize: 24, fontWeight: 600, textAlign: "center", maxWidth: 680, lineHeight: 1.35 }}>
        {hint}
      </span>
      {onPick && <span style={{ color: MUTED, fontSize: 18, fontWeight: 600 }}>Clique para colocar a foto real</span>}
    </div>
  );
}

/* ---------- CAPA: manchete editorial gigante + isca ---------- */
function CapaCard({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={BASE}>
      <PostHeader company={company} showLogo />
      <Kicker color={RED}>Case · {company.name}</Kicker>
      <h1
        style={{
          fontFamily: DISPLAY,
          color: INK,
          fontSize: 92,
          fontWeight: 400,
          lineHeight: 0.98,
          letterSpacing: "0.015em",
          textTransform: "uppercase",
          margin: "20px 0 0",
        }}
      >
        <RedText text={slide.heading || ""} />
      </h1>
      {slide.body && (
        <p style={{ color: "#4A4436", fontSize: 31, fontWeight: 500, lineHeight: 1.5, marginTop: 28, maxWidth: 820 }}>
          <RedText text={slide.body} />
        </p>
      )}
      {slide.photoHint && (
        <div style={{ marginTop: 36 }}>
          <FotoArea hint={slide.photoHint} height={330} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}
      <CardFooter slide={slide} />
    </div>
  );
}

/* ---------- HISTORIA: o desenvolvimento do case ---------- */
function HistoriaCard({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={BASE}>
      <PostHeader company={company} />
      <Kicker>O caso · {company.name}</Kicker>
      {slide.heading && (
        <h2
          style={{
            fontFamily: DISPLAY,
            color: INK,
            fontSize: 64,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "0.015em",
            textTransform: "uppercase",
            margin: "16px 0 0",
            maxWidth: 880,
          }}
        >
          <RedText text={slide.heading} />
        </h2>
      )}
      {slide.body && (
        <p
          style={{
            color: "#3A3529",
            fontSize: 29,
            fontWeight: 400,
            lineHeight: 1.62,
            marginTop: 26,
            maxWidth: 860,
            whiteSpace: "pre-line",
          }}
        >
          <RedText text={slide.body} />
        </p>
      )}
      {slide.photoHint && (
        <div style={{ marginTop: 30 }}>
          <FotoArea hint={slide.photoHint} height={280} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}
      <CardFooter slide={slide} />
    </div>
  );
}

/* ---------- ANALISE: a leitura do Pedro ---------- */
function AnaliseCard({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={BASE}>
      <PostHeader company={company} />
      <Kicker color={RED}>A leitura do Pedro</Kicker>
      <div style={{ borderLeft: `8px solid ${RED}`, paddingLeft: 36, marginTop: 26 }}>
        {slide.heading && (
          <h2
            style={{
              fontFamily: DISPLAY,
              color: INK,
              fontSize: 62,
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: "0.015em",
              textTransform: "uppercase",
              margin: 0,
              maxWidth: 840,
            }}
          >
            <RedText text={slide.heading} />
          </h2>
        )}
        {slide.body && (
          <p
            style={{
              color: "#3A3529",
              fontSize: 29,
              fontWeight: 400,
              lineHeight: 1.62,
              marginTop: 26,
              maxWidth: 820,
              whiteSpace: "pre-line",
            }}
          >
            <RedText text={slide.body} />
          </p>
        )}
        {slide.photoHint && (
          <div style={{ marginTop: 28 }}>
            <FotoArea hint={slide.photoHint} height={240} photoUrl={photoUrl} onPick={onPickPhoto} />
          </div>
        )}
      </div>
      <CardFooter slide={slide} />
    </div>
  );
}

/* ---------- PONTE: a virada — conecta o case ao leitor ---------- */
function PonteCard({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={{ ...BASE, background: BG_PONTE }}>
      <PostHeader company={company} />
      <Kicker color={RED}>E a sua empresa?</Kicker>
      {slide.heading && (
        <h2
          style={{
            fontFamily: DISPLAY,
            color: INK,
            fontSize: 70,
            fontWeight: 400,
            lineHeight: 0.98,
            letterSpacing: "0.015em",
            textTransform: "uppercase",
            margin: "18px 0 0",
            maxWidth: 880,
          }}
        >
          <RedText text={slide.heading} />
        </h2>
      )}
      {slide.body && (
        <p
          style={{
            color: "#3A3529",
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.6,
            marginTop: 28,
            maxWidth: 840,
            whiteSpace: "pre-line",
          }}
        >
          <RedText text={slide.body} />
        </p>
      )}
      {slide.photoHint && (
        <div style={{ marginTop: 28 }}>
          <FotoArea hint={slide.photoHint} height={240} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}
      <CardFooter slide={slide} />
    </div>
  );
}

/* ---------- FECHO: a licao + assinatura, sem seta ---------- */
function FechoCard({ slide, company, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={BASE}>
      <PostHeader company={company} />
      <Kicker color={RED}>A lição</Kicker>
      {slide.heading && (
        <h2
          style={{
            fontFamily: DISPLAY,
            color: INK,
            fontSize: 66,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "0.015em",
            textTransform: "uppercase",
            margin: "18px 0 0",
            maxWidth: 860,
          }}
        >
          <RedText text={slide.heading} />
        </h2>
      )}
      {slide.body && (
        <p
          style={{
            color: "#3A3529",
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.6,
            marginTop: 28,
            maxWidth: 840,
            whiteSpace: "pre-line",
          }}
        >
          <RedText text={slide.body} />
        </p>
      )}
      {slide.photoHint && (
        <div style={{ marginTop: 28 }}>
          <FotoArea hint={slide.photoHint} height={220} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 44 }}>
        <span style={{ width: 64, height: 3, background: RED, display: "block" }} />
        <span style={{ fontFamily: DISPLAY, fontSize: 32, letterSpacing: "0.06em", color: "#3A3529" }}>Pedro Rabelo</span>
      </div>
      <CardFooter slide={slide} />
    </div>
  );
}
