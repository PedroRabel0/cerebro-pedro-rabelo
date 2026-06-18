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
  const { bg, accent, text } = brand.colors;
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

    instagram_static: `SINGLE-IMAGE STATIC INFOGRAPHIC (instagram_static) — dedicated style. This is ONE self-contained, fully-composed square infographic at exactly 1080x1080px that must deliver the entire idea on its own. It is NOT a carousel slide or cover: do not use carousel pacing, "swipe" cues, page numbers, slide indicators, or continuation arrows. One frame, one strong idea.

    BACKGROUND: Solid pure black ${bg}, full bleed, flat — never gradients or textures on the background.

    This is a premium @alfredosoares / @gabrielbechi infographic: one dominant centered diagram, strong hierarchy, every label anchored. The whole composition is centered on the vertical axis (x=540) inside a uniform 80px safe-area margin on all four sides — nothing touches or is cropped by the edges.

    LAYOUT ZONES (stacked on the central axis, top to bottom):

    1. TITLE ZONE (top band, ~220px tall):
       - A short, punchy MASSIVE headline in extra-bold/black-weight geometric sans-serif (Montserrat Black feel), white ${text}, centered, maximum two lines.
       - The single most important KEYWORD MUST sit inside a RED HIGHLIGHT BOX: a solid ${accent} rounded rectangle, 16px corner radius, white bold text inside, generous ~24px internal padding. This is THE signature brand element #1 — always present and the strongest focal accent in the title. Non-negotiable.
       - Optional one-line subtitle below in #AAAAAA explaining the concept — short and centered.

    2. CENTRAL VISUAL ZONE (middle band, ~620px tall — the dominant hero):
       - ONE structure chosen from the catalog to fit the content (funnel, 3D pyramid in perspective, radial wheel, comparison table, circular diagram with satellites, diamond, flowchart, Venn, 2x2 matrix, numbered icon list, etc.), centered on x=540 and vertically centered in this band. It must fill the band confidently and be unmistakably the largest, highest-contrast element — never floating small in the middle.
       - For symmetric structures, mirror-balance them across the central axis so left and right weights are equal.
       - Fill shapes with brand red ${accent} as the primary color; build 3D depth ONLY within the sanctioned red ramp — #8B0000 (dark/shadow side) to ${accent} (mid-tone) to #FF3333 (light side), single light source from top-left. White icons centered inside solid ${accent} circles of one consistent size. Use #1A1A1A / #111111 for secondary cards/shapes and #333333 for thin borders.
       - Every layer/segment carries SHORT Portuguese text (1-4 words) that sits completely inside the shape with padding — never overflowing or cropped.

    3. DETAIL / ANNOTATION ZONE (integrated into the central band, subordinate to the diagram — never a separate floating strip):
       - Side labels, questions, or callouts MUST follow the COMPOSITION & LAYOUT DISCIPLINE: balanced mirrored pairs at matched left/right heights, each ANCHORED to the exact layer/segment it describes by a thin 1-2px guide line in #333333 (or ${accent} at low emphasis), ending in a small filled dot or tick at the shape. NO floating, unanchored text — ever. Labels snap to the vertical center of the layer they point to so leader lines stay short, parallel, and balanced.
       - Any concluding/result element (check circle, outcome badge, total) is sized proportionally to the diagram (min 96px) and connected to it on the central axis by an arrow or short stem — never a tiny detached dot.
       - Optional supporting cards: #1A1A1A (or #111111) fill, 1px #333333 border, 16px radius, white ${text} titles and #AAAAAA description text, aligned to the grid in a single balanced row with at least 48px clearance from the central visual.

    4. FOOTER ZONE (bottom band, ~70px, the quietest tier):
       - A thin #333333 divider line above it. Descriptive hashtag flush LEFT and "@pedrorabelo" flush RIGHT, both small and baseline-aligned in #666666, sitting at least 60px above the bottom edge. Always present, never competing with the content.

    COLOR RULES (strict): background ${bg}; the ONLY red is brand red ${accent} — with #8B0000 (shadow) and #FF3333 (highlight) as tonal variants of that same red for 3D depth, NOT new hues. Absolutely no orange or brick tone such as #c9412b. White ${text} for primary text and icons; #AAAAAA for captions/descriptions; #666666 for footer; #1A1A1A / #111111 for cards and panels; #333333 for thin borders and connector lines. These three reds are the entire warm palette — nothing else.

    TYPOGRAPHY: heavy black-weight geometric sans-serif throughout. Strong monotonic size descent: title dramatically oversized > structure/layer labels and key numbers (medium-bold white) > anchored annotations (#AAAAAA) > footer (#666666). Tight, confident letter-spacing. All text sharp and anti-aliased.

    OVERALL FEEL: premium, centered, balanced, high-contrast black-and-red — the polished agency look of @alfredosoares / @gabrielbechi. One centered hero diagram with symmetric, line-anchored labels and a quiet footer. Every element intentional, anchored, and finished — no floating labels, no orphaned tiny shapes, no lopsided weight.`,
  };
}

function getCompositionDiscipline(accent: string): string {
  return `## COMPOSITION & LAYOUT DISCIPLINE

This is a NON-NEGOTIABLE section. Treat the 1080x1080px canvas as a strict editorial grid — every element is placed by rule, never floated freely. The finished piece must read as agency-grade work in the @alfredosoares / @gabrielbechi tradition: centered, balanced, with one dominant diagram, strong hierarchy, and zero floating debris. Apply ALL rules below; they override any tendency toward loose, scattered, or lopsided placement.

### 1. CENTRAL AXIS & SYMMETRY (anchor everything)
- Establish ONE vertical center axis at x=540px (the exact horizontal middle). The PRIMARY visual structure (funnel, pyramid, radial wheel, diamond, circular-satellite diagram, Venn, 2x2 matrix, flowchart) MUST be centered on it — its geometric center of mass sits on x=540, never drifting left or right.
- The structure is also vertically centered within the content band (between the title zone and the footer), filling it confidently — never drifting up or down, never floating small in the middle.
- The title's red keyword box, the diagram, and the footer stack as a single centered column sharing the same horizontal center.
- For axially symmetric structures (funnel, pyramid, diamond, radial wheel, concentric circles, Venn), build them perfectly mirror-balanced about x=540 — left and right halves are mirror images in silhouette and carry equal visual weight.

### 2. SAFE-AREA & MARGINS (nothing touches the edges)
- Enforce a uniform safe-area margin of at least 80px on all four sides. NO shape, text, icon, guide line, or label may enter this margin or be cropped by the canvas edge — only the full-bleed black background extends to the edges.
- All live content sits inside a 920x920px inner frame, partitioned into three stacked bands: a TITLE ZONE (top ~220px tall) for the headline and its red keyword box; a DIAGRAM ZONE (center, ~620px tall) for the hero structure and all its anchored labels; and a FOOTER ZONE (bottom ~70px tall, baseline at least 60px above the bottom edge).
- Keep at least 48px of breathing space between any two distinct blocks. Prefer fewer, larger, well-spaced elements over many cramped ones; generous negative space is a feature, but it must be symmetric (equal gutters left and right of the diagram).

### 3. BALANCED VISUAL WEIGHT (the anti-defect rule: left = right)
- Visual weight on the left of the central axis must EQUAL the weight on the right. If you place a label, callout, question, or stat on one side, place a counterpart of comparable weight on the opposite side at the SAME vertical height (mirrored across x=540), with matching baselines. Labels come in mirrored PAIRS, never as lone floaters.
- NEVER leave one side heavy and the other empty (the failure mode: one label mid-left, another lower-right, with dead space between).
- If there is only ONE annotation, do not push it to a side — center it directly below the structure as a full-width caption block, or split its content into a balanced pair across both sides.
- For an odd number of labels, alternate left/right down the axis in evenly spaced rows, OR stack all labels in one centered column below the diagram — never scatter them at random heights.
- Before finalizing, mentally compute the center of mass of all non-background elements; it must land on x=540 (+/- 20px). If not, rebalance.

### 4. ANCHORED LABELS — NOTHING FLOATS (core fix)
- EVERY annotation, side question, callout, or stat label MUST be physically CONNECTED to the exact shape, layer, or segment it describes by a thin 1-2px leader line in #333333 (or ${accent} at low emphasis for the active layer), terminating in a small filled dot or tick at the anchor point on the structure side. A label without a connector line touching its target is FORBIDDEN — no exceptions.
- The guide line runs from the EDGE of the labeled element horizontally (or gently angled) to the label, staying short and parallel to its neighbors.
- Align each label's vertical center EXACTLY to the vertical center of the layer / tier / spoke it annotates — labels snap to layer baselines, never to arbitrary heights. One label per layer.
- Mirrored pairs sit at matching y-coordinates and matching horizontal distance from the axis, so the two connector lines are the same length.
- Text reads inward toward the hero: left-side labels are right-aligned toward their line, right-side labels are left-aligned toward their line.
- For radial / circular-satellite diagrams: connectors are straight spokes from the central hub to each satellite; satellites are evenly distributed around the full 360 degrees at equal radius.

### 5. NO TINY, NO ORPHAN ELEMENTS (proportional terminals)
- No element may be visually minuscule or disconnected. Any concluding/result marker (a "check" circle, outcome badge, final node, total figure) MUST be sized proportionally to the structure — minimum 96px diameter, large enough to read as the payoff — and MUST be visually attached: either it is the natural bottom vertex of the funnel/pyramid (touching the last layer) or it connects on the central axis by a short centered 1px #333333 stem or arrow. Never render it as a tiny detached dot dangling in empty space.
- Icon circles are a single consistent size class throughout one image (e.g. all 64px). Never mix wildly different icon-circle sizes.

### 6. Z-ORDER & HIERARCHY (back to front, largest to smallest)
Stacking order: (1) black background #0A0A0A full bleed; (2) main structure shapes (red-toned fills); (3) thin guide/connector lines #333333; (4) anchored labels, icon circles, stat numbers; (5) title + red keyword box, always on top within the title zone; (6) footer text.
Type-size hierarchy descends MONOTONICALLY across four tiers: TITLE (top, the single most dominant element, second-loudest only to nothing) > structure layer labels / key numbers > anchored annotations (#AAAAAA descriptive lines) > FOOTER (#666666, the quietest). No annotation may be larger than the diagram's own stage labels, and nothing may rival the title. No subordinate element (label, icon, card, end-node) may rival the main diagram in size or contrast.

### 7. ALIGNMENT, BASELINES & GEOMETRY CONSISTENCY
- Align text baselines across paired labels and across rows of cards; labels in the same row share one baseline.
- Align all left-side labels to a common left text edge and all right-side labels to a common right text edge. Icon circles repeating down a list are left-aligned on a single vertical guide (same x for every circle center). Numbered list items share consistent left indentation.
- Use ONE corner-radius scale per image: 16px for the red keyword box and cards (#1A1A1A / #111111), with optional 8px only for small chips/badges — do not mix radii arbitrarily.
- Stroke widths are consistent: all thin guide/connector and divider lines exactly 1-2px in #333333; card borders 1px #333333; structure outlines (if any) 2px. Leader lines all share one weight.
- Even spacing: equal vertical gaps between funnel layers / pyramid tiers / list items / cards; equal angular spacing between radial satellites. Consistent rhythm, no uneven gaps.

### 8. PREMIUM VECTOR FINISH
- Crisp vector edges, perfect geometric precision, anti-aliased — zero hand-drawn or sketchy feel. No blur except intentional soft drop shadows beneath 3D forms (dark red #8B0000, offset down-right ~8px, low opacity).
- 3D forms use a single consistent light source from the top-left: lit faces lean toward #FF3333, shadowed faces toward #8B0000, mid-tone faces use ${accent}. Keep all gradients strictly within these three reds — never orange or brick.
- Generous, consistent internal padding (min 24px) inside cards and the keyword box. Kern the massive title tight but never touching.
- FINAL CHECK before output: (a) is the structure centered on x=540? (b) is every label connected by a line? (c) are labels in balanced mirrored pairs at matching heights? (d) is nothing tiny or orphaned? (e) does the center of mass sit on the axis? If any answer is no, fix it before finalizing.`;
}

function getSignatureStyle(accent: string): string {
  return `## SIGNATURE STYLE — #BORAVENDER / @alfredosoares (STUDY & REPLICATE)

This section encodes the shared brand DNA observed across the reference posts. Replicate this premium Brazilian agency-grade language precisely for EVERY Pedro Rabelo (@pedrorabelo) infographic. This is editorial, art-directed work: perfect alignment, generous whitespace, a single confident dominant structure, magazine-grade finish. The single non-negotiable: ${accent} is a pure, fully-saturated traffic-signal red (#E31B23). NEVER drift toward orange, brick, vermillion, coral, salmon, scarlet, or maroon — if a swatch reads even slightly warm or brown, it is wrong. The red is loud and pure.

### 1. The red — ${accent} is the entire brand
- ${accent} is the ONLY chromatic accent in the whole piece. Use it for: the title keyword phrase, all pills/badges, all "VS" squares, numbered chips, key curves/shapes, satellite ring outlines, Venn fills, dashed leader lines + nodes, the central VS spine, phase washes, and bold-red keywords.
- Reds appear in exactly three weights: (1) FULL solid ${accent} for pills, badges, boxes, numbered chips, and the keyword box; (2) semi-transparent ${accent} at 35-55% opacity for overlapping Venn circles and phase area-fills (overlaps deepen naturally into richer red); (3) thin ${accent} strokes (1-1.5px) for dashed leaders, satellite outlines, and the VS spine. Vary opacity, never the hue — no gradient ever passes through orange. The only allowed red gradient is white->${accent} (light-left to saturated-right) for horizontal phase bands.
- Everything else is strictly monochrome: pure black, near-blacks (#0A0A0A, #141414), white, grays. The ONLY non-red color permitted is a single deep navy (#1A2A4A) reserved exclusively for a secondary data curve when two curves must be distinguished. Nothing else gets color.

### 2. Two background modes (pick ONE per post, commit fully — never mix)
- BLACK MODE (Pedro's default — use unless the content is a data chart or a photorealistic metaphor): true near-black field (#000000 to #0A0A0A), optionally with a whisper-quiet texture — faint concentric rings OR a barely-visible dot grid at ~4% white. Text white; cards #141414 with a hairline 1px #222-#2A2A2A border, ~14-16px corner radius, generous internal padding. Used for high-drama structures: VS comparisons, Venn diagrams, radial cycles, pyramids, funnels.
- LIGHT EDITORIAL MODE (only for data charts and photorealistic-metaphor posts): off-white field (#F5F5F5 to #FAFAFA) carrying a subtle dot-grid texture (evenly spaced faint ~1px gray dots, low opacity, like engineering paper). Text near-black (#0A0A0A-#111); cards pure white with a hairline 1px #E5E5E5 border, ~12px radius, a whisper-soft drop shadow. Photorealistic-metaphor posts ALWAYS use this mode.
- The background is flat and uniform edge to edge; the texture is whisper-quiet, never busy.

### 3. Massive black-weight title (always uppercase)
- Giant headline, condensed-to-normal heavy sans-serif (Helvetica/Inter/Archivo Black feel), 900 weight, tight leading, UPPERCASE, top-left or top-centered, occupying real estate with confidence.
- The KEY PHRASE is emphasized in ONE of two treatments only (choose one per post): (a) the entire key line set in ${accent} (rest of title stays white in black mode / near-black in light mode), OR (b) the key phrase wrapped inside a SOLID ${accent} rounded-rectangle box with white bold text inside.
- Small square ${accent} "VS" badges may sit inline inside a title as connector tokens between compared terms (e.g. "SEO [vs] AEO [vs] GEO") — each a tiny solid red rounded square with white bold "vs".
- Optional one-line gray subtitle below, with its two or three most important words in bold.

### 4. Pills, badges, and numbers (red, solid, uppercase)
- Section pills: solid ${accent} rounded pills, white UPPERCASE bold text, used as card headers / phase labels (e.g. "INTRODUCAO").
- VS badge: solid ${accent} square (slightly rounded), white bold "VS", centered in the gap between two compared cards — a recurring signature token.
- Numbered badges: small solid ${accent} circles or rounded squares with white bold numerals (1-5), pinned to the edge of the element they number (satellite top edges, step cards, pyramid tiers).
- All text inside pills/badges is uppercase and bold.

### 5. Dashed leader system + nodes — the core finishing DNA
- EVERY annotation, chip, label, or callout connects to its anchor via a THIN dashed guide line (1px, short even dashes; ${accent} red or neutral gray on light mode, light-gray/white-30% on dark mode), terminating in a SMALL filled circular NODE (~4-6px dot) sitting exactly on the anchor point — the curve, the diagram edge, the metaphor detail. The node visually "pins" the line to the data; place a node at the label end too.
- Leaders are short, clean, and purposeful — they never cross, never tangle. Annotation text sits neatly aligned at the far end. This dashed-line-plus-node pinning is the single most identifiable signature of the look: nothing ever floats unconnected. Use it liberally and precisely.

### 6. Body copy with bold keywords
- Body is clean sans-serif, regular weight, comfortable size, high contrast, short — one phrase or one to two lines per card, never long paragraphs, generous line spacing. The load-bearing keyword(s) per line are bold; the single most important term may be bold + ${accent}. This selective bolding creates the scannable, confident editorial rhythm.
- Lead with bold mini-heading patterns where useful ("Objetivo da fase" / "Gatilho de passagem"): bold mini-heading + one short line beneath.

### 7. Cards
- BLACK MODE: #141414 fill, ~14-16px radius, hairline #222-#2A2A2A border, generous padding; circular satellites get a soft top-left inner highlight for a glossy 3D bevel.
- LIGHT MODE: white fill, ~12px radius, hairline #E5E5E5 border, whisper-soft shadow, generous padding.
- Card internal pattern: a solid ${accent} UPPERCASE pill at top (when labeling a phase/step), then a bold label line, then 1-2 short body lines with bold keywords. Uniform vertical rhythm; identical card heights across a row; perfect baseline alignment.

### 8. One dominant central structure
- Each post is built around a SINGLE sophisticated central visual (line/area chart, 2-col VS, 3-circle Venn, radial cycle, funnel, 3D pyramid, or a central photorealistic metaphor image) that fills the width with confidence — never timid, never floating in empty space, but breathing with generous, even margins. Strict grid; never crowd; never randomly center-justify body text.

### 9. Optional photorealistic hero (for metaphor posts)
- When the concept benefits from a metaphor, replace the diagram with ONE central photorealistic hero object that embodies it (e.g. a tree with vivid red foliage above ground and a mirrored red root system below the soil line — visible result above, invisible work below; or an iceberg with red underwater mass). Keep ${accent} red as the only saturated color in the photo. The object is sharp, well-lit, unmistakably the metaphor, never decorative clutter. Anchor 4-6 rounded label chips around it (each with a tiny red line icon), each tethered to a precise point by a thin dashed leader + node, with the central/most-important chip in bold. The photorealistic object is the ONLY rendered element; all chips, lines, nodes, and footer stay flat vector.

### 10. Footer (always)
- Bottom-left: the campaign hashtag in small gray. Bottom-right: the handle, ALWAYS "@pedrorabelo" — never "@alfredosoares". Both sit low-contrast on the same baseline, quietly framing the piece.

### Hard rules checklist
- Red is ${accent} (#E31B23) only — never orange/brick/coral.
- Title uppercase, black-weight 900; key phrase entirely red OR in a solid red box.
- Pills/badges solid red, uppercase, white text.
- Every annotation tied to its anchor by a dashed line + node; nothing floats.
- Bold keywords (sometimes bold-red) in short body copy.
- ONE background mode per post (black default; light only for charts/metaphors), committed fully.
- ONE dominant central structure, generous even margins, agency-grade alignment.
- Footer: hashtag bottom-left, handle bottom-right, both small gray; handle ALWAYS @pedrorabelo.`;
}

function getStructureExecutions(accent: string): string {
  return `## REFERENCE STRUCTURE EXECUTIONS

Concrete, upgraded build recipes for the recurring central structures, executed at the reference standard. Each fills the canvas width as the single dominant element and follows the brand DNA: pure ${accent} (#E31B23) red, dashed-leader-plus-node annotations (every annotation tethered to its anchor by a thin dashed line ending in a small filled circular node, never floating), solid red uppercase pills/badges, bold (sometimes bold-red) keywords, ONE committed background mode, generous even margins. Footer always hashtag bottom-left / "@pedrorabelo" bottom-right in small gray. Pick the one structure that fits the concept.

### FUNNEL (conversion / filtering / stage narrowing)
Light Mode (off-white + dot grid). A clean vertical stack of 4-5 trapezoid bands narrowing top->bottom, perfectly centered, equal band heights, crisp edges. Bands deepen toward ${accent} (top lightest ~40% or white with hairline border, bottom band solid saturated ${accent} with white bold text). Each band carries a small numbered solid ${accent} pill on its left lip and a white bold stage label centered inside; a thin dashed ${accent} leader runs to the right margin ending in a node, where a short white card states the stage metric + a bold keyword. Add bold percentage/count figures at each step's right edge. Generous vertical gaps so the taper reads cleanly.

### 3D PYRAMID (hierarchy / maturity levels)
Black Mode (pure black). A clean isometric pyramid sliced into 3-5 horizontal tiers, base widest, drawn with subtle isometric depth — #141414 faces with thin ${accent} edge highlights catching a single soft top-light for a consistent bevel. Tiers shade from dark/neutral toward saturated ${accent} (apex-to-base or inverted for emphasis); apex may be crowned in solid ${accent}. Each tier carries a white bold UPPERCASE label centered on its front face and a small solid ${accent} numbered badge pinned to its left edge. Thin dashed ${accent} leaders fan out to the margin, each ending in a node + a #141414 callout card with a bold keyword annotation.

### 2-COLUMN VS COMPARISON
Black Mode. Header: two wide rounded #141414 cards side by side (e.g. "Branding" | "Marketing"), large white bold titles, with a single SQUARE solid ${accent} "VS" badge (white bold "VS") centered in the gap between them. Below: 5-6 paired rows; each row is two #141414 rounded cards (left vs right) separated by a thin VERTICAL ${accent} DASHED SPINE running down the exact center, punctuated by small red nodes where each row meets the spine. Each card holds one short line with its key term in bold (e.g. "Deve ser a base"). Identical uniform row height and gutter; perfect mirror baseline alignment across the continuous, perfectly centered spine.

### 3-CIRCLE VENN
Black Mode (optional subtle concentric-ring texture). Three large overlapping circles filled with semi-transparent ${accent} at 35-50% opacity (overlaps blend into richer red), arranged two-up (upper-left, upper-right) / one-down centered, symmetric geometry. Each circle: white bold UPPERCASE label + 3 short bullets (small ${accent} arrow markers, keyword in bold). The triple-center intersection is labeled in white bold; each pairwise overlap carries a small white line-icon. External dark callout boxes with dashed borders sit outside the circles, each tethered inward by a thin dashed ${accent} leader ending in a node. Title may carry inline square ${accent} "vs" badge tokens between the three names.

### RADIAL NUMBERED CYCLE
Black Mode. A large central dark circle (white bold UPPERCASE core concept, optional solid ${accent} box around the key phrase) ringed by 5-6 satellite circles at perfectly even angular spacing, equal size. Each satellite: #141414 fill, thin ${accent} ring outline, a soft top-left inner highlight for a glossy 3D bevel, a white UPPERCASE label inside, and a solid ${accent} numbered badge (1-N) seated on its top edge. Connect the satellites in a loop with curved ${accent} DASHED arrows showing a consistent clockwise cycle direction, each arrow ending in a small red node. Optional dashed leaders from each satellite out to a short anchored note. Clean radial symmetry throughout.

### LINE / AREA CHART WITH PHASE BANDS
Light Mode (off-white + dot grid). Framed plot: X-axis labeled (e.g. "Tempo"), Y-axis labeled (e.g. "Vendas & Lucro"), faint gridlines. Split the plot into 4-5 vertical PHASE BANDS left->right, each a soft horizontal wash gradient from near-white (left) to saturated ${accent} (right), each labeled at the top with a solid ${accent} pill (e.g. Desenvolvimento / Introducao / Crescimento / Maturidade / Declinio). Overlay two smooth curves: one deep navy (#1A2A4A) for the primary series and one ${accent} for the secondary; each curve carries a small text label + a SHORT dashed arrow ending in a node pointing exactly at the curve. Below the chart, a row of 4 uniform-width white cards (hairline border, ~12px corners), each topped by a solid ${accent} UPPERCASE pill (phase name), then a bold mini-heading + 1-2 lines, then a second bold mini-heading + 1-2 lines.

### CENTRAL PHOTOREALISTIC METAPHOR IMAGE WITH ANCHORED CHIPS
Light Mode (off-white + dot grid). Title above with the key phrase in ${accent} or in a solid ${accent} box. One sharp, well-lit photorealistic central object embodying the metaphor (e.g. a tree with vivid ${accent}-red foliage as the visible result and a mirrored ${accent}-tinted ROOT SYSTEM below the soil line as the invisible work; or an iceberg with red underwater mass), red as the only saturated color in the photo. Anchor 4-6 rounded label chips around it (light on light), each with a tiny ${accent} line-icon, each tethered to a precise point on the image by a thin dashed ${accent} leader ending in a small filled node at both ends; place a central bold chip for the core idea, with supporting chips evenly distributed. The photoreal image is the only rendered element; all chips, leaders, nodes, and footer stay flat vector. Leaders never cross; composition balanced left-to-right.

For every structure: ONE committed background mode; red is ${accent} (#E31B23) only, never orange; footer hashtag bottom-left, "@pedrorabelo" bottom-right in small gray.`;
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

${getSignatureStyle(brand.colors.accent)}

${VISUAL_STRUCTURES}

${getStructureExecutions(brand.colors.accent)}

## FORMAT SPECS:
${styleGuide}

${getCompositionDiscipline(brand.colors.accent)}

## COLOR PALETTE:
- Background: flat and uniform — default BLACK MODE (solid near-black ${brand.colors.bg}); use LIGHT EDITORIAL MODE (off-white + faint dot grid) only for data charts and photorealistic-metaphor posts, per SIGNATURE STYLE. Never gradients on the background itself.
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
- TEXT MUST FIT INSIDE ITS SHAPE (critical): keep every label SHORT — ideally 1-4 words. Every piece of text must sit COMPLETELY inside its shape/box/segment with comfortable padding on all sides — NEVER let text overflow, touch the edges, get cut off, wrap awkwardly, or spill outside the shape or the canvas. Size each shape generously to contain its text; if a label would be long, shorten it so it fits.
- Leave a clear safety margin around the whole composition so no element is cropped at the canvas edges. Prefer fewer, larger, well-spaced elements over many cramped ones.

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
