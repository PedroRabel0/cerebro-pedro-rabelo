import { extractYouTubeContent, isYouTubeUrl } from './youtube';
import { getClient, logCost, parseJSON } from './client';

// --- Types ---

export interface ProposalResult {
  type: 'playbook' | 'story' | 'question';
  title: string;
  summary?: string;
  content_markdown: string;
  suggested_tags: string[];
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
  proposals: ProposalResult[];
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

    const systemPrompt = `RESPONDA SEMPRE EM PT-BR. Traduza tudo se necessario.

Voce transforma inputs em propostas de conhecimento estruturado para a base do Pedro Rabelo.

## 3 tipos de proposta:
- Playbook: framework, metodologia, conviccao. content_markdown com ## secoes e passos praticos.
- Story: historia pessoal, caso real. content_markdown com contexto, acontecimento, licao.
- Question: ponto a explorar. content_markdown explicando por que importa.

## Tom do Pedro:
Direto, pratico, contrario ao senso comum. Fala como quem ja fez. Sem guru, sem enrolacao. Portugues brasileiro.

## Regras:
- Gere 2-4 propostas dependendo da riqueza do conteudo
- suggested_tags em portugues
- speaker_verified: true se parece ser o Pedro falando, false se nao

## Responda APENAS com JSON valido (sem markdown, sem explicacao):
{
  "detected_type": "youtube|instagram|article|free_text|unknown",
  "title": "Titulo descritivo",
  "summary": "Resumo em 2-3 frases",
  "proposals": [
    {
      "type": "playbook",
      "title": "Titulo do playbook",
      "content_markdown": "## Principio\\n\\nConteudo estruturado...",
      "suggested_tags": ["tag1", "tag2"]
    }
  ],
  "extracted_themes": ["tema1", "tema2"],
  "speaker_verified": true
}`;

    // Build user prompt based on available content
    let userPrompt: string;
    if (youtubeContent && youtubeContent.transcript) {
      // We have real YouTube transcript or Gemini analysis
      const isGeminiAnalysis = youtubeContent.transcript.startsWith('[Análise do vídeo via Gemini');
      userPrompt = isGeminiAnalysis
        ? `Processe esta analise de video do YouTube:\n\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\n\n${youtubeContent.transcript}\n\nCom base nesta analise detalhada, gere propostas de playbooks, historias e perguntas para a Base de Conhecimento.`
        : `Processe este video do YouTube:\n\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\n\nTranscricao:\n${youtubeContent.transcript}`;
    } else if (youtubeContent && !youtubeContent.transcript) {
      // YouTube URL but no transcript - use metadata
      userPrompt = `Processe este video do YouTube baseado no titulo e canal:\n\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\nURL: ${input.trim()}\n\nNao foi possivel obter a transcricao completa, mas gere propostas de conhecimento baseadas no titulo, canal e tema do video. Faca sua melhor inferencia sobre o conteudo.`;
    } else if (isUrl) {
      userPrompt = `Processe este link e extraia todo o conhecimento possivel:\n\n${input.trim()}\n\nNota: Voce nao pode acessar a URL, mas analise o dominio, path, e qualquer contexto para inferir o conteudo.`;
    } else {
      userPrompt = `Processe este texto/transcricao e extraia todo o conhecimento possivel:\n\n${input}`;
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096, // Reduced from 8192 — proposals don't need more
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
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
      console.error('[Universal] Failed to parse AI response. Raw text:', text.slice(0, 500));
      return { error: 'A IA retornou uma resposta que nao pude interpretar. Tente novamente.' };
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
