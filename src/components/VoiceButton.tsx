"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

/**
 * Reusable voice recording button.
 * Records audio via MediaRecorder, sends to /api/transcribe (Whisper), returns text.
 *
 * States:
 * - Idle: gray mic icon
 * - Recording: red pulsing mic-off icon
 * - Processing: spinning loader (sending to Whisper)
 */

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export default function VoiceButton({
  onTranscript,
  disabled = false,
  size = "sm",
  className = "",
}: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (audioBlob.size < 1000) return;

        setIsProcessing(true);
        try {
          const formData = new FormData();
          const ext = mimeType.includes("webm") ? "webm" : "mp4";
          formData.append("audio", audioBlob, `recording.${ext}`);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            if (data.text?.trim()) {
              onTranscriptRef.current(data.text.trim());
            }
          } else {
            console.error("[Voice] Transcription failed:", res.status);
          }
        } catch (err) {
          console.error("[Voice] Error:", err);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      console.error("[Voice] Mic access failed:", err);
      alert("Permita o acesso ao microfone nas configuracoes do navegador.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const handleClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  }, [isRecording, isProcessing, startRecording, stopRecording]);

  const sizeClasses = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isProcessing}
      title={
        isProcessing
          ? "Transcrevendo..."
          : isRecording
          ? "Parar gravacao"
          : "Gravar por voz"
      }
      className={`
        flex shrink-0 items-center justify-center rounded-xl transition-all
        ${
          isProcessing
            ? "bg-accent/20 text-accent cursor-wait"
            : isRecording
            ? "bg-red/90 text-white shadow-lg shadow-red/20 animate-pulse"
            : "bg-surface text-text-muted hover:bg-card-hover hover:text-accent"
        }
        ${sizeClasses}
        disabled:opacity-30 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isProcessing ? (
        <Loader2 className={`${iconSize} animate-spin`} />
      ) : isRecording ? (
        <MicOff className={iconSize} />
      ) : (
        <Mic className={iconSize} />
      )}
    </button>
  );
}
