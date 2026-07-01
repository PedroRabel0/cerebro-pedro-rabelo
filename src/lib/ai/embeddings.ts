import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { logApiCost } from '@/lib/ai/client';
import { log } from '@/lib/logger';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const COST_PER_MILLION_TOKENS = 0.02;

function getOpenAI(): OpenAI {
  // Embedding runs on the critical path before the Anthropic call inside the 60s
  // Vercel budget. Bound it tightly so a slow OpenAI response can't eat the budget;
  // on timeout, findSimilarPlaybooks falls back to keyword matching.
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15_000,
    maxRetries: 1,
  });
}

/**
 * Generate a 1536-dimension embedding for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const tokens = response.usage?.total_tokens ?? 0;
  if (tokens > 0) {
    const cost = (tokens / 1_000_000) * COST_PER_MILLION_TOKENS;
    logApiCost('openai', EMBEDDING_MODEL, cost, { input_tokens: tokens });
  }

  return response.data[0].embedding;
}

/**
 * Generate an embedding from "title + principio" and store it
 * in the playbook's `embedding` column via Supabase.
 */
export async function updatePlaybookEmbedding(
  playbookId: string,
  title: string,
  principio: string
): Promise<void> {
  try {
    const text = `${title} ${principio}`;
    const embedding = await generateEmbedding(text);

    const supabase = await createClient();
    const { error } = await supabase
      .from('playbooks')
      .update({ embedding })
      .eq('id', playbookId);

    if (error) {
      log.error(`[Embeddings] Failed to update playbook ${playbookId}: ${error.message}`);
      return;
    }

    log.info(`[Embeddings] Updated embedding for playbook ${playbookId}`);
  } catch (err) {
    log.error(`[Embeddings] Error updating playbook ${playbookId}: ${String(err)}`);
  }
}

/**
 * Find playbooks similar to the given query text using cosine similarity.
 * Calls the `match_playbooks` Supabase RPC function.
 */
export async function findSimilarPlaybooks(
  queryText: string,
  threshold: number = 0.5,
  limit: number = 10
): Promise<
  {
    id: string;
    title: string;
    principio: string | null;
    tema_name: string | null;
    similarity: number;
  }[]
> {
  try {
    const embedding = await generateEmbedding(queryText);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('match_playbooks', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      log.error(`[Embeddings] match_playbooks RPC failed: ${error.message}`);
      return [];
    }

    return data ?? [];
  } catch (err) {
    log.error(`[Embeddings] Error finding similar playbooks: ${String(err)}`);
    return [];
  }
}

/**
 * Find shareable playbooks similar to the given query text using cosine similarity.
 * Calls the `match_shareable_playbooks` Supabase RPC function.
 */
export async function findSimilarShareablePlaybooks(
  queryText: string,
  threshold: number = 0.3,
  limit: number = 5
): Promise<
  {
    id: string;
    title: string;
    body_markdown: string;
    similarity: number;
  }[]
> {
  try {
    const embedding = await generateEmbedding(queryText);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('match_shareable_playbooks', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      log.error(`[Embeddings] match_shareable_playbooks RPC failed: ${error.message}`);
      return [];
    }

    return data ?? [];
  } catch (err) {
    log.error(`[Embeddings] Error finding similar shareable playbooks: ${String(err)}`);
    return [];
  }
}
