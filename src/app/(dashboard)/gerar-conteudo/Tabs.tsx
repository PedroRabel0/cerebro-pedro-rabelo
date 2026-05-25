"use client";

import { useState } from "react";
import type {
  ContentFormat,
  GeneratedContent,
} from "@/lib/supabase/types";
import FormatList from "./FormatList";
import GenerationWizard from "./GenerationWizard";
import ContentList from "./ContentList";

type Tab = "novo" | "formatos" | "salvos";

const TABS: { key: Tab; label: string }[] = [
  { key: "novo", label: "Novo Conteúdo" },
  { key: "formatos", label: "Formatos" },
  { key: "salvos", label: "Conteúdos Salvos" },
];

export default function Tabs({
  formats,
  contents,
  playbooks,
  stories,
}: {
  formats: ContentFormat[];
  contents: GeneratedContent[];
  playbooks: { id: string; title: string }[];
  stories: { id: string; title: string }[];
}) {
  const [tab, setTab] = useState<Tab>("novo");

  return (
    <div>
      <div className="mb-6 flex gap-0 border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
              tab === t.key
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "novo" && (
        <GenerationWizard
          formats={formats}
          playbooks={playbooks}
          stories={stories}
        />
      )}
      {tab === "formatos" && <FormatList formats={formats} />}
      {tab === "salvos" && <ContentList contents={contents} />}
    </div>
  );
}
