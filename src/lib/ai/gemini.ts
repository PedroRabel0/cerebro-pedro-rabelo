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
    accent: '#C9412B',
    text: '#F5F5F5',
    subtle: '#1A1A1C',
  },
  aesthetic: 'Dark luxury minimalism. Think Apple keynote meets fight club poster.',
  mood: 'Powerful, provocative, premium. Anti-guru energy.',
  references: 'Alex Hormozi visual style, Naval Ravikant simplicity, high-end editorial photography',
};

const CONTENT_TYPE_STYLES: Record<string, string> = {
  instagram_carousel: `
    Instagram carousel cover slide design.
    - Square format (1:1), designed for mobile-first impact
    - Bold, dramatic composition that stops the scroll
    - Abstract or symbolic imagery — NO literal illustrations
    - Deep shadows, selective accent lighting in blood red (#C9412B)
    - Cinematic depth of field, bokeh effects welcome
    - Think: movie poster meets premium brand campaign
    - Textures: brushed metal, dark concrete, leather, smoke, glass
    - NO text, NO logos, NO watermarks — pure visual art`,

  instagram_reel: `
    Instagram reel thumbnail / cover frame.
    - Vertical format feel, dramatic portrait-oriented composition
    - High energy, dynamic movement implied through blur or light trails
    - Dark background with punchy red accent elements
    - Think: trailer frame of a business documentary
    - Motion blur, light streaks, particles welcome`,

  linkedin_post: `
    LinkedIn professional content visual.
    - Slightly more polished and corporate, but still dark and bold
    - Think: Bloomberg or The Economist premium visual style
    - Data visualization aesthetics — abstract charts, grids, matrices
    - Muted red accents, more cool-toned shadows
    - Sophisticated, intellectual, authority-driven`,

  x_thread: `
    Twitter/X thread cover image.
    - Widescreen feel, panoramic composition
    - Stark, high-contrast, almost monochrome with selective red
    - Graphic, bold, punchy — designed for the timeline
    - Think: film noir meets tech startup branding`,
};

function buildMasterPrompt(contentText: string, contentType: string): string {
  const styleGuide = CONTENT_TYPE_STYLES[contentType] || CONTENT_TYPE_STYLES.instagram_carousel;

  return `You are an elite creative director at a top agency like Wieden+Kennedy or Droga5. You specialize in dark, premium visual identities for thought leaders and disruptive brands.

Your client is Pedro Rabelo — a Brazilian entrepreneur and content creator. His brand is ANTI-GURU: direct, provocative, real. His visual identity is:
- Primary color: Pure black (#0A0A0B)
- Accent color: Blood red (#C9412B) — used sparingly, like a wound on darkness
- Aesthetic: ${PEDRO_BRAND.aesthetic}
- Mood: ${PEDRO_BRAND.mood}
- Visual references: ${PEDRO_BRAND.references}

## Content type & format:
${styleGuide}

## Critical rules:
1. ZERO text, letters, numbers, logos, or watermarks in the image
2. ZERO faces or recognizable people
3. Use SYMBOLIC/ABSTRACT imagery that captures the FEELING of the content
4. The image must work as a standalone piece of art — gallery worthy
5. Lighting is everything: use rim light, volumetric beams, caustics, neon glow
6. Color palette: 90% deep blacks and dark grays, 10% blood red (#C9412B) accents
7. Resolution and detail: hyperrealistic, 8K quality, sharp focus on key elements
8. Composition: follow rule of thirds, strong leading lines, negative space

## The content this image represents:
${contentText.slice(0, 800)}

## Your task:
Write a detailed image generation prompt (120-180 words) that will produce a STUNNING, scroll-stopping visual. Be extremely specific about:
- Exact subject/objects and their arrangement
- Lighting setup (direction, color temperature, intensity)
- Camera angle and lens feel (wide, macro, telephoto)
- Textures and materials
- Atmosphere (fog, particles, reflections)
- Color grading

Reply with ONLY the prompt. No explanations, no preamble.`;
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
