"use client";

import { useState, useRef, useEffect } from "react";
import { Brain, Send, User } from "lucide-react";
import { askBrain } from "@/app/(dashboard)/actions";

interface Message {
  role: "user" | "brain";
  content: string;
}

export default function BrainChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");

    setMessages((prev) => {
      const updated = [...prev, { role: "user" as const, content: question }];
      return updated.slice(-20);
    });

    setLoading(true);
    try {
      const response = await askBrain(question);
      setMessages((prev) => {
        const updated = [
          ...prev,
          { role: "brain" as const, content: response },
        ];
        return updated.slice(-20);
      });
    } catch {
      setMessages((prev) => {
        const updated = [
          ...prev,
          {
            role: "brain" as const,
            content: "Desculpa, tive um problema ao processar sua pergunta. Tenta de novo.",
          },
        ];
        return updated.slice(-20);
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col" role="log" aria-label="Chat com o Cérebro" aria-live="polite">
      {/* Messages area */}
      <div className="flex min-h-[200px] flex-col gap-3 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/10 to-violet/10">
              <Brain className="h-6 w-6 text-violet" />
            </div>
            <p className="text-sm text-text-secondary">
              Pergunte qualquer coisa sobre os playbooks, histórias e
              referências do Pedro.
            </p>
            {/* Quick suggestion chips */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "Resuma meus playbooks",
                "Me dê uma ideia de post",
                "Quais temas estão incompletos?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="rounded-full border border-border bg-surface/50 px-3 py-1.5 font-mono text-[11px] text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {msg.role === "brain" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet/20 to-accent/20">
                <Brain className="h-3.5 w-3.5 text-violet" />
              </div>
            )}
            {msg.role === "user" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
                <User className="h-3.5 w-3.5 text-accent" />
              </div>
            )}
            <div
              className={
                msg.role === "user"
                  ? "btn-primary rounded-2xl rounded-br-md px-4 py-3 text-sm text-white ml-auto max-w-[80%]"
                  : "brain-message rounded-2xl rounded-bl-md px-4 py-3 text-sm text-text mr-auto max-w-[80%]"
              }
            >
              {msg.content.split("\n").map((line, j) => (
                <p key={j} className={j > 0 ? "mt-1.5" : ""}>
                  {line || " "}
                </p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet/20 to-accent/20">
              <Brain className="h-3.5 w-3.5 animate-pulse text-violet" />
            </div>
            <div className="brain-message rounded-2xl rounded-bl-md px-4 py-3 text-sm text-text-muted mr-auto">
              <span className="inline-flex items-center gap-1.5">
                <span className="animate-pulse">Pensando</span>
                <span className="inline-flex gap-0.5">
                  <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-violet/50" style={{ animationDelay: "0ms" }} />
                  <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-violet/50" style={{ animationDelay: "150ms" }} />
                  <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-violet/50" style={{ animationDelay: "300ms" }} />
                </span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="O que o Pedro pensa sobre..."
          disabled={loading}
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          title="Enviar (Enter)"
          className="btn-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
