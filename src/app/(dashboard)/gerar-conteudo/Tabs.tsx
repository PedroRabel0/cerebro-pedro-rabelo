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

type AtualidadesFase = "idle" | "buscando" | "gerando" | "pronto" | "erro";

interface AtualidadesEstado {
  fase: AtualidadesFase;
  progresso: { atual: number; total: number; manchete: string };
  criadas: string[];
  falhas: number;
  erro: string | null;
}

/**
 * "O que esta rolando" (Atualidades) — click-and-generate: busca as noticias
 * mais quentes de negocios na web e gera 3-5 posts prontos na voz do Pedro.
 * Sem formulario. Componente APRESENTACIONAL: o estado vive no Tabs (que
 * fica montado o tempo todo) — se morasse aqui, trocar de aba no meio da
 * geracao desmontaria o card, zeraria o progresso e perderia a trava
 * contra clique duplo enquanto o loop antigo continua rodando.
 */
function AtualidadesCard({
  estado,
  onGerar,
  onVerSalvos,
}: {
  estado: AtualidadesEstado;
  onGerar: () => void;
  onVerSalvos: () => void;
}) {
  const { fase, progresso, criadas, falhas, erro } = estado;
  const ocupado = fase === "buscando" || fase === "gerando";

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
          onClick={onGerar}
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
            {falhas > 0 ? ` (${falhas} não deu certo — tente de novo mais tarde)` : ""}:
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

      {fase === "erro" && (
        <div className="mt-3 space-y-1.5">
          {erro && (
            <p className="text-xs text-red" role="alert">
              {erro}
            </p>
          )}
          {criadas.length > 0 && (
            <>
              <p className="text-xs text-text-muted">
                Mesmo assim, {criadas.length} post{criadas.length !== 1 ? "s" : ""} já{" "}
                {criadas.length !== 1 ? "foram criados" : "foi criado"}:
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
            </>
          )}
        </div>
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

  // Estado das Atualidades no Tabs (sempre montado) — sobrevive a troca de aba.
  const [atualidades, setAtualidades] = useState<AtualidadesEstado>({
    fase: "idle",
    progresso: { atual: 0, total: 0, manchete: "" },
    criadas: [],
    falhas: 0,
    erro: null,
  });
  const [, startTransition] = useTransition();

  function handleGerarAtualidades() {
    if (atualidades.fase === "buscando" || atualidades.fase === "gerando") return;
    setAtualidades({
      fase: "buscando",
      progresso: { atual: 0, total: 0, manchete: "" },
      criadas: [],
      falhas: 0,
      erro: null,
    });
    startTransition(async () => {
      let busca: Awaited<ReturnType<typeof buscarAtualidades>>;
      try {
        busca = await buscarAtualidades();
      } catch {
        // Erro lancado (ex.: funcao morta pelo teto de tempo do servidor) —
        // mensagem amigavel em vez do digest cru do Next.
        setAtualidades((prev) => ({
          ...prev,
          fase: "erro",
          erro: "A busca demorou demais e foi interrompida pelo servidor. Tente de novo.",
        }));
        return;
      }
      if ("error" in busca) {
        setAtualidades((prev) => ({ ...prev, fase: "erro", erro: busca.error }));
        return;
      }

      const picks = busca.picks;
      setAtualidades((prev) => ({
        ...prev,
        fase: "gerando",
        progresso: { atual: 0, total: picks.length, manchete: "" },
      }));

      const ok: string[] = [];
      let ruim = 0;
      for (let i = 0; i < picks.length; i++) {
        const pick = picks[i];
        setAtualidades((prev) => ({
          ...prev,
          progresso: { atual: i + 1, total: picks.length, manchete: pick.manchete },
        }));
        let r: Awaited<ReturnType<typeof gerarPostAtualidade>>;
        try {
          r = await gerarPostAtualidade(pick);
        } catch {
          r = { error: "interrompido" };
        }
        if ("error" in r) ruim += 1;
        else ok.push(r.manchete);
        setAtualidades((prev) => ({ ...prev, criadas: [...ok], falhas: ruim }));
      }

      if (ok.length === 0) {
        setAtualidades((prev) => ({
          ...prev,
          fase: "erro",
          erro: "Nenhum post pôde ser gerado agora. Tente de novo.",
        }));
        return;
      }
      setAtualidades((prev) => ({ ...prev, fase: "pronto" }));
    });
  }

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
          <AtualidadesCard
            estado={atualidades}
            onGerar={handleGerarAtualidades}
            onVerSalvos={() => setTab("salvos")}
          />
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
