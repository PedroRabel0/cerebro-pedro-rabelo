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
 */
export async function generateImageWithDalle(
  contentText: string,
  contentType: string,
): Promise<DalleImageResult | { error: string }> {
  try {
    const client = getOpenAIClient();

    // First, use GPT to create an optimized image prompt
    const promptResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'You are an art director. Create a short image prompt (max 80 words) for a professional social media image. NO text in the image. Modern, clean aesthetic with dark tones (black background, red accents #C9412B). Reply ONLY with the prompt.',
        },
        {
          role: 'user',
          content: `Create an image prompt for this ${contentType} content:\n\n${contentText.slice(0, 800)}`,
        },
      ],
    });

    const imagePrompt =
      promptResponse.choices[0]?.message?.content?.trim() ||
      'Professional modern abstract background for social media content, dark black background with red accent lighting';

    // Log GPT-4o-mini cost (~200 input, ~80 output tokens)
    const promptInputTokens = promptResponse.usage?.prompt_tokens ?? 200;
    const promptOutputTokens = promptResponse.usage?.completion_tokens ?? 80;
    const promptCost =
      (promptInputTokens / 1_000_000) * 0.15 +
      (promptOutputTokens / 1_000_000) * 0.60;
    logApiCost('openai', 'gpt-4o-mini', promptCost, {
      input_tokens: promptInputTokens,
      output_tokens: promptOutputTokens,
    });

    // Generate image with gpt-image-1
    console.log(`[GPT-Image] Generating image | prompt: ${imagePrompt.slice(0, 80)}...`);

    const imageResponse = await client.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'low',
    });

    // gpt-image-1 returns b64_json by default
    const b64 = imageResponse.data?.[0]?.b64_json;
    if (b64) {
      console.log(`[GPT-Image] Generated image successfully (base64)`);
      logApiCost('openai', 'gpt-image-1', 0.011, { unit: 'image', quantity: 1 });
      return {
        image_url: `data:image/png;base64,${b64}`,
        image_prompt: imagePrompt,
        image_model: 'gpt-image-1',
      };
    }

    const url = imageResponse.data?.[0]?.url;
    if (url) {
      console.log(`[GPT-Image] Generated image successfully (URL)`);
      logApiCost('openai', 'gpt-image-1', 0.011, { unit: 'image', quantity: 1 });
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
