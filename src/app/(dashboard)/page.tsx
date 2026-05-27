export const dynamic = "force-dynamic";
export const maxDuration = 60;

import UniversalInput from "@/components/UniversalInput";
import BrainChat from "@/components/BrainChat";
import { getDashboardStats, getActivityFeed } from "./actions";
import Link from "next/link";
import {
  Inbox,
  BookOpen,
  BookMarked,
  Sparkles,
  Clock,
  Brain,
  Zap,
  Search,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

function getActivityIcon(
  action: string,
  entityType: string | null
): typeof BookOpen {
  if (entityType === "playbook") return BookOpen;
  if (entityType === "story") return BookMarked;
  if (entityType === "generated_content") return Sparkles;
  if (entityType === "reference_post") return Search;
  if (action.toLowerCase().includes("proposta") || action.toLowerCase().includes("aprovou"))
    return CheckCircle2;
  if (action.toLowerCase().includes("scrape") || action.toLowerCase().includes("instagram"))
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

// TODO: Filtrar activity feed por usuario/role quando implementar
// server-side role detection (ex: ler role do cookie/session no server component).
// Atualmente o feed mostra toda atividade para ambos os usuarios.
export default async function DashboardHome() {
  const [stats, activityFeed] = await Promise.all([
    getDashboardStats(),
    getActivityFeed(),
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
            <Brain className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Cérebro do Pedro
            </h1>
            <p className="text-sm text-text-secondary">
              Seu cérebro sabe{" "}
              <span className="font-medium text-text">
                {stats.playbooks} playbooks
              </span>
              ,{" "}
              <span className="font-medium text-text">
                {stats.stories} histórias
              </span>{" "}
              e{" "}
              <span className="font-medium text-text">
                {stats.contents} referências
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Brain Chat */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-muted">
          <Brain className="h-3.5 w-3.5" />
          Perguntar ao Cérebro
        </h2>
        <BrainChat />
      </div>

      {/* Feed the Brain */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-muted">
          <Zap className="h-3.5 w-3.5" />
          Alimentar o Cérebro
        </h2>
        <UniversalInput />
      </div>

      {/* Brain Health Stats */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-muted">
          <Sparkles className="h-3.5 w-3.5" />
          Saúde do Cérebro
        </h2>
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
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-muted">
          <Clock className="h-3.5 w-3.5" />
          Atividade Recente
        </h2>
        {activityFeed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
              <Brain className="h-8 w-8 text-accent" />
            </div>
            <p className="text-sm font-medium text-text">
              Nenhuma atividade ainda
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Alimente o cérebro acima para começar a gerar atividade.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activityFeed.map((item, i) => {
              const ActionIcon = getActivityIcon(
                item.action,
                item.entity_type
              );
              const link = getActivityLink(item.entity_type);
              return (
                <Link
                  key={item.id}
                  href={link}
                  className="card-hover animate-fade-in flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface">
                    <ActionIcon className="h-4 w-4 text-text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {item.action}
                    </p>
                    {item.entity_title && (
                      <p className="truncate text-xs text-text-muted">
                        {item.entity_title}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-text-muted">
                    {relativeTime(item.created_at)}
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
