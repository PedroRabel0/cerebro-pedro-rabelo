/**
 * Image Generation Engine — Nano Banana Pro + Imagen 4 Ultra
 * Professional-grade image generation for Pedro Rabelo's content.
 *
 * Chain: Nano Banana Pro → Imagen 4 Ultra → Nano Banana 2 (Flash)
 */

import { logApiCost } from '@/lib/ai/client';

export interface ImageGenerationResult {
  image_url: string;
  image_prompt: string;
  image_model: string;
}

// ---------------------------------------------------------------------------
// Brand-aware prompt system
// ---------------------------------------------------------------------------

const PEDRO_BRAND = {
  colors: {
    bg: '#0A0A0B',
    accent: '#E31B23', // vermelho vibrante
    text: '#FFFFFF',
    subtle: '#1A1A1C',
  },
  aesthetic: 'Infográficos educativos premium no estilo @alfredosoares / #BORAVENDER. Design gráfico, NÃO fotografia.',
  mood: 'Educativo, direto, autoridade. Frameworks visuais e diagramas.',
  references: 'Alfredo Soares @alfredosoares, Thiago Nigro, Flavio Augusto — carrosséis infográficos brasileiros',
};

const CONTENT_TYPE_STYLES: Record<string, string> = {
  instagram_carousel: `
    Instagram carousel INFOGRAPHIC slide — estilo @alfredosoares / #BORAVENDER.
    - Square format (1:1), 1080x1080px
    - FUNDO PRETO PURO (#0A0A0B), texto BRANCO BOLD, destaques em VERMELHO VIBRANTE (#E31B23)
    - Estilo INFOGRÁFICO EDUCATIVO: diagramas, frameworks, escadas, Venn diagrams, fluxogramas
    - Elementos 3D em vermelho (blocos, escadas, cubos) com sombras realistas sobre fundo preto
    - Ícones brancos minimalistas dentro de elementos vermelhos
    - Linhas conectoras finas (brancas ou cinza) ligando conceitos
    - Labels explicativas em caixas com borda tracejada
    - Tipografia: headline MUITO GRANDE e bold no topo, subtextos menores
    - Watermark pequeno no rodapé: @pedrorabelo à direita
    - NÃO é foto, NÃO é arte abstrata — é DESIGN GRÁFICO / INFOGRÁFICO
    - Referência visual: slides do Alfredo Soares, Thiago Nigro, Flavio Augusto`,

  instagram_reel: `
    Instagram reel thumbnail — estilo infográfico brasileiro.
    - Vertical feel, fundo preto puro
    - Título GRANDE em branco bold no topo
    - Palavra-chave destacada em VERMELHO (#E31B23) com fundo vermelho
    - Elemento visual central (ícone 3D, diagrama simples)
    - Design limpo, alto contraste, sem fotos`,

  linkedin_post: `
    LinkedIn infographic — profissional mas impactante.
    - Fundo preto, texto branco, destaques vermelhos
    - Estilo framework/matriz: quadrantes, listas numeradas, comparações
    - Mais clean e organizado que Instagram, mas mesmo DNA visual
    - Dados e métricas em destaque com números grandes
    - @pedrorabelo no rodapé`,

  x_thread: `
    Twitter/X cover image — gráfico de impacto.
    - Widescreen feel, fundo preto
    - Uma frase BOLD gigante em branco
    - Palavra-chave em vermelho destacado
    - Minimalista: poucos elementos, máximo impacto
    - Estilo statement/manifesto visual`,
};

function buildMasterPrompt(contentText: string, contentType: string): string {
  const styleGuide = CONTENT_TYPE_STYLES[contentType] || CONTENT_TYPE_STYLES.instagram_carousel;

  return `Você é um designer gráfico especialista em infográficos para Instagram no estilo dos maiores criadores de conteúdo brasileiros: Alfredo Soares (@alfredosoares), Thiago Nigro, Flavio Augusto.

Seu cliente é Pedro Rabelo — empreendedor brasileiro. Identidade visual:
- Fundo: PRETO PURO (#0A0A0B) — sempre
- Destaque: VERMELHO VIBRANTE (#E31B23) — elementos 3D, badges, destaques
- Texto: BRANCO (#FFFFFF) — títulos bold grandes
- Cinza (#666666) — textos secundários, linhas, labels

## ESTILO OBRIGATÓRIO — INFOGRÁFICO EDUCATIVO:
${styleGuide}

## REGRAS CRÍTICAS:
1. É INFOGRÁFICO / DESIGN GRÁFICO — NÃO é foto, NÃO é arte abstrata
2. Fundo SEMPRE preto puro (#0A0A0B)
3. Elementos visuais: diagramas de Venn, escadas 3D, blocos vermelhos, fluxogramas, matrizes, frameworks
4. Tipografia: títulos ENORMES em branco bold, subtítulos menores
5. Ícones minimalistas brancos dentro de shapes vermelhos
6. Linhas conectoras finas ligando conceitos
7. Labels explicativas em caixas com borda tracejada cinza
8. Elementos 3D vermelhos com sombra realista (blocos, cubos, escadas)
9. Composição limpa, espaçamento generoso, hierarquia visual clara
10. Pode ter TEXTO no design (títulos, labels, números) — FAZ PARTE do infográfico

## O conteúdo que este infográfico representa:
${contentText.slice(0, 800)}

## Sua tarefa:
Escreva um prompt detalhado (120-180 palavras) para gerar um INFOGRÁFICO PROFISSIONAL no estilo descrito acima. Seja específico sobre:
- Tipo de diagrama/framework visual (Venn, escada, matriz, fluxo, lista)
- Layout dos elementos e sua disposição
- Textos que aparecem no design (título, labels, números)
- Cores exatas de cada elemento
- Estilo dos ícones e shapes 3D
- Hierarquia visual e composição

Responda APENAS com o prompt. Sem explicações.`;
}

// ---------------------------------------------------------------------------
// Image generation functions
// ---------------------------------------------------------------------------

/**
 * Main entry: generates image with Nano Banana Pro, falls back through chain.
 */
export async function generateImageWithGemini(
  contentText: string,
  contentType: string
): Promise<ImageGenerationResult | { error: string }> {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return { error: 'GOOGLE_GEMINI_API_KEY not configured' };

    // Step 1: Generate a world-class image prompt using Gemini Flash
    const imagePrompt = await generateArtDirectorPrompt(apiKey, contentText, contentType);
    if (!imagePrompt) return { error: 'Failed to generate image prompt' };

    console.log(`[ImageEngine] Prompt ready (${imagePrompt.length} chars), starting generation chain...`);

    // Step 2: Try Nano Banana Pro first (best quality for composed images)
    const nanaBananaResult = await generateWithNanaBananaPro(apiKey, imagePrompt);
    if (nanaBananaResult) return nanaBananaResult;

    // Step 3: Fallback to Imagen 4 Ultra (best photorealism)
    console.log('[ImageEngine] Nano Banana Pro failed, trying Imagen 4 Ultra...');
    const imagenResult = await generateWithImagen4Ultra(apiKey, imagePrompt);
    if (imagenResult) return imagenResult;

    // Step 4: Final fallback to Nano Banana 2 (fast, reliable)
    console.log('[ImageEngine] Imagen 4 Ultra failed, trying Nano Banana 2...');
    const flashResult = await generateWithNanaBanana2(apiKey, imagePrompt);
    if (flashResult) return flashResult;

    return { error: 'Todos os modelos de imagem falharam' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ImageEngine Error]:', message);
    return { error: `Falha ao gerar imagem: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Prompt generation
// ---------------------------------------------------------------------------

async function generateArtDirectorPrompt(
  apiKey: string,
  contentText: string,
  contentType: string,
): Promise<string | null> {
  try {
    const masterPrompt = buildMasterPrompt(contentText, contentType);

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
