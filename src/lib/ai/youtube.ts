// --- YouTube Transcript Extraction Utility ---
// Uses youtube-transcript library as primary method (reliable server-side)
// Falls back to InnerTube API and page scraping

import { YoutubeTranscript } from 'youtube-transcript';
import { logApiCost } from '@/lib/ai/client';

import { log } from '@/lib/logger';
export interface YouTubeExtraction {
  video_id: string;
  title: string;
  author: string;
  transcript: string | null;
  thumbnail_url: string;
}

/**
 * Extracts a YouTube video ID from various URL formats.
 */
function extractVideoId(url: string): string | null {
  const trimmed = url.trim();

  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  const vMatch = trimmed.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];

  return null;
}

/**
 * Fetches video metadata via YouTube oEmbed API.
 * Falls back to thumbnail-only if oEmbed fails.
 */
async function fetchMetadata(
  videoId: string
): Promise<{ title: string; author: string; thumbnail_url: string }> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

    const response = await fetch(oembedUrl);
    if (response.ok) {
      const data = (await response.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };

      return {
        title: data.title || 'Video do YouTube',
        author: data.author_name || 'Autor desconhecido',
        thumbnail_url:
          data.thumbnail_url ||
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch {
    // oEmbed failed, try page scraping for title
  }

  // Fallback: try to get title from video page
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cookie': 'CONSENT=PENDING+987',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<meta name="title" content="(.*?)"/) ||
                          html.match(/<title>(.*?)(?:\s*-\s*YouTube)?<\/title>/);
      const authorMatch = html.match(/"ownerChannelName"\s*:\s*"(.*?)"/) ||
                          html.match(/<link itemprop="name" content="(.*?)">/);

      return {
        title: titleMatch ? decodeHTMLEntities(titleMatch[1]) : 'Video do YouTube',
        author: authorMatch ? decodeHTMLEntities(authorMatch[1]) : 'Autor desconhecido',
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch {
    // Page scraping also failed
  }

  // Last resort: return minimal metadata
  return {
    title: 'Video do YouTube',
    author: 'Autor desconhecido',
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

/**
 * Small delay helper for retry logic.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches transcript using youtube-transcript library.
 * Tries Portuguese first, then English, then any available language.
 * Includes retry logic for rate-limiting.
 */
async function fetchTranscript(videoId: string): Promise<string | null> {
  const attempts = [
    { lang: 'pt', label: 'Portuguese' },
    { lang: 'en', label: 'English' },
    { lang: undefined, label: 'Default' },
  ];

  for (let retry = 0; retry < 2; retry++) {
    if (retry > 0) {
      log.info(`[YouTube] Retry ${retry} after delay...`);
      await delay(2000);
    }

    for (const attempt of attempts) {
      try {
        log.info(`[YouTube] Trying transcript (${attempt.label}) for ${videoId}`);

        const segments = await YoutubeTranscript.fetchTranscript(videoId,
          attempt.lang ? { lang: attempt.lang } : undefined
        );

        if (segments && segments.length > 0) {
          const text = segments.map(s => s.text).join(' ');
          if (text.length > 50) {
            log.info(`[YouTube] Transcript found (${attempt.label}): ${text.length} chars, ${segments.length} segments`);
            return text;
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isLangError = msg.includes('No transcripts are available in');
        log.info(`[YouTube] Transcript (${attempt.label}) failed: ${msg.substring(0, 150)}`);

        // If it's a language-specific error, try next language immediately
        if (isLangError) continue;

        // For other errors (rate limit, network), break to retry loop
        break;
      }
    }
  }

  // Fallback 1: try Supadata API
  log.info(`[YouTube] Trying Supadata fallback for ${videoId}...`);
  const supadataResult = await fetchTranscriptSupadata(videoId);
  if (supadataResult) return supadataResult;

  // Fallback 2: try Gemini video analysis
  log.info(`[YouTube] Trying Gemini video analysis for ${videoId}...`);
  const geminiResult = await analyzeVideoWithGemini(videoId);
  if (geminiResult) return geminiResult;

  log.info(`[YouTube] No transcript available for ${videoId}`);
  return null;
}

/**
 * Fetches transcript using Supadata API as fallback.
 * Free tier: 100 requests/month.
 */
async function fetchTranscriptSupadata(videoId: string): Promise<string | null> {
  try {
    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
      log.info('[YouTube/Supadata] No API key configured');
      return null;
    }

    const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      log.info(`[YouTube/Supadata] Failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as { content?: string; lang?: string };
    if (data.content && data.content.length > 50) {
      log.info(`[YouTube/Supadata] Transcript found: ${data.content.length} chars (lang: ${data.lang || 'unknown'})`);
      logApiCost('supadata', 'transcript', 0.001, { unit: 'request', quantity: 1 });
      return data.content;
    }

    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.info(`[YouTube/Supadata] Error: ${msg.substring(0, 150)}`);
    return null;
  }
}

/**
 * Analyzes a YouTube video using Gemini's video understanding capability.
 * Gemini can process YouTube URLs directly and extract topics, key points, etc.
 * Returns a structured text summary that can be used as transcript replacement.
 */
async function analyzeVideoWithGemini(videoId: string): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      log.info('[YouTube/Gemini] No API key configured');
      return null;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  fileData: {
                    mimeType: 'video/mp4',
                    fileUri: videoUrl,
                  },
                },
                {
                  text: `Analise este vídeo do YouTube e extraia TODO o conteúdo em português brasileiro.

Forneça:
1. TÍTULO do vídeo
2. RESUMO COMPLETO (3-5 parágrafos detalhados)
3. PRINCIPAIS TÓPICOS ABORDADOS (lista com 5-10 tópicos, cada um com 2-3 frases explicando)
4. FRASES MAIS IMPACTANTES (citações diretas do speaker)
5. FRAMEWORKS OU CONCEITOS ensinados
6. LIÇÕES PRÁTICAS E ACIONÁVEIS

Seja o mais detalhado possível. Extraia o máximo de conteúdo e insights do vídeo.
Responda TUDO em português brasileiro, mesmo que o vídeo seja em outro idioma.`,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      log.info(`[YouTube/Gemini] Failed: ${response.status} - ${errorText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.text && part.text.length > 100) {
        log.info(`[YouTube/Gemini] Video analysis successful: ${part.text.length} chars`);
        // Gemini Flash video analysis cost (~1000 input, ~2000 output tokens)
        const videoCost = (1000 / 1_000_000) * 0.10 + (2000 / 1_000_000) * 0.40;
        logApiCost('gemini', 'gemini-2.0-flash', videoCost, {
          input_tokens: 1000,
          output_tokens: 2000,
        });
        return `[Análise do vídeo via Gemini AI]\n\n${part.text}`;
      }
    }

    log.info('[YouTube/Gemini] No useful content in response');
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.info(`[YouTube/Gemini] Error: ${msg.substring(0, 200)}`);
    return null;
  }
}

/**
 * Checks if a given string is a YouTube URL.
 */
export function isYouTubeUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    /youtube\.com\/watch/i.test(trimmed) ||
    /youtu\.be\//i.test(trimmed) ||
    /youtube\.com\/shorts\//i.test(trimmed) ||
    /youtube\.com\/embed\//i.test(trimmed) ||
    /youtube\.com\/v\//i.test(trimmed)
  );
}

/**
 * Main exported function: extracts YouTube video content including metadata and transcript.
 */
export async function extractYouTubeContent(
  url: string
): Promise<YouTubeExtraction | { error: string }> {
  try {
    log.info(`[YouTube] Starting extraction for: ${url}`);

    const videoId = extractVideoId(url);
    if (!videoId) {
      return { error: `URL do YouTube invalida: ${url}` };
    }

    log.info(`[YouTube] Video ID: ${videoId}`);

    // Fetch metadata and transcript in parallel.
    // A transcricao tem orcamento de tempo: se a lib estiver bloqueada ou a
    // analise de video (Gemini) demorar, seguimos so com o titulo — assim a
    // funcao nunca estoura o limite de 60s da Vercel.
    const [metadata, transcript] = await Promise.all([
      fetchMetadata(videoId),
      Promise.race<string | null>([
        fetchTranscript(videoId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
      ]),
    ]);

    log.info(`[YouTube] Title: ${metadata.title}`);
    log.info(`[YouTube] Author: ${metadata.author}`);
    log.info(`[YouTube] Transcript: ${transcript ? `${transcript.length} chars` : 'not available'}`);

    return {
      video_id: videoId,
      title: metadata.title,
      author: metadata.author,
      transcript,
      thumbnail_url: metadata.thumbnail_url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    log.error(`[YouTube] Extraction failed:` + " " + String(error));
    return { error: `Falha ao extrair conteudo do YouTube: ${message}` };
  }
}
