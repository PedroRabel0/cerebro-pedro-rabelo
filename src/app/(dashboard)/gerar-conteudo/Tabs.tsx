"use client";

import { useState, useTransition } from "react";
import type {
  ContentFormat,
  GeneratedContent,
} from "@/lib/supabase/types";
import type { Hook } from "@/app/(dashboard)/hooks/actions";
import type { Noticia } from "./atualidades-types";
import FormatList from "./FormatList";
import GenerationWizard from "./GenerationWizard";
import ContentList from "./ContentList";
import HooksBank from "@/app/(dashboard)/hooks/HooksBank";
import RepurposePanel from "@/app/(dashboard)/repurpose/RepurposePanel";
import { searchTrendingNews, generateNewsPosts } from "./actions";
import {
  PlusCircle,
  LayoutGrid,
  Archive,
  Anchor,
  Repeat2,
  Newspaper,
  Loader2,
  Check,
  ExternalLink,
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

// --- "O que esta rolando" (Atualidades) ---

const MAX_NOTICIAS_POR_VEZ = 4;

const TEMA_CHIP: Record<Noticia["tema"], string> = {
  startups: "Startups",
  ia: "IA",
  brasil: "Brasil",
  negocios: "Negócios",
};

type AtualidadesFase =
  | "idle"
  | "buscando"
  | "escolhendo"
  | "gerando"
  | "pronto"
  | "erro";

interface AtualidadesEstado {
  fase: AtualidadesFase;
  noticias: Noticia[];
  selecionadas: string[];
  progresso: { atual: number; total: number; manchete: string };
  criadas: string[];
  falhas: number;
  erro: string | null;
}

const ATUALIDADES_INICIAL: AtualidadesEstado = {
  fase: "idle",
  noticias: [],
  selecionadas: [],
  progresso: { atual: 0, total: 0, manchete: "" },
  criadas: [],
  falhas: 0,
  erro: null,
};

/**
 * Card do "O que esta rolando": buscar → o Pedro SELECIONA as noticias →
 * gerar 2 opcoes de post por noticia (no visual editorial branco do Cases).
 * Componente APRESENTACIONAL: o estado vive no Tabs (sempre montado) — se
 * morasse aqui, trocar de aba no meio da geracao desmontaria o card,
 * zeraria o progresso e perderia a trava contra clique duplo.
 */
function AtualidadesCard({
  estado,
  onBuscar,
  onToggle,
  onGerar,
  onVerSalvos,
  onVoltarLista,
}: {
  estado: AtualidadesEstado;
  onBuscar: () => void;
  onToggle: (id: string) => void;
  onGerar: () => void;
  onVerSalvos: () => void;
  onVoltarLista: () => void;
}) {
  const { fase, noticias, selecionadas, progresso, criadas, falhas, erro } = estado;
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
            Busca as notícias quentes de negócios, você escolhe as que quer, e cada uma vira 2 opções de post na voz do Pedro.
          </p>
        </div>
        <button
          onClick={onBuscar}
          disabled={ocupado}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fase === "buscando" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Newspaper className="h-3.5 w-3.5" />
          )}
          {fase === "buscando"
            ? "Buscando..."
            : fase === "escolhendo"
              ? "Buscar de novo"
              : "Buscar notícias"}
        </button>
      </div>

      {fase === "buscando" && (
        <p className="mt-3 animate-pulse font-mono text-xs text-accent">
          Buscando o que rolou no mundo… (leva alguns segundos)
        </p>
      )}

      {fase === "escolhendo" && noticias.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Marque as notícias que você quer transformar em post (máx. {MAX_NOTICIAS_POR_VEZ} por vez):
          </p>
          <div className="space-y-1.5">
            {noticias.map((n) => {
              const marcada = selecionadas.includes(n.id);
              const bloqueada = !marcada && selecionadas.length >= MAX_NOTICIAS_POR_VEZ;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onToggle(n.id)}
                  disabled={bloqueada}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    marcada
                      ? "border-accent bg-accent/10"
                      : bloqueada
                        ? "border-border opacity-40"
                        : "border-border bg-card hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        marcada ? "border-accent bg-accent" : "border-border-light"
                      }`}
                    >
                      {marcada && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
                          {TEMA_CHIP[n.tema]}
                        </span>
                        <span className="text-sm font-medium leading-snug text-text">
                          {n.manchete}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-text-muted">
                        {n.resumo}
                      </span>
                      {n.fonte_veiculo && (
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-text-muted">
                          {n.fonte_url ? (
                            <a
                              href={n.fonte_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 hover:text-accent"
                            >
                              <ExternalLink className="h-2.5 w-2.5" /> {n.fonte_veiculo}
                            </a>
                          ) : (
                            n.fonte_veiculo
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            onClick={onGerar}
            disabled={selecionadas.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Newspaper className="h-3.5 w-3.5" />
            Gerar posts ({selecionadas.length})
          </button>
        </div>
      )}

      {fase === "gerando" && (
        <div className="mt-3 space-y-1.5">
          <p className="font-mono text-xs text-accent">
            Escrevendo na sua voz… notícia {progresso.atual}/{progresso.total}:{" "}
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
            Pronto! Cada notícia virou 2 opções de post (escolha a melhor na aba Salvos)
            {falhas > 0 ? ` — ${falhas} não deu certo, tente de novo mais tarde` : ""}:
          </p>
          {criadas.map((m, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
              <Check className="h-3 w-3 shrink-0 text-green" /> {m}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onVerSalvos}
              className="mt-1 rounded-xl bg-accent/10 px-3 py-1.5 font-mono text-[11px] font-medium text-accent transition hover:bg-accent/20"
            >
              Ver na aba Salvos →
            </button>
            {noticias.length > 0 && (
              <button
                onClick={onVoltarLista}
                className="mt-1 rounded-xl border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted transition hover:border-accent/40 hover:text-text"
              >
                Escolher mais notícias desta busca
              </button>
            )}
          </div>
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
                Mesmo assim, {criadas.length} notícia{criadas.length !== 1 ? "s" : ""} já
                {criadas.length !== 1 ? " viraram" : " virou"} post:
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
          {noticias.length > 0 && (
            <button
              onClick={onVoltarLista}
              className="mt-1 rounded-xl border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted transition hover:border-accent/40 hover:text-text"
            >
              Voltar pra lista de notícias
            </button>
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
  const [atualidades, setAtualidades] = useState<AtualidadesEstado>(ATUALIDADES_INICIAL);
  const [, startTransition] = useTransition();

  function handleBuscarNoticias() {
    if (atualidades.fase === "buscando" || atualidades.fase === "gerando") return;
    setAtualidades({ ...ATUALIDADES_INICIAL, fase: "buscando" });
    startTransition(async () => {
      let busca: Awaited<ReturnType<typeof searchTrendingNews>>;
      try {
        busca = await searchTrendingNews();
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
      setAtualidades((prev) => ({
        ...prev,
        fase: "escolhendo",
        noticias: busca.noticias,
        selecionadas: [],
      }));
    });
  }

  function handleToggleNoticia(id: string) {
    setAtualidades((prev) => {
      if (prev.fase !== "escolhendo") return prev;
      const ja = prev.selecionadas.includes(id);
      if (!ja && prev.selecionadas.length >= MAX_NOTICIAS_POR_VEZ) return prev;
      return {
        ...prev,
        selecionadas: ja
          ? prev.selecionadas.filter((s) => s !== id)
          : [...prev.selecionadas, id],
      };
    });
  }

  function handleVoltarLista() {
    // Volta pra MESMA lista da busca (sem gastar outra das 10 buscas/dia)
    // pra gerar mais uma rodada com as noticias que sobraram.
    setAtualidades((prev) => {
      if (prev.noticias.length === 0) return prev;
      if (prev.fase !== "pronto" && prev.fase !== "erro") return prev;
      return {
        ...prev,
        fase: "escolhendo",
        selecionadas: [],
        criadas: [],
        falhas: 0,
        erro: null,
      };
    });
  }

  function handleGerarPosts() {
    if (atualidades.fase !== "escolhendo" || atualidades.selecionadas.length === 0) return;
    const escolhidas = atualidades.noticias.filter((n) =>
      atualidades.selecionadas.includes(n.id)
    );
    setAtualidades((prev) => ({
      ...prev,
      fase: "gerando",
      progresso: { atual: 0, total: escolhidas.length, manchete: "" },
      criadas: [],
      falhas: 0,
      erro: null,
    }));
    startTransition(async () => {
      const ok: string[] = [];
      let ruim = 0;
      for (let i = 0; i < escolhidas.length; i++) {
        const noticia = escolhidas[i];
        setAtualidades((prev) => ({
          ...prev,
          progresso: { atual: i + 1, total: escolhidas.length, manchete: noticia.manchete },
        }));
        let r: Awaited<ReturnType<typeof generateNewsPosts>>;
        try {
          r = await generateNewsPosts(noticia);
        } catch {
          r = { error: "interrompido" };
        }
        if ("error" in r) ruim += 1;
        else ok.push(`${r.manchete} (${r.criados} opç${r.criados !== 1 ? "ões" : "ão"})`);
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
            onBuscar={handleBuscarNoticias}
            onToggle={handleToggleNoticia}
            onGerar={handleGerarPosts}
            onVerSalvos={() => setTab("salvos")}
            onVoltarLista={handleVoltarLista}
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
