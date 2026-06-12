"use client";

import { useState } from "react";
import type {
  ContentFormat,
  GeneratedContent,
} from "@/lib/supabase/types";
import type { Hook } from "@/app/(dashboard)/hooks/actions";
import FormatList from "./FormatList";
import GenerationWizard from "./GenerationWizard";
import ContentList from "./ContentList";
import HooksBank from "@/app/(dashboard)/hooks/HooksBank";
import RepurposePanel from "@/app/(dashboard)/repurpose/RepurposePanel";
import { PlusCircle, LayoutGrid, Archive, Anchor, Repeat2 } from "lucide-react";

type Tab = "novo" | "hooks" | "repurpose" | "formatos" | "salvos";

const TABS: { key: Tab; label: string; Icon: typeof PlusCircle }[] = [
  { key: "novo", label: "Novo", Icon: PlusCircle },
  { key: "hooks", label: "Hooks", Icon: Anchor },
  { key: "repurpose", label: "Reaproveitar", Icon: Repeat2 },
  { key: "formatos", label: "Formatos", Icon: LayoutGrid },
  { key: "salvos", label: "Salvos", Icon: Archive },
];

interface PlaybookOption {
  id: string;
  title: string;
}

interface StoryOption {
  id: string;
  title: string;
}

interface ThemeOption {
  id: string;
  name: string;
  color: string | null;
}

interface RepurposeContent {
  id: string;
  content_type: string;
  content_text: string | null;
  status: string;
  created_at: string;
}

export default function Tabs({
  formats,
  contents,
  playbooks,
  stories,
  themes,
  initialHooks,
  repurposeContents,
}: {
  formats: ContentFormat[];
  contents: GeneratedContent[];
  playbooks: PlaybookOption[];
  stories: StoryOption[];
  themes: ThemeOption[];
  initialHooks: Hook[];
  repurposeContents: RepurposeContent[];
}) {
  const [tab, setTab] = useState<Tab>("novo");

  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 font-mono text-xs transition-all ${
              tab === t.key
                ? "bg-card text-accent shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            <t.Icon className="h-3.5 w-3.5" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "novo" && (
        <GenerationWizard playbooks={playbooks} stories={stories} themes={themes} />
      )}
      {tab === "hooks" && <HooksBank initialHooks={initialHooks} />}
      {tab === "repurpose" && (
        <RepurposePanel contents={repurposeContents} />
      )}
      {tab === "formatos" && <FormatList formats={formats} />}
      {tab === "salvos" && <ContentList contents={contents} />}
    </div>
  );
}
