"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

export default function TestVoicePage() {
  const [transcript, setTranscript] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const addLog = (msg: string) => {
    console.log("[TestVoice]", msg);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  };

  const startRecording = useCallback(async () => {
    addLog("Pedindo permissao do microfone...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog("Microfone liberado! Iniciando gravacao...");
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      addLog(`Formato: ${mimeType}`);

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          addLog(`Chunk recebido: ${e.data.size} bytes (total: ${chunksRef.current.length} chunks)`);
        }
      };

      recorder.onstop = async () => {
        addLog("Gravacao parada. Processando...");
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        addLog(`Audio: ${(audioBlob.size / 1024).toFixed(1)}KB`);
        chunksRef.current = [];

        if (audioBlob.size < 1000) {
          addLog("Audio muito curto, ignorando.");
          return;
        }

        setIsProcessing(true);
        addLog("Enviando para Whisper...");

        try {
          const formData = new FormData();
          const ext = mimeType.includes("webm") ? "webm" : "mp4";
          formData.append("audio", audioBlob, `recording.${ext}`);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          addLog(`Resposta: HTTP ${res.status}`);

          const data = await res.json();
          addLog(`JSON: ${JSON.stringify(data)}`);

          if (data.text?.trim()) {
            setTranscript(data.text.trim());
            addLog(`SUCESSO: "${data.text.trim()}"`);
          } else {
            addLog("Resposta sem texto.");
          }
        } catch (err) {
          addLog(`ERRO: ${err}`);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      addLog("GRAVANDO... Fale agora. Clique novamente para parar.");
    } catch (err) {
      addLog(`ERRO ao acessar microfone: ${err}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      addLog("Parando gravacao...");
    }
    setIsRecording(false);
  }, []);

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  };

  return (
    <div style={{ padding: 40, background: "#0a0a0b", color: "white", minHeight: "100vh", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Teste de Voz - Debug</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button
          onClick={handleClick}
          disabled={isProcessing}
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            border: "none",
            cursor: isProcessing ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isProcessing ? "#ff000033" : isRecording ? "#dc2626" : "#1a1a1c",
            color: isRecording ? "white" : "#999",
            animation: isRecording ? "pulse 1.5s infinite" : "none",
          }}
        >
          {isProcessing ? (
            <Loader2 style={{ width: 24, height: 24, animation: "spin 1s linear infinite" }} />
          ) : isRecording ? (
            <MicOff style={{ width: 24, height: 24 }} />
          ) : (
            <Mic style={{ width: 24, height: 24 }} />
          )}
        </button>

        <div>
          <div style={{ fontSize: 16, fontWeight: "bold" }}>
            {isProcessing ? "Transcrevendo..." : isRecording ? "GRAVANDO - clique para parar" : "Clique para gravar"}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {isRecording ? "Fale normalmente no microfone" : "O audio sera enviado ao Whisper (OpenAI)"}
          </div>
        </div>
      </div>

      {transcript && (
        <div style={{ padding: 16, background: "#1a1a1c", borderRadius: 8, marginBottom: 24, border: "1px solid #333" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Texto transcrito:</div>
          <div style={{ fontSize: 18 }}>{transcript}</div>
        </div>
      )}

      <div style={{ marginTop: 20, borderTop: "1px solid #333", paddingTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>Log de eventos:</div>
        {logs.length === 0 && <p style={{ color: "#666" }}>Nenhuma acao ainda. Clique no microfone.</p>}
        {logs.map((l, i) => (
          <p key={i} style={{ color: "#aaa", fontSize: 12, margin: "4px 0" }}>{l}</p>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
