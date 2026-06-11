"use client";

import { useState } from "react";
import type { Playbook, Story, HistoriaPessoal, Theme } from "@/lib/supabase/types";
import PlaybookList from "./PlaybookList";
import StoryList from "./StoryList";
import HistoriaPessoalList from "./HistoriaPessoalList";
import ThemeManager from "./ThemeManager";
import UniversalInput from "@/components/UniversalInput";
import { migrateAllPlaybooks } from "./actions";
import { BookOpen, BookMarked, BookHeart, Zap, Users, User, RefreshCw, Loader2 } from "lucide-react";

type MainTab = "pedro" | "outros" | "alimentar";
type SubTab = "playbooks" | "historias" | "historias_pessoais";

export default function Tabs({
  playbooks,
  stories,
  historiasPessoais,
  themes,
}: {
  playbooks: Playbook[];
  stories: Story[];
  historiasPessoais: HistoriaPessoal[];
  themes: Theme[];
}) {
  const [mainTab, setMainTab] = useState<MainTab>("pedro");
  const [subTab, setSubTab] = useState<SubTab>("playbooks");
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ total: number; migrated: number; skipped: number; errors: string[] } | null>(null);

  // Conta quantos playbooks legados existem (sem estrutura.principio)
  const legacyCount = playbooks.filter((p) => {
    if (!p.body_markdown || p.body_markdown.length < 20) return false;
    const est = p.estrutura as Record<string, unknown> | null;
    if (est?.principio && typeof est.principio === "string" && (est.principio as string).length > 5) return false;
    return true;
  }).length;

  async function handleMigrate() {
    if (migrating) return;
    setMigrating(true);
    setMigrationResult(null);
    try {
      const result = await migrateAllPlaybooks();
      setMigrationResult(result);
    } catch (err) {
      console.error("Migration failed:", err);
    }
    setMigrating(false);
  }

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
            Cole transcrições, links do YouTube, posts do Instagram, ou envie arquivos. A IA vai extrair <strong className="text-text">conhecimento</strong> (playbooks e histórias) para a base — sem gerar conteúdo para postar. Para criar posts, use a página <a href="/gerar-conteudo" className="text-accent hover:underline">Geração de Conteúdo</a>.
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
              <button
                onClick={() => setSubTab("historias_pessoais")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
                  subTab === "historias_pessoais"
                    ? "bg-card text-accent shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <BookHeart className="h-3.5 w-3.5" />
                Hist. Pessoais
                <span className="text-[9px] text-text-muted">
                  ({historiasPessoais.length})
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

            {/* Migration banner — only shows when legacy playbooks exist */}
            {subTab === "playbooks" && legacyCount > 0 && (
              <div className="mb-4 rounded-xl border border-amber/20 bg-amber/5 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-text font-medium">
                    {legacyCount} playbook{legacyCount > 1 ? "s" : ""} legado{legacyCount > 1 ? "s" : ""} sem estrutura
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Migre para o novo formato com princípio, passos e proveniência.
                  </p>
                </div>
                <button
                  onClick={handleMigrate}
                  disabled={migrating}
                  className="flex items-center gap-1.5 rounded-lg bg-amber/15 px-3 py-1.5 font-mono text-[11px] font-bold text-amber transition hover:bg-amber/25 disabled:opacity-50 shrink-0"
                >
                  {migrating ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Migrando...</>
                  ) : (
                    <><RefreshCw className="h-3 w-3" /> Migrar todos</>
                  )}
                </button>
              </div>
            )}

            {/* Migration result */}
            {migrationResult && (
              <div className="mb-4 rounded-xl border border-green/20 bg-green/5 p-3">
                <p className="text-xs text-green font-medium">
                  Migração concluída: {migrationResult.migrated} migrados, {migrationResult.skipped} já OK
                  {migrationResult.errors.length > 0 && `, ${migrationResult.errors.length} erros`}
                </p>
                {migrationResult.errors.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-text-muted cursor-pointer">Ver erros</summary>
                    <ul className="mt-1 space-y-0.5">
                      {migrationResult.errors.map((e, i) => (
                        <li key={i} className="text-[10px] text-red">{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {subTab === "playbooks" ? (
              <PlaybookList playbooks={activePlaybooks} themes={themes} />
            ) : subTab === "historias_pessoais" ? (
              <HistoriaPessoalList historias={historiasPessoais} />
            ) : (
              <StoryList stories={activeStories} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
