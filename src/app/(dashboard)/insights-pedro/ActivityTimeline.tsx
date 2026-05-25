"use client";

import type { ActivityLogEntry, ActivityActor } from "@/lib/supabase/types";

const actorBadge: Record<ActivityActor, { label: string; className: string }> = {
  system: {
    label: "Sistema",
    className: "bg-paper-dark border border-rule text-ink-muted",
  },
  pedro: {
    label: "Pedro",
    className: "bg-blue/10 text-blue",
  },
  henrique: {
    label: "Henrique",
    className: "bg-green/10 text-green",
  },
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;

  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default function ActivityTimeline({
  entries,
}: {
  entries: ActivityLogEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        Nenhuma atividade registrada.
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => {
        const badge = actorBadge[entry.actor] ?? actorBadge.system;
        const isLast = i === entries.length - 1;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* timeline line */}
            <div className="flex w-5 flex-col items-center">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rule" />
              {!isLast && <div className="w-px flex-1 bg-rule" />}
            </div>

            {/* content */}
            <div className={`min-w-0 flex-1 pb-4 ${isLast ? "" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${badge.className}`}
                >
                  {badge.label}
                </span>
                <span className="font-mono text-[10px] text-ink-muted">
                  {formatTimestamp(entry.created_at)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-ink-soft">{entry.action}</p>
              {entry.entity_title && (
                <p className="mt-0.5 text-xs text-ink-muted">
                  {entry.entity_type && (
                    <span className="font-mono uppercase">
                      {entry.entity_type}:{" "}
                    </span>
                  )}
                  {entry.entity_title}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
