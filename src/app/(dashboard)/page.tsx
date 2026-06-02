export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
} from "lucide-react";

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
      gradient: "stat-blue",
    },
    {
      label: "Playbooks",
      value: stats.playbooks,
      Icon: BookOpen,
      color: "text-purple",
      gradient: "stat-purple",
    },
    {
      label: "Histórias",
      value: stats.stories,
      Icon: BookMarked,
      color: "text-green",
      gradient: "stat-green",
    },
    {
      label: "Conteúdos",
      value: stats.contents,
      Icon: Sparkles,
      color: "text-accent",
      gradient: "stat-accent",
    },
    {
      label: "Pendentes",
      value: stats.pendingProposals,
      Icon: Clock,
      color: "text-red",
      gradient: "stat-red",
    },
  ];

  return (
    <div className="relative space-y-10">
      {/* Header */}
      <div>
        <span className="page-accent-line" />
        <div className="flex items-center gap-4">
          <div className="logo-gradient flex h-11 w-11 items-center justify-center rounded-2xl">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Cérebro do Pedro
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              <span className="font-medium text-accent">
                {stats.playbooks}
              </span>{" "}
              playbooks ·{" "}
              <span className="font-medium text-green">
                {stats.stories}
              </span>{" "}
              histórias ·{" "}
              <span className="font-medium text-violet">
                {stats.contents}
              </span>{" "}
              referências
            </p>
          </div>
        </div>
      </div>

      {/* Brain Chat — glass card */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="mb-4 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wider text-text-muted">
          <Brain className="h-3.5 w-3.5 text-violet" />
          Perguntar ao Cérebro
        </h2>
        <BrainChat />
      </div>

      {/* Brain Health Stats */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wider text-text-muted">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Saúde do Cérebro
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {statItems.map((stat, i) => (
            <div
              key={stat.label}
              className={`card-hover animate-fade-in rounded-2xl border border-border bg-card p-4 ${stat.gradient}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/50">
                  <stat.Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <span className="block font-display text-xl font-bold text-text">
                    {stat.value}
                  </span>
                  <span className="block font-mono text-[11px] uppercase tracking-wider text-text-muted">
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
