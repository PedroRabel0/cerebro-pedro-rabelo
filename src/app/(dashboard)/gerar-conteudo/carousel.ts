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
 * O parser antigo dividia por /---|\n\n(?=\d+\.)/: o "---" de "---LEGENDA---"
 * fazia a capa virar TODOS os slides concatenados, os slides virarem a palavra
 * "LEGENDA" e o cta virar a legenda. Este parser segue o formato do prompt,
 * com fallbacks para conteudos antigos/fora do padrao.
 */

export interface ParsedCarousel {
  slides: string[];
  hook: string;
  cta: string;
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
    return {
      hook: slideParts[0],
      slides: slideParts.slice(1, -1),
      cta: slideParts[slideParts.length - 1],
    };
  }

  // 3) Fallback legado: separadores "---" ou itens numerados "1.", "2." ...
  const parts = slidesSection
    .split(/---|\n\n(?=\d+\.)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      hook: parts[0],
      slides: parts.slice(1, -1),
      cta: parts[parts.length - 1],
    };
  }

  // 4) Ultimo recurso: paragrafos.
  const lines = slidesSection.split(/\n\n+/).filter((s) => s.trim());
  return {
    hook: (lines[0] || "").trim(),
    slides: lines.slice(1, -1).map((s) => s.trim()),
    cta: (lines[lines.length - 1] || "").trim(),
  };
}
