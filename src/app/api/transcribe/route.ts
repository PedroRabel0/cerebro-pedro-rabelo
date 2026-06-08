/**
 * POST /api/transcribe
 * Receives audio file from browser MediaRecorder, sends to OpenAI Whisper for transcription.
 * Returns { text: string }
 *
 * Uses prompt parameter to reduce hallucinations and guide Portuguese transcription.
 * Filters out known Whisper hallucination phrases (e.g. "Legendas pela comunidade Amara.org").
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { logApiCost } from "@/lib/ai/client";

// Known Whisper hallucination phrases — these appear when audio has silence/noise
const HALLUCINATION_PHRASES = [
  "legendas pela comunidade amara.org",
  "legendas pela comunidade",
  "obrigado por assistir",
  "inscreva-se no canal",
  "se inscreva no canal",
  "like e inscreva",
  "não se esqueça de se inscrever",
  "obrigado a todos",
  "até a próxima",
  "até o próximo vídeo",
  "thank you for watching",
  "thanks for watching",
  "subscribe to the channel",
  "please subscribe",
  "subtitles by the amara.org community",
  "transcrição automática",
  "continue watching",
  "www.",
  "http",
  "amara.org",
];

function isHallucination(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // Too short (less than 3 chars) — likely noise
  if (lower.length < 3) return true;
  // Check against known hallucination phrases
  return HALLUCINATION_PHRASES.some(
    (phrase) => lower.includes(phrase) || phrase.includes(lower)
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Check size (max 25MB for Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio too large (max 25MB)" },
        { status: 413 }
      );
    }

    log.info(
      `[Transcribe] Received audio: ${(audioFile.size / 1024).toFixed(0)}KB, type=${audioFile.type}`
    );

    // Build FormData for Whisper API
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, audioFile.name || "recording.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "pt");
    whisperForm.append("response_format", "verbose_json");
    // Prompt reduces hallucinations by giving context about expected content
    whisperForm.append(
      "prompt",
      "Transcrição de áudio gravado por microfone. O usuário está falando em português brasileiro sobre negócios, empreendedorismo, ecommerce, conteúdo e estratégias digitais."
    );
    // Temperature 0 = most deterministic, reduces hallucinations
    whisperForm.append("temperature", "0");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperForm,
        signal: AbortSignal.timeout(60_000),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      log.error(
        `[Transcribe] Whisper API error ${response.status}: ${errText.slice(0, 200)}`
      );
      return NextResponse.json(
        { error: `Whisper API error: ${response.status}` },
        { status: 502 }
      );
    }

    const result = await response.json();
    const text = (result.text || "").trim();
    const duration = result.duration || 0;

    // Log cost: whisper-1 = $0.006/min
    const minutes = Math.max(duration / 60, 0.1);
    const cost = minutes * 0.006;
    logApiCost("openai", "whisper-1", cost, {
      unit: "minute",
      quantity: Math.ceil(minutes),
    });

    // Filter hallucinations
    if (isHallucination(text)) {
      log.info(`[Transcribe] Filtered hallucination: "${text}"`);
      return NextResponse.json({ text: "", duration: 0, filtered: true });
    }

    log.info(
      `[Transcribe] Done: ${text.length} chars, ${Math.round(duration)}s, $${cost.toFixed(4)}`
    );

    return NextResponse.json({ text, duration: Math.round(duration) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error(`[Transcribe] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
