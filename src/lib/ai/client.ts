import Anthropic from '@anthropic-ai/sdk';
import { after } from 'next/server';
// ADMIN client (service_role): sem sessao aqui, ou operacao que exige bypass de RLS
import { createAdminClient as createClient } from '@/lib/supabase/server';

import { log } from '@/lib/logger';
export function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Vercel Hobby caps functions at 60s. Fail fast (50s) with a catchable error
    // instead of being silently reaped mid-request. maxRetries: 0 because a single
    // SDK retry (default 2) on a ~30s call deterministically exceeds the 60s budget.
    timeout: 50_000,
    maxRetries: 0,
  });
}

/**
 * Generic cost logger for any API provider.
 * Usa after() do Next para garantir a execucao POS-resposta: o
 * fire-and-forget antigo morria em voo quando a instancia serverless era
 * congelada ao retornar — justamente nas chamadas caras que terminam perto
 * do fim da funcao. Tambem checa o { error } do insert (o client Supabase
 * NAO lanca), senao um problema de RLS/schema apagaria o rastreio de custo
 * de TODOS os provedores em silencio.
 */
export function logApiCost(
  provider: string,
  model: string,
  cost_usd: number,
  details?: { input_tokens?: number; output_tokens?: number; unit?: string; quantity?: number }
) {
  log.info(`[API Cost] ${provider}/${model} | $${cost_usd.toFixed(4)}`);

  const persist = async () => {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from('api_cost_log').insert({
        provider,
        model,
        input_tokens: details?.input_tokens ?? 0,
        output_tokens: details?.output_tokens ?? 0,
        cost_usd: parseFloat(cost_usd.toFixed(6)),
        created_at: new Date().toISOString(),
      });
      if (error) log.error('[API Cost] insert failed:' + ' ' + String(error.message));
    } catch (err) {
      log.error('[API Cost] persist error:' + ' ' + String(err));
    }
  };

  try {
    after(persist);
  } catch {
    // Fora de request scope (ex.: teste) — melhor tentar do que perder
    void persist();
  }
}

/**
 * Legacy cost logger for Anthropic models. Calls logApiCost internally.
 */
export function logCost(model: string, inputTokens: number, outputTokens: number) {
  const costs: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    // Preco real do Haiku 4.5: $1/$5 por MTok (o $0.8/$4 antigo subestimava)
    'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
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
  // Try 1: Extract from ```json ... ``` blocks (greedy — handles large responses)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  const candidate = jsonMatch ? jsonMatch[1].trim() : text.trim();

  // Try 2: Direct parse
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // noop
  }

  // Try 3: Find the outermost { ... } or [ ... ] in the full text
  // Use a bracket-counting approach for reliability with large JSON
  const startIdx = text.indexOf('{');
  if (startIdx !== -1) {
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx !== -1) {
      try {
        return JSON.parse(text.slice(startIdx, endIdx + 1)) as T;
      } catch {
        // noop
      }
    }
  }

  // Try 4: Array
  const arrStart = text.indexOf('[');
  if (arrStart !== -1) {
    let depth = 0;
    let endIdx = -1;
    for (let i = arrStart; i < text.length; i++) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx !== -1) {
      try {
        return JSON.parse(text.slice(arrStart, endIdx + 1)) as T;
      } catch {
        // noop
      }
    }
  }

  return null;
}
