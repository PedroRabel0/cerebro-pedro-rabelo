/**
 * Image Generation via OpenAI GPT-image-1
 * Generates images directly from prompts using the same model as Genspark.
 */

import { logApiCost } from '@/lib/ai/client';

import { log } from '@/lib/logger';
export interface GeneratedImage {
  base64: string;
  format: string;
  prompt_used: string;
}

/**
 * Generate an image using GPT-image-1.
 * Returns base64-encoded image data or error.
 */
export async function generateImage(
  prompt: string,
  options?: {
    size?: '1024x1024' | '1536x1024' | '1024x1536';
    quality?: 'auto' | 'high' | 'medium' | 'low';
    format?: 'png' | 'jpeg' | 'webp';
  }
): Promise<GeneratedImage | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: 'OPENAI_API_KEY not configured' };

  const size = options?.size || '1024x1024';
  // 'high' por padrao: qualidade maxima pro Instagram (custa ~4x o 'medium';
  // decisao do usuario em 07/jul/2026 priorizando nitidez sobre custo).
  const quality = options?.quality || 'high';
  const format = options?.format || 'png';

  try {
    log.info(`[ImageGen] Generating with gpt-image-1 (${size}, ${quality})...`);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size,
        quality,
        output_format: format,
      }),
      // 45s: precisa caber no maxDuration de 60s da Vercel junto com a geracao
      // do prompt — 120s fazia a plataforma matar a funcao antes do catch rodar.
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      log.error(`[ImageGen] API error ${response.status}:` + " " + String(errorText.slice(0, 300)));

      // Check for common errors
      if (response.status === 401) return { error: 'API key invalida. Verifique OPENAI_API_KEY.' };
      if (response.status === 429) return { error: 'Rate limit atingido. Tente novamente em alguns minutos.' };
      if (response.status === 400 && errorText.includes('organization_verification')) {
        return { error: 'Verificacao da organizacao necessaria. Acesse platform.openai.com para verificar.' };
      }
      if (response.status === 400 && errorText.includes('content_policy')) {
        return { error: 'O prompt foi rejeitado pela politica de conteudo. Tente reformular.' };
      }

      return { error: `Erro ao gerar imagem: HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0 || !data.data[0].b64_json) {
      log.error('[ImageGen] No image data in response');
      return { error: 'A API nao retornou imagem. Tente novamente.' };
    }

    // Log cost — precos reais do gpt-image-1 (1024x1024; retrato/paisagem
    // custam ~50% mais). O map antigo subestimava 'high' em ~50%.
    const costMap: Record<string, number> = {
      'low': 0.011,
      'medium': 0.042,
      'high': 0.167,
      'auto': 0.042,
    };
    logApiCost('openai', 'gpt-image-1', costMap[quality] || 0.042, {
      unit: 'image',
      quantity: 1,
    });

    log.info(`[ImageGen] Image generated successfully (${format}, ${size})`);

    return {
      base64: data.data[0].b64_json,
      format,
      prompt_used: prompt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    log.error('[ImageGen] Error:' + " " + String(message));
    return { error: `Falha ao gerar imagem: ${message}` };
  }
}
