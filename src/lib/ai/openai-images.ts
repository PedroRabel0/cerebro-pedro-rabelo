/**
 * OpenAI GPT-4o — Fallback image PROMPT generation.
 * Generates detailed infographic prompts using GPT-4o when Gemini is unavailable.
 * No actual image generation — user copies the prompt to their preferred AI tool.
 */
import OpenAI from 'openai';
import { logApiCost } from '@/lib/ai/client';

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Generate a detailed infographic image prompt using GPT-4o.
 * Fallback when Gemini Flash is unavailable for prompt generation.
 */
export async function generateImagePromptWithGPT(
  contentText: string,
  contentType: string,
): Promise<{ image_prompt: string } | { error: string }> {
  try {
    const client = getOpenAIClient();

    const promptResponse = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are a senior graphic designer who creates ULTRA DETAILED image prompts for AI image generators. Your prompts produce professional infographic slides in the style of top Brazilian Instagram educators (@alfredosoares, Thiago Nigro).

Your client is Pedro Rabelo — Brazilian entrepreneur.

FIXED PALETTE (always use these exact hex codes):
- Background: solid black (#0A0A0B), completely flat, no gradients
- Accent: vibrant red (#E31B23) — for key title words, shapes, badges
- Main text: pure white (#FFFFFF) — bold headlines
- Secondary text: gray (#666666) — labels, lines, footer

YOUR PROMPT MUST follow this EXACT structure:

Professional Instagram infographic slide, 1080x1080px square.
BACKGROUND: [always solid black #0A0A0B, flat, no gradients]
LAYOUT - TOP SECTION (20%): [subtitle + huge headline with keyword in red]
LAYOUT - CENTER (60%): [diagram type + every element described: position, color hex, text, connections]
LAYOUT - LABELS: [explanatory text boxes with dashed gray lines connecting to diagram]
LAYOUT - FOOTER: [Left: @pedrorabelo in gray, Right: attribution in gray]
STYLE: [clean flat vector, NOT photography, high contrast, crisp typography]

RULES:
1. Prompt MUST be 250-400 words in English
2. Describe EVERY element: exact position, hex color, relative size, exact text
3. Choose the best diagram type for the content (Venn, staircase, matrix, pyramid, flowchart, numbered list)
4. ALWAYS include: headline with keyword in red, central diagram, explanatory labels, footer with @pedrorabelo
5. NEVER describe photos, people, landscapes — ONLY flat graphic design

Reply with ONLY the prompt. No explanations.`,
        },
        {
          role: 'user',
          content: `Create an ultra-detailed infographic image prompt for this ${contentType} content:\n\n${contentText.slice(0, 1200)}`,
        },
      ],
    });

    const imagePrompt =
      promptResponse.choices[0]?.message?.content?.trim() || '';

    if (!imagePrompt) {
      return { error: 'GPT-4o não retornou prompt' };
    }

    // Log GPT-4o cost
    const promptInputTokens = promptResponse.usage?.prompt_tokens ?? 500;
    const promptOutputTokens = promptResponse.usage?.completion_tokens ?? 350;
    const promptCost =
      (promptInputTokens / 1_000_000) * 2.50 +
      (promptOutputTokens / 1_000_000) * 10.0;
    logApiCost('openai', 'gpt-4o', promptCost, {
      input_tokens: promptInputTokens,
      output_tokens: promptOutputTokens,
    });

    console.log(`[GPT-Prompt] Generated prompt (${imagePrompt.length} chars)`);
    return { image_prompt: imagePrompt };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GPT-Prompt Error]:', message);
    return { error: `Falha GPT prompt: ${message}` };
  }
}
