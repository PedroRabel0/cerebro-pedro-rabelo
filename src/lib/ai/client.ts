import Anthropic from '@anthropic-ai/sdk';

export function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export function logCost(model: string, inputTokens: number, outputTokens: number) {
  const costs: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  };
  const rate = costs[model] || { input: 3.0, output: 15.0 };
  const cost =
    (inputTokens / 1_000_000) * rate.input +
    (outputTokens / 1_000_000) * rate.output;
  console.log(
    `[AI Cost] ${model} | in: ${inputTokens} | out: ${outputTokens} | $${cost.toFixed(4)}`
  );
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
