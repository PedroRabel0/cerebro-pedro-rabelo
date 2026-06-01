export const dynamic = "force-dynamic";
export const maxDuration = 60;

import UniversalInput from "@/components/UniversalInput";
import BrainChat from "@/components/BrainChat";
import ActivityAccordion from "@/components/ActivityAccordion";
import { getDashboardStats, getActivityFeed } from "./actions";
import {
  Inbox,
  BookOpen,
  BookMarked,
  Sparkles,
  Clock,
  Brain,
  Zap,
} from "lucide-react";

// TODO: Filtrar activity feed por usuario/role quando implementar
// server-side role detection (ex: ler role do cookie/session no server component).
// Atualmente o feed mostra toda atividade para ambos os usuarios.
function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl shimmer" />
        <div className="space-y-2">
          <div className="h-5 w-10 rounded shimmer" />
          <div className="h-2.5 w-14 rounded shimmer" />
        </div>
      </div>
    </div>
  );
}

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
              Seu cérebro contém{" "}
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

      {/* Activity Feed — collapsible */}
      <ActivityAccordion entries={activityFeed} />
    </div>
  );
}
