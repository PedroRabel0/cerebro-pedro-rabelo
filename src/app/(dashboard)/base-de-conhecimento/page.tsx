export const dynamic = "force-dynamic";
export const maxDuration = 60; // processamento de IA (Alimentar) precisa de mais que os ~10s padrão

import Link from "next/link";
import { getPlaybooks, getStories, getHistoriasPessoais, getThemes } from "./actions";
import { getDashboardStats, getActivityFeed } from "../actions";
import Tabs from "./Tabs";
import ActivityAccordion from "@/components/ActivityAccordion";
import {
  BookOpen,
  Inbox,
  BookMarked,
  Sparkles,
  Clock,
  Brain,
} from "lucide-react";

export default async function BaseDeConhecimentoPage() {
  const [playbooks, stories, historiasPessoaisResult, themes, stats, activityFeed] = await Promise.all([
    getPlaybooks(),
    getStories(),
    getHistoriasPessoais().catch(() => []),
    getThemes(),
    getDashboardStats(),
    getActivityFeed(),
  ]);
  const historiasPessoais = historiasPessoaisResult ?? [];

  const statItems = [
    { label: "Inputs", value: stats.captures, Icon: Inbox, color: "text-blue", gradient: "stat-blue", href: "/insights-pedro" },
    { label: "Playbooks", value: stats.playbooks, Icon: BookOpen, color: "text-purple", gradient: "stat-purple", href: "/base-de-conhecimento" },
    { label: "Histórias", value: stats.stories, Icon: BookMarked, color: "text-green", gradient: "stat-green", href: "/base-de-conhecimento" },
    { label: "Conteúdos", value: stats.contents, Icon: Sparkles, color: "text-accent", gradient: "stat-accent", href: "/gerar-conteudo" },
    { label: "Pendentes", value: stats.pendingProposals, Icon: Clock, color: "text-red", gradient: "stat-red", href: "/insights-pedro" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <span className="page-accent-line" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red/20 to-blue/20">
            <BookOpen className="h-5 w-5 text-red" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Base de Conhecimento
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Playbooks e histórias organizados por tema.
            </p>
          </div>
        </div>
      </div>

      {/* Onboarding — only when base is empty */}
      {stats.playbooks === 0 && stats.stories === 0 && stats.captures === 0 && (
        <div className="animate-slide-in glass-card rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-text mb-2">
            Bem-vindo ao Segundo Cérebro!
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            Comece alimentando a base para o cérebro ficar inteligente:
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <a href="/base-de-conhecimento" className="card-hover rounded-xl border border-border bg-card p-4 block">
              <span className="font-display text-sm font-bold text-accent">1. Alimentar a base</span>
              <p className="mt-1 text-xs text-text-muted">Cole transcrições, links ou suba arquivos</p>
            </a>
            <a href="/identidade" className="card-hover rounded-xl border border-border bg-card p-4 block">
              <span className="font-display text-sm font-bold text-violet">2. Configurar identidade</span>
              <p className="mt-1 text-xs text-text-muted">Defina tom, voz e cores do Pedro</p>
            </a>
            <a href="/gerar-conteudo" className="card-hover rounded-xl border border-border bg-card p-4 block">
              <span className="font-display text-sm font-bold text-green">3. Gerar conteúdo</span>
              <p className="mt-1 text-xs text-text-muted">Crie o primeiro post com IA</p>
            </a>
          </div>
        </div>
      )}

      {/* Brain Health Stats */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wider text-text-muted">
          <Brain className="h-3.5 w-3.5 text-accent" />
          Saúde do Cérebro
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {statItems.map((stat, i) => (
            <Link
              key={stat.label}
              href={stat.href}
              className={`card-hover animate-fade-in rounded-2xl border border-border bg-card p-4 block ${stat.gradient}`}
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
            </Link>
          ))}
        </div>
      </div>

      {/* Knowledge Base Tabs */}
      <Tabs playbooks={playbooks} stories={stories} historiasPessoais={historiasPessoais} themes={themes} />

      {/* Activity Feed */}
      <ActivityAccordion entries={activityFeed} />
    </div>
  );
}
