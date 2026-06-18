"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  Trash2,
  XCircle,
  Eye,
} from "lucide-react";
import type { CalendarEntry, CalendarStatus, Platform } from "@/lib/supabase/types";
import {
  createCalendarEntry,
  updateCalendarEntry,
  deleteCalendarEntry,
  scheduleContentFromDraft,
  getCalendarEntries,
} from "./actions";

// --- Constants ---

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  linkedin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  x: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  youtube: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PLATFORM_DOT: Record<string, string> = {
  instagram: "bg-pink-400",
  linkedin: "bg-blue-400",
  x: "bg-slate-400",
  youtube: "bg-red-400",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  published: "bg-green-500/20 text-green-400 border-green-500/30",
  missed: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  published: "Publicado",
  missed: "Perdido",
  cancelled: "Cancelado",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  instagram_reel: "Reels",
  instagram_carousel: "Carousel",
  instagram_static: "Post",
  youtube_long: "YouTube Longo",
  youtube_short: "YouTube Short",
  linkedin_post: "LinkedIn Post",
  x_thread: "X Thread",
  x_tweet: "X Tweet",
};

function getPlatform(contentType: string): Platform {
  if (contentType.startsWith("instagram")) return "instagram";
  if (contentType.startsWith("youtube")) return "youtube";
  if (contentType.startsWith("linkedin")) return "linkedin";
  if (contentType.startsWith("x_")) return "x";
  return "instagram";
}

// --- Helpers ---

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday = 0, Sunday = 6 */
function getStartDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Convert: Sunday=0 -> 6, Monday=1 -> 0, ...
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date) {
  return isSameDay(date, new Date());
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(dd);
  }
  return days;
}

// --- Unscheduled content type ---
interface UnscheduledContent {
  id: string;
  content_type: string;
  content_text: string | null;
  status: string;
  created_at: string;
}

// --- Props ---

interface CalendarViewProps {
  initialEntries: CalendarEntry[];
  unscheduledContents: UnscheduledContent[];
}

// ===========================================
// Main Component
// ===========================================

export default function CalendarView({
  initialEntries,
  unscheduledContents,
}: CalendarViewProps) {
  const today = new Date();
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(today);
  const [entries, setEntries] = useState<CalendarEntry[]>(initialEntries);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Group entries by date key
  const entriesByDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    for (const entry of entries) {
      const d = new Date(entry.scheduled_for);
      const key = formatDateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }
    return map;
  }, [entries]);

  // Navigate
  const goBack = useCallback(() => {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
    // Re-fetch for new range
    startTransition(async () => {
      const start = viewMode === "month"
        ? new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
        : getWeekDays(d)[0].toISOString();
      const end = viewMode === "month"
        ? new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
        : new Date(getWeekDays(d)[6].getTime() + 86399999).toISOString();
      const data = await getCalendarEntries(start, end);
      setEntries(data);
    });
  }, [currentDate, viewMode]);

  const goForward = useCallback(() => {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
    startTransition(async () => {
      const start = viewMode === "month"
        ? new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
        : getWeekDays(d)[0].toISOString();
      const end = viewMode === "month"
        ? new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
        : new Date(getWeekDays(d)[6].getTime() + 86399999).toISOString();
      const data = await getCalendarEntries(start, end);
      setEntries(data);
    });
  }, [currentDate, viewMode]);

  const goToday = useCallback(() => {
    setCurrentDate(new Date());
    startTransition(async () => {
      const data = await getCalendarEntries();
      setEntries(data);
    });
  }, []);

  // Re-fetch when switching view mode
  const switchView = useCallback(
    (mode: "month" | "week") => {
      setViewMode(mode);
      startTransition(async () => {
        const d = currentDate;
        const start =
          mode === "month"
            ? new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
            : getWeekDays(d)[0].toISOString();
        const end =
          mode === "month"
            ? new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
            : new Date(getWeekDays(d)[6].getTime() + 86399999).toISOString();
        const data = await getCalendarEntries(start, end);
        setEntries(data);
      });
    },
    [currentDate]
  );

  // Refresh after mutations
  const refresh = useCallback(() => {
    startTransition(async () => {
      const d = currentDate;
      const start =
        viewMode === "month"
          ? new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
          : getWeekDays(d)[0].toISOString();
      const end =
        viewMode === "month"
          ? new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
          : new Date(getWeekDays(d)[6].getTime() + 86399999).toISOString();
      const data = await getCalendarEntries(start, end);
      setEntries(data);
    });
  }, [currentDate, viewMode]);

  // Month label
  const headerLabel =
    viewMode === "month"
      ? `${MONTH_NAMES[month]} ${year}`
      : (() => {
          const days = getWeekDays(currentDate);
          const first = days[0];
          const last = days[6];
          if (first.getMonth() === last.getMonth()) {
            return `${first.getDate()} - ${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
          }
          return `${first.getDate()} ${MONTH_NAMES[first.getMonth()].slice(0, 3)} - ${last.getDate()} ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
        })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-text-secondary transition-colors hover:bg-card-hover hover:text-text"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-[200px] text-center font-display text-lg font-semibold text-text">
            {headerLabel}
          </h2>
          <button
            onClick={goForward}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-text-secondary transition-colors hover:bg-card-hover hover:text-text"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-card-hover hover:text-text"
          >
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-card">
            <button
              onClick={() => switchView("week")}
              className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "week"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => switchView("month")}
              className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "month"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              Mes
            </button>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Agendar Conteudo
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
      )}

      {/* Calendar Grid */}
      {viewMode === "month" ? (
        <MonthGrid
          year={year}
          month={month}
          entriesByDate={entriesByDate}
          onSelectDay={setSelectedDay}
          selectedDay={selectedDay}
        />
      ) : (
        <WeekGrid
          currentDate={currentDate}
          entriesByDate={entriesByDate}
          onSelectDay={setSelectedDay}
          selectedDay={selectedDay}
        />
      )}

      {/* Day detail panel */}
      {selectedDay && (
        <DayPanel
          date={selectedDay}
          entries={entriesByDate[formatDateKey(selectedDay)] || []}
          onClose={() => setSelectedDay(null)}
          onRefresh={refresh}
        />
      )}

      {/* Schedule modal */}
      {showScheduleModal && (
        <ScheduleModal
          unscheduledContents={unscheduledContents}
          onClose={() => setShowScheduleModal(false)}
          onRefresh={refresh}
          defaultDate={selectedDay}
        />
      )}
    </div>
  );
}

// ===========================================
// Month Grid
// ===========================================

function MonthGrid({
  year,
  month,
  entriesByDate,
  onSelectDay,
  selectedDay,
}: {
  year: number;
  month: number;
  entriesByDate: Record<string, CalendarEntry[]>;
  onSelectDay: (d: Date) => void;
  selectedDay: Date | null;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartDayOfWeek(year, month);

  // Build grid cells: leading blanks + day cells
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  // Pad trailing to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border min-w-[680px]">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-text-muted"
          >
            {label}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 min-w-[680px]">
        {cells.map((date, idx) => {
          if (!date) {
            return (
              <div
                key={`blank-${idx}`}
                className="min-h-[100px] border-b border-r border-border/50 bg-bg/30"
              />
            );
          }
          const key = formatDateKey(date);
          const dayEntries = entriesByDate[key] || [];
          const today_ = isToday(date);
          const selected = selectedDay && isSameDay(date, selectedDay);

          return (
            <button
              key={key}
              onClick={() => onSelectDay(date)}
              className={`min-h-[100px] border-b border-r border-border/50 p-1.5 text-left transition-colors hover:bg-card-hover ${
                selected ? "bg-accent/10 ring-1 ring-accent/40" : ""
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  today_
                    ? "bg-accent text-white"
                    : "text-text-secondary"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 flex flex-col gap-0.5">
                {dayEntries.slice(0, 3).map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium border ${PLATFORM_COLORS[entry.platform] || PLATFORM_COLORS.instagram}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${PLATFORM_DOT[entry.platform] || PLATFORM_DOT.instagram}`}
                    />
                    <span className="truncate">{entry.title}</span>
                  </div>
                ))}
                {dayEntries.length > 3 && (
                  <span className="px-1 text-[10px] text-text-muted">
                    +{dayEntries.length - 3} mais
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================
// Week Grid
// ===========================================

function WeekGrid({
  currentDate,
  entriesByDate,
  onSelectDay,
  selectedDay,
}: {
  currentDate: Date;
  entriesByDate: Record<string, CalendarEntry[]>;
  onSelectDay: (d: Date) => void;
  selectedDay: Date | null;
}) {
  const weekDays = getWeekDays(currentDate);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 min-w-[680px]">
        {weekDays.map((date, idx) => {
          const key = formatDateKey(date);
          const dayEntries = entriesByDate[key] || [];
          const today_ = isToday(date);
          const selected = selectedDay && isSameDay(date, selectedDay);

          return (
            <div
              key={key}
              className={`min-h-[320px] border-r border-border/50 last:border-r-0 ${
                selected ? "bg-accent/10" : ""
              }`}
            >
              {/* Day header */}
              <button
                onClick={() => onSelectDay(date)}
                className="flex w-full flex-col items-center gap-0.5 border-b border-border px-2 py-3 transition-colors hover:bg-card-hover"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  {WEEKDAY_LABELS[idx]}
                </span>
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    today_
                      ? "bg-accent text-white"
                      : "text-text"
                  }`}
                >
                  {date.getDate()}
                </span>
              </button>
              {/* Entries */}
              <div className="flex flex-col gap-1 p-1.5">
                {dayEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => onSelectDay(date)}
                    className={`rounded-lg border p-2 text-left transition-colors hover:bg-card-hover ${PLATFORM_COLORS[entry.platform] || PLATFORM_COLORS.instagram}`}
                  >
                    <p className="truncate text-xs font-medium">{entry.title}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[10px] opacity-75">
                        {CONTENT_TYPE_LABELS[entry.content_type] || entry.content_type}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span
                        className={`inline-block rounded px-1 py-0.5 text-[9px] font-medium border ${STATUS_COLORS[entry.status]}`}
                      >
                        {STATUS_LABELS[entry.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-text-muted">
                      {new Date(entry.scheduled_for).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </button>
                ))}
                {dayEntries.length === 0 && (
                  <p className="py-4 text-center text-[10px] text-text-muted">
                    Sem conteudo
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================
// Day Panel (side detail)
// ===========================================

function DayPanel({
  date,
  entries,
  onClose,
  onRefresh,
}: {
  date: Date;
  entries: CalendarEntry[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const formatted = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleUpdateStatus = (id: string, status: CalendarStatus) => {
    startTransition(async () => {
      await updateCalendarEntry(id, { status });
      onRefresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteCalendarEntry(id);
      onRefresh();
    });
  };

  return (
    <div className="animate-slide-in rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold capitalize text-text">
          {formatted}
        </h3>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isPending && (
        <div className="mb-3 h-0.5 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
      )}

      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Nenhum conteudo agendado para este dia.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-border bg-bg p-4 transition-colors hover:border-border-light"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-text">
                    {entry.title}
                  </h4>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {/* Content type badge */}
                    <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                      {CONTENT_TYPE_LABELS[entry.content_type] || entry.content_type}
                    </span>
                    {/* Platform badge */}
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${PLATFORM_COLORS[entry.platform]}`}
                    >
                      {PLATFORM_LABELS[entry.platform]}
                    </span>
                    {/* Status badge */}
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[entry.status]}`}
                    >
                      {STATUS_LABELS[entry.status]}
                    </span>
                    {/* Time */}
                    <span className="text-[10px] text-text-muted">
                      {new Date(entry.scheduled_for).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="mt-2 text-xs text-text-muted">{entry.notes}</p>
                  )}
                  {/* Content preview */}
                  {entry.content?.content_text && (
                    <div className="mt-2 rounded-lg border border-border/50 bg-surface/50 p-2">
                      <div className="flex items-center gap-1 text-[10px] text-text-muted">
                        <Eye className="h-3 w-3" />
                        Preview
                      </div>
                      <p className="mt-1 line-clamp-3 text-xs text-text-secondary">
                        {entry.content.content_text.slice(0, 200)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* Quick actions */}
              <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-3">
                {entry.status === "scheduled" && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(entry.id, "published")}
                      className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2.5 py-1.5 text-[11px] font-medium text-green-400 transition-colors hover:bg-green-500/20"
                    >
                      <Check className="h-3 w-3" />
                      Publicado
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(entry.id, "cancelled")}
                      className="flex items-center gap-1 rounded-lg bg-slate-500/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-500/20"
                    >
                      <XCircle className="h-3 w-3" />
                      Cancelar
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================
// Schedule Modal
// ===========================================

function ScheduleModal({
  unscheduledContents,
  onClose,
  onRefresh,
  defaultDate,
}: {
  unscheduledContents: UnscheduledContent[];
  onClose: () => void;
  onRefresh: () => void;
  defaultDate: Date | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"from_content" | "placeholder">(
    unscheduledContents.length > 0 ? "from_content" : "placeholder"
  );
  const [selectedContentId, setSelectedContentId] = useState("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("instagram_carousel");
  const [platform, setPlatform] = useState("instagram");
  const [notes, setNotes] = useState("");

  // Default date/time: selected day at 10:00 or now
  const defaultDt = defaultDate
    ? `${formatDateKey(defaultDate)}T10:00`
    : `${formatDateKey(new Date())}T10:00`;
  const [scheduledFor, setScheduledFor] = useState(defaultDt);

  // Auto-detect platform when content type changes
  const handleContentTypeChange = (ct: string) => {
    setContentType(ct);
    setPlatform(getPlatform(ct));
  };

  // When selecting existing content, auto-fill fields
  const handleSelectContent = (id: string) => {
    setSelectedContentId(id);
    const c = unscheduledContents.find((c) => c.id === id);
    if (c) {
      setContentType(c.content_type);
      setPlatform(getPlatform(c.content_type));
      setTitle(
        (c.content_text || "Conteudo sem titulo").slice(0, 60).trim() + "..."
      );
    }
  };

  const handleSubmit = () => {
    startTransition(async () => {
      if (mode === "from_content" && selectedContentId) {
        await scheduleContentFromDraft(selectedContentId, new Date(scheduledFor).toISOString());
      } else {
        await createCalendarEntry({
          title: title || "Conteudo sem titulo",
          contentType,
          scheduledFor: new Date(scheduledFor).toISOString(),
          platform,
          notes: notes || undefined,
        });
      }
      onRefresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-slide-in mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-text">
            Agendar Conteudo
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode toggle */}
        {unscheduledContents.length > 0 && (
          <div className="mb-4 flex rounded-lg border border-border bg-bg">
            <button
              onClick={() => setMode("from_content")}
              className={`flex-1 rounded-l-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === "from_content"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              Conteudo Existente
            </button>
            <button
              onClick={() => setMode("placeholder")}
              className={`flex-1 rounded-r-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === "placeholder"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              Placeholder
            </button>
          </div>
        )}

        <div className="space-y-4">
          {mode === "from_content" ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Selecionar conteudo
              </label>
              <select
                value={selectedContentId}
                onChange={(e) => handleSelectContent(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
              >
                <option value="">Selecione...</option>
                {unscheduledContents.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{CONTENT_TYPE_LABELS[c.content_type] || c.content_type}]{" "}
                    {(c.content_text || "Sem texto").slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Titulo
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Post sobre produtividade"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Tipo de conteudo
                </label>
                <select
                  value={contentType}
                  onChange={(e) => handleContentTypeChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
                >
                  {Object.entries(CONTENT_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Data e horario
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Plataforma
            </label>
            <div className="flex gap-2">
              {(["instagram", "linkedin", "x", "youtube"] as Platform[]).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      platform === p
                        ? PLATFORM_COLORS[p]
                        : "border-border text-text-muted hover:border-border-light hover:text-text-secondary"
                    }`}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observacoes, ideias, lembretes..."
              className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={
              isPending ||
              (mode === "from_content" && !selectedContentId) ||
              (mode === "placeholder" && !title.trim())
            }
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Agendando..." : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
