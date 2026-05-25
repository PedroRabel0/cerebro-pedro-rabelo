"use client";

import { useState } from "react";
import type { Playbook, Story, Theme } from "@/lib/supabase/types";
import PlaybookList from "./PlaybookList";
import StoryList from "./StoryList";
import ThemeManager from "./ThemeManager";

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
        <div className="mb-4 flex gap-0 border-b border-rule">
          <button
            onClick={() => setTab("playbooks")}
            className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
              tab === "playbooks"
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink-soft"
            }`}
          >
            Playbooks
          </button>
          <button
            onClick={() => setTab("historias")}
            className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
              tab === "historias"
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink-soft"
            }`}
          >
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
