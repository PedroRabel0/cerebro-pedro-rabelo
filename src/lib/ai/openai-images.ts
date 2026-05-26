/**
 * OpenAI DALL-E Image Generation for content covers and thumbnails.
 */
import OpenAI from 'openai';

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
 * Generate a cover/thumbnail image using DALL-E 3.
 */
export async function generateImageWithDalle(
  contentText: string,
  contentType: string,
  style: 'vivid' | 'natural' = 'vivid'
): Promise<DalleImageResult | { error: string }> {
  try {
    const client = getOpenAIClient();

    // First, use GPT to create an optimized DALL-E prompt
    const promptResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'You are an art director. Create a short DALL-E prompt (max 80 words) for a professional social media image. NO text in the image. Modern, clean aesthetic. Reply ONLY with the prompt.',
        },
        {
          role: 'user',
          content: `Create an image prompt for this ${contentType} content:\n\n${contentText.slice(0, 800)}`,
        },
      ],
    });

    const imagePrompt =
      promptResponse.choices[0]?.message?.content?.trim() ||
      'Professional modern abstract background for social media content';

    // Generate image with DALL-E 3
    const imageResponse = await client.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style,
    });

    const imageUrl = imageResponse.data?.[0]?.url;
    if (!imageUrl) {
      return { error: 'DALL-E não retornou URL de imagem' };
    }

    console.log(
      `[DALL-E] Generated image | prompt: ${imagePrompt.slice(0, 50)}...`
    );

    return {
      image_url: imageUrl,
      image_prompt: imagePrompt,
      image_model: 'dall-e-3',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[OpenAI Error] generateImage:', message);
    return { error: `Falha ao gerar imagem com DALL-E: ${message}` };
  }
}
