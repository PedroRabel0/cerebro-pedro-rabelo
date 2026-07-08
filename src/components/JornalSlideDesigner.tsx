"use client";

import { useRef, useState, useCallback } from "react";
import { Download, ChevronLeft, ChevronRight, Loader2, Newspaper } from "lucide-react";

/**
 * Template DIÁRIO DO INVESTIDOR — o quadro de jornal do formato Atualidades
 * ("O que está rolando"). Pedro como âncora-colunista: a redação dá o FATO
 * e o colunista assina a OPINIÃO. Estética de jornal impresso:
 *   - papel-jornal claro (destaca no feed preto), tinta preta, vermelho #FF0000
 *   - masthead em letra GÓTICA (logotipo do jornal), manchete em serif de
 *     jornal (Playfair), texto em serif de leitura (Lora)
 *   - filetes duplos, tarja URGENTE, carimbo OPINIÃO, fotolegenda, bordão
 * Papeis ([TIPO: ...]): capa, fato, opiniao, ponte, fecho (legados mapeiam).
 * Nenhuma imagem e gerada por IA: foto real entra no slot clicavel da capa.
 */

const RED = "#FF0000";
const PAPEL = "#F7F2E5";
const INK = "#151310";
const CINZA = "#5C5648";
const FILETE = "#151310";
const MASTHEAD = "var(--font-jornal-masthead), 'Pirata One', Georgia, serif";
const MANCHETE = "var(--font-jornal-manchete), 'Playfair Display', Georgia, serif";
const TEXTO = "var(--font-jornal-texto), 'Lora', Georgia, serif";

const NOME_JORNAL = "Diário do Investidor";
const BORDAO = "Você leu aqui primeiro.";

interface JornalSlideDesignerProps {
  slides: string[];
  hook: string;
  cta: string;
  title: string;
  photoHints?: (string | null)[];
  slideRoles?: (string | null)[];
  /** Credito da noticia ("veiculo — url", da linha FONTE do content_text) */
  fonte?: string | null;
  /** Data do post (ISO); default = hoje */
  dataPost?: string | null;
  /** Tema/editoria exibido na capa (ex.: "IA", "Startups") */
  tema?: string | null;
}

type Role = "capa" | "fato" | "opiniao" | "ponte" | "fecho";

interface JornalSlide {
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
  if (r === "fato" || r === "opiniao" || r === "ponte" || r === "fecho" || r === "capa")
    return r as Role;
  // papeis dos outros templates mapeiam pro registro de jornal
  if (r === "historia" || r === "contexto" || r === "origem" || r === "virada") return "fato";
  if (r === "analise" || r === "insight" || r === "acao") return "opiniao";
  if (r === "licao") return "fecho";
  return fallback;
}

function stripArrow(text?: string): string | undefined {
  return text?.replace(/\s*(?:→|->)\s*$/g, "").trim() || undefined;
}

function buildSlides(
  slides: string[],
  hook: string,
  cta: string,
  photoHints: (string | null)[],
  slideRoles: (string | null)[]
): JornalSlide[] {
  const total = slides.length + 2;
  const out: JornalSlide[] = [];

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
      role: normalizeRole(slideRoles[i + 1], "fato"),
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
    photoHint: null,
  });

  return out;
}

/** Renderiza texto com **trechos** em vermelho — o grifo do Pedro. */
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

function formatarData(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const txt = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(isNaN(d.getTime()) ? new Date() : d);
  return txt.toUpperCase();
}

export default function JornalSlideDesigner({
  slides,
  hook,
  cta,
  title,
  photoHints = [],
  slideRoles = [],
  fonte = null,
  dataPost = null,
  tema = null,
}: JornalSlideDesignerProps) {
  const [current, setCurrent] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [slidePhotos, setSlidePhotos] = useState<Record<number, string>>({});
  const pendingPhotoIndex = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const allSlides = buildSlides(slides, hook, cta, photoHints, slideRoles);
  const dataEdicao = formatarData(dataPost);
  const temaEdicao = (tema || title || "").trim();

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
    const el = document.getElementById(`jornal-slide-render-${index}`);
    if (!el) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        width: 1080,
        height: 1080,
        pixelRatio: 2, // 2160x2160 — nitidez cheia pro Instagram/retina
        cacheBust: true,
        style: { transform: "scale(1)", transformOrigin: "top left", width: "1080px", height: "1080px" },
      });
      const link = document.createElement("a");
      link.download = `diario-slide-${index + 1}.png`;
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
        const el = document.getElementById(`jornal-slide-render-${i}`);
        if (!el) continue;
        const dataUrl = await toPng(el, {
          width: 1080,
          height: 1080,
          pixelRatio: 2,
          cacheBust: true,
          style: { transform: "scale(1)", transformOrigin: "top left", width: "1080px", height: "1080px" },
        });
        const link = document.createElement("a");
        link.download = `diario-slide-${i + 1}.png`;
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
          <Newspaper className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            Diário do Investidor ({allSlides.length} slides)
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

      <div className="relative overflow-hidden rounded-xl border border-border" style={{ background: PAPEL }}>
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
              <SlideRenderer
                slide={allSlides[current]}
                fonte={fonte}
                data={dataEdicao}
                tema={temaEdicao}
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
          <div key={i} id={`jornal-slide-render-${i}`}>
            <SlideRenderer
              slide={slide}
              fonte={fonte}
              data={dataEdicao}
              tema={temaEdicao}
              photoUrl={slidePhotos[i]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================ RENDERERS ============================

interface RenderProps {
  slide: JornalSlide;
  fonte: string | null;
  data: string;
  tema: string;
  photoUrl?: string;
  onPickPhoto?: () => void;
}

function SlideRenderer(props: RenderProps) {
  switch (props.slide.role) {
    case "capa":
      return <CapaJornal {...props} />;
    case "opiniao":
      return <OpiniaoColuna {...props} />;
    case "ponte":
      return <PonteJornal {...props} />;
    case "fecho":
      return <FechoJornal {...props} />;
    default:
      return <FatoColuna {...props} />;
  }
}

const BASE: React.CSSProperties = {
  width: 1080,
  height: 1080,
  position: "relative",
  fontFamily: TEXTO,
  overflow: "hidden",
  background: PAPEL,
  padding: "56px 84px 140px",
  color: INK,
};

/** Filete duplo classico de jornal (grosso + fino). */
function FileteDuplo({ margem = 0 }: { margem?: number }) {
  return (
    <div style={{ marginTop: margem, marginBottom: 0 }}>
      <div style={{ height: 5, background: FILETE }} />
      <div style={{ height: 1.5, background: FILETE, marginTop: 5 }} />
    </div>
  );
}

/** Cabecalho compacto das paginas internas: nome gotico + secao. */
function MastheadCompacto({ secao, data }: { secao: string; data: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontFamily: MASTHEAD, fontSize: 42, color: INK, lineHeight: 1 }}>
          {NOME_JORNAL}
        </span>
        <span style={{ fontFamily: TEXTO, fontSize: 19, letterSpacing: "0.14em", color: CINZA }}>
          {data}
        </span>
      </div>
      <FileteDuplo margem={16} />
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 0,
          borderBottom: `1.5px solid ${FILETE}`,
          padding: "10px 0",
        }}
      >
        <span
          style={{
            fontFamily: TEXTO,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: INK,
          }}
        >
          {secao}
        </span>
      </div>
    </div>
  );
}

/** Rodape de jornal: quadro + paginacao + continua. */
function RodapeJornal({ slide }: { slide: JornalSlide }) {
  const ultima = slide.number >= slide.total;
  return (
    <div style={{ position: "absolute", bottom: 48, left: 84, right: 84 }}>
      <div style={{ height: 1.5, background: FILETE }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 14,
        }}
      >
        <span style={{ fontFamily: MASTHEAD, fontSize: 26, color: INK }}>{NOME_JORNAL}</span>
        <span style={{ fontFamily: TEXTO, fontSize: 19, letterSpacing: "0.18em", color: CINZA }}>
          PÁG. {String(slide.number).padStart(2, "0")}/{String(slide.total).padStart(2, "0")}
        </span>
        {ultima ? (
          <span style={{ fontFamily: TEXTO, fontSize: 19, letterSpacing: "0.1em", color: CINZA }}>
            @pedrorabelo ■
          </span>
        ) : (
          <span style={{ fontFamily: TEXTO, fontStyle: "italic", fontSize: 20, color: RED }}>
            continua →
          </span>
        )}
      </div>
    </div>
  );
}

/** Fotolegenda: foto com moldura fina + legenda; vazia = slot com instrucao. */
function FotoLegenda({
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
  return (
    <div>
      {photoUrl ? (
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
            cursor: onPick ? "pointer" : undefined,
            display: "block",
          }}
        />
      ) : (
        <div
          onClick={onPick}
          style={{
            width: "100%",
            height,
            border: `2px solid ${INK}`,
            background: "#EFE9D8",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            cursor: onPick ? "pointer" : undefined,
          }}
        >
          <span style={{ color: RED, fontSize: 21, fontWeight: 700, letterSpacing: "0.16em", fontFamily: TEXTO }}>
            📷 FOTO
          </span>
          <span
            style={{
              color: CINZA,
              fontSize: 23,
              fontFamily: TEXTO,
              fontStyle: "italic",
              textAlign: "center",
              maxWidth: 680,
              lineHeight: 1.35,
            }}
          >
            {hint}
          </span>
          {onPick && (
            <span style={{ color: "#8d8672", fontSize: 18, fontFamily: TEXTO }}>
              clique para colocar a foto real
            </span>
          )}
        </div>
      )}
      <p
        style={{
          margin: "10px 0 0",
          fontFamily: TEXTO,
          fontStyle: "italic",
          fontSize: 19,
          color: CINZA,
          borderBottom: `1px solid ${CINZA}`,
          paddingBottom: 8,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

/* ---------- CAPA: primeira pagina do jornal ---------- */
function CapaJornal({ slide, data, tema, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={BASE}>
      {/* Masthead completo */}
      <div style={{ textAlign: "center" }}>
        <div style={{ height: 1.5, background: FILETE }} />
        <h1
          style={{
            fontFamily: MASTHEAD,
            fontSize: 92,
            fontWeight: 400,
            color: INK,
            margin: "10px 0 6px",
            lineHeight: 1,
          }}
        >
          {NOME_JORNAL}
        </h1>
        <div style={{ height: 1.5, background: FILETE }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 4px",
            fontFamily: TEXTO,
            fontSize: 18,
            letterSpacing: "0.1em",
            color: CINZA,
            textTransform: "uppercase",
          }}
        >
          <span>{data}</span>
          <span>POR PEDRO RABELO</span>
          <span>R$ 0,00 · GRÁTIS PRA QUEM CONSTRÓI</span>
        </div>
        <FileteDuplo />
      </div>

      {/* Tarja urgente + editoria */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26 }}>
        <span
          style={{
            background: RED,
            color: "#fff",
            padding: "7px 18px",
            fontFamily: TEXTO,
            fontWeight: 600,
            fontSize: 21,
            letterSpacing: "0.24em",
          }}
        >
          URGENTE
        </span>
        {tema && (
          <span
            style={{
              border: `2px solid ${INK}`,
              padding: "5px 16px",
              fontFamily: TEXTO,
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: INK,
            }}
          >
            {tema}
          </span>
        )}
      </div>

      {/* Manchete */}
      <h2
        style={{
          fontFamily: MANCHETE,
          fontWeight: 900,
          fontSize: 78,
          lineHeight: 1.04,
          letterSpacing: "-0.01em",
          color: INK,
          margin: "22px 0 0",
        }}
      >
        <RedText text={slide.heading || ""} />
      </h2>

      {/* Sublead */}
      {slide.body && (
        <p
          style={{
            fontFamily: TEXTO,
            fontStyle: "italic",
            fontSize: 28,
            lineHeight: 1.45,
            color: "#3E382C",
            margin: "18px 0 0",
            maxWidth: 860,
          }}
        >
          <RedText text={slide.body} />
        </p>
      )}

      {/* Fotolegenda */}
      {slide.photoHint && (
        <div style={{ marginTop: 26 }}>
          <FotoLegenda hint={slide.photoHint} height={300} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}

      <RodapeJornal slide={slide} />
    </div>
  );
}

/* ---------- O FATO: coluna de noticia ---------- */
function FatoColuna({ slide, fonte, data, photoUrl, onPickPhoto }: RenderProps) {
  return (
    <div style={BASE}>
      <MastheadCompacto secao="O FATO" data={data} />
      {slide.heading && (
        <h2
          style={{
            fontFamily: MANCHETE,
            fontWeight: 800,
            fontSize: 52,
            lineHeight: 1.1,
            color: INK,
            margin: "30px 0 0",
          }}
        >
          <RedText text={slide.heading} />
        </h2>
      )}
      {slide.body && (
        <p
          style={{
            fontFamily: TEXTO,
            fontSize: 29,
            lineHeight: 1.62,
            color: "#2A251B",
            margin: "22px 0 0",
            whiteSpace: "pre-line",
          }}
        >
          <RedText text={slide.body} />
        </p>
      )}
      {slide.photoHint && (
        <div style={{ marginTop: 24 }}>
          <FotoLegenda hint={slide.photoHint} height={250} photoUrl={photoUrl} onPick={onPickPhoto} />
        </div>
      )}
      {fonte && (
        <p
          style={{
            fontFamily: TEXTO,
            fontStyle: "italic",
            fontSize: 20,
            color: CINZA,
            margin: "20px 0 0",
          }}
        >
          Fonte: {fonte}
        </p>
      )}
      <RodapeJornal slide={slide} />
    </div>
  );
}

/* ---------- OPINIÃO: a coluna assinada do Pedro ---------- */
function OpiniaoColuna({ slide, data }: RenderProps) {
  return (
    <div style={BASE}>
      <MastheadCompacto secao="OPINIÃO" data={data} />

      {/* Byline do colunista */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26 }}>
        <span
          style={{
            border: `3px solid ${RED}`,
            color: RED,
            padding: "6px 16px",
            fontFamily: TEXTO,
            fontWeight: 600,
            fontSize: 20,
            letterSpacing: "0.2em",
          }}
        >
          OPINIÃO
        </span>
        <span style={{ fontFamily: TEXTO, fontStyle: "italic", fontSize: 23, color: CINZA }}>
          por Pedro Rabelo
        </span>
      </div>

      {/* Aspas gigantes de coluna */}
      <span
        style={{
          position: "absolute",
          right: 64,
          top: 190,
          fontFamily: MANCHETE,
          fontSize: 260,
          lineHeight: 1,
          color: "rgba(255,0,0,0.10)",
          fontWeight: 900,
        }}
      >
        &ldquo;
      </span>

      {slide.heading && (
        <h2
          style={{
            fontFamily: MANCHETE,
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: 50,
            lineHeight: 1.12,
            color: INK,
            margin: "24px 0 0",
            maxWidth: 860,
          }}
        >
          <RedText text={slide.heading} />
        </h2>
      )}
      {slide.body && (
        <p
          style={{
            fontFamily: TEXTO,
            fontSize: 29,
            lineHeight: 1.62,
            color: "#2A251B",
            margin: "22px 0 0",
            whiteSpace: "pre-line",
            maxWidth: 880,
          }}
        >
          <RedText text={slide.body} />
        </p>
      )}
      <RodapeJornal slide={slide} />
    </div>
  );
}

/* ---------- E O SEU NEGÓCIO?: caixa de servico ---------- */
function PonteJornal({ slide, data }: RenderProps) {
  return (
    <div style={BASE}>
      <MastheadCompacto secao="E O SEU NEGÓCIO?" data={data} />
      <div
        style={{
          border: `3px solid ${INK}`,
          outline: `1.5px solid ${INK}`,
          outlineOffset: 6,
          padding: "44px 48px",
          marginTop: 40,
        }}
      >
        {slide.heading && (
          <h2
            style={{
              fontFamily: MANCHETE,
              fontWeight: 800,
              fontSize: 50,
              lineHeight: 1.1,
              color: INK,
              margin: 0,
            }}
          >
            <RedText text={slide.heading} />
          </h2>
        )}
        {slide.body && (
          <p
            style={{
              fontFamily: TEXTO,
              fontSize: 29,
              lineHeight: 1.6,
              color: "#2A251B",
              margin: "20px 0 0",
              whiteSpace: "pre-line",
            }}
          >
            <RedText text={slide.body} />
          </p>
        )}
      </div>
      <RodapeJornal slide={slide} />
    </div>
  );
}

/* ---------- FECHO: expediente + bordao ---------- */
function FechoJornal({ slide, data }: RenderProps) {
  return (
    <div style={BASE}>
      <MastheadCompacto secao="EXPEDIENTE" data={data} />
      {slide.heading && (
        <h2
          style={{
            fontFamily: MANCHETE,
            fontWeight: 800,
            fontSize: 48,
            lineHeight: 1.12,
            color: INK,
            margin: "34px 0 0",
          }}
        >
          <RedText text={slide.heading} />
        </h2>
      )}
      {slide.body && (
        <p
          style={{
            fontFamily: TEXTO,
            fontSize: 29,
            lineHeight: 1.6,
            color: "#2A251B",
            margin: "20px 0 0",
            whiteSpace: "pre-line",
          }}
        >
          <RedText text={slide.body} />
        </p>
      )}

      {/* Bordao do quadro */}
      <div style={{ marginTop: 46, textAlign: "center" }}>
        <FileteDuplo />
        <p
          style={{
            fontFamily: MASTHEAD,
            fontSize: 58,
            color: RED,
            margin: "26px 0 0",
            lineHeight: 1.1,
          }}
        >
          {BORDAO}
        </p>
        <p
          style={{
            fontFamily: TEXTO,
            fontSize: 21,
            letterSpacing: "0.22em",
            color: INK,
            margin: "16px 0 0",
            textTransform: "uppercase",
          }}
        >
          Pedro Rabelo · @pedrorabelo
        </p>
      </div>
      <RodapeJornal slide={slide} />
    </div>
  );
}
