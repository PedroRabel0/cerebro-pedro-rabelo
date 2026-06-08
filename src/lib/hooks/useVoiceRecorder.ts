"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook for recording audio in the browser via MediaRecorder,
 * then sending to server-side Whisper API for transcription.
 *
 * Much more reliable than Web Speech API — works on all modern browsers.
 */

interface UseVoiceRecorderOptions {
  /** Called with final transcribed text */
  onTranscript?: (text: string) => void;
  /** Called when transcription is processing */
  onProcessing?: (processing: boolean) => void;
}

interface UseVoiceRecorderReturn {
  /** Currently recording audio */
  isRecording: boolean;
  /** Sending audio to Whisper for transcription */
  isProcessing: boolean;
  /** Start recording */
  start: () => void;
  /** Stop recording and transcribe */
  stop: () => void;
  /** Toggle recording */
  toggle: () => void;
  /** Browser supports MediaRecorder */
  isSupported: boolean;
}

export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {}
): UseVoiceRecorderReturn {
  const { onTranscript, onProcessing } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onProcessingRef = useRef(onProcessing);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onProcessingRef.current = onProcessing;
  }, [onTranscript, onProcessing]);

  // Detect support client-side
  useEffect(() => {
    setIsSupported(
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== "undefined"
    );
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Prefer webm for best compatibility, fall back to whatever is available
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Skip if too small (less than 1KB — probably empty)
        if (audioBlob.size < 1000) {
          return;
        }

        // Send to server for Whisper transcription
        setIsProcessing(true);
        onProcessingRef.current?.(true);

        try {
          const formData = new FormData();
          const ext = mimeType.includes("webm") ? "webm" : "mp4";
          formData.append("audio", audioBlob, `recording.${ext}`);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.text().catch(() => "");
            console.error("[VoiceRecorder] Transcription failed:", err);
            return;
          }

          const data = await res.json();
          if (data.text?.trim()) {
            onTranscriptRef.current?.(data.text.trim());
          }
        } catch (err) {
          console.error("[VoiceRecorder] Error sending audio:", err);
        } finally {
          setIsProcessing(false);
          onProcessingRef.current?.(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Collect chunks every second
      setIsRecording(true);
    } catch (err) {
      console.error("[VoiceRecorder] Failed to start:", err);
      // Probably permission denied
      alert("Permita o acesso ao microfone nas configuracoes do navegador.");
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) {
      stop();
    } else if (!isProcessing) {
      start();
    }
  }, [isRecording, isProcessing, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { isRecording, isProcessing, start, stop, toggle, isSupported };
}
