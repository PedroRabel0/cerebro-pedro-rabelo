"use client";

import { useState } from "react";
import type { HistoriaPessoal } from "@/lib/supabase/types";
import { deleteHistoriaPessoal } from "./actions";
import { Sparkles, Trash2, BookHeart } from "lucide-react";

const EPIPHANY_STEPS = [
  { key: "backstory", label: "Backstory", color: "blue" },
  { key: "desejo_externo", label: "Desejo Externo", color: "purple" },
  { key: "desejo_interno", label: "Desejo Interno", color: "purple" },
  { key: "parede", label: "A Parede", color: "red" },
  { key: "epifania", label: "Epifania", color: "amber" },
  { key: "plano", label: "O Plano", color: "green" },
  { key: "conflito", label: "Conflito", color: "red" },
  { key: "conquista", label: "Conquista", color: "green" },
  { key: "transformacao", label: "Transformacao", color: "accent" },
] as const;

type StepColor = (typeof EPIPHANY_STEPS)[number]["color"];

const COLOR_MAP: Record<StepColor, { border: string; bg: string; text: string; label: string }> = {
  blue: { border: "border-blue", bg: "bg-blue/5", text: "text-blue", label: "text-blue" },
  purple: { border: "border-purple", bg: "bg-purple/5", text: "text-purple", label: "text-purple" },
  red: { border: "border-red", bg: "bg-red/5", text: "text-red", label: "text-red" },
  amber: { border: "border-amber", bg: "bg-amber/5", text: "text-amber", label: "text-amber" },
  green: { border: "border-green", bg: "bg-green/5", text: "text-green", label: "text-green" },
  accent: { border: "border-accent", bg: "bg-accent/5", text: "text-accent", label: "text-accent" },
};

function CompletenessBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green" : score >= 50 ? "bg-blue" : "bg-accent";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-surface">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-text-muted">{score}%</span>
    </div>
  );
}

function EpiphanyTimeline({ estrutura }: { estrutura: HistoriaPessoal["estrutura_epiphany"] }) {
  const filledSteps = EPIPHANY_STEPS.filter(
    (s) => estrutura[s.key as keyof typeof estrutura]
  );

  if (filledSteps.length === 0) {
    return (
      <p className="text-xs text-text-muted italic">
        Nenhum passo da Epiphany Bridge preenchido ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {EPIPHANY_STEPS.map((step, i) => {
        const content = estrutura[step.key as keyof typeof estrutura];
        if (!content) return null;
        const colors = COLOR_MAP[step.color];

        return (
          <div
            key={step.key}
            className={`rounded-lg border-l-[3px] ${colors.border} ${colors.bg} p-3`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[10px] font-bold text-text-muted">
                {i + 1}
              </span>
              <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${colors.label}`}>
                {step.label}
              </span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed pl-7">
              {content}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function HistoriaPessoalList({
  historias,
}: {
  historias: HistoriaPessoal[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [narrativaOpenId, setNarrativaOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; titulo: string } | null>(null);

  async function handleDelete(id: string) {
    await deleteHistoriaPessoal(id);
    setDeleteTarget(null);
  }

  if (historias.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card py-12 text-center">
        <BookHeart className="mx-auto h-8 w-8 text-text-muted" />
        <p className="mt-3 text-sm text-text-muted">
          Nenhuma historia pessoal ainda.
        </p>
        <p className="text-xs text-text-muted">
          Historias pessoais no formato Epiphany Bridge aparecerao aqui.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">
              Apagar a historia <strong>&quot;{deleteTarget.titulo}&quot;</strong>? Esta acao nao pode ser desfeita.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:bg-surface hover:text-text"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                className="rounded-lg bg-red px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-red/80"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-muted">
          {historias.length} historia{historias.length !== 1 ? "s" : ""} pessoai{historias.length !== 1 ? "s" : "l"}
        </span>
      </div>

      <div className="space-y-2">
        {historias.map((h) => {
          const isExpanded = expandedId === h.id;
          const isNarrativaOpen = narrativaOpenId === h.id;
          const openQuestions = h.perguntas_abertas?.filter((q) => q.status === "aberta") ?? [];

          return (
            <div
              key={h.id}
              className="rounded-xl border border-border bg-card transition hover:border-border-light"
            >
              {/* Collapsed header */}
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : h.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <h3 className="truncate font-sans text-sm font-medium text-text">
                      {h.titulo}
                    </h3>
                    {h.tema && (
                      <span
                        className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] text-white"
                        style={{ backgroundColor: h.tema.color ?? "#3a5a7a" }}
                      >
                        {h.tema.name}
                      </span>
                    )}
                  </div>
                  <CompletenessBar score={h.completude} />
                </button>
                <div className="ml-3 flex shrink-0 gap-1">
                  <button
                    onClick={() => setDeleteTarget({ id: h.id, titulo: h.titulo })}
                    className="rounded-lg p-1.5 text-text-muted transition hover:bg-red/10 hover:text-red"
                    title="Apagar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border px-4 pb-4">
                  {/* Epiphany Bridge Timeline */}
                  <div className="mt-3">
                    <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Epiphany Bridge
                    </span>
                    <EpiphanyTimeline estrutura={h.estrutura_epiphany} />
                  </div>

                  {/* Narrativa completa (collapsible) */}
                  {h.corpo_longo && (
                    <div className="mt-3">
                      <button
                        onClick={() => setNarrativaOpenId(isNarrativaOpen ? null : h.id)}
                        className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-text transition"
                      >
                        <span className={`inline-block transition-transform ${isNarrativaOpen ? "rotate-90" : ""}`}>
                          &#9654;
                        </span>
                        Narrativa completa
                      </button>
                      {isNarrativaOpen && (
                        <div className="mt-2 rounded-lg bg-surface p-3">
                          <pre className="whitespace-pre-wrap text-xs text-text-secondary font-sans leading-relaxed">
                            {h.corpo_longo}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Perguntas abertas */}
                  {openQuestions.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber/20 bg-amber/5 p-3 space-y-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase text-amber">
                        Lacunas ({openQuestions.length})
                      </span>
                      {openQuestions.slice(0, 5).map((q, i) => (
                        <div key={i} className="text-[11px]">
                          <p className="text-text-secondary">{q.pergunta}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">Campo: {q.campo_alvo}</p>
                        </div>
                      ))}
                      {openQuestions.length > 5 && (
                        <p className="text-[10px] text-amber">+{openQuestions.length - 5} mais</p>
                      )}
                    </div>
                  )}

                  {/* Proveniencia badge */}
                  {h.proveniencia?.nivel && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                        h.proveniencia.nivel === "dito_por_voce" ? "bg-green/10 text-green" :
                        h.proveniencia.nivel === "fonte_externa" ? "bg-purple/10 text-purple" :
                        "bg-surface text-text-muted"
                      }`}>
                        {h.proveniencia.nivel === "dito_por_voce" ? "Dito pelo Pedro" :
                         h.proveniencia.nivel === "fonte_externa" ? "Fonte externa" :
                         "Sintetizado"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
