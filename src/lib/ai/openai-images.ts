/**
 * OpenAI GPT Image — Fallback image generation.
 * Used when Nano Banana Pro / Imagen 4 are unavailable.
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
 * This is the fallback — called when Nano Banana Pro and Imagen 4 both fail.
 */
export async function generateImageWithDalle(
  contentText: string,
  contentType: string,
): Promise<DalleImageResult | { error: string }> {
  try {
    const client = getOpenAIClient();

    // Use GPT-4o with the same elite art director prompt system
    const promptResponse = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `Você é um designer gráfico especialista em infográficos para Instagram no estilo dos maiores criadores brasileiros: Alfredo Soares (@alfredosoares), Thiago Nigro, Flavio Augusto.

Seu cliente é Pedro Rabelo — empreendedor brasileiro.

IDENTIDADE VISUAL:
- Fundo: PRETO PURO (#0A0A0B) — sempre
- Destaque: VERMELHO VIBRANTE (#E31B23) — elementos 3D, badges, destaques
- Texto: BRANCO (#FFFFFF) — títulos bold grandes
- Secundário: CINZA (#666666) — labels, linhas conectoras

ESTILO OBRIGATÓRIO — INFOGRÁFICO EDUCATIVO:
1. É DESIGN GRÁFICO / INFOGRÁFICO — NÃO é foto, NÃO é arte abstrata
2. Fundo SEMPRE preto puro (#0A0A0B)
3. Elementos visuais: diagramas de Venn, escadas 3D vermelhas, blocos, fluxogramas, matrizes
4. Tipografia: títulos ENORMES em branco bold no topo
5. Ícones minimalistas brancos dentro de shapes vermelhos
6. Linhas conectoras finas ligando conceitos
7. Labels explicativas em caixas com borda tracejada
8. Elementos 3D vermelhos com sombra realista
9. Pode ter TEXTO no design (títulos, labels, números)
10. Composição limpa, hierarquia visual clara

Escreva um prompt detalhado (120-180 palavras) para gerar um INFOGRÁFICO PROFISSIONAL. Responda APENAS com o prompt.`,
        },
        {
          role: 'user',
          content: `Create a stunning image prompt for this ${contentType} content:\n\n${contentText.slice(0, 1200)}`,
        },
      ],
    });

    const imagePrompt =
      promptResponse.choices[0]?.message?.content?.trim() ||
      'Infográfico profissional estilo Instagram brasileiro: fundo preto puro (#0A0A0B), título grande em branco bold no topo "FRAMEWORK DE DECISÃO", diagrama de 4 quadrantes com bordas vermelhas (#E31B23) sobre fundo preto, cada quadrante com ícone branco minimalista e label em branco, linhas conectoras finas cinza entre os quadrantes, elemento central vermelho 3D com sombra, labels explicativas em caixas com borda tracejada cinza ao redor, @pedrorabelo pequeno no canto inferior direito em cinza, design limpo e profissional';

    // Log GPT-4o cost
    const promptInputTokens = promptResponse.usage?.prompt_tokens ?? 400;
    const promptOutputTokens = promptResponse.usage?.completion_tokens ?? 180;
    const promptCost =
      (promptInputTokens / 1_000_000) * 2.50 +
      (promptOutputTokens / 1_000_000) * 10.0;
    logApiCost('openai', 'gpt-4o', promptCost, {
      input_tokens: promptInputTokens,
      output_tokens: promptOutputTokens,
    });

    // Generate image with gpt-image-1
    console.log(`[GPT-Image] Generating | prompt: ${imagePrompt.slice(0, 100)}...`);

    const imageResponse = await client.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const b64 = imageResponse.data?.[0]?.b64_json;
    if (b64) {
      console.log('[GPT-Image] Generated successfully');
      logApiCost('openai', 'gpt-image-1', 0.167, { unit: 'image', quantity: 1 });
      return {
        image_url: `data:image/png;base64,${b64}`,
        image_prompt: imagePrompt,
        image_model: 'gpt-image-1',
      };
    }

    const url = imageResponse.data?.[0]?.url;
    if (url) {
      console.log('[GPT-Image] Generated successfully (URL)');
      logApiCost('openai', 'gpt-image-1', 0.167, { unit: 'image', quantity: 1 });
      return {
        image_url: url,
        image_prompt: imagePrompt,
        image_model: 'gpt-image-1',
      };
    }

    return { error: 'GPT Image não retornou imagem' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GPT-Image Error]:', message);
    return { error: `Falha GPT Image: ${message}` };
  }
}
