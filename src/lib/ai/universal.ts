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

// --- Helpers ---

/** Estimate how many proposals based on input size */
function estimateProposalRange(inputLength: number): string {
  if (inputLength < 500) return '2-4';
  if (inputLength < 2000) return '4-6';
  if (inputLength < 5000) return '5-8';
  if (inputLength < 15000) return '6-10';
  return '8-15';
}

/** Split long text into chunks for multi-pass processing */
function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  // Try to split on paragraph boundaries
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// --- System Prompt ---

function buildSystemPrompt(proposalRange: string): string {
  return `RESPONDA SEMPRE EM PT-BR. Traduza tudo se necessario.

Voce e um analista de conteudo EXAUSTIVO. Seu trabalho e extrair TUDO que for relevante de um input — nao perca nenhum insight, framework, historia ou ponto importante.

## 3 tipos de proposta:
- **Playbook**: framework, metodologia, conviccao, principio, processo, regra pratica. content_markdown com ## secoes, listas, passos praticos. CADA framework/principio distinto deve ser um playbook separado.
- **Story**: historia pessoal, caso real, exemplo concreto, situacao vivida, case study. content_markdown com contexto, acontecimento, licao aprendida.
- **Question**: ponto que merece exploracao futura, lacuna no conhecimento, algo que precisa de mais detalhes. content_markdown explicando por que importa.

## Tom do Pedro:
Direto, pratico, contrario ao senso comum. Fala como quem ja operou. Sem guru, sem enrolacao. Portugues brasileiro.

## Regras IMPORTANTES:
- Gere ${proposalRange} propostas — EXTRAIA TUDO, nao resuma em poucas
- Cada insight/framework/historia DISTINTO deve ser uma proposta SEPARADA
- NAO agrupe multiplos conceitos em uma unica proposta
- Se o texto menciona 5 principios diferentes, gere 5 playbooks (um pra cada)
- Se menciona 3 historias, gere 3 stories separadas
- suggested_tags em portugues, 2-4 por proposta
- speaker_verified: true se parece ser o Pedro falando, false caso contrario
- content_markdown deve ser DETALHADO — minimo 100 palavras por proposta

## Responda APENAS com JSON valido (sem markdown code block, sem explicacao antes ou depois):
{
  "detected_type": "youtube|instagram|article|free_text|unknown",
  "title": "Titulo descritivo do conteudo",
  "summary": "Resumo completo em 3-5 frases cobrindo os pontos principais",
  "proposals": [
    {
      "type": "playbook",
      "title": "Nome do framework ou principio",
      "content_markdown": "## Conceito\\n\\nExplicacao detalhada...\\n\\n## Como aplicar\\n\\n1. Passo um...\\n2. Passo dois...",
      "suggested_tags": ["tag1", "tag2"]
    },
    {
      "type": "story",
      "title": "Nome da historia",
      "content_markdown": "## Contexto\\n\\nOnde e quando aconteceu...\\n\\n## O que aconteceu\\n\\nNarrativa...\\n\\n## Licao\\n\\nO que isso ensina...",
      "suggested_tags": ["tag1"]
    }
  ],
  "extracted_themes": ["tema1", "tema2", "tema3"],
  "speaker_verified": true
}`;
}

// --- Main Processing ---

async function processChunk(
  client: ReturnType<typeof getClient>,
  systemPrompt: string,
  userPrompt: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<UniversalInputResult | { error: string }> {
  const chunkLabel = totalChunks > 1 ? ` (parte ${chunkIndex + 1}/${totalChunks})` : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
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

  console.log(`[Universal] AI response${chunkLabel}: ${text.length} chars, ${response.usage.output_tokens} tokens`);

  const parsed = parseJSON<UniversalInputResult>(text);
  if (!parsed) {
    console.error(`[Universal] Failed to parse AI response${chunkLabel}. Raw:`, text.slice(0, 500));
    return { error: `A IA retornou resposta invalida${chunkLabel}. Tente novamente.` };
  }

  return {
    detected_type: parsed.detected_type || 'unknown',
    title: parsed.title || 'Input sem titulo',
    summary: parsed.summary || '',
    source_url: null,
    raw_content: '',
    proposals: parsed.proposals || [],
    extracted_themes: parsed.extracted_themes || [],
    speaker_verified: parsed.speaker_verified ?? false,
  };
}

/**
 * Processes any raw input through Claude. For long texts, splits into chunks
 * and merges results for exhaustive extraction.
 */
export async function processUniversalInput(
  input: string
): Promise<UniversalInputResult | { error: string }> {
  try {
    const client = getClient();
    const isUrl = /^https?:\/\/[^\s]+$/i.test(input.trim());

    // YouTube extraction
    let youtubeContent: { title: string; author: string; transcript: string | null; thumbnail_url: string } | null = null;
    if (isUrl && isYouTubeUrl(input.trim())) {
      console.log('[Universal] Detected YouTube URL, extracting...');
      const extraction = await extractYouTubeContent(input.trim());
      if (!('error' in extraction)) {
        youtubeContent = extraction;
        console.log(`[Universal] YouTube: "${youtubeContent.title}" — transcript: ${youtubeContent.transcript?.length ?? 0} chars`);
      } else {
        console.log(`[Universal] YouTube extraction failed: ${extraction.error}`);
      }
    }

    // Build the raw text to process
    let rawText: string;
    if (youtubeContent?.transcript) {
      const isGemini = youtubeContent.transcript.startsWith('[Análise do vídeo via Gemini');
      rawText = isGemini
        ? `Analise de video YouTube:\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\n\n${youtubeContent.transcript}`
        : `Video YouTube:\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\n\nTranscricao:\n${youtubeContent.transcript}`;
    } else if (youtubeContent) {
      rawText = `Video YouTube (sem transcricao):\nTitulo: ${youtubeContent.title}\nCanal: ${youtubeContent.author}\nURL: ${input.trim()}\n\nGere propostas baseadas no titulo e tema do video.`;
    } else if (isUrl) {
      rawText = `Link: ${input.trim()}\n\nAnalise o dominio, path e contexto para inferir conteudo.`;
    } else {
      rawText = input;
    }

    // Determine proposal range based on content size
    const proposalRange = estimateProposalRange(rawText.length);
    const systemPrompt = buildSystemPrompt(proposalRange);

    console.log(`[Universal] Input: ${rawText.length} chars, target proposals: ${proposalRange}`);

    // For short/medium texts: single pass
    if (rawText.length <= 15000) {
      const userPrompt = `Extraia TODOS os insights, frameworks, historias e pontos relevantes deste conteudo:\n\n${rawText}`;
      const result = await processChunk(client, systemPrompt, userPrompt, 0, 1);

      if ('error' in result) return result;

      return {
        ...result,
        source_url: isUrl ? input.trim() : null,
        raw_content: input,
      };
    }

    // For long texts: split into chunks and merge results
    console.log(`[Universal] Long text (${rawText.length} chars) — splitting into chunks`);
    const chunks = splitIntoChunks(rawText, 12000);
    console.log(`[Universal] Split into ${chunks.length} chunks`);

    const allProposals: ProposalResult[] = [];
    const allThemes: Set<string> = new Set();
    let mainTitle = '';
    let mainSummary = '';
    let detectedType: UniversalInputResult['detected_type'] = 'unknown';
    let speakerVerified = false;

    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = chunks.length > 1
        ? `Este e a PARTE ${i + 1} de ${chunks.length} de um conteudo longo. Extraia TODOS os insights desta parte:\n\n${chunks[i]}`
        : `Extraia TODOS os insights deste conteudo:\n\n${chunks[i]}`;

      const result = await processChunk(client, systemPrompt, chunkPrompt, i, chunks.length);

      if ('error' in result) {
        console.error(`[Universal] Chunk ${i + 1} failed:`, result.error);
        continue; // Skip failed chunk, don't fail everything
      }

      // Merge results
      if (i === 0) {
        mainTitle = result.title;
        mainSummary = result.summary;
        detectedType = result.detected_type;
        speakerVerified = result.speaker_verified;
      }
      allProposals.push(...result.proposals);
      result.extracted_themes.forEach((t) => allThemes.add(t));
    }

    if (allProposals.length === 0) {
      return { error: 'Nenhuma proposta extraida do conteudo. Tente com um texto mais detalhado.' };
    }

    // Deduplicate proposals by title similarity
    const seen = new Set<string>();
    const uniqueProposals = allProposals.filter((p) => {
      const key = p.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[Universal] Total: ${uniqueProposals.length} proposals from ${chunks.length} chunks (${allProposals.length} before dedup)`);

    return {
      detected_type: detectedType,
      title: mainTitle,
      summary: mainSummary + (chunks.length > 1 ? ` (processado em ${chunks.length} partes, ${uniqueProposals.length} propostas extraidas)` : ''),
      source_url: isUrl ? input.trim() : null,
      raw_content: input,
      proposals: uniqueProposals,
      extracted_themes: Array.from(allThemes),
      speaker_verified: speakerVerified,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Error] processUniversalInput:', message);
    return { error: `Falha ao processar input: ${message}` };
  }
}
