"use client";

import { useState } from "react";
import type { Playbook, Story, Theme } from "@/lib/supabase/types";
import PlaybookList from "./PlaybookList";
import StoryList from "./StoryList";
import ThemeManager from "./ThemeManager";
import UniversalInput from "@/components/UniversalInput";
import { BookOpen, BookMarked, Zap, Users, User } from "lucide-react";

type MainTab = "pedro" | "outros" | "alimentar";
type SubTab = "playbooks" | "historias";

export default function Tabs({
  playbooks,
  stories,
  themes,
}: {
  playbooks: Playbook[];
  stories: Story[];
  themes: Theme[];
}) {
  const [mainTab, setMainTab] = useState<MainTab>("pedro");
  const [subTab, setSubTab] = useState<SubTab>("playbooks");

  // Split by created_by
  const pedroPlaybooks = playbooks.filter(
    (p) => !p.created_by || p.created_by === "pedro"
  );
  const outrosPlaybooks = playbooks.filter(
    (p) => p.created_by && p.created_by !== "pedro"
  );
  const pedroStories = stories.filter(
    (s) => !s.created_by || s.created_by === "pedro"
  );
  const outrosStories = stories.filter(
    (s) => s.created_by && s.created_by !== "pedro"
  );

  const activePlaybooks = mainTab === "pedro" ? pedroPlaybooks : outrosPlaybooks;
  const activeStories = mainTab === "pedro" ? pedroStories : outrosStories;

  return (
    <div className="space-y-6">
      {/* Main tabs: Pedro | Outros | Alimentar */}
      <div className="flex gap-1 rounded-2xl bg-surface p-1">
        <button
          onClick={() => setMainTab("pedro")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
            mainTab === "pedro"
              ? "bg-card text-accent shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <User className="h-3.5 w-3.5" />
          Pedro
          <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">
            {pedroPlaybooks.length + pedroStories.length}
          </span>
        </button>
        <button
          onClick={() => setMainTab("outros")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
            mainTab === "outros"
              ? "bg-card text-blue shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Outros
          <span className="rounded-full bg-blue/10 px-1.5 py-0.5 text-[9px] text-blue">
            {outrosPlaybooks.length + outrosStories.length}
          </span>
        </button>
        <button
          onClick={() => setMainTab("alimentar")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
            mainTab === "alimentar"
              ? "bg-card text-green shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Alimentar
        </button>
      </div>

      {/* Alimentar tab — UniversalInput + file upload */}
      {mainTab === "alimentar" && (
        <div>
          <p className="mb-4 text-sm text-text-secondary">
            Cole transcrições, links do YouTube, posts do Instagram, ou envie arquivos do seu computador. A IA vai processar e gerar propostas para a base.
          </p>
          <UniversalInput />
        </div>
      )}

      {/* Pedro / Outros tabs — show playbooks + stories */}
      {(mainTab === "pedro" || mainTab === "outros") && (
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-56">
            <ThemeManager themes={themes} />
          </aside>

          <div className="min-w-0 flex-1">
            {/* Sub-tabs: Playbooks | Historias */}
            <div className="mb-4 flex gap-1 rounded-2xl bg-surface p-1">
              <button
                onClick={() => setSubTab("playbooks")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
                  subTab === "playbooks"
                    ? "bg-card text-accent shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Playbooks
                <span className="text-[9px] text-text-muted">
                  ({activePlaybooks.length})
                </span>
              </button>
              <button
                onClick={() => setSubTab("historias")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
                  subTab === "historias"
                    ? "bg-card text-accent shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <BookMarked className="h-3.5 w-3.5" />
                Histórias
                <span className="text-[9px] text-text-muted">
                  ({activeStories.length})
                </span>
              </button>
            </div>

            {/* Origin badge */}
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                  mainTab === "pedro"
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "bg-blue/10 text-blue border border-blue/20"
                }`}
              >
                {mainTab === "pedro" ? (
                  <><User className="h-2.5 w-2.5" /> Conhecimento do Pedro</>
                ) : (
                  <><Users className="h-2.5 w-2.5" /> Referências externas</>
                )}
              </span>
            </div>

            {subTab === "playbooks" ? (
              <PlaybookList playbooks={activePlaybooks} themes={themes} />
            ) : (
              <StoryList stories={activeStories} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
