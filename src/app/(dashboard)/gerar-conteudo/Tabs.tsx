"use client";

import { useState } from "react";
import type {
  ContentFormat,
  GeneratedContent,
} from "@/lib/supabase/types";
import FormatList from "./FormatList";
import QuickGenerate from "./GenerationWizard";
import ContentList from "./ContentList";
import { PlusCircle, LayoutGrid, Archive } from "lucide-react";

type Tab = "novo" | "formatos" | "salvos";

const TABS: { key: Tab; label: string; Icon: typeof PlusCircle }[] = [
  { key: "novo", label: "Novo Conteudo", Icon: PlusCircle },
  { key: "formatos", label: "Formatos", Icon: LayoutGrid },
  { key: "salvos", label: "Salvos", Icon: Archive },
];

export default function Tabs({
  formats,
  contents,
}: {
  formats: ContentFormat[];
  contents: GeneratedContent[];
}) {
  const [tab, setTab] = useState<Tab>("novo");

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-2xl bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
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
        <QuickGenerate formats={formats} />
      )}
      {tab === "formatos" && <FormatList formats={formats} />}
      {tab === "salvos" && <ContentList contents={contents} />}
    </div>
  );
}
