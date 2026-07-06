/**
 * Parser do texto de carrossel gerado pela IA — compartilhado entre
 * GenerationWizard e ContentList (antes: duplicado e quebrado nos dois).
 *
 * O prompt do wizard pede o formato:
 *   SLIDE 1: <capa>
 *   SLIDE 2: <conteudo>
 *   ...
 *   ---LEGENDA---
 *   <legenda do post>
 *
 * O tipo "case_empresa" adiciona marcadores de FOTO REAL por slide:
 *   [FOTO: fachada da loja]
 * — a IA NAO gera imagem; o marcador vira um slot no SlideDesigner para o
 * Pedro encaixar a foto real dele.
 *
 * O parser antigo dividia por /---|\n\n(?=\d+\.)/: o "---" de "---LEGENDA---"
 * fazia a capa virar TODOS os slides concatenados, os slides virarem a palavra
 * "LEGENDA" e o cta virar a legenda. Este parser segue o formato do prompt,
 * com fallbacks para conteudos antigos/fora do padrao.
 */

export interface ParsedCarousel {
  slides: string[];
  hook: string;
  cta: string;
  /**
   * Hints de FOTO REAL por posicao, alinhados com a sequencia final do
   * carrossel: [capa, ...slides, cta]. null = slide sem foto.
   */
  photoHints: (string | null)[];
}

const FOTO_RE = /\[\s*FOTO:\s*([^\]]+)\]/i;

/** Extrai (e remove do texto) o marcador [FOTO: ...] de um slide. */
function extractPhoto(text: string): { text: string; hint: string | null } {
  const m = text.match(FOTO_RE);
  if (!m) return { text: text.trim(), hint: null };
  return {
    text: text.replace(FOTO_RE, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    hint: m[1].trim(),
  };
}

/** Monta o resultado final extraindo os hints de foto de cada posicao. */
function withPhotos(hook: string, slides: string[], cta: string): ParsedCarousel {
  const h = extractPhoto(hook);
  const s = slides.map(extractPhoto);
  const c = extractPhoto(cta);
  return {
    hook: h.text,
    slides: s.map((x) => x.text),
    cta: c.text,
    photoHints: [h.hint, ...s.map((x) => x.hint), c.hint],
  };
}

export function parseCarouselSlides(content: string): ParsedCarousel {
  // 1) Separa a legenda — ela e a descricao do post, NAO um slide.
  const [slidesSection] = content.split(/-{2,}\s*LEGENDA\s*-{2,}/i);

  // 2) Formato canonico do prompt: "SLIDE 1:", "**SLIDE 2 - CAPA:**",
  //    "[SLIDE 3]" etc. Primeiro slide = capa (hook), ultimo = CTA.
  const slideParts = slidesSection
    .split(/\*{0,2}\[?\s*SLIDE\s+\d+[^\n:\]]*\]?\s*:?\*{0,2}/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (slideParts.length >= 2) {
    return withPhotos(
      slideParts[0],
      slideParts.slice(1, -1),
      slideParts[slideParts.length - 1]
    );
  }

  // 3) Fallback legado: separadores "---" ou itens numerados "1.", "2." ...
  const parts = slidesSection
    .split(/---|\n\n(?=\d+\.)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return withPhotos(parts[0], parts.slice(1, -1), parts[parts.length - 1]);
  }

  // 4) Ultimo recurso: paragrafos.
  const lines = slidesSection.split(/\n\n+/).filter((s) => s.trim());
  return withPhotos(
    (lines[0] || "").trim(),
    lines.slice(1, -1).map((s) => s.trim()),
    (lines[lines.length - 1] || "").trim()
  );
}
