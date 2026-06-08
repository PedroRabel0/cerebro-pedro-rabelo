/**
 * OpenAI GPT-4o — Fallback image PROMPT generation.
 * Generates detailed infographic prompts using GPT-4o when Gemini is unavailable.
 * Now reads brand colors from identity (passed via BrandConfig).
 */
import OpenAI from 'openai';
import { logApiCost } from '@/lib/ai/client';

import { log } from '@/lib/logger';
interface BrandColors {
  bg: string;
  accent: string;
  text: string;
}

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Generate a detailed infographic image prompt using GPT-4o.
 * Fallback when Gemini Flash is unavailable for prompt generation.
 * Accepts optional brand config with colors from the DB identity.
 */
export async function generateImagePromptWithGPT(
  contentText: string,
  contentType: string,
  brand?: { colors: BrandColors; references?: string; mood?: string },
): Promise<{ image_prompt: string } | { error: string }> {
  const colors = brand?.colors || { bg: '#0A0A0B', accent: '#E31B23', text: '#FFFFFF' };
  const references = brand?.references || '@alfredosoares, Thiago Nigro';
  const mood = brand?.mood || 'Educativo, direto, autoridade';

  try {
    const client = getOpenAIClient();

    const promptResponse = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are a senior graphic designer who creates ULTRA DETAILED image prompts for AI image generators. You specialize in the EXACT visual style of top Brazilian Instagram educators: ${references}.

Your client: Pedro Rabelo — Brazilian entrepreneur.
Brand mood: ${mood}

## VISUAL DNA (the defining characteristics you MUST replicate):
1. BACKGROUND: Always solid pure black (${colors.bg}). Never gradients, never textures. Completely flat.
2. ACCENT: Vibrant red (${colors.accent}) for keyword badges, shape fills, staircase elements, table headers, chart fills, circle outlines.
3. TEXT: White (${colors.text}) bold sans-serif headlines. Gray (#AAAAAA) subtitles. Gray (#666666) labels/footer.
4. CORE ELEMENT — structured diagram: Venn (red-outlined circles), pyramids (gray layers + dashed labels), 3D red staircases with white icons, tables (red headers, #111111 cells, #333333 borders), radar charts (red fill), flowcharts (dark boxes, dashed arrows), side-by-side comparisons.
5. SIGNATURE: 2-4 small text labels around diagram connected by DASHED gray (#666666) lines.
6. HIERARCHY: Small subtitle → HUGE bold headline (keyword in red badge) → diagram → labels → footer.
7. FOOTER: Gray (#666666) small text. Left: hashtag/description. Right: "@pedrorabelo".

STRICT PALETTE:
- Background: ${colors.bg} solid black, flat
- Accent: ${colors.accent} vibrant red
- Primary text: ${colors.text} white bold
- Secondary: #AAAAAA gray
- Labels/footer: #666666 gray
- Borders: #333333 dark gray
- Dark fills: #111111

YOUR PROMPT MUST follow this structure:
Professional infographic slide, [dimensions].
BACKGROUND: Solid pure black (${colors.bg}), flat, no gradients.
TOP (15-20%): [subtitle in gray + HUGE headline with keyword in red badge]
CENTER (55-65%): [diagram type + EVERY element: position, hex color, fill, outline, text, connections]
LABELS: [2-4 annotation boxes with dashed gray #666666 line connectors]
FOOTER: [Left: text/hashtag in gray, Right: @pedrorabelo in gray]
STYLE: [flat vector, NO photography, high contrast, crisp sans-serif]

RULES:
1. Prompt MUST be 300-500 words in ENGLISH
2. Describe EVERY element with exact position, hex color, size, text
3. Choose the BEST diagram for the content (Venn, staircase, matrix, pyramid, radar, flowchart, comparison, list)
4. ALWAYS include dashed-line label annotations (signature style)
5. ALWAYS include red badge for main keyword in headline
6. NEVER describe photos, people, landscapes — ONLY flat graphic design
7. Invent relevant Portuguese text for diagram labels based on content

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

    log.info(`[GPT-Prompt] Generated prompt (${imagePrompt.length} chars)`);
    return { image_prompt: imagePrompt };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('[GPT-Prompt Error]:' + " " + String(message));
    return { error: `Falha GPT prompt: ${message}` };
  }
}
