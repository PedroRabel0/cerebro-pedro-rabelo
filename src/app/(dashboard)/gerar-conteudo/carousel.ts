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

/**
 * Prompt de design DETERMINISTICO do "Case de Empresa" (vai pro "Ver
 * Prompt"): a especificacao COMPLETA do card editorial claro — fontes
 * nomeadas, cores por elemento e MEDIDAS no canvas de 1080px — + o conteudo
 * dos slides. Pronto pra colar no Claude Design, igual ao fluxo do DIARIO
 * DO INVESTIDOR (Atualidades). Fundo CLARO proposital: todos os outros
 * posts do app sao pretos; o case destaca no feed.
 *
 * Puro e sem IA de proposito: roda no servidor (geracao/ajuste) E no
 * cliente, dando "Ver Prompt" aos cases salvos ANTES desta funcao existir
 * (sem image_prompt no banco). Devolve null se o texto nao tem a estrutura
 * de SLIDEs (registros antigos fora do padrao).
 */
export function buildCaseDesignPrompt(contentText: string | null): string | null {
  if (!contentText) return null;
  const { content, brand } = extractCompanyBrand(
    contentText.replace(FONTE_LINE_RE, "")
  );
  const slidesSection = content.split(LEGENDA_RE)[0].trim();
  if (!slidesSection || !/SLIDE\s*\d/i.test(slidesSection)) return null;
  const empresa = brand?.name || "a empresa analisada";

  return `Crie um carrossel de Instagram — um CASE DE EMPRESA analisado pelo Pedro Rabelo (${empresa}), no template CARD EDITORIAL CLARO dele. REPRODUZA EXATAMENTE a especificacao abaixo; nao invente outro estilo, nao mude fontes nem cores.

== CANVAS ==
1080x1080px por slide. Padding: 72px no topo, 90px nas laterais, 150px embaixo (area do rodape).

== CORES (exatas) ==
- Fundo: off-white #FDFCF9 em TODOS os slides (nunca escuro), EXCETO o slide da ponte ("E A SUA EMPRESA?"), que usa creme #F6F1E7.
- Titulos: #111111. Texto corrido: #3A3529. Detalhes/cinza: #A39B86. Filetes/linhas: #E4DFD3.
- VERMELHO #FF0000 SOMENTE em: quadradinho do cabecalho, kickers indicados abaixo, palavras destacadas, barra lateral da analise, seta de swipe e traco da assinatura.

== FONTES (exatas; se nao tiver, use a mais proxima e avise) ==
- Titulos e manchetes: "Bebas Neue" (a fonte de titulos do site do Pedro) — SEMPRE MAIUSCULAS, entrelinha ~1.0, espacamento 0.015em.
- Todo o resto (corpo, kickers, rodape): "Inter" (ou sans-serif geometrica proxima). Numeracao do rodape em fonte monoespacada.

== CABECALHO (todos os slides) ==
Quadradinho VERMELHO #FF0000 de 20x20px + "Pedro Rabelo" em Inter 800 27px preto + "@pedrorabelo" em Inter 500 25px cinza #A39B86, na mesma linha com 18px de vao. SO NA CAPA, o logotipo da empresa entra na ponta direita: caixinha branca de 58x58px, borda fina #E4DFD3, cantos 10px (se nao tiver o logo, omita a caixinha). Abaixo, filete de 2px na cor #E4DFD3, a 24px.

== LAYOUT POR TIPO DE SLIDE (o marcador [TIPO: ...] define o layout; primeiro slide = capa, ultimo = fecho) ==
- CAPA: kicker "CASE · ${empresa.toUpperCase()}" em VERMELHO (Inter 800 21px, MAIUSCULAS, espacamento 0.24em, a 46px do filete); MANCHETE em Bebas Neue 92px, entrelinha 0.98; isca em Inter 500 31px cor #4A4436 (largura maxima 820px); caixa de foto de 330px de altura.
- [TIPO: historia]: kicker "O CASO · ${empresa.toUpperCase()}" em cinza #A39B86; titulo Bebas Neue 64px; corpo Inter 29px, entrelinha 1.62 (largura maxima 860px); caixa de foto de 280px quando o slide tiver [FOTO: ...].
- [TIPO: analise]: kicker "A LEITURA DO PEDRO" em VERMELHO; todo o conteudo dentro de um bloco com BARRA VERMELHA #FF0000 de 8px na borda esquerda e 36px de recuo interno; titulo Bebas Neue 62px; corpo Inter 29px entrelinha 1.62. SEM foto.
- [TIPO: ponte]: FUNDO CREME #F6F1E7; kicker "E A SUA EMPRESA?" em VERMELHO; titulo Bebas Neue 70px, entrelinha 0.98; corpo Inter 30px entrelinha 1.6. SEM foto.
- FECHO (ultimo slide): kicker "A LIÇÃO" em VERMELHO; titulo Bebas Neue 66px; corpo Inter 30px; abaixo do texto, a assinatura: traco VERMELHO de 64x3px + "Pedro Rabelo" em Bebas Neue 32px, espacamento 0.06em, cor #3A3529.

== CAIXAS DE FOTO REAL ([FOTO: ...]) ==
NENHUMA imagem e gerada por IA. Cada marcador [FOTO: instrucao] vira uma CAIXA PLACEHOLDER no slide: borda 2px #C9C2B0, cantos 4px, fundo #F2EEE3, com "FOTO" em VERMELHO 22px MAIUSCULAS espacadas no centro e a instrucao logo abaixo em #55503F 24px (largura maxima 680px). O Pedro troca a caixa pela foto real depois (a foto final leva moldura preta #111111 de 3px, cantos 4px).

== RODAPE (todos os slides, na faixa de 150px de baixo) ==
Na esquerda, a numeracao "01/NN" em monoespacada 22px cinza #A39B86 (NN = total de slides); na direita, a seta de swipe "→" em VERMELHO #FF0000, 62px. No ULTIMO slide, troque a seta por "@pedrorabelo" em Inter 700 22px cinza #A39B86 espacado.

== DESTAQUES ==
Trechos entre **asteriscos duplos** ficam em VERMELHO #FF0000, na mesma fonte e tamanho do texto ao redor — e o sublinhado do Pedro. NAO renderize os asteriscos.

== PROIBIDO ==
Fundo escuro/preto; manchete fora da Bebas Neue; foto ou avatar do rosto do Pedro; emojis e icones de app; sombras, gradientes e texturas; gerar imagem por IA no lugar das caixas de foto; escrever a seta "→" dentro do texto dos slides.

== CONTEUDO DOS SLIDES (use exatamente este texto; [TIPO: ...] escolhe o layout; [FOTO: ...] vira caixa placeholder; **trechos entre asteriscos** = vermelho) ==

${slidesSection}`;
}

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
