/**
 * OpenAI GPT Image — Fallback image generation.
 * Used when Nano Banana Pro / Imagen 4 are unavailable.
 */
import OpenAI from 'openai';
import { logApiCost } from '@/lib/ai/client';

export interface DalleImageResult {
  image_url: string;
  image_prompt: string;
  image_model: string;
}

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Generate a cover/thumbnail image using GPT Image (gpt-image-1).
 * This is the fallback — called when Nano Banana Pro and Imagen 4 both fail.
 */
export async function generateImageWithDalle(
  contentText: string,
  contentType: string,
): Promise<DalleImageResult | { error: string }> {
  try {
    const client = getOpenAIClient();

    // Use GPT-4o with the same elite art director prompt system
    const promptResponse = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are an elite creative director at a top agency. You specialize in dark, premium visual identities for thought leaders.

Your client is Pedro Rabelo — a Brazilian entrepreneur. His brand is ANTI-GURU: direct, provocative, real.

BRAND IDENTITY:
- Primary: Pure black (#0A0A0B) — 90% of the image
- Accent: Blood red (#C9412B) — used sparingly like a wound on darkness
- Aesthetic: Dark luxury minimalism. Apple keynote meets fight club poster.
- Mood: Powerful, provocative, premium.

CRITICAL RULES:
1. ZERO text, letters, numbers, logos, or watermarks
2. ZERO faces or recognizable people
3. Use SYMBOLIC/ABSTRACT imagery — gallery-worthy art
4. Lighting: rim light, volumetric beams, caustics, neon glow
5. Color: 90% deep blacks/grays, 10% blood red (#C9412B) accents
6. Quality: hyperrealistic, 8K, sharp focus
7. Composition: rule of thirds, strong leading lines, negative space
8. Textures: brushed metal, dark concrete, leather, smoke, glass
9. Camera: cinematic, shallow depth of field

Write a detailed prompt (120-180 words). Be specific about subject, lighting, camera angle, textures, atmosphere. Reply ONLY with the prompt.`,
        },
        {
          role: 'user',
          content: `Create a stunning image prompt for this ${contentType} content:\n\n${contentText.slice(0, 1200)}`,
        },
      ],
    });

    const imagePrompt =
      promptResponse.choices[0]?.message?.content?.trim() ||
      'Dramatic cinematic still life: a single chess king piece carved from obsidian stone, lit by a blood-red volumetric beam cutting through darkness, particles of dust floating in the light, deep black background with subtle smoke tendrils, macro lens perspective, extreme shallow depth of field, the red light creates caustic reflections on the polished stone surface';

    // Log GPT-4o cost
    const promptInputTokens = promptResponse.usage?.prompt_tokens ?? 400;
    const promptOutputTokens = promptResponse.usage?.completion_tokens ?? 180;
    const promptCost =
      (promptInputTokens / 1_000_000) * 2.50 +
      (promptOutputTokens / 1_000_000) * 10.0;
    logApiCost('openai', 'gpt-4o', promptCost, {
      input_tokens: promptInputTokens,
      output_tokens: promptOutputTokens,
    });

    // Generate image with gpt-image-1
    console.log(`[GPT-Image] Generating | prompt: ${imagePrompt.slice(0, 100)}...`);

    const imageResponse = await client.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const b64 = imageResponse.data?.[0]?.b64_json;
    if (b64) {
      console.log('[GPT-Image] Generated successfully');
      logApiCost('openai', 'gpt-image-1', 0.167, { unit: 'image', quantity: 1 });
      return {
        image_url: `data:image/png;base64,${b64}`,
        image_prompt: imagePrompt,
        image_model: 'gpt-image-1',
      };
    }

    const url = imageResponse.data?.[0]?.url;
    if (url) {
      console.log('[GPT-Image] Generated successfully (URL)');
      logApiCost('openai', 'gpt-image-1', 0.167, { unit: 'image', quantity: 1 });
      return {
        image_url: url,
        image_prompt: imagePrompt,
        image_model: 'gpt-image-1',
      };
    }

    return { error: 'GPT Image não retornou imagem' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GPT-Image Error]:', message);
    return { error: `Falha GPT Image: ${message}` };
  }
}
