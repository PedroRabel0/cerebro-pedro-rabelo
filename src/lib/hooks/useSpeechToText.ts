"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook for browser-native speech-to-text using Web Speech API.
 * Falls back gracefully when not supported (shows alert).
 *
 * Usage:
 *   const { isListening, transcript, start, stop, toggle, isSupported } = useSpeechToText({
 *     lang: "pt-BR",
 *     onResult: (text) => setMyField(prev => prev + " " + text),
 *   });
 */

interface UseSpeechToTextOptions {
  /** BCP-47 language tag. Default: "pt-BR" */
  lang?: string;
  /** Called with final transcript when speech ends or is stopped */
  onResult?: (transcript: string) => void;
  /** Called with interim (partial) transcript while speaking */
  onInterim?: (transcript: string) => void;
  /** Continuous listening mode. Default: true */
  continuous?: boolean;
}

interface UseSpeechToTextReturn {
  isListening: boolean;
  /** Current interim transcript (updates while speaking) */
  transcript: string;
  /** Start recording */
  start: () => void;
  /** Stop recording */
  stop: () => void;
  /** Toggle recording on/off */
  toggle: () => void;
  /** Whether browser supports speech recognition */
  isSupported: boolean;
}

// Extend Window for webkit prefix
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export function useSpeechToText(
  options: UseSpeechToTextOptions = {}
): UseSpeechToTextReturn {
  const {
    lang = "pt-BR",
    onResult,
    onInterim,
    continuous = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);

  // Keep callbacks fresh without re-creating recognition
  useEffect(() => {
    onResultRef.current = onResult;
    onInterimRef.current = onInterim;
  }, [onResult, onInterim]);

  // Detect support on client side only (after hydration)
  useEffect(() => {
    setIsSupported(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window
    );
  }, []);

  const start = useCallback(() => {
    if (!isSupported) {
      alert("Seu navegador nao suporta reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = createRecognition();
    if (!recognition) return;

    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
      finalTranscript = "";
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      const currentText = finalTranscript + interim;
      setTranscript(currentText);
      onInterimRef.current?.(currentText);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        onResultRef.current?.(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: Event & { error?: string }) => {
      console.warn("[SpeechToText] Error:", event.error);
      setIsListening(false);
      // "no-speech" and "aborted" are expected — don't alert
      if (event.error && !["no-speech", "aborted"].includes(event.error)) {
        console.error("[SpeechToText] Unexpected error:", event.error);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("[SpeechToText] Failed to start:", err);
      setIsListening(false);
    }
  }, [isSupported, lang, continuous]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  return { isListening, transcript, start, stop, toggle, isSupported };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createRecognition(): any | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const W = window as any;
  const SpeechRecognition = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  return new SpeechRecognition();
}
