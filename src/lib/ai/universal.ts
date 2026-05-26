import { extractYouTubeContent, isYouTubeUrl } from './youtube';
import { getClient, logCost, parseJSON } from './client';

// --- Types ---

export interface GeneratedPost {
  platform: 'instagram_carousel' | 'linkedin_post' | 'x_thread';
  title: string;
  caption: string;
  hashtags: string[];
  hook: string;
  cta: string;
  slides?: string[];
}

export interface UniversalInputResult {
  detected_type:
    | 'youtube'
    | 'instagram'
    | 'article'
    | 'book'
    | 'podcast'
    | 'free_text'
    | 'unknown';
  title: string;
  summary: string;
  source_url: string | null;
  raw_content: string;
  proposals: GeneratedPost[];
  extracted_themes: string[];
  speaker_verified: boolean;
}

// --- Exported Function ---

/**
 * Processes any raw input (URL or free text) through Claude and returns
 * structured knowledge: detected type, summary, proposals, and themes.
 */
export async function processUniversalInput(
  input: string
): Promise<UniversalInputResult | { error: string }> {
  try {
    const client = getClient();

    // Detect if input is a URL
    const urlPattern = /^https?:\/\/[^\s]+$/i;
    const isUrl = urlPattern.test(input.trim());

    // If it's a YouTube URL, try to extract real content first
    let youtubeContent: { title: string; author: string; transcript: string | null; thumbnail_url: string } | null = null;
    if (isUrl && isYouTubeUrl(input.trim())) {
      console.log('[Universal] Detected YouTube URL, extracting content...');
      const extraction = await extractYouTubeContent(input.trim());
      if ('error' in extraction) {
        console.log(`[Universal] YouTube extraction failed: ${extraction.error}`);
      } else {
        youtubeContent = extraction;
        console.log(`[Universal] YouTube extraction successful: "${youtubeContent.title}" by ${youtubeContent.author}`);
        if (youtubeContent.transcript) {
          console.log(`[Universal] Transcript available: ${youtubeContent.transcript.length} chars`);
        } else {
          console.log('[Universal] No transcript available, will fall back to URL-only processing');
        }
      }
    }

    const systemPrompt = `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUÊS BRASILEIRO (PT-BR). SE O CONTEÚDO ORIGINAL ESTIVER EM INGLÊS OU QUALQUER OUTRO IDIOMA, TRADUZA E ADAPTE TUDO PARA PT-BR. TÍTULOS, RESUMOS, PROPOSTAS, TAGS, POSTS — TUDO EM PORTUGUÊS. NUNCA RESPONDA EM INGLÊS OU OUTRO IDIOMA.

Voce e o ghostwriter do Pedro Rabelo. Seu trabalho e transformar qualquer input — link, texto, transcricao, ideia solta — em POSTS PRONTOS para publicar.

## Tom e Estilo do Pedro:
- Tom: direto, pratico, contrario ao senso comum
- Fala como quem ja fez, nao como quem leu sobre
- Usa frases curtas e impactantes
- Traz exemplos reais e numeros quando possivel
- NUNCA use: "Ola pessoal", "Nesse video", emojis excessivos, linguagem de guru
- NUNCA use frases genericas tipo "vou te contar um segredo", "a maioria das pessoas nao sabe"
- SEMPRE em portugues brasileiro
- Baseie-se no conteudo fornecido para criar posts que o Pedro publicaria

## O que voce deve fazer:
1. DETECTAR o tipo do input (youtube, instagram, article, book, podcast, free_text)
2. EXTRAIR o conteudo relevante e resumir
3. GERAR exatamente 3 posts PRONTOS para publicar:
   - 1 post de Instagram Carousel (com slides)
   - 1 post de LinkedIn
   - 1 thread de X/Twitter
4. IDENTIFICAR temas recorrentes
5. VERIFICAR se e o Pedro falando (speaker_verified)

## Regras para os posts:
- Cada post deve ter um HOOK forte na primeira linha (algo que faca a pessoa parar de rolar)
- O conteudo deve ser ACIONAVEL — o leitor deve sair sabendo fazer algo
- CTA (call-to-action) no final de cada post
- Hashtags relevantes em portugues
- O carousel do Instagram deve ter entre 5-8 slides
- O thread do X deve ter entre 4-7 tweets
- O post do LinkedIn deve ter entre 800-1500 caracteres
- TODOS os posts devem extrair as ideias-chave do conteudo fornecido
- Se for URL e nao tiver conteudo, faca o melhor com a URL disponivel

## Formato de Resposta (JSON):
\`\`\`json
{
  "detected_type": "youtube|instagram|article|book|podcast|free_text|unknown",
  "title": "Titulo descritivo do input",
  "summary": "Resumo em 2-3 frases",
  "proposals": [
    {
      "platform": "instagram_carousel",
      "title": "Titulo interno do post",
      "caption": "Legenda completa do carousel com quebras de linha",
      "hashtags": ["hashtag1", "hashtag2"],
      "hook": "Primeira linha impactante",
      "cta": "Call-to-action final",
      "slides": ["Texto do slide 1 (capa)", "Texto do slide 2", "Texto do slide 3", "..."]
    },
    {
      "platform": "linkedin_post",
      "title": "Titulo interno do post",
      "caption": "Texto completo do post no LinkedIn",
      "hashtags": ["hashtag1", "hashtag2"],
      "hook": "Primeira linha impactante",
      "cta": "Call-to-action final"
    },
    {
      "platform": "x_thread",
      "title": "Titulo interno da thread",
      "caption": "Tweet 1\\n\\nTweet 2\\n\\nTweet 3 (cada tweet separado por linha em branco)",
      "hashtags": ["hashtag1", "hashtag2"],
      "hook": "Primeiro tweet impactante",
      "cta": "Call-to-action no ultimo tweet"
    }
  ],
  "extracted_themes": ["tema1", "tema2"],
  "speaker_verified": true
}
\`\`\``;

    // Build user prompt based on available content
    let userPrompt: string;
    if (youtubeContent && youtubeContent.transcript) {
      // We have real YouTube transcript or Gemini analysis
      const isGeminiAnalysis = youtubeContent.transcript.startsWith('[Análise do vídeo via Gemini');
      userPrompt = isGeminiAnalysis
        ? `Processe esta analise de video do YouTube:\n\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\n\n${youtubeContent.transcript}\n\nCom base nesta analise detalhada, gere os 3 posts prontos para publicar extraindo os melhores insights e topicos abordados.`
        : `Processe este video do YouTube:\n\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\n\nTranscricao:\n${youtubeContent.transcript}`;
    } else if (youtubeContent && !youtubeContent.transcript) {
      // YouTube URL but no transcript - use metadata
      userPrompt = `Processe este video do YouTube baseado no titulo e canal:\n\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\nURL: ${input.trim()}\n\nNao foi possivel obter a transcricao completa, mas crie os 3 posts baseados no titulo, canal e tema do video. Faca sua melhor inferencia sobre o conteudo.`;
    } else if (isUrl) {
      userPrompt = `Processe este link e extraia todo o conhecimento possivel:\n\n${input.trim()}\n\nNota: Voce nao pode acessar a URL, mas analise o dominio, path, e qualquer contexto para inferir o conteudo.`;
    } else {
      userPrompt = `Processe este texto/transcricao e extraia todo o conhecimento possivel:\n\n${input}`;
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    logCost(
      'claude-sonnet-4-6',
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const parsed = parseJSON<UniversalInputResult>(text);
    if (!parsed) {
      return { error: 'Falha ao processar input' };
    }

    return {
      detected_type: parsed.detected_type || 'unknown',
      title: parsed.title || 'Input sem titulo',
      summary: parsed.summary || '',
      source_url: isUrl ? input.trim() : null,
      raw_content: input,
      proposals: parsed.proposals || [],
      extracted_themes: parsed.extracted_themes || [],
      speaker_verified: parsed.speaker_verified ?? false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Error] processUniversalInput:', message);
    return { error: `Falha ao processar input: ${message}` };
  }
}
