"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  ChevronDown,
  BookOpen,
  BookMarked,
  Sparkles,
  Search,
  CheckCircle2,
  Zap,
  ArrowUpRight,
  Brain,
} from "lucide-react";
import type { ActivityLogEntry } from "@/lib/supabase/types";

function getActivityIcon(
  action: string,
  entityType: string | null
): typeof BookOpen {
  if (entityType === "playbook") return BookOpen;
  if (entityType === "story") return BookMarked;
  if (entityType === "generated_content") return Sparkles;
  if (entityType === "reference_post") return Search;
  if (
    action.toLowerCase().includes("proposta") ||
    action.toLowerCase().includes("aprovou")
  )
    return CheckCircle2;
  if (
    action.toLowerCase().includes("scrape") ||
    action.toLowerCase().includes("instagram")
  )
    return Search;
  return Zap;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function getActivityLink(entityType: string | null): string {
  switch (entityType) {
    case "playbook":
      return "/base-de-conhecimento";
    case "story":
      return "/base-de-conhecimento";
    case "capture":
      return "/insights-pedro";
    case "reference_post":
      return "/referencias";
    case "generated_content":
      return "/gerar-conteudo";
    default:
      return "/";
  }
}

export default function ActivityAccordion({
  entries,
}: {
  entries: ActivityLogEntry[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface/30"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
            Atividade Recente
          </span>
          {entries.length > 0 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent">
              {entries.length}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-text-muted transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`transition-all duration-200 ease-in-out ${
          open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        } overflow-hidden`}
      >
        <div className="border-t border-border">
          {entries.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                <Brain className="h-6 w-6 text-accent" />
              </div>
              <p className="text-sm text-text-muted">
                Nenhuma atividade ainda
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((item) => {
                const ActionIcon = getActivityIcon(
                  item.action,
                  item.entity_type
                );
                const link = getActivityLink(item.entity_type);
                return (
                  <Link
                    key={item.id}
                    href={link}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface/30"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface">
                      <ActionIcon className="h-3.5 w-3.5 text-text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text">
                        {item.action}
                      </p>
                      {item.entity_title && (
                        <p className="truncate text-xs text-text-muted">
                          {item.entity_title}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-text-muted">
                      {relativeTime(item.created_at)}
                    </span>
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-text-muted" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
