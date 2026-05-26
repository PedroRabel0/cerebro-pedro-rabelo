"use client";

import { useState } from "react";
import type {
  ReferenceProfile,
  ReferenceKnowledge,
} from "@/lib/supabase/types";
import type { WeeklyPattern } from "./actions";
import ProfileManager from "./ProfileManager";
import PostList from "./PostList";
import KnowledgeList from "./KnowledgeList";
import SinaisPanel from "./SinaisPanel";
import { Users, Library, Radio } from "lucide-react";

type Tab = "perfis" | "conhecimento" | "sinais";

export default function Tabs({
  profiles,
  knowledge,
  patterns,
}: {
  profiles: ReferenceProfile[];
  knowledge: ReferenceKnowledge[];
  patterns: WeeklyPattern[];
}) {
  const [tab, setTab] = useState<Tab>("perfis");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );

  const selectedProfile =
    profiles.find((p) => p.id === selectedProfileId) ?? null;

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-2xl bg-surface p-1">
        <button
          onClick={() => setTab("perfis")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
            tab === "perfis"
              ? "bg-card text-accent shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Perfis &amp; Posts
        </button>
        <button
          onClick={() => setTab("conhecimento")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
            tab === "conhecimento"
              ? "bg-card text-accent shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Library className="h-3.5 w-3.5" />
          Conhecimento Externo
        </button>
        <button
          onClick={() => setTab("sinais")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
            tab === "sinais"
              ? "bg-card text-accent shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          Sinais
          {patterns.length > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {patterns.length}
            </span>
          )}
        </button>
      </div>

      {tab === "perfis" ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-64">
            <ProfileManager
              profiles={profiles}
              selectedId={selectedProfileId}
              onSelect={setSelectedProfileId}
            />
          </aside>
          <div className="min-w-0 flex-1">
            <PostList profile={selectedProfile} />
          </div>
        </div>
      ) : tab === "conhecimento" ? (
        <KnowledgeList knowledge={knowledge} />
      ) : (
        <SinaisPanel patterns={patterns} />
      )}
    </div>
  );
}
