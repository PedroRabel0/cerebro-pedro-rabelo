"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Save,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import VoiceButton from "@/components/VoiceButton";
import { saveEntry, deleteEntry, generateDaySummary } from "./actions";

interface JournalEntry {
  id: string;
  entry_date: string;
  author: string;
  content: string;
  highlights: string | null;
  challenges: string | null;
  decisions: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

interface JournalProps {
  entries: JournalEntry[];
  todayEntry: JournalEntry | null;
  today: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

// --- Today's Entry Editor ---

function TodayEditor({
  entry,
  today,
}: {
  entry: JournalEntry | null;
  today: string;
}) {
  const [content, setContent] = useState(entry?.content || "");
  const [highlights, setHighlights] = useState(entry?.highlights || "");
  const [challenges, setChallenges] = useState(entry?.challenges || "");
  const [decisions, setDecisions] = useState(entry?.decisions || "");
  const [aiSummary, setAiSummary] = useState(entry?.ai_summary || "");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await saveEntry({
        entry_date: today,
        content,
        highlights: highlights || undefined,
        challenges: challenges || undefined,
        decisions: decisions || undefined,
      });
      setLastSaved(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [content, highlights, challenges, decisions, today]);

  // Auto-save: debounce 2s after any change
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      doSave();
    }, 2000);
  }, [doSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  async function handleGenerateSummary() {
    if (!content.trim()) return;

    // Save first if needed
    await doSave();

    setGenerating(true);
    try {
      // We need the entry ID. If it was just created, refetch
      // For simplicity, save returns void, so we call generate after save
      // The entry should exist after save
      const entryId = entry?.id;
      if (!entryId) {
        // Entry was just created, we need to reload page to get the ID
        window.location.reload();
        return;
      }
      const summary = await generateDaySummary(entryId);
      setAiSummary(summary);
    } catch (err) {
      console.error("Generate summary failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl border border-accent/20 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Hoje</p>
          <p className="font-display text-lg font-semibold text-text">
            {formatDate(today)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-text-muted">
              Salvo as {lastSaved}
            </span>
          )}
          <button
            onClick={doSave}
            disabled={saving || !content.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salvar
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            scheduleAutoSave();
          }}
          placeholder="O que aconteceu hoje? Reunioes, decisoes, aprendizados..."
          className="w-full resize-none rounded-xl border border-border bg-card p-4 pr-12 text-sm text-text placeholder:text-text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
          rows={6}
        />
        <div className="absolute right-2 top-2">
          <VoiceButton
            onTranscript={(text) => {
              setContent((prev) => prev ? prev + " " + text : text);
              scheduleAutoSave();
            }}
          />
        </div>
      </div>

      {/* Collapsible details */}
      <button
        onClick={() => setDetailsOpen(!detailsOpen)}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text"
      >
        {detailsOpen ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        Detalhes do dia
      </button>

      {detailsOpen && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Destaques do dia
            </label>
            <div className="relative">
              <textarea
                value={highlights}
                onChange={(e) => {
                  setHighlights(e.target.value);
                  scheduleAutoSave();
                }}
                placeholder="O que deu certo hoje?"
                className="w-full resize-none rounded-lg border border-border bg-card p-3 pr-11 text-sm text-text placeholder:text-text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
                rows={2}
              />
              <div className="absolute right-1.5 top-1.5">
                <VoiceButton
                  size="sm"
                  onTranscript={(text) => {
                    setHighlights((prev) => prev ? prev + " " + text : text);
                    scheduleAutoSave();
                  }}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Desafios enfrentados
            </label>
            <div className="relative">
              <textarea
                value={challenges}
                onChange={(e) => {
                  setChallenges(e.target.value);
                  scheduleAutoSave();
                }}
                placeholder="O que foi dificil?"
                className="w-full resize-none rounded-lg border border-border bg-card p-3 pr-11 text-sm text-text placeholder:text-text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
                rows={2}
              />
              <div className="absolute right-1.5 top-1.5">
                <VoiceButton
                  size="sm"
                  onTranscript={(text) => {
                    setChallenges((prev) => prev ? prev + " " + text : text);
                    scheduleAutoSave();
                  }}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Decisoes tomadas
            </label>
            <div className="relative">
              <textarea
                value={decisions}
                onChange={(e) => {
                  setDecisions(e.target.value);
                  scheduleAutoSave();
                }}
                placeholder="Que decisoes foram tomadas hoje?"
                className="w-full resize-none rounded-lg border border-border bg-card p-3 pr-11 text-sm text-text placeholder:text-text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
                rows={2}
              />
              <div className="absolute right-1.5 top-1.5">
                <VoiceButton
                  size="sm"
                  onTranscript={(text) => {
                    setDecisions((prev) => prev ? prev + " " + text : text);
                    scheduleAutoSave();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleGenerateSummary}
          disabled={generating || !content.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-accent/30 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Gerar resumo com IA
        </button>
      </div>

      {aiSummary && (
        <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
          <p className="mb-2 text-xs font-medium text-accent">Resumo IA</p>
          <div className="whitespace-pre-wrap text-sm text-text-secondary">
            {aiSummary}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Calendar Dots ---

function CalendarDots({
  entries,
  today,
  onSelectDate,
}: {
  entries: JournalEntry[];
  today: string;
  onSelectDate: (date: string) => void;
}) {
  const entryDates = new Set(entries.map((e) => e.entry_date));

  // Generate last 30 days
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-3">
      {days.map((day) => {
        const hasEntry = entryDates.has(day);
        const isToday = day === today;
        return (
          <button
            key={day}
            onClick={() => onSelectDate(day)}
            title={formatDateShort(day)}
            className={`h-3 w-3 rounded-full transition-all ${
              isToday
                ? "ring-2 ring-accent ring-offset-1 ring-offset-card"
                : ""
            } ${
              hasEntry
                ? "bg-green hover:scale-125"
                : "bg-border/50 hover:bg-border"
            }`}
          />
        );
      })}
    </div>
  );
}

// --- Past Entry Card ---

function EntryCard({
  entry,
  onDelete,
}: {
  entry: JournalEntry;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const preview =
    entry.content.length > 200
      ? entry.content.slice(0, 200) + "..."
      : entry.content;

  async function handleDelete() {
    if (!confirm("Apagar esta entrada?")) return;
    setDeleting(true);
    try {
      await deleteEntry(entry.id);
      onDelete(entry.id);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left"
        >
          <p className="font-display text-sm font-semibold text-text">
            {formatDate(entry.entry_date)}
          </p>
          <p className="mt-1.5 text-sm text-text-secondary">
            {expanded ? entry.content : preview}
          </p>
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-3 rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-red/10 hover:text-red group-hover:opacity-100"
          title="Apagar entrada"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          {entry.highlights && (
            <div>
              <p className="text-xs font-medium text-green">Destaques</p>
              <p className="text-sm text-text-secondary">{entry.highlights}</p>
            </div>
          )}
          {entry.challenges && (
            <div>
              <p className="text-xs font-medium text-orange">Desafios</p>
              <p className="text-sm text-text-secondary">{entry.challenges}</p>
            </div>
          )}
          {entry.decisions && (
            <div>
              <p className="text-xs font-medium text-accent">Decisoes</p>
              <p className="text-sm text-text-secondary">{entry.decisions}</p>
            </div>
          )}
          {entry.ai_summary && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
              <p className="mb-1 text-xs font-medium text-accent">Resumo IA</p>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">
                {entry.ai_summary}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Journal Component ---

export default function Journal({ entries, todayEntry, today }: JournalProps) {
  const [localEntries, setLocalEntries] = useState(entries);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Filter out today's entry from the past entries list
  const pastEntries = localEntries.filter((e) => e.entry_date !== today);

  function handleDelete(id: string) {
    setLocalEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleSelectDate(date: string) {
    if (date === today) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Find the entry card for this date and scroll to it
    const el = document.getElementById(`entry-${date}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight
      el.classList.add("ring-2", "ring-accent/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-accent/50"), 2000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Today's entry */}
      <TodayEditor entry={todayEntry} today={today} />

      {/* Calendar dots */}
      <div>
        <p className="mb-1 text-xs font-medium text-text-muted">
          Ultimos 30 dias
        </p>
        <CalendarDots
          entries={localEntries}
          today={today}
          onSelectDate={handleSelectDate}
        />
      </div>

      {/* Past entries timeline */}
      {pastEntries.length > 0 && (
        <div ref={timelineRef}>
          <h2 className="mb-3 font-display text-lg font-semibold text-text">
            Entradas anteriores
          </h2>
          <div className="space-y-3">
            {pastEntries.map((entry) => (
              <div key={entry.id} id={`entry-${entry.entry_date}`}>
                <EntryCard entry={entry} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        </div>
      )}

      {pastEntries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-text-muted">
            Nenhuma entrada anterior. Comece escrevendo sobre o seu dia!
          </p>
        </div>
      )}
    </div>
  );
}
