"use client";

import { useState } from "react";
import type { Playbook, Theme } from "@/lib/supabase/types";
import { createPlaybook, updatePlaybook, deletePlaybook, togglePlaybookOrigin, answerGapQuestion } from "./actions";
import BookQuestionsPanel from "./BookQuestionsPanel";
import DiffView from "./DiffView";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { BookOpen, MessageCircle, Send, ChevronDown, ChevronUp, Loader2, ArrowUpRight, Link2 } from "lucide-react";

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

function GapQuestionsPanel({ playbookId, perguntas }: { playbookId: string; perguntas: import("@/lib/supabase/types").PerguntaAberta[] }) {
  const [answeringIdx, setAnsweringIdx] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const openQuestions = perguntas
    .map((q, originalIdx) => ({ ...q, originalIdx }))
    .filter(q => q.status === "aberta");

  const visibleQuestions = showAll ? openQuestions : openQuestions.slice(0, 3);

  async function handleSubmit(originalIdx: number) {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await answerGapQuestion(playbookId, originalIdx, answer.trim());
      if (result.success) {
        setAnsweringIdx(null);
        setAnswer("");
      }
    } catch (err) {
      console.error("Failed to answer:", err);
    }
    setSubmitting(false);
  }

  if (openQuestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber/20 bg-amber/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase text-amber">
          Lacunas ({openQuestions.length})
        </span>
        <span className="text-[10px] text-text-muted">Responda para enriquecer o playbook</span>
      </div>
      {visibleQuestions.map((q) => (
        <div key={q.originalIdx} className="rounded-lg bg-white/5 p-2 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-text-secondary leading-relaxed">{q.pergunta}</p>
              <p className="text-[10px] text-text-muted mt-0.5">
                Campo: <span className="text-amber/80 font-medium">{q.campo_alvo}</span>
                {q.trecho_gatilho && (
                  <span className="ml-2 italic text-text-muted/60">&ldquo;{q.trecho_gatilho.slice(0, 60)}...&rdquo;</span>
                )}
              </p>
            </div>
            {answeringIdx !== q.originalIdx && (
              <button
                onClick={() => { setAnsweringIdx(q.originalIdx); setAnswer(""); }}
                className="shrink-0 flex items-center gap-1 rounded-lg bg-amber/15 px-2 py-1 font-mono text-[10px] font-bold text-amber transition hover:bg-amber/25"
              >
                <MessageCircle className="h-3 w-3" />
                Responder
              </button>
            )}
          </div>
          {answeringIdx === q.originalIdx && (
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(q.originalIdx); }}
                placeholder="Sua resposta..."
                autoFocus
                disabled={submitting}
                className="flex-1 rounded-lg border border-amber/30 bg-card px-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-amber focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => handleSubmit(q.originalIdx)}
                disabled={!answer.trim() || submitting}
                className="flex items-center gap-1 rounded-lg bg-amber px-3 py-1.5 font-mono text-[10px] font-bold text-white transition hover:bg-amber/80 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </button>
              <button
                onClick={() => setAnsweringIdx(null)}
                className="rounded-lg border border-border px-2 py-1.5 text-[10px] text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ))}
      {openQuestions.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-[10px] text-amber hover:text-amber/80 transition"
        >
          {showAll ? (
            <><ChevronUp className="h-3 w-3" /> Mostrar menos</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> +{openQuestions.length - 3} mais</>
          )}
        </button>
      )}
    </div>
  );
}

function PlaybookForm({
  themes,
  playbook,
  onClose,
}: {
  themes: Theme[];
  playbook?: Playbook;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    if (playbook) {
      await updatePlaybook(playbook.id, fd);
    } else {
      await createPlaybook(fd);
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-text-secondary">
        {playbook ? "Editar Playbook" : "Novo Playbook"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="title"
          required
          defaultValue={playbook?.title}
          placeholder="Título do playbook"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <input
          name="subtitle"
          defaultValue={playbook?.subtitle ?? ""}
          placeholder="Subtítulo (opcional)"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <select
          name="theme_id"
          defaultValue={playbook?.theme_id ?? ""}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
        >
          <option value="">Sem tema</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <textarea
          name="body_markdown"
          defaultValue={playbook?.body_markdown ?? ""}
          placeholder="Conteúdo em markdown..."
          rows={8}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-1.5 font-mono text-xs font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-1.5 font-mono text-xs text-text-muted transition hover:text-text hover:border-border-light"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PlaybookList({
  playbooks,
  themes,
}: {
  playbooks: Playbook[];
  themes: Theme[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [filterTheme, setFilterTheme] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffId, setDiffId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const { isPedro } = useUserRole();

  const filtered = filterTheme
    ? playbooks.filter((p) => p.theme_id === filterTheme)
    : playbooks;

  async function handleDelete(id: string) {
    await deletePlaybook(id);
    setDeleteTarget(null);
  }

  if (editing) {
    return (
      <PlaybookForm
        themes={themes}
        playbook={editing}
        onClose={() => setEditing(null)}
      />
    );
  }

  if (showForm) {
    return (
      <PlaybookForm themes={themes} onClose={() => setShowForm(false)} />
    );
  }

  return (
    <div>
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">
              Apagar o playbook <strong>&quot;{deleteTarget.title}&quot;</strong>? Esta ação não pode ser desfeita.
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={filterTheme}
            onChange={(e) => setFilterTheme(e.target.value)}
            className="rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs text-text-secondary focus:border-accent focus:outline-none"
          >
            <option value="">Todos os temas</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="font-mono text-[10px] text-text-muted">
            {filtered.length} playbook{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-accent px-3 py-1.5 font-mono text-xs font-bold text-white transition hover:bg-accent-hover"
        >
          + Novo Playbook
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            {filterTheme ? "Nenhum playbook neste tema." : "Nenhum playbook ainda."}
          </p>
          <p className="text-xs text-text-muted">
            {filterTheme ? "Tente outro filtro ou crie um novo." : "Crie o primeiro para começar a organizar conhecimento."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const isBookReady =
              p.has_example &&
              p.has_story &&
              p.has_origin &&
              p.has_counterexample &&
              p.completeness_score >= 80;
            const isExpanded = expandedId === p.id;

            return (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-card transition hover:border-border-light"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : p.id)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-sans text-sm font-medium text-text">
                        {p.title}
                      </h3>
                      {p.created_at &&
                        Date.now() - new Date(p.created_at).getTime() < 24 * 60 * 60 * 1000 && (
                        <span className="bg-green/15 text-green text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                          Novo
                        </span>
                      )}
                      {p.theme && (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] text-white"
                          style={{
                            backgroundColor: p.theme.color ?? "#3a5a7a",
                          }}
                        >
                          {p.theme.name}
                        </span>
                      )}
                      {p.status && p.status !== "rascunho" && (
                        <span className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                          p.status === "publicado" ? "bg-green/15 text-green" : "bg-blue/15 text-blue"
                        }`}>
                          {p.status === "publicado" ? "Publicado" : "Revisado"}
                        </span>
                      )}
                      {isBookReady && (
                        <span className="inline-block rounded-full bg-green/20 px-2 py-0.5 font-mono text-[10px] font-bold text-green">
                          Pronto pro Livro
                        </span>
                      )}
                    </div>
                    {p.subtitle && (
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {p.subtitle}
                      </p>
                    )}
                    <CompletenessBar score={p.estrutura?.principio ? Math.max(p.completeness_score, 30) : p.completeness_score} />
                  </button>
                  <div className="ml-3 flex shrink-0 gap-1">
                    {/* Toggle origin: Pedro ↔ Outros */}
                    <button
                      onClick={async () => {
                        const newOrigin = (!p.created_by || p.created_by === "pedro") ? "outros" : "pedro";
                        await togglePlaybookOrigin(p.id, newOrigin);
                      }}
                      className="rounded-lg px-2 py-1 font-mono text-[10px] text-purple transition hover:bg-purple/10"
                      title={(!p.created_by || p.created_by === "pedro") ? "Mover para Outros" : "Mover para Pedro"}
                    >
                      {(!p.created_by || p.created_by === "pedro") ? "→ Outros" : "→ Pedro"}
                    </button>
                    {p.version_previous && (
                      <button
                        onClick={() =>
                          setDiffId(diffId === p.id ? null : p.id)
                        }
                        className="rounded-lg px-2 py-1 font-mono text-[10px] text-accent transition hover:bg-accent/10"
                      >
                        Ver alteracoes
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(p)}
                      className="rounded-lg px-2 py-1 font-mono text-[10px] text-blue transition hover:bg-card"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
                      className="rounded-lg px-2 py-1 font-mono text-[10px] text-red transition hover:bg-card"
                    >
                      Apagar
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4">
                    {/* Structured playbook view (v2) */}
                    {p.estrutura && p.estrutura.principio ? (
                      <div className="mt-3 space-y-3">
                        {/* Status + Proveniência badge row */}
                        <div className="flex flex-wrap items-center gap-2">
                          {p.status && (
                            <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                              p.status === "publicado" ? "bg-green/15 text-green" :
                              p.status === "revisado" ? "bg-blue/15 text-blue" :
                              "bg-surface text-text-muted"
                            }`}>
                              {p.status}
                            </span>
                          )}
                          {p.proveniencia?.nivel && (
                            <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                              p.proveniencia.nivel === "dito_por_voce" ? "bg-green/10 text-green" :
                              p.proveniencia.nivel === "fonte_externa" ? "bg-purple/10 text-purple" :
                              "bg-surface text-text-muted"
                            }`}>
                              {p.proveniencia.nivel === "dito_por_voce" ? "Dito pelo Pedro" :
                               p.proveniencia.nivel === "fonte_externa" ? "Fonte externa" :
                               "Sintetizado"}
                            </span>
                          )}
                          {p.proveniencia?.autor && p.proveniencia.autor !== "pedro" && (
                            <span className="rounded-full bg-amber/10 text-amber px-2 py-0.5 font-mono text-[10px]">
                              Autor: {p.proveniencia.autor}
                            </span>
                          )}
                        </div>

                        {/* Princípio (hero) */}
                        {p.estrutura.principio && (
                          <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                            <span className="font-mono text-[10px] font-bold uppercase text-accent">Princípio</span>
                            <p className="mt-1 text-sm text-text leading-relaxed">{p.estrutura.principio}</p>
                          </div>
                        )}

                        {/* Quando aplica + Erro comum (side by side on desktop) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {p.estrutura.quando_aplica && (
                            <div className="rounded-lg bg-surface p-3">
                              <span className="font-mono text-[10px] font-bold uppercase text-text-muted">Quando Aplicar</span>
                              <p className="mt-1 text-xs text-text-secondary leading-relaxed">{p.estrutura.quando_aplica}</p>
                            </div>
                          )}
                          {p.estrutura.erro_comum && (
                            <div className="rounded-lg bg-red/5 border border-red/10 p-3">
                              <span className="font-mono text-[10px] font-bold uppercase text-red/70">Erro Comum</span>
                              <p className="mt-1 text-xs text-text-secondary leading-relaxed">{p.estrutura.erro_comum}</p>
                            </div>
                          )}
                        </div>

                        {/* Passos */}
                        {p.estrutura.passos && p.estrutura.passos.length > 0 && (
                          <div className="rounded-lg bg-surface p-3 space-y-2">
                            <span className="font-mono text-[10px] font-bold uppercase text-text-muted">Passos</span>
                            {p.estrutura.passos.map((passo, i) => (
                              <div key={i} className="flex gap-3">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-[10px] font-bold text-accent">
                                  {i + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-text">{passo.titulo}</p>
                                  {passo.como_executar && passo.como_executar.length > 0 && (
                                    <ul className="mt-0.5 space-y-0.5">
                                      {passo.como_executar.map((item, j) => (
                                        <li key={j} className="text-[11px] text-text-secondary pl-1 before:content-['·'] before:mr-1.5 before:text-text-muted">
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Por que importa */}
                        {p.estrutura.por_que_importa && (
                          <div className="rounded-lg bg-surface p-3">
                            <span className="font-mono text-[10px] font-bold uppercase text-text-muted">Por que Importa</span>
                            <p className="mt-1 text-xs text-text-secondary leading-relaxed">{p.estrutura.por_que_importa}</p>
                          </div>
                        )}

                        {/* Exemplos */}
                        {p.estrutura.exemplos && p.estrutura.exemplos.length > 0 && (
                          <div className="rounded-lg bg-surface p-3 space-y-1.5">
                            <span className="font-mono text-[10px] font-bold uppercase text-text-muted">Exemplos</span>
                            {p.estrutura.exemplos.map((ex, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                                  ex.tipo === "vivido_por_voce" ? "bg-green/10 text-green" : "bg-blue/10 text-blue"
                                }`}>
                                  {ex.tipo === "vivido_por_voce" ? "Vivido" : "Terceiro"}
                                </span>
                                <p className="text-text-secondary">{ex.texto}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Proveniência — trechos fonte */}
                        {p.proveniencia?.trechos_fonte && p.proveniencia.trechos_fonte.length > 0 && (
                          <details className="rounded-lg bg-surface p-3">
                            <summary className="font-mono text-[10px] font-bold uppercase text-text-muted cursor-pointer">
                              Fontes ({p.proveniencia.trechos_fonte.length} trecho{p.proveniencia.trechos_fonte.length > 1 ? "s" : ""})
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {p.proveniencia.trechos_fonte.map((t, i) => (
                                <blockquote key={i} className="border-l-2 border-accent/30 pl-2 text-[11px] text-text-muted italic">
                                  &ldquo;{t.citacao_verbatim}&rdquo;
                                  {t.timestamp && <span className="ml-1 not-italic text-[10px] text-accent/60">[{t.timestamp}]</span>}
                                </blockquote>
                              ))}
                            </div>
                          </details>
                        )}

                        {/* Relações — clicáveis */}
                        {p.relacoes && ((p.relacoes.faz_parte_de?.length || 0) > 0 || (p.relacoes.relacionado_a?.length || 0) > 0) && (
                          <div className="rounded-lg bg-surface p-3 space-y-2">
                            <span className="font-mono text-[10px] font-bold uppercase text-text-muted flex items-center gap-1">
                              <Link2 className="h-3 w-3" /> Relações
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {p.relacoes.faz_parte_de?.map((relId) => {
                                const related = playbooks.find((pb) => pb.id === relId);
                                return (
                                  <button
                                    key={relId}
                                    onClick={() => setExpandedId(relId)}
                                    className="inline-flex items-center gap-1 rounded-full bg-purple/10 text-purple border border-purple/20 px-2 py-0.5 font-mono text-[10px] transition hover:bg-purple/20 hover:border-purple/40 cursor-pointer"
                                    title={related ? `Parte de: ${related.title}` : relId}
                                  >
                                    <ArrowUpRight className="h-2.5 w-2.5" />
                                    {related ? related.title.slice(0, 35) + (related.title.length > 35 ? "..." : "") : "Playbook"}
                                  </button>
                                );
                              })}
                              {p.relacoes.relacionado_a?.map((relId) => {
                                const related = playbooks.find((pb) => pb.id === relId);
                                return (
                                  <button
                                    key={relId}
                                    onClick={() => setExpandedId(relId)}
                                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 font-mono text-[10px] transition hover:bg-accent/20 hover:border-accent/40 cursor-pointer"
                                    title={related ? `Relacionado: ${related.title}` : relId}
                                  >
                                    <ArrowUpRight className="h-2.5 w-2.5" />
                                    {related ? related.title.slice(0, 35) + (related.title.length > 35 ? "..." : "") : "Playbook"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Perguntas abertas — interativas */}
                        {p.perguntas_abertas && p.perguntas_abertas.filter(q => q.status === "aberta").length > 0 && (
                          <GapQuestionsPanel playbookId={p.id} perguntas={p.perguntas_abertas} />
                        )}
                      </div>
                    ) : (
                      /* Legacy body_markdown fallback */
                      p.body_markdown && (
                        <div className="mt-3 rounded-lg bg-surface p-3">
                          <pre className="whitespace-pre-wrap text-xs text-text-secondary font-sans leading-relaxed">
                            {p.body_markdown}
                          </pre>
                        </div>
                      )
                    )}

                    {diffId === p.id && p.version_previous && (
                      <DiffView
                        versionCurrent={p.version_current}
                        versionPrevious={p.version_previous}
                        onClose={() => setDiffId(null)}
                      />
                    )}
                    <BookQuestionsPanel playbook={p} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
