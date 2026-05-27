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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
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
  const brandBase = `Professional Instagram carousel slide, 1080x1080px square format. Brand: black background (#0A0A0A), red accent color (#C9412B), white bold text. Clean modern design, no clutter. High contrast, minimalist.`;

  switch (slidePrompt.type) {
    case 'cover':
      return `${brandBase}
COVER SLIDE design. Large bold white headline text in the center that reads exactly: "${slidePrompt.text.substring(0, 120)}"
The text should be the hero element, very large and impactful.
Subtle red accent line at the top.
Small "PEDRO RABELO" watermark at the bottom in gray.
"Deslize →" in red at the bottom right.
Dark moody gradient background. No photos, no illustrations - pure typography focused.`;

    case 'content':
      return `${brandBase}
CONTENT SLIDE number ${slidePrompt.slideNumber} of ${slidePrompt.totalSlides}.
Large red number "${String(slidePrompt.slideNumber).padStart(2, '0')}" in the top left corner.
A thin red horizontal line separating the number from the content.
The main text content reads: "${slidePrompt.text.substring(0, 200)}"
Text should be white, readable, well-spaced.
Small "@pedrorabelo" watermark at bottom left in dark gray.
"${slidePrompt.slideNumber}/${slidePrompt.totalSlides}" at bottom right in dark gray.
Pure black background, no decorations.`;

    case 'cta':
      return `${brandBase}
CALL-TO-ACTION final slide. The main text reads: "${slidePrompt.text.substring(0, 150)}"
Text should be white, large, and centered.
A red glowing accent behind the text.
Two action buttons below: a red filled button saying "SALVAR" and a red outlined button saying "COMPARTILHAR".
Red accent line at the bottom.
"@pedrorabelo" watermark centered at the very bottom.
Dramatic dark background with subtle red radial glow.`;

    default:
      return `${brandBase} Slide with text: "${slidePrompt.text.substring(0, 200)}"`;
  }
}
