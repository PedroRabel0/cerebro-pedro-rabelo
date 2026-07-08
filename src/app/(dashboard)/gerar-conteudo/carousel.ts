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
  /**
   * Papel de cada slide (marcador [TIPO: origem|virada|insight|acao|licao],
   * mais "contexto" legado), alinhado com [capa, ...slides, cta]. O template
   * dossie do case escolhe o LAYOUT pelo papel. null = sem papel declarado.
   */
  slideRoles: (string | null)[];
  /**
   * Credito da noticia (posts de Atualidades): conteudo da linha
   * "FONTE: veiculo — url" do topo do content_text. O template de jornal
   * exibe como credito; null nos demais formatos.
   */
  fonte: string | null;
}

const FOTO_RE = /\[\s*FOTO:\s*([^\]]+)\]/i;
const TIPO_RE = /\[\s*TIPO:\s*([a-zA-Z_]+)\s*\]/i;

/** Extrai (e remove do texto) os marcadores [FOTO: ...] e [TIPO: ...] de um slide. */
function extractPhoto(text: string): {
  text: string;
  hint: string | null;
  role: string | null;
} {
  const mFoto = text.match(FOTO_RE);
  const mTipo = text.match(TIPO_RE);
  let clean = text;
  if (mFoto) clean = clean.replace(FOTO_RE, " ");
  if (mTipo) clean = clean.replace(TIPO_RE, " ");
  clean = clean.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    text: clean,
    hint: mFoto ? mFoto[1].trim() : null,
    role: mTipo ? mTipo[1].trim().toLowerCase() : null,
  };
}

/** Monta o resultado final extraindo os hints de foto de cada posicao. */
function withPhotos(
  hook: string,
  slides: string[],
  cta: string,
  brand: CompanyBrand | null = null,
  fonte: string | null = null
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
    slideRoles: [h.role ?? "capa", ...s.map((x) => x.role), c.role ?? "licao"],
    fonte,
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

const DESIGN_RE = /-{2,}\s*PROMPT DE DESIGN\s*-{2,}/i;
const LEGENDA_RE = /-{2,}\s*LEGENDA\s*-{2,}/i;

/**
 * Extrai SO a legenda do post a partir do content_text salvo — e o que a
 * area de legenda do card (e o "Copiar legenda") deve mostrar:
 * - corta o bloco "---PROMPT DE DESIGN---" (registros antigos salvavam o
 *   prompt grudado na legenda);
 * - em carrossel/case (texto com "---LEGENDA---"), devolve so o que vem
 *   DEPOIS do marcador (os slides ficam pro design, nao pra legenda).
 */
export function extractCaption(contentText: string | null): string {
  if (!contentText) return "";
  const semDesign = contentText.split(DESIGN_RE)[0];
  const parts = semDesign.split(LEGENDA_RE);
  return (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
}

/**
 * Registros antigos (frase/educativo) salvaram o prompt de design DENTRO do
 * content_text. Devolve esse bloco (para o painel "Ver Prompt") ou null.
 */
export function extractLegacyDesignPrompt(contentText: string | null): string | null {
  if (!contentText) return null;
  const parts = contentText.split(DESIGN_RE);
  if (parts.length < 2) return null;
  const block = parts.slice(1).join("\n").trim();
  return block || null;
}

/**
 * Linha "FONTE: veiculo — url" no topo do content_text (posts de
 * Atualidades): e metadado pro Pedro conferir a noticia, nao slide —
 * sem remover, ela viraria a capa do design. O conteudo capturado vira o
 * credito de fonte no template de jornal.
 */
const FONTE_LINE_RE = /^\s*FONTE:\s*([^\n]*)\n+/i;

export function parseCarouselSlides(rawContent: string): ParsedCarousel {
  // 0) Credito da noticia (Atualidades) + identidade da empresa (case)
  const mFonte = rawContent.match(FONTE_LINE_RE);
  const fonte = mFonte?.[1]?.trim() || null;
  const { content, brand } = extractCompanyBrand(rawContent.replace(FONTE_LINE_RE, ""));

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
      brand,
      fonte
    );
  }

  // 3) Fallback legado: separadores "---" ou itens numerados "1.", "2." ...
  const parts = slidesSection
    .split(/---|\n\n(?=\d+\.)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return withPhotos(parts[0], parts.slice(1, -1), parts[parts.length - 1], brand, fonte);
  }

  // 4) Ultimo recurso: paragrafos.
  const lines = slidesSection.split(/\n\n+/).filter((s) => s.trim());
  return withPhotos(
    (lines[0] || "").trim(),
    lines.slice(1, -1).map((s) => s.trim()),
    (lines[lines.length - 1] || "").trim(),
    brand,
    fonte
  );
}
