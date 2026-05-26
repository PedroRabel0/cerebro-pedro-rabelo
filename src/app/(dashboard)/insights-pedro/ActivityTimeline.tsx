"use client";

import type { ActivityLogEntry, ActivityActor } from "@/lib/supabase/types";
import { Bot, User, Code, Clock } from "lucide-react";

const actorConfig: Record<
  ActivityActor,
  {
    label: string;
    className: string;
    Icon: typeof Bot;
    dotColor: string;
  }
> = {
  ia: {
    label: "IA",
    className: "bg-accent/10 text-accent",
    Icon: Bot,
    dotColor: "bg-accent",
  },
  pedro: {
    label: "Pedro",
    className: "bg-blue/10 text-blue",
    Icon: User,
    dotColor: "bg-blue",
  },
  henrique: {
    label: "Henrique",
    className: "bg-green/10 text-green",
    Icon: Code,
    dotColor: "bg-green",
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
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface">
          <Clock className="h-6 w-6 text-text-muted" />
        </div>
        <p className="text-sm text-text-muted">
          Nenhuma atividade registrada.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => {
        const config = actorConfig[entry.actor] ?? actorConfig.ia;
        const isLast = i === entries.length - 1;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* timeline line */}
            <div className="flex w-5 flex-col items-center">
              <div
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${config.dotColor}`}
              />
              {!isLast && <div className="w-px flex-1 bg-border" />}
            </div>

            {/* content */}
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ${config.className}`}
                >
                  <config.Icon className="h-2.5 w-2.5" />
                  {config.label}
                </span>
                <span className="font-mono text-[10px] text-text-muted">
                  {formatTimestamp(entry.created_at)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-text-secondary">
                {entry.action}
              </p>
              {entry.entity_title && (
                <p className="mt-0.5 text-xs text-text-muted">
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
