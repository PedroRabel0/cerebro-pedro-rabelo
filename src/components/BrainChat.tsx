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

    // Keep last 4 messages + new user message (total 5)
    setMessages((prev) => {
      const updated = [...prev, { role: "user" as const, content: question }];
      return updated.slice(-5);
    });

    setLoading(true);
    try {
      const response = await askBrain(question);
      setMessages((prev) => {
        const updated = [
          ...prev,
          { role: "brain" as const, content: response },
        ];
        return updated.slice(-5);
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
        return updated.slice(-5);
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Messages area */}
      <div className="flex min-h-[200px] flex-col gap-3 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
              <Brain className="h-6 w-6 text-accent" />
            </div>
            <p className="text-sm text-text-secondary">
              Pergunte qualquer coisa sobre os playbooks, historias e
              referencias do Pedro.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {msg.role === "brain" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <Brain className="h-3.5 w-3.5 text-accent" />
              </div>
            )}
            {msg.role === "user" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-text/10">
                <User className="h-3.5 w-3.5 text-text-secondary" />
              </div>
            )}
            <div
              className={
                msg.role === "user"
                  ? "rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-white ml-auto max-w-[80%]"
                  : "rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-text mr-auto max-w-[80%]"
              }
            >
              {msg.content.split("\n").map((line, j) => (
                <p key={j} className={j > 0 ? "mt-1.5" : ""}>
                  {line || " "}
                </p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <Brain className="h-3.5 w-3.5 animate-pulse text-accent" />
            </div>
            <div className="rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-text-muted mr-auto">
              <span className="inline-flex items-center gap-1">
                <span className="animate-pulse">Pensando</span>
                <span className="inline-flex gap-0.5">
                  <span
                    className="inline-block h-1 w-1 animate-bounce rounded-full bg-accent/50"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="inline-block h-1 w-1 animate-bounce rounded-full bg-accent/50"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="inline-block h-1 w-1 animate-bounce rounded-full bg-accent/50"
                    style={{ animationDelay: "300ms" }}
                  />
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
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
