"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Brain, Send, User, Plus, Trash2, MessageSquare, Menu, X } from "lucide-react";
import {
  getChats,
  createChat,
  getChatMessages,
  sendChatMessage,
  deleteChat,
} from "@/app/(dashboard)/actions";

interface Chat {
  id: string;
  title: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

export default function BrainChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chats on mount
  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getChats();
        setChats(data);
      } catch {
        // ignore
      }
    });
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    startTransition(async () => {
      try {
        const data = await getChatMessages(activeChatId);
        setMessages(data);
      } catch {
        setMessages([]);
      }
    });
  }, [activeChatId]);

  async function handleNewChat() {
    startTransition(async () => {
      try {
        const { id } = await createChat();
        const newChat: Chat = {
          id,
          title: "Nova conversa",
          updated_at: new Date().toISOString(),
        };
        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(id);
        setMessages([]);
        setSidebarOpen(false);
        inputRef.current?.focus();
      } catch {
        // ignore
      }
    });
  }

  async function handleDeleteChat(chatId: string) {
    startTransition(async () => {
      try {
        await deleteChat(chatId);
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setMessages([]);
        }
      } catch {
        // ignore
      }
    });
  }

  function handleSelectChat(chatId: string) {
    setActiveChatId(chatId);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    // Auto-create chat if none selected
    let chatId = activeChatId;
    if (!chatId) {
      try {
        const { id } = await createChat();
        const newChat: Chat = {
          id,
          title: "Nova conversa",
          updated_at: new Date().toISOString(),
        };
        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(id);
        chatId = id;
      } catch {
        return;
      }
    }

    setInput("");
    setLoading(true);

    // Optimistic user message
    const optimisticUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      const { response } = await sendChatMessage(chatId, question);

      // Add brain response
      const brainMsg: Message = {
        id: `temp-${Date.now()}-brain`,
        role: "brain",
        content: response,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, brainMsg]);

      // Update chat title in list
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                title:
                  c.title === "Nova conversa"
                    ? question.slice(0, 50)
                    : c.title,
                updated_at: new Date().toISOString(),
              }
            : c
        )
      );
    } catch {
      const errorMsg: Message = {
        id: `temp-${Date.now()}-error`,
        role: "brain",
        content:
          "Desculpa, tive um problema ao processar sua pergunta. Tenta de novo.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestion(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-surface/80 text-text-muted hover:text-accent md:hidden"
        aria-label="Abrir lista de conversas"
      >
        {sidebarOpen ? (
          <X className="h-4 w-4" />
        ) : (
          <Menu className="h-4 w-4" />
        )}
      </button>

      {/* Left panel: Chat list */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } absolute inset-y-0 left-0 z-10 w-64 border-r border-border bg-bg/95 backdrop-blur-sm transition-transform md:relative md:translate-x-0`}
      >
        <div className="flex h-full flex-col p-3">
          {/* New chat button */}
          <button
            onClick={handleNewChat}
            disabled={isPending}
            className="btn-primary mb-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>

          {/* Chat list */}
          <div className="flex-1 space-y-1 overflow-y-auto">
            {chats.length === 0 && (
              <p className="px-3 py-4 text-center text-[12px] text-text-muted">
                Nenhuma conversa ainda
              </p>
            )}
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                  activeChatId === chat.id
                    ? "bg-accent/10 text-accent"
                    : "text-text-secondary hover:bg-surface/50 hover:text-text"
                }`}
                onClick={() => handleSelectChat(chat.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] leading-tight">
                    {chat.title}
                  </p>
                  <p className="font-mono text-[11px] text-text-muted">
                    {relativeTime(chat.updated_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteChat(chat.id);
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-red/10 hover:text-red group-hover:opacity-100"
                  aria-label="Excluir conversa"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[5] bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Right panel: Active chat */}
      <div className="relative flex flex-1 flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {/* No chat selected */}
          {!activeChatId && messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/10 to-violet/10">
                <Brain className="h-6 w-6 text-violet" />
              </div>
              <p className="text-sm text-text-secondary">
                Selecione ou crie uma conversa
              </p>
              <button
                onClick={handleNewChat}
                className="btn-primary mt-4 rounded-xl px-5 py-2 text-sm text-white"
              >
                Nova conversa
              </button>
            </div>
          )}

          {/* Chat selected but empty */}
          {activeChatId && messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/10 to-violet/10">
                <Brain className="h-6 w-6 text-violet" />
              </div>
              <p className="mb-4 text-sm text-text-secondary">
                Pergunte qualquer coisa sobre os playbooks, historias e
                referencias do Pedro.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Resuma meus playbooks",
                  "Me de uma ideia de post",
                  "Quais temas estao incompletos?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestion(suggestion)}
                    className="rounded-full border border-border bg-surface/50 px-3 py-1.5 font-mono text-[11px] text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`animate-slide-in mb-3 flex items-start gap-2.5 ${
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
                    ? "btn-primary ml-auto max-w-[80%] rounded-2xl rounded-br-md px-4 py-3 text-sm text-white"
                    : "brain-message mr-auto max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 text-sm text-text"
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

          {/* Loading indicator */}
          {loading && (
            <div className="mb-3 flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet/20 to-accent/20">
                <Brain className="h-3.5 w-3.5 animate-pulse text-violet" />
              </div>
              <div className="brain-message mr-auto rounded-2xl rounded-bl-md px-4 py-3 text-sm text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="animate-pulse">Pensando</span>
                  <span className="inline-flex gap-0.5">
                    <span
                      className="inline-block h-1 w-1 animate-bounce rounded-full bg-violet/50"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="inline-block h-1 w-1 animate-bounce rounded-full bg-violet/50"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="inline-block h-1 w-1 animate-bounce rounded-full bg-violet/50"
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-bg/50 px-4 py-3 md:px-6">
          <form
            onSubmit={handleSubmit}
            className="glow-input flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                activeChatId
                  ? "O que o Pedro pensa sobre..."
                  : "Crie ou selecione uma conversa..."
              }
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
      </div>
    </div>
  );
}
