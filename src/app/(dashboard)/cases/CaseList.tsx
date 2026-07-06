"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Images,
  Sparkles,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import { createCase, uploadCasePhoto, deleteCase } from "./actions";
import type { CaseCard, CaseInput } from "./actions";

const EMPTY: CaseInput = {
  name: "",
  sector: "",
  summary: "",
  results: "",
  pedro_angle: "",
  notes: "",
};

export default function CaseList({
  initialCases,
  migrationMissing,
}: {
  initialCases: CaseCard[];
  migrationMissing: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [cases, setCases] = useState<CaseCard[]>(initialCases);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CaseInput>(EMPTY);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (migrationMissing) {
    return (
      <div className="rounded-2xl border border-amber/30 bg-amber/5 p-6 text-sm text-text-secondary">
        <p className="font-semibold text-amber">Migracao pendente</p>
        <p className="mt-1">
          As tabelas dos Cases ainda nao existem. Rode o arquivo{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-xs">
            supabase-migration-company-cases.sql
          </code>{" "}
          no SQL Editor do Supabase e recarregue esta pagina.
        </p>
      </div>
    );
  }

  function set<K extends keyof CaseInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setPhotos((prev) => [...prev, ...imgs]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function movePhoto(index: number, dir: -1 | 1) {
    setPhotos((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await createCase(form);
      if ("error" in res) {
        setError(res.error);
        return;
      }

      // Upload das fotos reais na ordem escolhida
      if (photos.length > 0) {
        const fd = new FormData();
        photos.forEach((f) => fd.append("photos", f));
        const up = await uploadCasePhoto(res.id, fd);
        if ("error" in up) {
          // case criado; avisa e segue pro detalhe (fotos podem ser re-enviadas la)
          setError(up.error + " O case foi criado — envie as fotos no detalhe.");
        }
      }

      router.push(`/cases/${res.id}`);
    } catch {
      setError("Nao foi possivel criar o case. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: CaseCard) {
    const ok = await confirm({
      title: "Excluir case",
      message: `Excluir "${c.name}"? As fotos e a analise serao apagadas permanentemente.`,
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const res = await deleteCase(c.id);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setCases((prev) => prev.filter((x) => x.id !== c.id));
  }

  return (
    <div className="space-y-5">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Novo case
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red/20 bg-red/5 px-4 py-2 text-xs text-red">
          {error}
        </p>
      )}

      {/* ===== Form: novo case ===== */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="animate-slide-in space-y-4 rounded-2xl border border-accent/20 bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-text">Novo case</h2>
            <button
              type="button"
              onClick={() => { setShowForm(false); setPhotos([]); setForm(EMPTY); setError(null); }}
              aria-label="Fechar formulario"
              className="rounded-lg p-1 text-text-muted hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="case-name" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">
                Empresa *
              </label>
              <input
                id="case-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
                placeholder="Nome da empresa"
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="case-sector" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">
                Setor
              </label>
              <input
                id="case-sector"
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
                placeholder="E-commerce, SaaS, varejo..."
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="case-summary" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">
              O que a empresa fez *
            </label>
            <textarea
              id="case-summary"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={3}
              required
              placeholder="A estrategia, a mudanca, o lancamento — a materia-prima da analise"
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="case-results" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">
                Resultados / numeros
              </label>
              <textarea
                id="case-results"
                value={form.results}
                onChange={(e) => set("results", e.target.value)}
                rows={3}
                placeholder="Faturamento, crescimento, conversao..."
                className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="case-angle" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">
                O angulo do Pedro
              </label>
              <textarea
                id="case-angle"
                value={form.pedro_angle}
                onChange={(e) => set("pedro_angle", e.target.value)}
                rows={3}
                placeholder="A opiniao/tese — o gancho da analise"
                className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="case-notes" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">
              Notas
            </label>
            <textarea
              id="case-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Contexto extra, fontes, observacoes"
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
            />
          </div>

          {/* Fotos reais (upload manual — nada de IA aqui) */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">
              Fotos reais da empresa
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addPhotos(e.target.files)}
              aria-label="Selecionar fotos do case"
              className="mt-1.5 block w-full text-xs text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20"
            />
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="group relative overflow-hidden rounded-xl border border-border">
                    {/* preview local antes do upload */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="h-20 w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1 py-0.5">
                      <span className="font-mono text-[10px] text-white">#{i + 1}</span>
                      <span className="flex gap-0.5">
                        <button type="button" onClick={() => movePhoto(i, -1)} aria-label="Mover foto para tras" className="rounded p-0.5 text-white/70 hover:text-white">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => movePhoto(i, 1)} aria-label="Mover foto para frente" className="rounded p-0.5 text-white/70 hover:text-white">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, x) => x !== i))} aria-label="Remover foto" className="rounded p-0.5 text-red hover:text-red">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setPhotos([]); setForm(EMPTY); setError(null); }}
              className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted hover:text-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim() || !form.summary?.trim()}
              className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Criando..." : "Criar case"}
            </button>
          </div>
        </form>
      )}

      {/* ===== Lista ===== */}
      {cases.length === 0 && !showForm ? (
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card/50 py-14 text-center">
          <Building2 className="mb-3 h-8 w-8 text-text-muted/30" />
          <p className="text-sm text-text-secondary">Nenhum case ainda.</p>
          <p className="mt-1 text-xs text-text-muted">
            Registre uma empresa + fotos reais e gere a analise do Pedro em carrossel.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/cases/${c.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter") router.push(`/cases/${c.id}`); }}
              className="group cursor-pointer rounded-2xl border border-border bg-card p-5 transition-all hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-bold text-text">
                    {c.name}
                  </h3>
                  {c.sector && (
                    <span className="mt-1 inline-block rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {c.sector}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                  aria-label={`Excluir case ${c.name}`}
                  className="shrink-0 rounded p-1 text-text-muted/40 hover:bg-red/10 hover:text-red"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {c.summary && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                  {c.summary}
                </p>
              )}

              <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-text-muted">
                <span className="flex items-center gap-1">
                  <Images className="h-3 w-3" />
                  {c.photos?.[0]?.count ?? 0} fotos
                </span>
                {c.analysis_generated_at && (
                  <span className="flex items-center gap-1 text-accent">
                    <Sparkles className="h-3 w-3" />
                    Analise pronta
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
