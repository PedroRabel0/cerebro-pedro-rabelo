"use client";

import { useState } from "react";
import type { Playbook, Story, Theme } from "@/lib/supabase/types";
import PlaybookList from "./PlaybookList";
import StoryList from "./StoryList";
import ThemeManager from "./ThemeManager";
import { BookOpen, BookMarked } from "lucide-react";

type Tab = "playbooks" | "historias";

export default function Tabs({
  playbooks,
  stories,
  themes,
}: {
  playbooks: Playbook[];
  stories: Story[];
  themes: Theme[];
}) {
  const [tab, setTab] = useState<Tab>("playbooks");

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <ThemeManager themes={themes} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex gap-1 rounded-2xl bg-surface p-1">
          <button
            onClick={() => setTab("playbooks")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
              tab === "playbooks"
                ? "bg-card text-accent shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Playbooks
          </button>
          <button
            onClick={() => setTab("historias")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
              tab === "historias"
                ? "bg-card text-accent shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            <BookMarked className="h-3.5 w-3.5" />
            Histórias
          </button>
        </div>

        {tab === "playbooks" ? (
          <PlaybookList playbooks={playbooks} themes={themes} />
        ) : (
          <StoryList stories={stories} />
        )}
      </div>
    </div>
  );
}
