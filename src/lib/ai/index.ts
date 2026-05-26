import {
  Identity,
  Playbook,
  Story,
  Format,
  Feedback,
  buildContentGenerationSystemPrompt,
  buildContentGenerationUserPrompt,
  buildProcessCaptureSystemPrompt,
  buildProcessCaptureUserPrompt,
  buildCompletenessAnalysisSystemPrompt,
  buildCompletenessAnalysisUserPrompt,
  buildBookQuestionsSystemPrompt,
  buildBookQuestionsUserPrompt,
  buildDNAAnalysisSystemPrompt,
  buildDNAAnalysisUserPrompt,
} from './prompts';
import { getClient, logCost, parseJSON } from './client';

// --- Types ---

export interface GenerateContentParams {
  identity: Identity;
  playbook?: Playbook;
  story?: Story;
  contentType: string;
  format?: Format;
  freeText?: string;
  recentFeedbacks?: Feedback[];
}

export interface GenerateContentResult {
  content_text: string;
  source_map: Record<string, unknown>;
}

export interface Proposal {
  type: 'playbook' | 'story' | 'question';
  title: string;
  content_markdown: string;
  suggested_tags: string[];
}

export interface ProcessCaptureResult {
  proposals: Proposal[];
  speaker_verified: boolean;
}

export interface CompletenessResult {
  completeness_score: number;
  has_example: boolean;
  has_story: boolean;
  has_origin: boolean;
  has_counterexample: boolean;
  questions: string[];
}

export interface BookQuestion {
  question: string;
  type: 'example' | 'origin' | 'counterexample' | 'story' | 'meaning' | 'person';
}

export interface DNAResult {
  hook_type: string;
  structure: string;
  length: string;
  tone: string;
  cta_type: string;
  main_theme: string;
  sub_theme: string;
  thesis: string;
}

// --- Exported Functions ---

/**
 * Generates content using Claude Sonnet based on identity, playbook, story, and format.
 */
export async function generateContent(
  params: GenerateContentParams
): Promise<GenerateContentResult | { error: string }> {
  try {
    const client = getClient();
    const systemPrompt = buildContentGenerationSystemPrompt(params.identity);
    const userPrompt = buildContentGenerationUserPrompt({
      contentType: params.contentType,
      playbook: params.playbook,
      story: params.story,
      format: params.format,
      freeText: params.freeText,
      recentFeedbacks: params.recentFeedbacks,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
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

    // Extract source_map from the end of the response
    const sourceMapMatch = text.match(/```json\s*(\{[\s\S]*?"source_map"[\s\S]*?\})\s*```/);
    let sourceMap: Record<string, unknown> = {};
    let contentText = text;

    if (sourceMapMatch) {
      try {
        const parsed = JSON.parse(sourceMapMatch[1]);
        sourceMap = parsed.source_map || parsed;
      } catch {
        // Keep empty source_map
      }
      contentText = text.slice(0, sourceMapMatch.index).trim();
    }

    return {
      content_text: contentText,
      source_map: sourceMap,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Error] generateContent:', message);
    return { error: `Falha ao gerar conteúdo: ${message}` };
  }
}

/**
 * Processes a capture/transcription using Claude Sonnet.
 */
export async function processCapture(
  rawContent: string,
  sourceType: string
): Promise<ProcessCaptureResult | { error: string }> {
  try {
    const client = getClient();
    const systemPrompt = buildProcessCaptureSystemPrompt();
    const userPrompt = buildProcessCaptureUserPrompt(rawContent, sourceType);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
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

    const parsed = parseJSON<ProcessCaptureResult>(text);
    if (!parsed) {
      return { error: 'Falha ao parsear resposta da IA' };
    }

    return {
      proposals: parsed.proposals || [],
      speaker_verified: parsed.speaker_verified ?? false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Error] processCapture:', message);
    return { error: `Falha ao processar captura: ${message}` };
  }
}

/**
 * Analyzes playbook completeness using Claude Haiku.
 */
export async function analyzeCompleteness(
  playbook: Playbook
): Promise<CompletenessResult | { error: string }> {
  try {
    const client = getClient();
    const systemPrompt = buildCompletenessAnalysisSystemPrompt();
    const userPrompt = buildCompletenessAnalysisUserPrompt(playbook);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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
      'claude-haiku-4-5-20251001',
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const parsed = parseJSON<CompletenessResult>(text);
    if (!parsed) {
      return { error: 'Falha ao parsear resposta da IA' };
    }

    return {
      completeness_score: parsed.completeness_score ?? 0,
      has_example: parsed.has_example ?? false,
      has_story: parsed.has_story ?? false,
      has_origin: parsed.has_origin ?? false,
      has_counterexample: parsed.has_counterexample ?? false,
      questions: parsed.questions || [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Error] analyzeCompleteness:', message);
    return { error: `Falha ao analisar completude: ${message}` };
  }
}

/**
 * Generates targeted questions for book-readiness using Claude Haiku.
 */
export async function generateBookQuestions(
  playbook: Playbook
): Promise<BookQuestion[] | { error: string }> {
  try {
    const client = getClient();
    const systemPrompt = buildBookQuestionsSystemPrompt();
    const userPrompt = buildBookQuestionsUserPrompt(playbook);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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
      'claude-haiku-4-5-20251001',
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const parsed = parseJSON<BookQuestion[]>(text);
    if (!parsed || !Array.isArray(parsed)) {
      return { error: 'Falha ao parsear resposta da IA' };
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Error] generateBookQuestions:', message);
    return { error: `Falha ao gerar perguntas: ${message}` };
  }
}

/**
 * Analyzes a reference post's DNA/structure using Claude Haiku.
 */
export async function analyzeDNA(
  post: { content?: string; [key: string]: unknown }
): Promise<DNAResult | { error: string }> {
  try {
    const client = getClient();
    const systemPrompt = buildDNAAnalysisSystemPrompt();
    const userPrompt = buildDNAAnalysisUserPrompt(post);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
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
      'claude-haiku-4-5-20251001',
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const parsed = parseJSON<DNAResult>(text);
    if (!parsed) {
      return { error: 'Falha ao parsear resposta da IA' };
    }

    return {
      hook_type: parsed.hook_type || '',
      structure: parsed.structure || '',
      length: parsed.length || '',
      tone: parsed.tone || '',
      cta_type: parsed.cta_type || '',
      main_theme: parsed.main_theme || '',
      sub_theme: parsed.sub_theme || '',
      thesis: parsed.thesis || '',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Error] analyzeDNA:', message);
    return { error: `Falha ao analisar DNA do post: ${message}` };
  }
}
