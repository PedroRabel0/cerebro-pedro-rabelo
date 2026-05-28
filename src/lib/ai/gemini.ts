/**
 * Nano Banana Pro (Gemini 3 Pro Image) — Image Generation.
 * Uses Google GenAI SDK for high-quality image generation.
 */

import { logApiCost } from '@/lib/ai/client';

export interface ImageGenerationResult {
  image_url: string;
  image_prompt: string;
  image_model: string;
}

/**
 * Generate an image using Nano Banana Pro (gemini-3-pro-image-preview).
 * Step 1: Use Gemini Flash to craft an optimized image prompt
 * Step 2: Use Nano Banana Pro to generate a high-quality image
 */
export async function generateImageWithGemini(
  contentText: string,
  contentType: string
): Promise<ImageGenerationResult | { error: string }> {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return { error: 'GOOGLE_GEMINI_API_KEY not configured' };

    // Step 1: Generate an optimized image prompt using Gemini Flash
    const promptRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a world-class art director for social media content. Create a detailed image prompt (100-150 words) in English for generating a stunning visual.

BRAND GUIDELINES:
- Dark, premium aesthetic: deep black backgrounds (#0A0A0A)
- Bold red accent color (#C9412B) used sparingly for impact
- Modern, minimalist, high-contrast
- Professional and sophisticated — think luxury brand meets tech startup

RULES:
- Include specific visual details: lighting, composition, mood, textures, colors
- NO text or words in the image — pure visual art
- Think cinematic, editorial quality — as if shot for a magazine
- Use dramatic lighting (rim light, volumetric light, dramatic shadows)
- Reply ONLY with the prompt, no explanations

Content type: ${contentType}
Content:
${contentText.slice(0, 1200)}`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!promptRes.ok) {
      const err = await promptRes.text();
      console.error('[Gemini] Prompt generation failed:', err);
      return { error: `Gemini prompt failed: ${promptRes.status}` };
    }

    const promptData = await promptRes.json();
    const imagePrompt =
      promptData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      'Dramatic cinematic still life with deep black background, subtle red accent lighting, modern minimalist composition, professional editorial quality, volumetric lighting, high contrast';

    // Log Gemini Flash prompt cost
    const flashCost = (500 / 1_000_000) * 0.10 + (150 / 1_000_000) * 0.40;
    logApiCost('gemini', 'gemini-2.0-flash', flashCost, {
      input_tokens: 500,
      output_tokens: 150,
    });

    // Step 2: Generate image with Nano Banana Pro (gemini-3-pro-image-preview)
    console.log(`[NanaBanana Pro] Generating image | prompt: ${imagePrompt.slice(0, 100)}...`);

    const imageRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Generate this image: ${imagePrompt}` }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
        signal: AbortSignal.timeout(60_000),
      }
    );

    if (!imageRes.ok) {
      const errorText = await imageRes.text().catch(() => '');
      console.error(`[NanaBanana Pro] HTTP ${imageRes.status}: ${errorText.substring(0, 300)}`);

      // Fallback to Nano Banana 2 (Flash) if Pro fails
      console.log('[NanaBanana] Pro failed, trying Nano Banana 2 (Flash)...');
      return generateWithNanaBanana2(apiKey, imagePrompt);
    }

    const imageData = await imageRes.json();
    const parts = imageData.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        console.log('[NanaBanana Pro] Image generated successfully');
        logApiCost('gemini', 'nano-banana-pro', 0.134, { unit: 'image', quantity: 1 });
        return {
          image_url: `data:${mimeType};base64,${part.inlineData.data}`,
          image_prompt: imagePrompt,
          image_model: 'nano-banana-pro',
        };
      }
    }

    // No image in response — try fallback
    console.log('[NanaBanana] Pro returned no image, trying Nano Banana 2...');
    return generateWithNanaBanana2(apiKey, imagePrompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NanaBanana Error] generateImage:', message);
    return { error: `Falha ao gerar imagem com Nano Banana: ${message}` };
  }
}

/**
 * Fallback: Nano Banana 2 (gemini-3.1-flash-image-preview) — faster, cheaper.
 */
async function generateWithNanaBanana2(
  apiKey: string,
  imagePrompt: string,
): Promise<ImageGenerationResult | { error: string }> {
  try {
    console.log(`[NanaBanana 2] Generating fallback image...`);

    const imageRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Generate this image: ${imagePrompt}` }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
        signal: AbortSignal.timeout(60_000),
      }
    );

    if (!imageRes.ok) {
      const errorText = await imageRes.text().catch(() => '');
      console.error(`[NanaBanana 2] HTTP ${imageRes.status}: ${errorText.substring(0, 300)}`);
      return { error: `Nano Banana 2 failed: ${imageRes.status}` };
    }

    const imageData = await imageRes.json();
    const parts = imageData.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        console.log('[NanaBanana 2] Image generated successfully');
        logApiCost('gemini', 'nano-banana-2', 0.045, { unit: 'image', quantity: 1 });
        return {
          image_url: `data:${mimeType};base64,${part.inlineData.data}`,
          image_prompt: imagePrompt,
          image_model: 'nano-banana-2',
        };
      }
    }

    return { error: 'Nano Banana não retornou imagem' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NanaBanana 2 Error]:', message);
    return { error: `Falha Nano Banana 2: ${message}` };
  }
}
