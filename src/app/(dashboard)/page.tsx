export const dynamic = "force-dynamic";
export const maxDuration = 60;

import UniversalInput from "@/components/UniversalInput";
import { getRecentInputs, getDashboardStats } from "./actions";
import Link from "next/link";
import {
  Inbox,
  BookOpen,
  BookMarked,
  Sparkles,
  Clock,
  Video,
  Mic,
  FileText,
  MessageSquare,
  Paperclip,
  Brain,
  Zap,
  ArrowUpRight,
} from "lucide-react";

const sourceIcons: Record<string, typeof Video> = {
  youtube: Video,
  transcript: Mic,
  pdf: FileText,
  manual: MessageSquare,
};

const statusColors: Record<string, string> = {
  pending: "bg-accent/10 text-accent",
  processed: "bg-green/10 text-green",
  archived: "bg-text-muted/10 text-text-muted",
};

const statusLabels: Record<string, string> = {
  pending: "pendente",
  processed: "processado",
  archived: "arquivado",
};

export default async function DashboardHome() {
  const [recentInputs, stats] = await Promise.all([
    getRecentInputs(),
    getDashboardStats(),
  ]);

  const statItems = [
    {
      label: "Inputs",
      value: stats.captures,
      Icon: Inbox,
      color: "text-blue",
      bg: "bg-blue/10",
    },
    {
      label: "Playbooks",
      value: stats.playbooks,
      Icon: BookOpen,
      color: "text-purple",
      bg: "bg-purple/10",
    },
    {
      label: "Histórias",
      value: stats.stories,
      Icon: BookMarked,
      color: "text-green",
      bg: "bg-green/10",
    },
    {
      label: "Conteúdos",
      value: stats.contents,
      Icon: Sparkles,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Pendentes",
      value: stats.pendingProposals,
      Icon: Clock,
      color: "text-red",
      bg: "bg-red/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20">
            <Zap className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Alimentar o Cérebro
            </h1>
            <p className="text-sm text-text-secondary">
              Cole qualquer link, texto ou transcrição. A IA processa e organiza
              automaticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Universal Input */}
      <UniversalInput />

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statItems.map((stat, i) => (
          <div
            key={stat.label}
            className="card-hover animate-fade-in rounded-2xl border border-border bg-card px-4 py-3"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg}`}
              >
                <stat.Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <span className="block font-mono text-xl font-bold text-text">
                  {stat.value}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {stat.label}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Inputs */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-muted">
          <Clock className="h-3.5 w-3.5" />
          Inputs Recentes
        </h2>
        {recentInputs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
              <Brain className="h-8 w-8 text-accent" />
            </div>
            <p className="text-sm font-medium text-text">
              O cérebro está vazio
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Cole algo acima para começar a alimentar o sistema.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentInputs.map((item, i) => {
              const SourceIcon =
                sourceIcons[item.source_type] || Paperclip;
              return (
                <Link
                  key={item.id}
                  href="/insights-pedro"
                  className="card-hover animate-fade-in flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface">
                    <SourceIcon className="h-4 w-4 text-text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {item.title}
                    </p>
                    {item.context && (
                      <p className="truncate text-xs text-text-muted">
                        {item.context}
                      </p>
                    )}
                  </div>
                  <span
                    className={`hidden shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] sm:inline ${statusColors[item.status] || ""}`}
                  >
                    {statusLabels[item.status] || item.status}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-text-muted">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
