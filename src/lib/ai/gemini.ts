/**
 * Image Generation Engine — Nano Banana Pro + Imagen 4 Ultra
 * Professional-grade image generation for Pedro Rabelo's content.
 *
 * Chain: Nano Banana Pro → Imagen 4 Ultra → Nano Banana 2 (Flash)
 */

import { logApiCost } from '@/lib/ai/client';
import { generateImagePromptWithGPT } from '@/lib/ai/openai-images';
import { createClient } from '@/lib/supabase/server';

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
  aesthetic: 'Infográficos educativos premium no estilo @alfredosoares / #BORAVENDER. Design gráfico, NÃO fotografia.',
  mood: 'Educativo, direto, autoridade. Frameworks visuais e diagramas.',
  references: 'Alfredo Soares @alfredosoares, Thiago Nigro, Flavio Augusto — carrosséis infográficos brasileiros',
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
    Instagram carousel INFOGRAPHIC slide — estilo @alfredosoares / #BORAVENDER.
    - Square format (1:1), 1080x1080px
    - FUNDO PRETO PURO (${bg}), texto BRANCO BOLD, destaques em VERMELHO VIBRANTE (${accent})
    - Estilo INFOGRÁFICO EDUCATIVO: diagramas, frameworks, escadas, Venn diagrams, fluxogramas
    - Elementos 3D em vermelho (blocos, escadas, cubos) com sombras realistas sobre fundo preto
    - Ícones brancos minimalistas dentro de elementos vermelhos
    - Linhas conectoras finas (brancas ou cinza) ligando conceitos
    - Labels explicativas em caixas com borda tracejada
    - Tipografia: headline MUITO GRANDE e bold no topo, subtextos menores
    - Watermark pequeno no rodapé: @pedrorabelo à direita
    - NÃO é foto, NÃO é arte abstrata — é DESIGN GRÁFICO / INFOGRÁFICO
    - Referência visual: ${brand.references}`,

    instagram_reel: `
    Instagram reel thumbnail — estilo infográfico brasileiro.
    - Vertical feel, fundo preto puro (${bg})
    - Título GRANDE em branco bold no topo
    - Palavra-chave destacada em VERMELHO (${accent}) com fundo vermelho
    - Elemento visual central (ícone 3D, diagrama simples)
    - Design limpo, alto contraste, sem fotos`,

    linkedin_post: `
    LinkedIn infographic — profissional mas impactante.
    - Fundo preto (${bg}), texto branco, destaques vermelhos (${accent})
    - Estilo framework/matriz: quadrantes, listas numeradas, comparações
    - Mais clean e organizado que Instagram, mas mesmo DNA visual
    - Dados e métricas em destaque com números grandes
    - @pedrorabelo no rodapé`,

    x_thread: `
    Twitter/X cover image — gráfico de impacto.
    - Widescreen feel, fundo preto (${bg})
    - Uma frase BOLD gigante em branco
    - Palavra-chave em vermelho destacado (${accent})
    - Minimalista: poucos elementos, máximo impacto
    - Estilo statement/manifesto visual`,
  };
}

function buildMasterPrompt(contentText: string, contentType: string, brand: BrandConfig): string {
  const styles = getContentTypeStyles(brand);
  const styleGuide = styles[contentType] || styles.instagram_carousel;

  return `Você é um designer gráfico sênior que cria prompts de imagem ULTRA DETALHADOS para IA generativa. Seus prompts geram infográficos profissionais no estilo dos maiores criadores brasileiros (@alfredosoares, Thiago Nigro).

Seu cliente é Pedro Rabelo — empreendedor brasileiro.

## FORMATO DO SLIDE:
${styleGuide}

## PALETA FIXA (use SEMPRE esses hex codes exatos):
- Fundo: solid black (${brand.colors.bg}), completamente flat, sem gradientes
- Destaque/acento: vermelho vibrante (${brand.colors.accent}) — para títulos-chave, shapes, badges
- Texto principal: branco puro (${brand.colors.text}) — títulos bold
- Texto secundário: cinza (#666666) — labels, linhas, referências, rodapé
- Linhas/conectores: cinza (#444444) ou branco fino

## CONTEÚDO A REPRESENTAR:
${contentText.slice(0, 1200)}

## SUA TAREFA:
Analise o conteúdo acima e crie um prompt de imagem EXTREMAMENTE DETALHADO seguindo EXATAMENTE esta estrutura (em inglês para melhor resultado na IA de imagem):

---
Professional Instagram infographic slide, 1080x1080px square.

BACKGROUND: [descrever o fundo — sempre solid black #0A0A0B, flat, no gradients]

LAYOUT - TOP SECTION (20% do slide):
- [subtítulo pequeno em branco fino, tamanho, posição exata]
- [headline principal ENORME em bold, quais palavras em vermelho #E31B23, quais em branco #FFFFFF, tamanho relativo]

LAYOUT - CENTER (60% do slide):
- [tipo de diagrama: Venn com N círculos / escada com N degraus / matriz 2x2 / fluxograma / lista numerada / pirâmide]
- [descrição EXATA de cada elemento: posição, cor do outline, cor do fill, texto dentro]
- [labels de cada seção: texto exato, cor, tamanho]
- [elemento central se houver: shape vermelho com ícone branco, texto abaixo]
- [interseções/conexões: o que aparece onde os elementos se cruzam]

LAYOUT - LABELS/EXPLICAÇÕES (ao redor do diagrama):
- [N caixas explicativas com texto pequeno branco, conectadas por linhas tracejadas cinza #666666]
- [posição de cada caixa: top-left, top-right, bottom-left, bottom-right]
- [texto exato de cada label explicativa]

LAYOUT - FOOTER:
- Left: "@pedrorabelo" in gray (#666666) small text
- Right: small attribution text in gray (#666666)

STYLE:
- Clean flat vector/graphic design, NOT photography, NOT 3D renders
- High contrast, sharp edges, crisp typography
- Professional infographic quality like top Brazilian Instagram educators
---

REGRAS DO PROMPT:
1. O prompt deve ser em INGLÊS
2. DEVE ter entre 250-400 palavras — seja MUITO específico
3. Descreva CADA elemento: posição, cor hex exata, tamanho relativo, texto exato
4. Invente textos curtos e relevantes para labels/explicações baseados no conteúdo
5. Escolha o tipo de diagrama que MELHOR representa o conteúdo (Venn, escada, matriz, lista, pirâmide, fluxo)
6. SEMPRE inclua: headline com palavra-chave em vermelho, diagrama central, labels explicativas, rodapé com @pedrorabelo
7. NÃO descreva fotos, pessoas, paisagens — APENAS design gráfico flat

Responda APENAS com o prompt. Sem explicações, sem "Here is the prompt:", sem nada antes ou depois.`;
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
    console.log(`[ImageEngine] Brand loaded from DB: accent=${brand.colors.accent}, bg=${brand.colors.bg}`);
  } catch {
    console.log('[ImageEngine] Could not load identity from DB, using defaults');
  }

  // Try Gemini Flash first (cheaper)
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKey) {
      const imagePrompt = await generateArtDirectorPrompt(apiKey, contentText, contentType, brand);
      if (imagePrompt && imagePrompt.length > 100) {
        console.log(`[ImageEngine] Prompt generated via Gemini (${imagePrompt.length} chars)`);
        return { image_prompt: imagePrompt };
      }
    }
  } catch (error) {
    console.error('[ImageEngine] Gemini prompt failed, trying GPT-4o...', error);
  }

  // Fallback to GPT-4o
  try {
    console.log('[ImageEngine] Gemini unavailable, falling back to GPT-4o...');
    const result = await generateImagePromptWithGPT(contentText, contentType, brand);
    if ('error' in result) {
      console.error('[ImageEngine] GPT-4o fallback also failed:', result.error);
    } else {
      console.log(`[ImageEngine] GPT-4o prompt generated (${result.image_prompt.length} chars)`);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ImageEngine] All prompt generators failed:', message);
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
      console.error(`[ImageEngine] Prompt gen failed: ${res.status}`);
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

    console.log(`[ImageEngine] Art director prompt: "${prompt?.slice(0, 120)}..."`);
    return prompt || null;
  } catch (err) {
    console.error('[ImageEngine] Prompt generation error:', err);
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
    console.log('[NanaBanana Pro] Generating...');
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
      console.error(`[NanaBanana Pro] HTTP ${res.status}: ${err.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const mime = part.inlineData.mimeType || 'image/png';
        console.log('[NanaBanana Pro] Image generated successfully!');
        logApiCost('gemini', 'nano-banana-pro', 0.134, { unit: 'image', quantity: 1 });
        return {
          image_url: `data:${mime};base64,${part.inlineData.data}`,
          image_prompt: imagePrompt,
          image_model: 'nano-banana-pro',
        };
      }
    }

    console.log('[NanaBanana Pro] No image in response');
    return null;
  } catch (err) {
    console.error('[NanaBanana Pro] Error:', err);
    return null;
  }
}

async function generateWithImagen4Ultra(
  apiKey: string,
  imagePrompt: string,
): Promise<ImageGenerationResult | null> {
  try {
    console.log('[Imagen 4 Ultra] Generating...');
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
      console.error(`[Imagen 4 Ultra] HTTP ${res.status}: ${err.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const predictions = data.predictions || [];

    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      console.log('[Imagen 4 Ultra] Image generated successfully!');
      logApiCost('gemini', 'imagen-4-ultra', 0.08, { unit: 'image', quantity: 1 });
      return {
        image_url: `data:image/png;base64,${predictions[0].bytesBase64Encoded}`,
        image_prompt: imagePrompt,
        image_model: 'imagen-4-ultra',
      };
    }

    console.log('[Imagen 4 Ultra] No image in response');
    return null;
  } catch (err) {
    console.error('[Imagen 4 Ultra] Error:', err);
    return null;
  }
}

async function generateWithNanaBanana2(
  apiKey: string,
  imagePrompt: string,
): Promise<ImageGenerationResult | null> {
  try {
    console.log('[NanaBanana 2] Generating fallback...');
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
      console.error(`[NanaBanana 2] HTTP ${res.status}: ${err.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const mime = part.inlineData.mimeType || 'image/png';
        console.log('[NanaBanana 2] Image generated successfully!');
        logApiCost('gemini', 'nano-banana-2', 0.045, { unit: 'image', quantity: 1 });
        return {
          image_url: `data:${mime};base64,${part.inlineData.data}`,
          image_prompt: imagePrompt,
          image_model: 'nano-banana-2',
        };
      }
    }

    console.log('[NanaBanana 2] No image in response');
    return null;
  } catch (err) {
    console.error('[NanaBanana 2] Error:', err);
    return null;
  }
}
