/**
 * Image Generation Engine — Nano Banana Pro + Imagen 4 Ultra
 * Professional-grade image generation for Pedro Rabelo's content.
 *
 * Chain: Nano Banana Pro → Imagen 4 Ultra → Nano Banana 2 (Flash)
 */

import { logApiCost } from '@/lib/ai/client';
import { generateImagePromptWithGPT } from '@/lib/ai/openai-images';
import { createClient } from '@/lib/supabase/server';

import { log } from '@/lib/logger';
export interface ImageGenerationResult {
  image_url: string;
  image_prompt: string;
  image_model: string;
}

// ---------------------------------------------------------------------------
// Brand-aware prompt system (defaults, overridden by DB identity)
// ---------------------------------------------------------------------------

interface BrandConfig {
  colors: { bg: string; accent: string; text: string; subtle: string };
  aesthetic: string;
  mood: string;
  references: string;
}

const DEFAULT_BRAND: BrandConfig = {
  colors: {
    bg: '#0A0A0B',
    accent: '#E31B23',
    text: '#FFFFFF',
    subtle: '#1A1A1C',
  },
  aesthetic: 'Infográficos educativos premium estilo @alfredosoares @gabrielbechi @orodolfosouza. Design gráfico flat/vetorial com diagramas sobre fundo preto puro. NÃO fotografia, NÃO ilustração, NÃO 3D realista.',
  mood: 'Educativo, direto, autoridade. Frameworks visuais, diagramas estruturados, dados organizados.',
  references: '@alfredosoares, @gabrielbechi, @orodolfosouza, @manualdedonos — infográficos educativos brasileiros com fundo preto e vermelho',
};

function buildBrandFromIdentity(identity?: Record<string, unknown> | null): BrandConfig {
  if (!identity) return DEFAULT_BRAND;

  const dbColors = identity.colors as Record<string, string> | null;
  const refCreators = identity.reference_creators as string | null;

  return {
    colors: {
      bg: dbColors?.primary || DEFAULT_BRAND.colors.bg,
      accent: dbColors?.accent || DEFAULT_BRAND.colors.accent,
      text: DEFAULT_BRAND.colors.text,
      subtle: DEFAULT_BRAND.colors.subtle,
    },
    aesthetic: DEFAULT_BRAND.aesthetic,
    mood: (identity.tone_descriptors as string) || DEFAULT_BRAND.mood,
    references: refCreators || DEFAULT_BRAND.references,
  };
}

function getContentTypeStyles(brand: BrandConfig): Record<string, string> {
  const { bg, accent } = brand.colors;
  return {
    instagram_carousel: `
    Instagram carousel INFOGRAPHIC slide — estilo @alfredosoares / @gabrielbechi / #BORAVENDER.
    Square format (1:1), 1080x1080px.

    FUNDO: Preto puro sólido (${bg}). Sem gradientes, sem texturas, sem ruído. Completamente flat.

    TIPOGRAFIA:
    - Headline no topo: texto ENORME (ocupa ~15-20% do slide), fonte sans-serif bold/extra-bold, cor branca (#FFFFFF)
    - Palavra-chave principal dentro de um BADGE/RETÂNGULO VERMELHO (${accent}) com cantos levemente arredondados — texto branco dentro do badge
    - Subtítulo menor abaixo do headline em cinza claro (#AAAAAA) ou branco regular
    - Todo texto é nítido, anti-aliased, sem sombras no texto

    DIAGRAMA CENTRAL (ocupa ~55-60% do slide):
    Escolha UM destes tipos baseado no conteúdo:
    - DIAGRAMA DE VENN: 2-3 círculos com outline vermelho (${accent}) e fill transparente/semi-transparente escuro, interseções nomeadas com texto branco
    - PIRÂMIDE: 3-5 camadas em tons de cinza (escuro na base #1A1A1C → mais claro no topo #666666), labels ao lado conectadas por LINHAS TRACEJADAS cinza
    - ESCADA/DEGRAUS: Degraus 3D vermelhos (${accent}) crescendo da esquerda para direita, com ícones brancos minimalistas dentro de cada degrau e texto abaixo
    - MATRIZ/TABELA: Grid com header vermelho (${accent}), células em fundo escuro (#111111), bordas finas cinza (#333333), texto branco alinhado
    - RADAR CHART: Eixos em cinza (#444444), área preenchida em vermelho semi-transparente (${accent}), labels ao redor em branco
    - FLUXOGRAMA: Caixas com borda cinza (#333333) ou vermelha (${accent}), conectadas por setas finas brancas ou tracejadas cinza
    - LISTA NUMERADA: Números grandes em vermelho (${accent}), texto branco ao lado, separadores finos horizontais cinza (#222222)
    - COMPARAÇÃO LADO A LADO: Duas colunas com boxes escuros (#111111), ícones vermelhos/brancos de check/X, headers vermelhos

    LABELS EXPLICATIVAS (ao redor do diagrama):
    - 2-4 caixas de texto pequenas com fundo semi-transparente escuro (#111111) ou sem fundo
    - Conectadas ao diagrama por LINHAS TRACEJADAS cinza (#666666) — dashed lines são obrigatórias
    - Texto dentro das labels: branco, fonte pequena, 1-2 linhas explicativas

    ELEMENTOS DECORATIVOS (sutis):
    - Linhas finas horizontais ou verticais em cinza (#222222) para separar seções
    - Ícones brancos minimalistas (line-style, não filled) quando relevante dentro de shapes
    - Badges/pills vermelhos (${accent}) para destacar números ou palavras-chave

    RODAPÉ (últimos 5% do slide):
    - Esquerda: texto pequeno descritivo ou hashtag em cinza (#666666)
    - Direita: "@pedrorabelo" em cinza (#666666), fonte pequena

    PROIBIDO:
    - Fotos, pessoas, paisagens, texturas de fundo
    - Gradientes coloridos, neon, glow effects
    - Emojis, clipart, ilustrações cartoon
    - Fundos que não sejam preto puro
    - Texto com sombra ou outline
    - Referência visual: ${brand.references}`,

    instagram_reel: `
    Instagram reel thumbnail — estilo infográfico brasileiro @alfredosoares.
    Vertical (9:16), 1080x1920px.

    FUNDO: Preto puro sólido (${bg}), sem gradientes.

    TIPOGRAFIA:
    - Headline GIGANTE no centro-superior, branco bold (#FFFFFF)
    - Palavra-chave em BADGE VERMELHO (${accent}) — retângulo com cantos arredondados, texto branco dentro
    - Subtítulo em cinza claro (#AAAAAA) abaixo

    VISUAL CENTRAL:
    - UM elemento gráfico simples: ícone grande em vermelho (${accent}), diagrama simplificado, ou número grande
    - Estilo flat vector, sem 3D complexo
    - Alto contraste, poucos elementos, impacto visual máximo

    RODAPÉ: "@pedrorabelo" em cinza (#666666)

    PROIBIDO: Fotos, pessoas, gradientes, emojis, fundos coloridos`,

    linkedin_post: `
    LinkedIn infographic — profissional e estruturado, estilo @alfredosoares / @gabrielbechi.
    Square (1:1) ou landscape (1200x627px).

    FUNDO: Preto puro (${bg}), sem gradientes.

    TIPOGRAFIA:
    - Headline bold branco (#FFFFFF) no topo
    - Palavra-chave em badge vermelho (${accent})
    - Corpo em branco regular, dados/números em vermelho (${accent}) grande

    DIAGRAMA: Framework/matriz mais limpo e organizado que Instagram:
    - Tabelas com headers vermelhos (${accent}), bordas cinza (#333333)
    - Quadrantes 2x2 com labels claras
    - Listas numeradas com ícones vermelhos
    - Métricas/números grandes em destaque

    RODAPÉ: "@pedrorabelo" em cinza (#666666)

    PROIBIDO: Fotos, gradientes, decoração excessiva — foco em dados e estrutura`,

    x_thread: `
    Twitter/X cover image — statement visual de impacto.
    Widescreen (1600x900px).

    FUNDO: Preto puro (${bg}).

    TIPOGRAFIA:
    - Uma frase BOLD GIGANTE centralizada em branco (#FFFFFF)
    - Palavra-chave em VERMELHO (${accent}) — pode ser inline (sem badge) ou com badge
    - Máximo 8-12 palavras total

    VISUAL: Ultra-minimalista
    - Fundo preto, texto grande, talvez UMA linha decorativa vermelha ou um separador fino
    - Sem diagramas complexos — puro texto de impacto

    RODAPÉ: "@pedrorabelo" em cinza (#666666) discreto

    PROIBIDO: Diagramas, fotos, elementos complexos — é um statement visual`,
  };
}

function buildMasterPrompt(contentText: string, contentType: string, brand: BrandConfig): string {
  const styles = getContentTypeStyles(brand);
  const styleGuide = styles[contentType] || styles.instagram_carousel;

  return `You are a senior graphic designer who creates ULTRA DETAILED image prompts for AI image generators. You specialize in the EXACT visual style of top Brazilian Instagram educators like @alfredosoares, @gabrielbechi, @orodolfosouza, and @manualdedonos.

Your client: Pedro Rabelo — Brazilian entrepreneur.

## VISUAL DNA (reference style — memorize this):
These are the DEFINING characteristics you MUST replicate:
1. BACKGROUND: Always solid pure black (#0A0A0B). Never gradients, never textures, never noise. Completely flat.
2. ACCENT COLOR: Vibrant red (${brand.colors.accent}) used for: keyword badges, shape fills, staircase elements, table headers, chart fills, circle outlines
3. TEXT: White (#FFFFFF) bold sans-serif for headlines. Gray (#AAAAAA) for subtitles. Gray (#666666) for labels and footer.
4. DIAGRAMS: The CORE of every slide. Always one central structured diagram:
   - Venn diagrams with red-outlined circles on black, white text at intersections
   - Pyramids with gray gradient layers (dark base → lighter top), labels connected by DASHED gray lines
   - 3D red staircases/blocks growing left-to-right with white icons inside each step
   - Tables/matrices with red headers, dark cell backgrounds (#111111), thin gray borders (#333333)
   - Radar/spider charts with red semi-transparent fill, gray axis lines
   - Flowcharts with dark boxes, thin gray or red borders, connected by dashed arrows
   - Side-by-side comparison columns with dark boxes and red/white check icons
5. LABELS: Small text boxes around the diagram connected by DASHED LINES (gray #666666). This is signature — always include 2-4 dashed-line labels.
6. TYPOGRAPHY HIERARCHY: Subtitle small at very top → HUGE bold headline (with keyword in red badge) → diagram → labels → footer
7. FOOTER: Small gray (#666666) text. Left side: descriptive text or hashtag. Right side: "@pedrorabelo"
8. DECORATIVE: Minimal thin gray lines (#222222) as separators. White line-style icons (not filled) inside shapes when needed.

## FORMAT SPECS:
${styleGuide}

## STRICT COLOR PALETTE (use ALWAYS these exact hex codes):
- Background: solid black ${brand.colors.bg} — flat, NO gradients ever
- Accent/highlight: vibrant red ${brand.colors.accent} — for keywords, shapes, badges, fills
- Primary text: pure white ${brand.colors.text} — bold headlines
- Secondary text: gray #AAAAAA — subtitles, body
- Labels/footer: gray #666666 — small text, dashed lines
- Borders/separators: dark gray #333333 — thin lines, cell borders
- Dark fills: #111111 — table cells, card backgrounds

## CONTENT TO VISUALIZE:
${contentText.slice(0, 1200)}

## YOUR TASK:
Create an EXTREMELY DETAILED image prompt in ENGLISH following this EXACT structure:

---
Professional infographic slide. [dimensions based on content type].

BACKGROUND: Solid pure black (#0A0A0B). Completely flat, no gradients, no textures, no noise pattern.

TOP SECTION (15-20% of slide):
- Small subtitle text in gray (#AAAAAA), [font size], [exact text], centered/left-aligned
- HUGE headline in white (#FFFFFF) extra-bold sans-serif, [exact text with specific words]
- Keyword "[WORD]" displayed inside a red (#E31B23) rounded rectangle badge with white text inside

CENTER SECTION (55-65% of slide):
- [DIAGRAM TYPE]: [exact description]
- Element 1: [position, shape, fill color hex, outline color hex, text inside, font size]
- Element 2: [same level of detail]
- [Continue for ALL elements]
- Connections: [how elements connect — lines, arrows, overlaps, with exact colors]

LABEL ANNOTATIONS (around the diagram):
- Label 1: [position relative to diagram], small white text "[exact text]", connected to [element] by a dashed gray (#666666) line
- Label 2: [same detail]
- [2-4 labels total, each with dashed line connector]

FOOTER (bottom 5%):
- Left: "[descriptive text or hashtag]" in small gray (#666666) text
- Right: "@pedrorabelo" in small gray (#666666) text

STYLE DIRECTIVES:
- Clean flat vector graphic design, NO photography, NO realistic 3D, NO illustrations
- High contrast black background with red and white elements only
- Sharp anti-aliased edges, crisp sans-serif typography (like Montserrat or Inter)
- Professional infographic quality matching top Brazilian Instagram business educators
- All shapes have clean geometric edges, no organic/hand-drawn feel
---

MANDATORY RULES:
1. Prompt MUST be in ENGLISH (better AI image results)
2. MUST be 300-500 words — be EXTREMELY specific about every element
3. Describe EVERY visual element: exact position, hex color, relative size, exact text content
4. ALWAYS choose a structured diagram that BEST represents the content (Venn, staircase, matrix, pyramid, radar, flowchart, comparison, numbered list)
5. ALWAYS include dashed-line label annotations — this is the signature style
6. ALWAYS include the red badge for the main keyword in the headline
7. NEVER describe photos, people, landscapes, abstract art — ONLY flat graphic design
8. ALWAYS include footer with @pedrorabelo
9. Invent short, relevant Portuguese text for labels/explanations based on the content
10. The diagram must have at least 3-5 distinct elements with specific text inside each

Reply with ONLY the prompt text. No preamble, no "Here is the prompt:", nothing before or after.`;
}

// ---------------------------------------------------------------------------
// Image generation functions
// ---------------------------------------------------------------------------

/**
 * Generate ONLY the image prompt text (no actual image generation).
 * The user copies this prompt and pastes into their preferred image AI tool.
 * Falls back to GPT-4o if Gemini Flash fails.
 */
export async function generateImagePrompt(
  contentText: string,
  contentType: string
): Promise<{ image_prompt: string } | { error: string }> {
  // Fetch identity from DB for brand colors/config
  let brand = DEFAULT_BRAND;
  try {
    const supabase = await createClient();
    const { data: identity } = await supabase.from('identity').select('*').limit(1).single();
    brand = buildBrandFromIdentity(identity);
    log.info(`[ImageEngine] Brand loaded from DB: accent=${brand.colors.accent}, bg=${brand.colors.bg}`);
  } catch {
    log.info('[ImageEngine] Could not load identity from DB, using defaults');
  }

  // Try Gemini Flash first (cheaper)
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKey) {
      const imagePrompt = await generateArtDirectorPrompt(apiKey, contentText, contentType, brand);
      if (imagePrompt && imagePrompt.length > 100) {
        log.info(`[ImageEngine] Prompt generated via Gemini (${imagePrompt.length} chars)`);
        return { image_prompt: imagePrompt };
      }
    }
  } catch (error) {
    log.error('[ImageEngine] Gemini prompt failed, trying GPT-4o...' + " " + String(error));
  }

  // Fallback to GPT-4o
  try {
    log.info('[ImageEngine] Gemini unavailable, falling back to GPT-4o...');
    const result = await generateImagePromptWithGPT(contentText, contentType, brand);
    if ('error' in result) {
      log.error('[ImageEngine] GPT-4o fallback also failed:' + " " + String(result.error));
    } else {
      log.info(`[ImageEngine] GPT-4o prompt generated (${result.image_prompt.length} chars)`);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('[ImageEngine] All prompt generators failed:' + " " + String(message));
    return { error: `Falha ao gerar prompt: ${message}` };
  }
}

/**
 * @deprecated Use generateImagePrompt() instead. Image generation removed — only prompt generation.
 */
export async function generateImageWithGemini(
  contentText: string,
  contentType: string
): Promise<ImageGenerationResult | { error: string }> {
  const result = await generateImagePrompt(contentText, contentType);
  if ('error' in result) return result;
  // Return prompt only, no image
  return {
    image_url: '',
    image_prompt: result.image_prompt,
    image_model: 'prompt-only',
  };
}

// ---------------------------------------------------------------------------
// Prompt generation
// ---------------------------------------------------------------------------

async function generateArtDirectorPrompt(
  apiKey: string,
  contentText: string,
  contentType: string,
  brand: BrandConfig = DEFAULT_BRAND,
): Promise<string | null> {
  try {
    const masterPrompt = buildMasterPrompt(contentText, contentType, brand);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: masterPrompt }] }],
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!res.ok) {
      log.error(`[ImageEngine] Prompt gen failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    // Log cost
    const cost = (800 / 1_000_000) * 0.10 + (200 / 1_000_000) * 0.40;
    logApiCost('gemini', 'gemini-2.0-flash', cost, {
      input_tokens: 800,
      output_tokens: 200,
    });

    log.info(`[ImageEngine] Art director prompt: "${prompt?.slice(0, 120)}..."`);
    return prompt || null;
  } catch (err) {
    log.error('[ImageEngine] Prompt generation error:' + " " + String(err));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Model-specific generators
// ---------------------------------------------------------------------------

async function generateWithNanaBananaPro(
  apiKey: string,
  imagePrompt: string,
): Promise<ImageGenerationResult | null> {
  try {
    log.info('[NanaBanana Pro] Generating...');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: imagePrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
        signal: AbortSignal.timeout(90_000),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      log.error(`[NanaBanana Pro] HTTP ${res.status}: ${err.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const mime = part.inlineData.mimeType || 'image/png';
        log.info('[NanaBanana Pro] Image generated successfully!');
        logApiCost('gemini', 'nano-banana-pro', 0.134, { unit: 'image', quantity: 1 });
        return {
          image_url: `data:${mime};base64,${part.inlineData.data}`,
          image_prompt: imagePrompt,
          image_model: 'nano-banana-pro',
        };
      }
    }

    log.info('[NanaBanana Pro] No image in response');
    return null;
  } catch (err) {
    log.error('[NanaBanana Pro] Error:' + " " + String(err));
    return null;
  }
}

async function generateWithImagen4Ultra(
  apiKey: string,
  imagePrompt: string,
): Promise<ImageGenerationResult | null> {
  try {
    log.info('[Imagen 4 Ultra] Generating...');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
            safetyFilterLevel: 'block_few',
          },
        }),
        signal: AbortSignal.timeout(90_000),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      log.error(`[Imagen 4 Ultra] HTTP ${res.status}: ${err.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const predictions = data.predictions || [];

    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      log.info('[Imagen 4 Ultra] Image generated successfully!');
      logApiCost('gemini', 'imagen-4-ultra', 0.08, { unit: 'image', quantity: 1 });
      return {
        image_url: `data:image/png;base64,${predictions[0].bytesBase64Encoded}`,
        image_prompt: imagePrompt,
        image_model: 'imagen-4-ultra',
      };
    }

    log.info('[Imagen 4 Ultra] No image in response');
    return null;
  } catch (err) {
    log.error('[Imagen 4 Ultra] Error:' + " " + String(err));
    return null;
  }
}

async function generateWithNanaBanana2(
  apiKey: string,
  imagePrompt: string,
): Promise<ImageGenerationResult | null> {
  try {
    log.info('[NanaBanana 2] Generating fallback...');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: imagePrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
        signal: AbortSignal.timeout(60_000),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      log.error(`[NanaBanana 2] HTTP ${res.status}: ${err.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const mime = part.inlineData.mimeType || 'image/png';
        log.info('[NanaBanana 2] Image generated successfully!');
        logApiCost('gemini', 'nano-banana-2', 0.045, { unit: 'image', quantity: 1 });
        return {
          image_url: `data:${mime};base64,${part.inlineData.data}`,
          image_prompt: imagePrompt,
          image_model: 'nano-banana-2',
        };
      }
    }

    log.info('[NanaBanana 2] No image in response');
    return null;
  } catch (err) {
    log.error('[NanaBanana 2] Error:' + " " + String(err));
    return null;
  }
}
