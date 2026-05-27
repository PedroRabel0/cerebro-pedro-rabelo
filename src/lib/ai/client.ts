import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

/**
 * Generic cost logger for any API provider.
 * Fire-and-forget: persists to Supabase silently.
 */
export function logApiCost(
  provider: string,
  model: string,
  cost_usd: number,
  details?: { input_tokens?: number; output_tokens?: number; unit?: string; quantity?: number }
) {
  console.log(`[API Cost] ${provider}/${model} | $${cost_usd.toFixed(4)}`);

  createClient()
    .then((supabase) =>
      supabase.from('api_cost_log').insert({
        provider,
        model,
        input_tokens: details?.input_tokens ?? 0,
        output_tokens: details?.output_tokens ?? 0,
        cost_usd: parseFloat(cost_usd.toFixed(6)),
        created_at: new Date().toISOString(),
      })
    )
    .catch(() => {
      // Silently ignore — table/column may not exist yet
    });
}

/**
 * Legacy cost logger for Anthropic models. Calls logApiCost internally.
 */
export function logCost(model: string, inputTokens: number, outputTokens: number) {
  const costs: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  };
  const rate = costs[model] || { input: 3.0, output: 15.0 };
  const cost =
    (inputTokens / 1_000_000) * rate.input +
    (outputTokens / 1_000_000) * rate.output;

  logApiCost('anthropic', model, cost, {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
}

export function parseJSON<T>(text: string): T | null {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    const match = objectMatch || arrayMatch;
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
