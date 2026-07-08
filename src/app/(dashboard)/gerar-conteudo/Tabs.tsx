"use client";

import { useState, useTransition } from "react";
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
import { buscarAtualidades, gerarPostAtualidade } from "./actions";
import {
  PlusCircle,
  LayoutGrid,
  Archive,
  Anchor,
  Repeat2,
  Newspaper,
  Loader2,
  Check,
} from "lucide-react";

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

/**
 * "O que esta rolando" (Atualidades) — click-and-generate: busca as noticias
 * mais quentes de negocios na web e gera 3-5 posts prontos na voz do Pedro.
 * Sem formulario: a busca (chamada 1) devolve os picks e a UI gera um post
 * por vez (chamada 2 em loop) pra cada request ficar abaixo do teto de 60s.
 */
function AtualidadesCard({ onVerSalvos }: { onVerSalvos: () => void }) {
  const [fase, setFase] = useState<"idle" | "buscando" | "gerando" | "pronto" | "erro">("idle");
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, manchete: "" });
  const [criadas, setCriadas] = useState<string[]>([]);
  const [falhas, setFalhas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const ocupado = fase === "buscando" || fase === "gerando";

  function handleGerar() {
    if (ocupado) return;
    setFase("buscando");
    setErro(null);
    setCriadas([]);
    setFalhas(0);
    startTransition(async () => {
      try {
        const busca = await buscarAtualidades();
        if ("error" in busca) {
          setErro(busca.error);
          setFase("erro");
          return;
        }
        setFase("gerando");
        const ok: string[] = [];
        let ruim = 0;
        for (let i = 0; i < busca.picks.length; i++) {
          const pick = busca.picks[i];
          setProgresso({ atual: i + 1, total: busca.picks.length, manchete: pick.manchete });
          const r = await gerarPostAtualidade(pick);
          if ("error" in r) ruim += 1;
          else ok.push(r.manchete);
          setCriadas([...ok]);
          setFalhas(ruim);
        }
        if (ok.length === 0) {
          setErro("Nenhum post pôde ser gerado agora. Tente de novo.");
          setFase("erro");
          return;
        }
        setFase("pronto");
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro inesperado ao gerar.");
        setFase("erro");
      }
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/10 to-transparent p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
          <Newspaper className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">O que está rolando</p>
          <p className="text-xs text-text-muted">
            Busca as notícias mais quentes de negócios e devolve 3-5 posts prontos, na voz do Pedro.
          </p>
        </div>
        <button
          onClick={handleGerar}
          disabled={ocupado}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Newspaper className="h-3.5 w-3.5" />}
          {ocupado ? "Gerando..." : "Gerar agora"}
        </button>
      </div>

      {fase === "buscando" && (
        <p className="mt-3 animate-pulse font-mono text-xs text-accent">
          Buscando o que rolou no mundo… (leva alguns segundos)
        </p>
      )}

      {fase === "gerando" && (
        <div className="mt-3 space-y-1.5">
          <p className="font-mono text-xs text-accent">
            Escrevendo post {progresso.atual}/{progresso.total}:{" "}
            <span className="text-text-secondary">{progresso.manchete}</span>
          </p>
          {criadas.map((m, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
              <Check className="h-3 w-3 shrink-0 text-green" /> {m}
            </p>
          ))}
        </div>
      )}

      {fase === "pronto" && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-text">
            {criadas.length} rascunho{criadas.length !== 1 ? "s" : ""} criado
            {criadas.length !== 1 ? "s" : ""}
            {falhas > 0 ? ` (${falhas} falhou${falhas !== 1 ? "ram" : ""}, tente de novo mais tarde)` : ""}:
          </p>
          {criadas.map((m, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
              <Check className="h-3 w-3 shrink-0 text-green" /> {m}
            </p>
          ))}
          <button
            onClick={onVerSalvos}
            className="mt-1 rounded-xl bg-accent/10 px-3 py-1.5 font-mono text-[11px] font-medium text-accent transition hover:bg-accent/20"
          >
            Ver na aba Salvos →
          </button>
        </div>
      )}

      {fase === "erro" && erro && (
        <p className="mt-3 text-xs text-red" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
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
        <>
          <AtualidadesCard onVerSalvos={() => setTab("salvos")} />
          <GenerationWizard playbooks={playbooks} stories={stories} themes={themes} />
        </>
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
