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

export interface CompanyBrand {
  name: string;
  color: string;
  domain: string | null;
}

export interface ParsedCarousel {
  slides: string[];
  hook: string;
  cta: string;
  /**
   * Hints de FOTO REAL por posicao, alinhados com a sequencia final do
   * carrossel: [capa, ...slides, cta]. null = slide sem foto.
   */
  photoHints: (string | null)[];
  /**
   * Identidade da empresa analisada (tipo case_empresa): vem do marcador
   * [MARCA: Nome | #cor | dominio.com] na primeira linha da resposta da IA.
   * Usada pra fundir a cara do Pedro com a da empresa no design.
   */
  companyBrand: CompanyBrand | null;
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
function withPhotos(
  hook: string,
  slides: string[],
  cta: string,
  brand: CompanyBrand | null = null
): ParsedCarousel {
  const h = extractPhoto(hook);
  const s = slides.map(extractPhoto);
  const c = extractPhoto(cta);
  return {
    hook: h.text,
    slides: s.map((x) => x.text),
    cta: c.text,
    photoHints: [h.hint, ...s.map((x) => x.hint), c.hint],
    companyBrand: brand,
  };
}

const MARCA_RE =
  /\[\s*MARCA:\s*([^|\]]+)\|\s*(#[0-9a-fA-F]{3,8})\s*(?:\|\s*([^\]]+))?\]/;

/** Extrai (e remove) o marcador de identidade da empresa, se presente. */
function extractCompanyBrand(content: string): {
  content: string;
  brand: CompanyBrand | null;
} {
  const m = content.match(MARCA_RE);
  if (!m) return { content, brand: null };
  return {
    content: content.replace(MARCA_RE, "").trim(),
    brand: {
      name: m[1].trim(),
      color: m[2].trim(),
      domain: m[3]?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null,
    },
  };
}

export function parseCarouselSlides(rawContent: string): ParsedCarousel {
  // 0) Identidade da empresa (case_empresa) — marcador na primeira linha
  const { content, brand } = extractCompanyBrand(rawContent);

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
      slideParts[slideParts.length - 1],
      brand
    );
  }

  // 3) Fallback legado: separadores "---" ou itens numerados "1.", "2." ...
  const parts = slidesSection
    .split(/---|\n\n(?=\d+\.)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return withPhotos(parts[0], parts.slice(1, -1), parts[parts.length - 1], brand);
  }

  // 4) Ultimo recurso: paragrafos.
  const lines = slidesSection.split(/\n\n+/).filter((s) => s.trim());
  return withPhotos(
    (lines[0] || "").trim(),
    lines.slice(1, -1).map((s) => s.trim()),
    (lines[lines.length - 1] || "").trim(),
    brand
  );
}
