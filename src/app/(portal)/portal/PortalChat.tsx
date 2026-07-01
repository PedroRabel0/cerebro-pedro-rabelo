"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Send, Sparkles, AlertTriangle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { askClient } from "../actions";

type ChatMessage = {
  id: string;
  question: string;
  answer: string;
  has_context: boolean;
  created_at: string;
};

type Exchange = {
  key: string;
  question: string;
  answer: string;
  escalated: boolean;
};

export default function PortalChat({
  company,
  initialChat,
}: {
  company: { id: string; name: string };
  initialChat: ChatMessage[];
}) {
  const [messages, setMessages] = useState<Exchange[]>(
    initialChat.map((m) => ({
      key: m.id,
      question: m.question,
      answer: m.answer,
      escalated: !m.has_context,
    }))
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading]);

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setQuestion("");
    const res = await askClient(q);
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      setQuestion(q);
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        key: `${Date.now()}`,
        question: q,
        answer: res.answer,
        escalated: res.escalated,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecalho */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-lg font-bold text-text">Pedro IA</h1>
            <p className="text-xs text-text-muted">{company.name}</p>
          </div>
        </div>
        <button
          onClick={logout}
          aria-label="Sair da conta"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition hover:border-accent/40 hover:text-text"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>

      {/* Lista de mensagens */}
      <div
        ref={listRef}
        className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-4"
      >
        {messages.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-text-muted">
            Faca uma pergunta para comecar.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.key} className="flex flex-col gap-2">
            <div className="self-end max-w-[85%] rounded-lg rounded-br-sm bg-accent px-3 py-2 text-sm text-white">
              {m.question}
            </div>
            <div className="self-start max-w-[85%] whitespace-pre-wrap rounded-lg rounded-bl-sm bg-surface px-3 py-2 text-sm text-text-secondary">
              {m.answer}
            </div>
            {m.escalated && (
              <div className="self-start flex items-center gap-1.5 text-[11px] text-amber">
                <AlertTriangle className="h-3 w-3" />
                A equipe do Pedro foi acionada e vai te responder em breve.
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="self-start flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pensando...
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Escreva sua pergunta..."
          aria-label="Pergunta ao Pedro IA"
          disabled={loading}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-60"
        />
        <button
          onClick={ask}
          disabled={loading || !question.trim()}
          aria-label="Enviar"
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
