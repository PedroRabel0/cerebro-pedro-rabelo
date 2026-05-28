/**
 * Instagram Carousel Slide Generator
 * Uses Gemini for background illustrations + OpenAI GPT Image for text overlay
 * Produces 1080x1080 PNG images ready to post on Instagram
 */

import OpenAI from 'openai';

interface SlideImageResult {
  imageUrl: string; // base64 data URL
  slideIndex: number;
}

interface SlideGenerationInput {
  slides: string[];
  hook: string;
  cta: string;
  title: string;
  hashtags: string[];
}

/**
 * Generate all carousel slide images using AI.
 * Strategy:
 * 1. OpenAI GPT Image (gpt-image-1) generates each slide as a complete designed image
 *    with text, background, and professional layout following Pedro's brand (black + red)
 */
export async function generateCarouselSlides(
  input: SlideGenerationInput
): Promise<SlideImageResult[]> {
  const results: SlideImageResult[] = [];
  const allSlides = buildSlidePrompts(input);

  console.log(`[SlideGen] Generating ${allSlides.length} slides...`);

  // Generate slides in batches of 2 to balance speed vs rate limits
  for (let i = 0; i < allSlides.length; i += 2) {
    const batch = allSlides.slice(i, i + 2);
    const batchResults = await Promise.all(
      batch.map((slidePrompt, batchIdx) =>
        generateSingleSlide(slidePrompt, i + batchIdx)
      )
    );

    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  console.log(`[SlideGen] Generated ${results.length}/${allSlides.length} slides successfully`);
  return results;
}

interface SlidePrompt {
  type: 'cover' | 'content' | 'cta';
  text: string;
  slideNumber?: number;
  totalSlides?: number;
}

function buildSlidePrompts(input: SlideGenerationInput): SlidePrompt[] {
  const prompts: SlidePrompt[] = [];

  // Cover slide
  prompts.push({
    type: 'cover',
    text: input.hook || input.title,
  });

  // Content slides
  input.slides.forEach((text, i) => {
    prompts.push({
      type: 'content',
      text,
      slideNumber: i + 1,
      totalSlides: input.slides.length,
    });
  });

  // CTA slide
  prompts.push({
    type: 'cta',
    text: input.cta || 'Salve este post e compartilhe.',
  });

  return prompts;
}

async function generateSingleSlide(
  slidePrompt: SlidePrompt,
  index: number
): Promise<SlideImageResult | null> {
  try {
    // Try OpenAI GPT Image first
    const result = await generateWithGPTImage(slidePrompt);
    if (result) {
      return { imageUrl: result, slideIndex: index };
    }

    // Fallback to Gemini
    const geminiResult = await generateWithGemini(slidePrompt);
    if (geminiResult) {
      return { imageUrl: geminiResult, slideIndex: index };
    }

    console.log(`[SlideGen] Both APIs failed for slide ${index}`);
    return null;
  } catch (error) {
    console.error(`[SlideGen] Error generating slide ${index}:`, error);
    return null;
  }
}

/**
 * Generate a slide image using OpenAI GPT Image (gpt-image-1)
 * Best for: text-heavy slides, covers with large typography
 */
async function generateWithGPTImage(slidePrompt: SlidePrompt): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const client = new OpenAI({ apiKey });
    const prompt = buildImagePrompt(slidePrompt);

    console.log(`[SlideGen/GPT] Generating ${slidePrompt.type} slide...`);

    const response = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    // gpt-image-1 returns b64_json by default
    const b64 = response.data?.[0]?.b64_json;
    if (b64) {
      console.log(`[SlideGen/GPT] ${slidePrompt.type} slide generated successfully`);
      return `data:image/png;base64,${b64}`;
    }

    const url = response.data?.[0]?.url;
    if (url) {
      console.log(`[SlideGen/GPT] ${slidePrompt.type} slide generated (URL)`);
      return url;
    }

    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[SlideGen/GPT] Failed: ${msg.substring(0, 150)}`);
    return null;
  }
}

/**
 * Generate a slide image using Gemini image generation
 * Best for: illustrations, visual backgrounds, artistic slides
 */
async function generateWithGemini(slidePrompt: SlidePrompt): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return null;

    const prompt = buildImagePrompt(slidePrompt);

    console.log(`[SlideGen/Gemini] Generating ${slidePrompt.type} slide...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Generate this image: ${prompt}` }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    );

    if (!response.ok) {
      console.log(`[SlideGen/Gemini] Failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        console.log(`[SlideGen/Gemini] ${slidePrompt.type} slide generated`);
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }

    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[SlideGen/Gemini] Failed: ${msg.substring(0, 150)}`);
    return null;
  }
}

/**
 * Build the image generation prompt for each slide type.
 * These prompts are designed for professional Instagram carousel slides
 * following Pedro Rabelo's brand: black background, red accents, bold typography.
 */
function buildImagePrompt(slidePrompt: SlidePrompt): string {
  const brandBase = `Slide de carrossel Instagram profissional, 1080x1080px quadrado. Estilo infográfico brasileiro (@alfredosoares / #BORAVENDER). Fundo PRETO PURO (#0A0A0B), vermelho vibrante (#E31B23) para destaques, texto branco bold. Design gráfico limpo, alto contraste.`;

  switch (slidePrompt.type) {
    case 'cover':
      return `${brandBase}
SLIDE DE CAPA com título gigante em branco bold centralizado: "${slidePrompt.text.substring(0, 120)}"
Palavra-chave principal em VERMELHO (#E31B23) com fundo vermelho ou badge vermelho.
Tipografia enorme, impactante, ocupa 60% do slide.
Elemento decorativo vermelho sutil (linha, barra, shape 3D pequeno).
"@pedrorabelo" pequeno no canto inferior direito em cinza (#666).
"Deslize →" em vermelho no canto inferior direito.
Fundo preto puro, sem fotos, sem ilustrações — tipografia é o herói.`;

    case 'content':
      return `${brandBase}
SLIDE DE CONTEÚDO número ${slidePrompt.slideNumber} de ${slidePrompt.totalSlides}.
Número "${String(slidePrompt.slideNumber).padStart(2, '0')}" GRANDE em vermelho (#E31B23) no canto superior esquerdo.
Linha horizontal vermelha fina separando o número do conteúdo.
Conteúdo principal em branco: "${slidePrompt.text.substring(0, 200)}"
Se possível, representar o conceito como mini-infográfico (ícone + texto, ou diagrama simples).
Ícone branco minimalista relevante ao conteúdo.
"@pedrorabelo" pequeno no canto inferior esquerdo em cinza escuro.
"${slidePrompt.slideNumber}/${slidePrompt.totalSlides}" no canto inferior direito em cinza.
Fundo preto puro.`;

    case 'cta':
      return `${brandBase}
SLIDE FINAL de CTA. Texto principal em branco grande centralizado: "${slidePrompt.text.substring(0, 150)}"
Elemento vermelho 3D brilhante atrás do texto (glow vermelho sutil).
Dois botões abaixo: botão vermelho preenchido "SALVAR 🔖" e botão com borda vermelha "COMPARTILHAR ↗".
Linha vermelha no rodapé.
"@pedrorabelo" centralizado embaixo em cinza.
Fundo preto com glow vermelho radial sutil no centro.`;

    default:
      return `${brandBase} Slide com texto: "${slidePrompt.text.substring(0, 200)}"`;
  }
}
