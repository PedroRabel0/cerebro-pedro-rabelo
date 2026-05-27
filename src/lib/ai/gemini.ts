/**
 * Gemini Image Generation for content visuals.
 * Uses Gemini REST API directly (no SDK needed).
 */

import { logApiCost } from '@/lib/ai/client';

export interface ImageGenerationResult {
  image_url: string;
  image_prompt: string;
  image_model: string;
}

/**
 * Generate an image for a content piece using Gemini.
 * Step 1: Use Gemini Flash to craft an image prompt
 * Step 2: Use Gemini Imagen to generate the image
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
                  text: `Você é um diretor de arte. Crie um prompt curto (máximo 100 palavras) em inglês para gerar uma imagem que represente visualmente este conteúdo de ${contentType}. A imagem deve ser profissional, moderna, e adequada para redes sociais. NÃO inclua texto na imagem. Responda APENAS com o prompt, sem explicações.\n\nConteúdo:\n${contentText.slice(0, 1000)}`,
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
      'Professional modern abstract background for social media';

    // Log Gemini Flash prompt cost (~500 input, ~100 output tokens)
    const flashCost = (500 / 1_000_000) * 0.10 + (100 / 1_000_000) * 0.40;
    logApiCost('gemini', 'gemini-2.0-flash', flashCost, {
      input_tokens: 500,
      output_tokens: 100,
    });

    // Step 2: Generate image using Imagen 3 via Gemini API
    const imageRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
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
      }
    );

    if (!imageRes.ok) {
      // Imagen might not be available, try the Gemini image generation model
      console.log('[Gemini] Imagen not available, trying gemini-2.0-flash image gen...');

      const fallbackRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
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
        }
      );

      if (!fallbackRes.ok) {
        return { error: `Gemini image generation failed: ${fallbackRes.status}` };
      }

      const fallbackData = await fallbackRes.json();
      const parts = fallbackData.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          logApiCost('gemini', 'gemini-flash-image', 0.03, { unit: 'image', quantity: 1 });
          return {
            image_url: `data:${mimeType};base64,${part.inlineData.data}`,
            image_prompt: imagePrompt,
            image_model: 'gemini-flash-image',
          };
        }
      }

      return { error: 'Gemini não retornou imagem' };
    }

    // Parse Imagen response
    const imageData = await imageRes.json();
    const predictions = imageData.predictions || [];

    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      logApiCost('gemini', 'imagen-3', 0.03, { unit: 'image', quantity: 1 });
      return {
        image_url: `data:image/png;base64,${predictions[0].bytesBase64Encoded}`,
        image_prompt: imagePrompt,
        image_model: 'imagen-3',
      };
    }

    return { error: 'Imagen não retornou imagem' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Gemini Error] generateImage:', message);
    return { error: `Falha ao gerar imagem com Gemini: ${message}` };
  }
}
