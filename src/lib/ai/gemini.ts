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
  aesthetic: 'Infográficos premium de alto impacto visual. Designs sofisticados com elementos 3D em perspectiva (pirâmides, funis, rodas), diagramas estruturados, ícones dentro de círculos coloridos, tipografia bold massiva. Estilo editorial profissional brasileiro.',
  mood: 'Autoridade, impacto visual, sofisticação. Visual que para o scroll.',
  references: '@alfredosoares, @gabrielbechi — infográficos educativos brasileiros premium',
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

// ---------------------------------------------------------------------------
// Visual structure catalog — maps content archetypes to the best diagram type
// ---------------------------------------------------------------------------

const VISUAL_STRUCTURES = `
Choose the SINGLE BEST visual structure for the content. Match content archetype → structure:

STRUCTURES CATALOG (pick ONE):

1. RADIAL WHEEL — for systems with a central concept + surrounding components
   Central circle with concept name, 4-8 segments radiating outward, each segment a component.
   Labels curve around or sit beside each segment. Red fills with dark dividers.
   BEST FOR: ecosystems, pillars, dimensions, "X components of Y"

2. 3D PERSPECTIVE PYRAMID — for hierarchies, levels, stages from base to top
   Pyramid with 3-7 layers rendered with subtle perspective/depth. Each layer a different shade of red (darker at base → brighter at top) OR alternating red/dark.
   Labels on the side connected by thin lines or dashed lines.
   BEST FOR: hierarchies, maturity models, priority levels, "the X levels of Y"

3. FUNNEL — for processes that narrow down, conversion paths, filtering
   Inverted trapezoid shape with 3-6 layers narrowing downward. Each layer labeled.
   Can have expansion (hourglass shape) for full-journey models.
   Red gradient layers. Labels on sides.
   BEST FOR: sales funnels, conversion paths, AIDA, customer journey stages

4. COMPARISON TABLE — for X vs Y, categories with attributes, KPI lists
   Clean table with red header row, dark cell backgrounds (#111111), thin gray borders.
   Left column for categories, right columns for attributes. Red icons for row identifiers.
   BEST FOR: comparisons, metrics lists, feature breakdowns, "X vs Y"

5. CIRCULAR DIAGRAM WITH SATELLITES — for a core concept with orbiting elements
   Large central circle (white or red) with concept name. 4-8 smaller circles/cards around it, each with icon + title + short description. Connected by thin lines or arrows.
   BEST FOR: frameworks with a core, "anatomy of X", elements that orbit a central idea

6. DIAMOND/GEM SHAPE — for multi-dimensional frameworks with axes
   Diamond or gem shape divided into facets. Each facet a different dimension.
   Axes labeled (e.g., "Racional ↔ Emocional"). Red fills with varying opacity.
   BEST FOR: brand models, value frameworks, multi-axis analysis

7. FLOWCHART/CYCLE — for processes, step-by-step, circular flows
   Boxes or circles connected by arrows showing flow direction. Can be linear or circular.
   Red arrows, dark boxes with white text, numbered steps.
   BEST FOR: processes, workflows, cause-effect chains, "how X works"

8. VENN DIAGRAM — for overlapping concepts, intersections, comparisons
   2-3 overlapping circles with semi-transparent fills. Intersection labeled with the key insight.
   BEST FOR: concept overlaps, "where X meets Y", shared attributes

9. MATRIX/QUADRANT — for 2x2 categorization, positioning
   2x2 grid with labeled axes. Each quadrant named and described.
   Red accent on key quadrant. Dark backgrounds with thin borders.
   BEST FOR: positioning maps, priority matrices, categorization

10. NUMBERED LIST WITH ICONS — for tips, steps, rules, principles
    Clean vertical list. Each item has: red number badge, white icon in red circle, title, brief description.
    Items separated by thin gray lines.
    BEST FOR: "X tips for Y", rules, commandments, principles lists

11. SIDE-BY-SIDE SPLIT — for contrasting two concepts
    Screen divided vertically into two halves. Each side has its own diagram, title, bullets.
    One side can be red-tinted, other neutral. Clear visual separation.
    BEST FOR: "X is not Y", "before vs after", contrasting concepts

12. CONCENTRIC CIRCLES — for layers, depth levels, from outer to inner
    3-5 nested circles from large (outer) to small (inner). Each ring labeled.
    Gradient from dark red (outer) to bright red (inner) or vice versa.
    BEST FOR: "layers of X", depth models, maturity rings, scope levels

13. HEXAGONAL HUB — for interconnected elements around a center
    Central hexagon with surrounding hexagons connected. Clean geometric layout.
    Red fills, white icons inside each hexagon, labels below.
    BEST FOR: ecosystems, interconnected capabilities, "the X pillars"

14. TIMELINE/EVOLUTION — for progression, maturity stages, evolution
    Horizontal or diagonal progression with stages. Each stage gets bigger/more complex.
    Red arrows or connectors between stages. Icons for each phase.
    BEST FOR: evolution models, maturity stages, "from X to Y"
`;

function getContentTypeStyles(brand: BrandConfig): Record<string, string> {
  const { bg, accent } = brand.colors;
  return {
    instagram_carousel: `
    Instagram carousel COVER SLIDE — the first slide that stops the scroll.
    Square format (1:1), 1080x1080px.

    LAYOUT ZONES:
    1. TITLE ZONE (top 25%):
       - MASSIVE headline text, extra-bold sans-serif (like Montserrat Black), white (#FFFFFF)
       - The most important keyword MUST be inside a RED HIGHLIGHT BOX: a solid red (${accent}) rectangle with slightly rounded corners, white text inside. This is THE signature element.
       - Subtitle below in smaller white or light gray text explaining the concept
       - Example title pattern: "ANATOMIA DO\\n[VALOR DE MARCA]" where [VALOR DE MARCA] is inside the red box

    2. MAIN VISUAL (center 55%):
       - The chosen visual structure rendered with sophistication and depth
       - Use perspective, shadows, and gradients within the red palette to create a premium 3D feel
       - Red (${accent}) as primary fill color for shapes — use varying shades (#8B0000 dark → ${accent} bright → #FF3333 light) for depth
       - White icons inside red circles for labeled elements
       - Dark gray (#111111) for secondary shapes/cards
       - Clean geometric precision — no hand-drawn feel

    3. DETAIL ZONE (bottom 15-20% — optional):
       - 2-4 small dark cards (#111111 bg, thin #333333 border) with supporting details
       - OR a summary bar with a key takeaway quote in a bordered box
       - Keeps the slide information-rich without cluttering the main visual

    4. FOOTER (bottom 3%):
       - Left: "#BORAVENDER" or descriptive hashtag in gray (#666666)
       - Right: "@pedrorabelo" in gray (#666666)

    COLOR RULES:
    - Background: Solid pure black (${bg}). NO gradients on background. NO textures.
    - Red (${accent}): Primary accent — shapes, fills, highlight boxes, icons, headers
    - Dark reds (#8B0000, #CC1111): For depth/shadow on 3D elements
    - White (#FFFFFF): Headlines, text inside shapes, icons
    - Dark gray (#111111): Card backgrounds, secondary areas
    - Medium gray (#333333): Borders, separators
    - Light gray (#AAAAAA): Subtitles, descriptions

    TYPOGRAPHY:
    - Headlines: Extra-bold/Black weight, sans-serif, HUGE (fills width)
    - Subtitle: Regular weight, smaller, gray or white
    - Diagram labels: Medium weight, white, clean
    - All text must be crisp, sharp, anti-aliased`,

    instagram_reel: `
    Instagram reel cover — vertical, bold, stops the scroll.
    Vertical (9:16), 1080x1920px.

    Same design principles as carousel but VERTICAL layout:
    - Title at top with RED HIGHLIGHT BOX on keyword
    - ONE dramatic visual element in center (simplified diagram or large icon composition)
    - Less information density than carousel — focus on visual impact
    - Large text, bold contrast, minimal elements
    - Footer: "@pedrorabelo" in gray (#666666)
    - Background: Solid black (${bg})`,

    linkedin_post: `
    LinkedIn infographic — professional, data-rich, structured.
    Square (1:1) or landscape (1200x627px).

    Same design system as carousel but slightly MORE structured:
    - Tables and matrices preferred over abstract shapes
    - More text-heavy, more data points
    - Clean grid layouts, precise alignment
    - Professional tone — think McKinsey/BCG slide aesthetic on black background
    - RED HIGHLIGHT BOX on main keyword in title
    - Footer: "@pedrorabelo" in gray (#666666)
    - Background: Solid black (${bg})`,

    x_thread: `
    Twitter/X cover — widescreen statement visual.
    Widescreen (1600x900px).

    SIMPLIFIED version of the design system:
    - HUGE bold statement text centered
    - Keyword in RED HIGHLIGHT BOX (${accent})
    - ONE simple visual element or none — can be pure typography
    - Maximum impact, minimum elements
    - Footer: "@pedrorabelo" in gray (#666666)
    - Background: Solid black (${bg})`,
  };
}

function buildMasterPrompt(contentText: string, contentType: string, brand: BrandConfig): string {
  const styles = getContentTypeStyles(brand);
  const styleGuide = styles[contentType] || styles.instagram_carousel;

  return `You are an elite art director and information designer. You create prompts for AI image generators that produce STUNNING infographic designs — the kind that get 10K+ saves on Instagram.

Your style references: the BEST Brazilian business educators on Instagram — @alfredosoares and @gabrielbechi. Study their visual patterns:
- Solid black backgrounds with RED as the dominant accent color
- A "HIGHLIGHT BOX" on the most important keyword in the title (solid red rectangle behind the word)
- Sophisticated visual structures: 3D pyramids with perspective, radial wheels, funnels with depth, diamond shapes, circular diagrams with satellite elements
- White icons inside red circles
- Clean, bold, extra-heavy typography
- Information-rich but visually organized

Your client: Pedro Rabelo (@pedrorabelo) — Brazilian entrepreneur.

## THE RED HIGHLIGHT BOX (MANDATORY — this is the #1 brand element):
Every design MUST have the main keyword in the title displayed inside a solid red (${brand.colors.accent}) rectangle with slightly rounded corners, white bold text inside. Like a highlighter marker over the word.
Examples: "ANATOMIA DO [VALOR DE MARCA]", "O FUNIL [AMPULHETA]", "3 FRAMEWORKS DE [STORYTELLING]", "AS CAMADAS DO [CONTEÚDO]"
The text OUTSIDE the box is white. The text INSIDE the red box is also white but the red box creates contrast.

${VISUAL_STRUCTURES}

## FORMAT SPECS:
${styleGuide}

## COLOR PALETTE:
- Background: solid black ${brand.colors.bg} — ALWAYS flat, never gradients on the background itself
- Primary accent: red ${brand.colors.accent} — highlight boxes, shape fills, icons, headers
- Dark red shades: #8B0000, #CC1111 — for depth/shadows on 3D shapes (pyramids, funnels, cones)
- Bright red: #FF3333 — for highlights on 3D shapes (light-facing surfaces)
- Primary text: white ${brand.colors.text} — bold headlines, text inside shapes
- Secondary text: #AAAAAA — subtitles, descriptions
- Footer/labels: #666666 — small text
- Borders: #333333 — thin lines, card borders
- Dark fills: #111111 — card backgrounds, secondary areas

## CONTENT TO VISUALIZE:
${contentText.slice(0, 1500)}

## YOUR TASK:
Write an image generation prompt in ENGLISH. The prompt must be a single continuous description (NOT structured with headers like "BACKGROUND:", "TOP:" etc — just flowing descriptive text that an image AI can render).

REQUIREMENTS:
1. Start with the format: "Professional infographic design, square 1080x1080px" (or appropriate format)
2. Describe the solid black background
3. Describe the title with the RED HIGHLIGHT BOX on the keyword — be VERY specific about this
4. Describe the subtitle text
5. Describe the chosen visual structure in RICH detail — every shape, color, position, text inside, connections
6. Describe any supporting elements (bottom cards, detail boxes, icons)
7. Describe the footer with @pedrorabelo
8. End with style directives (clean vector, sharp edges, sans-serif typography, professional quality)

CRITICAL RULES:
- Prompt MUST be in ENGLISH (produces better AI results)
- 400-600 words — be lavishly detailed about every visual element
- ALWAYS include the RED HIGHLIGHT BOX on the main keyword — this is NON-NEGOTIABLE
- Choose the BEST visual structure from the catalog above based on content type
- Use PORTUGUESE text for all text content in the design (titles, labels, descriptions — the audience is Brazilian)
- Describe colors using hex codes
- Include white icons inside red circles where appropriate (use descriptive icon names like "bar chart icon", "handshake icon", "lightbulb icon")
- The design should look like it was made by a top design agency — premium, sophisticated, not generic
- NEVER describe photos, people, realistic scenes — ONLY graphic design elements
- Each element in the diagram must have specific Portuguese text inside it
- Make the visual structure feel like it has DEPTH — use perspective, shading, layering
- The design should tell a story even without reading the text — the visual structure itself communicates the concept

Reply with ONLY the prompt. No preamble, no markdown, no explanations.`;
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
