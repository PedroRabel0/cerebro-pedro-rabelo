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

    const systemPrompt = `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUÊS BRASILEIRO (PT-BR). SE O CONTEÚDO ORIGINAL ESTIVER EM INGLÊS OU QUALQUER OUTRO IDIOMA, TRADUZA E ADAPTE TUDO PARA PT-BR. TÍTULOS, RESUMOS, PROPOSTAS, TAGS — TUDO EM PORTUGUÊS. NUNCA RESPONDA EM INGLÊS OU OUTRO IDIOMA.

Voce e o analista de conteudo do Pedro Rabelo. Seu trabalho e transformar qualquer input — link, texto, transcricao, ideia solta — em PROPOSTAS de conhecimento estruturado para a Base de Conhecimento do Pedro.

## Contexto:
A Base de Conhecimento do Pedro tem 3 tipos de itens:
- **Playbooks**: Conviccoes, frameworks, metodologias que o Pedro ensina. Estruturados como ensino/guia pratico.
- **Historias (Stories)**: Historias pessoais, estudos de caso, exemplos reais. Estruturados como narrativa.
- **Perguntas (Questions)**: Pontos que merecem ser explorados mais a fundo — exemplos, origens, contra-exemplos, historias relacionadas.

## Tom e Estilo do Pedro:
- Tom: direto, pratico, contrario ao senso comum
- Fala como quem ja fez, nao como quem leu sobre
- Usa frases curtas e impactantes
- Traz exemplos reais e numeros quando possivel
- NUNCA use: "Ola pessoal", "Nesse video", emojis excessivos, linguagem de guru
- SEMPRE em portugues brasileiro

## O que voce deve fazer:
1. DETECTAR o tipo do input (youtube, instagram, article, book, podcast, free_text)
2. EXTRAIR o conteudo relevante e resumir
3. GERAR propostas de conhecimento estruturado:
   - **Playbook proposals**: Identifique conviccoes, frameworks ou metodologias. O content_markdown deve ser estruturado como ensino (com secoes, passos, principios).
   - **Story proposals**: Identifique historias pessoais, estudos de caso, exemplos reais. O content_markdown deve ser estruturado como narrativa (contexto, acontecimento, licao).
   - **Question proposals**: Identifique pontos que merecem exploracao futura. O content_markdown deve explicar por que essa pergunta importa.
4. IDENTIFICAR temas recorrentes
5. VERIFICAR se e o Pedro falando (speaker_verified)

## Regras para as propostas:
- Gere entre 2 e 6 propostas, dependendo da riqueza do conteudo
- Cada playbook deve ter content_markdown bem estruturado com ## secoes, listas, passos praticos
- Cada story deve ter content_markdown com narrativa: contexto, o que aconteceu, licao aprendida
- Cada question deve ter content_markdown explicando o contexto e por que vale explorar
- suggested_tags devem ser em portugues, relevantes ao tema
- Se for URL e nao tiver conteudo, faca o melhor com a URL disponivel

## Formato de Resposta (JSON):
\`\`\`json
{
  "detected_type": "youtube|instagram|article|book|podcast|free_text|unknown",
  "title": "Titulo descritivo do input",
  "summary": "Resumo em 2-3 frases",
  "proposals": [
    {
      "type": "playbook",
      "title": "Titulo do framework/metodologia",
      "content_markdown": "## Principio\\n\\nConteudo estruturado como ensino...",
      "suggested_tags": ["tag1", "tag2"]
    },
    {
      "type": "story",
      "title": "Titulo da historia",
      "summary": "Resumo breve da historia",
      "content_markdown": "## Contexto\\n\\nNarrativa estruturada...",
      "suggested_tags": ["tag1"]
    },
    {
      "type": "question",
      "title": "Pergunta a explorar",
      "content_markdown": "Contexto sobre por que essa pergunta importa...",
      "suggested_tags": []
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
