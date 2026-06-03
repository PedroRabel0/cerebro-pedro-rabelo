"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Brain, Send, User, Plus, Trash2, MessageSquare, PanelLeftClose, PanelLeft, Sparkles, Zap } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getChats();
        setChats(data);
      } catch {}
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!activeChatId) { setMessages([]); return; }
    startTransition(async () => {
      try {
        const data = await getChatMessages(activeChatId);
        setMessages(data);
      } catch { setMessages([]); }
    });
  }, [activeChatId]);

  async function handleNewChat() {
    startTransition(async () => {
      try {
        const { id } = await createChat();
        setChats((prev) => [{ id, title: "Nova conversa", updated_at: new Date().toISOString() }, ...prev]);
        setActiveChatId(id);
        setMessages([]);
        inputRef.current?.focus();
      } catch {}
    });
  }

  async function handleDeleteChat(chatId: string) {
    startTransition(async () => {
      try {
        await deleteChat(chatId);
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (activeChatId === chatId) { setActiveChatId(null); setMessages([]); }
      } catch {}
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    let chatId = activeChatId;
    if (!chatId) {
      try {
        const { id } = await createChat();
        setChats((prev) => [{ id, title: "Nova conversa", updated_at: new Date().toISOString() }, ...prev]);
        setActiveChatId(id);
        chatId = id;
      } catch { return; }
    }

    setInput("");
    setLoading(true);
    if (inputRef.current) inputRef.current.style.height = "auto";

    setMessages((prev) => [...prev, {
      id: `temp-${Date.now()}`, role: "user", content: question, created_at: new Date().toISOString(),
    }]);

    try {
      const { response } = await sendChatMessage(chatId, question);
      setMessages((prev) => [...prev, {
        id: `temp-${Date.now()}-brain`, role: "brain", content: response, created_at: new Date().toISOString(),
      }]);
      setChats((prev) => prev.map((c) =>
        c.id === chatId
          ? { ...c, title: c.title === "Nova conversa" ? question.slice(0, 50) : c.title, updated_at: new Date().toISOString() }
          : c
      ));
    } catch {
      setMessages((prev) => [...prev, {
        id: `temp-${Date.now()}-err`, role: "brain", content: "Desculpa, tive um problema. Tenta de novo.", created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ===== LEFT: Chat History ===== */}
      <div className={`${sidebarOpen ? "w-72" : "w-0"} shrink-0 overflow-hidden border-r border-border/50 bg-card/50 transition-all duration-300 md:block hidden`}>
        <div className="flex h-full w-72 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="logo-gradient flex h-6 w-6 items-center justify-center rounded-lg">
                <Brain className="h-3 w-3 text-white" />
              </div>
              <span className="font-display text-sm font-bold text-text">Conversas</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* New chat */}
          <div className="p-3">
            <button
              onClick={handleNewChat}
              disabled={isPending}
              className="flex w-full items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2.5 text-[13px] font-medium text-accent transition-all hover:bg-accent/10 hover:border-accent/30 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova conversa
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {chats.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <MessageSquare className="h-5 w-5 text-text-muted/30 mb-2" />
                <p className="text-[12px] text-text-muted">Nenhuma conversa</p>
              </div>
            )}
            <div className="space-y-0.5">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => { setActiveChatId(chat.id); inputRef.current?.focus(); }}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                    activeChatId === chat.id
                      ? "nav-item-active text-accent"
                      : "text-text-secondary hover:bg-surface/40 hover:text-text"
                  }`}
                >
                  <MessageSquare className={`h-3 w-3 shrink-0 ${activeChatId === chat.id ? "text-accent" : "text-text-muted/40"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] leading-tight">{chat.title}</p>
                    <p className="font-mono text-[11px] text-text-muted/60">{relativeTime(chat.updated_at)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                    className="shrink-0 rounded p-1 text-text-muted/30 opacity-0 transition-all hover:bg-red/10 hover:text-red group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== RIGHT: Chat Area ===== */}
      <div className="relative flex flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b border-border/30 px-4 py-2.5 md:px-6">
          {/* Toggle sidebar button */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden md:flex rounded-lg p-1.5 text-text-muted hover:bg-surface hover:text-text transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden rounded-lg p-1.5 text-text-muted hover:text-text"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet/15 to-accent/15">
              <Zap className="h-3 w-3 text-violet" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
              {activeChatId ? (chats.find(c => c.id === activeChatId)?.title || "Conversa") : "Cerebro IA"}
            </span>
          </div>

          {activeChatId && (
            <span className="font-mono text-[11px] text-text-muted/50">
              {messages.length} msg
            </span>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
            {/* Empty: no chat */}
            {!activeChatId && messages.length === 0 && !loading && (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                <div className="animate-float mb-6 flex h-16 w-16 items-center justify-center rounded-2xl logo-gradient">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <h2 className="font-display text-xl font-bold text-text mb-2">
                  Segundo Cerebro
                </h2>
                <p className="text-sm text-text-secondary max-w-sm mb-6">
                  Pergunte sobre playbooks, historias, referencias. O cerebro sabe tudo que foi alimentado.
                </p>
                <button
                  onClick={handleNewChat}
                  className="btn-primary rounded-xl px-6 py-2.5 text-sm font-medium text-white"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Iniciar conversa
                  </span>
                </button>
              </div>
            )}

            {/* Empty: chat selected but no messages */}
            {activeChatId && messages.length === 0 && !loading && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/10 to-violet/10">
                  <Brain className="h-6 w-6 text-violet" />
                </div>
                <p className="text-sm text-text-secondary mb-5">
                  O que voce quer saber?
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                  {[
                    "Resuma meus playbooks",
                    "Me de uma ideia de post",
                    "Quais temas estao incompletos?",
                    "O que o Pedro pensa sobre lideranca?",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      className="rounded-full border border-border/50 bg-surface/30 px-3.5 py-2 text-[12px] text-text-muted transition-all hover:border-accent/30 hover:text-accent hover:bg-accent/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`animate-fade-in flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-xl ${
                    msg.role === "user"
                      ? "bg-accent/15"
                      : "bg-gradient-to-br from-violet/20 to-accent/10"
                  }`}>
                    {msg.role === "user"
                      ? <User className="h-3.5 w-3.5 text-accent" />
                      : <Brain className="h-3.5 w-3.5 text-violet" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
                    {/* Label */}
                    <p className={`mb-1 font-mono text-[11px] ${msg.role === "user" ? "text-right text-accent/60" : "text-violet/60"}`}>
                      {msg.role === "user" ? "Voce" : "Cerebro"}
                    </p>
                    {/* Content */}
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent/10 text-text border border-accent/10 rounded-tr-md"
                        : "glass-card text-text rounded-tl-md"
                    }`}>
                      {msg.content.split("\n").map((line, j) => (
                        <p key={j} className={j > 0 ? "mt-1.5" : ""}>{line || " "}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="animate-fade-in flex gap-3">
                  <div className="shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet/20 to-accent/10">
                    <Brain className="h-3.5 w-3.5 animate-pulse text-violet" />
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[11px] text-violet/60">Cerebro</p>
                    <div className="glass-card rounded-2xl rounded-tl-md px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-sm text-text-muted">
                        <span className="animate-pulse">Pensando</span>
                        <span className="inline-flex gap-0.5">
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet/40" style={{ animationDelay: "0ms" }} />
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet/40" style={{ animationDelay: "150ms" }} />
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet/40" style={{ animationDelay: "300ms" }} />
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ===== Input area ===== */}
        <div className="border-t border-border/30 bg-bg/80 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl px-4 py-3 md:px-8">
            <form onSubmit={handleSubmit} className="relative">
              <div className="glow-input flex items-end gap-2 rounded-2xl border border-border/50 bg-surface/50 px-4 py-2.5 transition-colors focus-within:border-accent/30">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder={activeChatId ? "Pergunte ao Cerebro..." : "Crie uma conversa para comecar..."}
                  disabled={loading}
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-text placeholder:text-text-muted/50 focus:outline-none disabled:opacity-50"
                  style={{ maxHeight: "150px" }}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-all hover:bg-accent-hover disabled:opacity-30 disabled:bg-surface disabled:text-text-muted"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-center font-mono text-[11px] text-text-muted/40">
                Enter para enviar · Shift+Enter para nova linha
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card md:hidden">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="logo-gradient flex h-6 w-6 items-center justify-center rounded-lg">
                    <Brain className="h-3 w-3 text-white" />
                  </div>
                  <span className="font-display text-sm font-bold text-text">Conversas</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-text-muted hover:text-text">
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3">
                <button onClick={handleNewChat} disabled={isPending} className="flex w-full items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2.5 text-[13px] font-medium text-accent hover:bg-accent/10 disabled:opacity-50">
                  <Plus className="h-3.5 w-3.5" /> Nova conversa
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
                {chats.map((chat) => (
                  <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setSidebarOpen(false); }}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-all ${activeChatId === chat.id ? "nav-item-active text-accent" : "text-text-secondary hover:bg-surface/40"}`}>
                    <MessageSquare className={`h-3 w-3 shrink-0 ${activeChatId === chat.id ? "text-accent" : "text-text-muted/40"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">{chat.title}</p>
                      <p className="font-mono text-[11px] text-text-muted/60">{relativeTime(chat.updated_at)}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                      className="shrink-0 rounded p-1 text-text-muted/30 opacity-0 hover:bg-red/10 hover:text-red group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
