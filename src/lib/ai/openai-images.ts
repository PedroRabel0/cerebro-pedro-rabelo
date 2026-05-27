/**
 * OpenAI DALL-E Image Generation for content covers and thumbnails.
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
 * Uses HIGH quality for professional results comparable to ChatGPT.
 */
export async function generateImageWithDalle(
  contentText: string,
  contentType: string,
): Promise<DalleImageResult | { error: string }> {
  try {
    const client = getOpenAIClient();

    // Use GPT-4o to create a rich, detailed image prompt (not mini — quality matters)
    const promptResponse = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a world-class art director for social media content. Your job is to create detailed, vivid image prompts that produce stunning visuals.

BRAND GUIDELINES:
- Dark, premium aesthetic: deep black backgrounds (#0A0A0A)
- Bold red accent color (#C9412B) used sparingly for impact
- Modern, minimalist, high-contrast
- Professional and sophisticated — think luxury brand meets tech startup

RULES:
- Write a detailed prompt (100-150 words) describing the EXACT image to generate
- Include specific visual details: lighting, composition, mood, textures, colors
- NO text or words in the image — pure visual art
- Think cinematic, editorial quality — as if shot for a magazine
- Use dramatic lighting (rim light, volumetric light, dramatic shadows)
- Reply ONLY with the prompt, no explanations`,
        },
        {
          role: 'user',
          content: `Create a stunning image prompt for this ${contentType} content. The image will be used as a cover/thumbnail on Instagram.\n\nContent:\n${contentText.slice(0, 1200)}`,
        },
      ],
    });

    const imagePrompt =
      promptResponse.choices[0]?.message?.content?.trim() ||
      'Dramatic cinematic still life with deep black background, subtle red accent lighting, modern minimalist composition, professional editorial quality, volumetric lighting, high contrast';

    // Log GPT-4o cost
    const promptInputTokens = promptResponse.usage?.prompt_tokens ?? 300;
    const promptOutputTokens = promptResponse.usage?.completion_tokens ?? 150;
    const promptCost =
      (promptInputTokens / 1_000_000) * 2.50 +
      (promptOutputTokens / 1_000_000) * 10.0;
    logApiCost('openai', 'gpt-4o', promptCost, {
      input_tokens: promptInputTokens,
      output_tokens: promptOutputTokens,
    });

    // Generate image with gpt-image-1 at HIGH quality
    console.log(`[GPT-Image] Generating HIGH quality image | prompt: ${imagePrompt.slice(0, 100)}...`);

    const imageResponse = await client.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    // gpt-image-1 returns b64_json by default
    const b64 = imageResponse.data?.[0]?.b64_json;
    if (b64) {
      console.log(`[GPT-Image] Generated HIGH quality image successfully`);
      // High quality costs ~$0.167 per image
      logApiCost('openai', 'gpt-image-1', 0.167, { unit: 'image', quantity: 1 });
      return {
        image_url: `data:image/png;base64,${b64}`,
        image_prompt: imagePrompt,
        image_model: 'gpt-image-1',
      };
    }

    const url = imageResponse.data?.[0]?.url;
    if (url) {
      console.log(`[GPT-Image] Generated HIGH quality image successfully (URL)`);
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
    console.error('[OpenAI Error] generateImage:', message);
    return { error: `Falha ao gerar imagem com GPT Image: ${message}` };
  }
}
