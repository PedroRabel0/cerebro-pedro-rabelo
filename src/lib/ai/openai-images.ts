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
          content: `You are an elite art director creating prompts for AI image generators. You produce STUNNING infographic designs in the style of @alfredosoares and @gabrielbechi — top Brazilian Instagram business educators.

Client: Pedro Rabelo (@pedrorabelo) — Brazilian entrepreneur.

## THE #1 BRAND ELEMENT — RED HIGHLIGHT BOX (MANDATORY):
Every design MUST have the main keyword in the title inside a solid red (${colors.accent}) rectangle with rounded corners, white text inside. Like: "ANATOMIA DO [VALOR DE MARCA]", "O FUNIL [AMPULHETA]".

## VISUAL STRUCTURES (choose the BEST one for the content):
- RADIAL WHEEL: central concept + surrounding components (for ecosystems, pillars)
- 3D PYRAMID: layers with perspective/depth (for hierarchies, levels)
- FUNNEL: narrowing layers (for conversion, journey stages)
- TABLE: red headers, dark cells (for comparisons, metrics, KPI lists)
- CIRCULAR + SATELLITES: core circle with orbiting elements (for frameworks)
- DIAMOND SHAPE: faceted with axes (for multi-dimensional models)
- FLOWCHART/CYCLE: connected steps (for processes, workflows)
- CONCENTRIC CIRCLES: nested rings (for layers, depth models)
- NUMBERED LIST WITH ICONS: vertical list with red badges (for tips, rules)

## DESIGN RULES:
- Background: solid black (${colors.bg}), flat, no gradients on bg
- Red (${colors.accent}): highlight boxes, fills, icons — use dark/bright red shades for 3D depth
- White (${colors.text}): headlines, text, icons inside shapes
- Gray #AAAAAA: subtitles. Gray #666666: footer. Gray #333333: borders
- Dark #111111: card backgrounds
- Footer: "@pedrorabelo" right side, gray small text
- Typography: extra-bold sans-serif, massive headlines
- White icons inside red circles for labeled elements
- All text content in PORTUGUESE (audience is Brazilian)
- Premium quality — looks like a top design agency made it
- NEVER photos, people, realistic scenes — ONLY graphic design

Write a 400-600 word prompt in ENGLISH. Flowing descriptive text (not headers). Be lavishly detailed about every element. Reply with ONLY the prompt.`,
        },
        {
          role: 'user',
          content: `Create a stunning infographic design prompt for this ${contentType} content:\n\n${contentText.slice(0, 1500)}`,
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
