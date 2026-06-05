/**
 * Audio transcription via OpenAI Whisper API.
 * Transcribes Instagram reels and other video content.
 *
 * Uses gpt-4o-mini-transcribe ($0.003/min) for cost efficiency.
 * Falls back to whisper-1 if needed.
 */

import { logApiCost } from '@/lib/ai/client';
import { log } from '@/lib/logger';

export interface TranscriptionResult {
  text: string;
  duration_seconds: number;
  model: string;
}

/**
 * Download video from URL and transcribe audio using OpenAI Whisper.
 * Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25MB).
 */
export async function transcribeVideoFromUrl(
  videoUrl: string,
): Promise<TranscriptionResult | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: 'OPENAI_API_KEY not configured' };

  try {
    // 1. Download the video
    log.info(`[Whisper] Downloading video: ${videoUrl.slice(0, 100)}...`);

    const videoResponse = await fetch(videoUrl, {
      signal: AbortSignal.timeout(60_000), // 60s to download
    });

    if (!videoResponse.ok) {
      return { error: `Falha ao baixar video: HTTP ${videoResponse.status}` };
    }

    const contentLength = videoResponse.headers.get('content-length');
    const sizeBytes = contentLength ? parseInt(contentLength) : 0;

    // Check size limit (25MB for Whisper API)
    if (sizeBytes > 25 * 1024 * 1024) {
      return { error: `Video muito grande (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Limite: 25MB.` };
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    log.info(`[Whisper] Downloaded: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

    // 2. Send to Whisper API using FormData
    const formData = new FormData();

    // Detect format from URL or content-type
    const contentType = videoResponse.headers.get('content-type') || '';
    let ext = 'mp4';
    if (contentType.includes('webm')) ext = 'webm';
    else if (contentType.includes('mp3') || contentType.includes('mpeg')) ext = 'mp3';
    else if (videoUrl.includes('.mp3')) ext = 'mp3';
    else if (videoUrl.includes('.webm')) ext = 'webm';

    const blob = new Blob([videoBuffer], { type: contentType || `video/${ext}` });
    formData.append('file', blob, `video.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'verbose_json');

    log.info(`[Whisper] Transcribing (${ext}, ${(videoBuffer.byteLength / 1024).toFixed(0)}KB)...`);

    const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(120_000), // 2 min for transcription
    });

    if (!transcribeResponse.ok) {
      const errText = await transcribeResponse.text().catch(() => '');
      log.error(`[Whisper] API error ${transcribeResponse.status}: ${errText.slice(0, 200)}`);
      return { error: `Whisper API erro: HTTP ${transcribeResponse.status}` };
    }

    const result = await transcribeResponse.json();
    const text = (result.text || '').trim();
    const duration = result.duration || 0;

    if (!text) {
      return { error: 'Transcricao vazia — video pode nao ter audio falado.' };
    }

    // Log cost: whisper-1 = $0.006/min
    const minutes = Math.max(duration / 60, 0.1);
    const cost = minutes * 0.006;
    logApiCost('openai', 'whisper-1', cost, {
      unit: 'minute',
      quantity: Math.ceil(minutes),
    });

    log.info(`[Whisper] Transcribed: ${text.length} chars, ${Math.round(duration)}s, $${cost.toFixed(4)}`);

    return {
      text,
      duration_seconds: Math.round(duration),
      model: 'whisper-1',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    log.error(`[Whisper] Error: ${message}`);
    return { error: `Falha na transcricao: ${message}` };
  }
}
