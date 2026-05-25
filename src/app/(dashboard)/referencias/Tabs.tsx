"use client";

import { useState } from "react";
import type {
  ReferenceProfile,
  ReferenceKnowledge,
} from "@/lib/supabase/types";
import ProfileManager from "./ProfileManager";
import PostList from "./PostList";
import KnowledgeList from "./KnowledgeList";

type Tab = "perfis" | "conhecimento";

export default function Tabs({
  profiles,
  knowledge,
}: {
  profiles: ReferenceProfile[];
  knowledge: ReferenceKnowledge[];
}) {
  const [tab, setTab] = useState<Tab>("perfis");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );

  const selectedProfile =
    profiles.find((p) => p.id === selectedProfileId) ?? null;

  return (
    <div>
      <div className="mb-4 flex gap-0 border-b border-rule">
        <button
          onClick={() => setTab("perfis")}
          className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
            tab === "perfis"
              ? "border-blue text-blue"
              : "border-transparent text-ink-muted hover:text-ink-soft"
          }`}
        >
          Perfis &amp; Posts
        </button>
        <button
          onClick={() => setTab("conhecimento")}
          className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
            tab === "conhecimento"
              ? "border-blue text-blue"
              : "border-transparent text-ink-muted hover:text-ink-soft"
          }`}
        >
          Conhecimento Externo
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
      ) : (
        <KnowledgeList knowledge={knowledge} />
      )}
    </div>
  );
}
