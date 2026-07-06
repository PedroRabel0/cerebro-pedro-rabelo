"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Download,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  updateCase,
  deleteCase,
  uploadCasePhoto,
  deleteCasePhoto,
  generateCaseCarousel,
} from "../actions";
import type { CompanyCase, CaseAnalysis, CaseInput, CasePhotoWithUrl } from "../actions";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button
      onClick={handleCopy}
      aria-label={label}
      className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors ${
        copied
          ? "border-green/30 bg-green/10 text-green"
          : "border-border text-text-muted hover:border-accent/40 hover:text-text"
      }`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export default function CaseDetail({
  initialCase,
  photos: initialPhotos,
}: {
  initialCase: CompanyCase;
  photos: CasePhotoWithUrl[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [caso, setCaso] = useState<CompanyCase>(initialCase);
  const [photos, setPhotos] = useState<CasePhotoWithUrl[]>(initialPhotos);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CaseInput>({
    name: initialCase.name,
    sector: initialCase.sector ?? "",
    summary: initialCase.summary ?? "",
    results: initialCase.results ?? "",
    pedro_angle: initialCase.pedro_angle ?? "",
    notes: initialCase.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysis: CaseAnalysis | null = caso.analysis;

  function set<K extends keyof CaseInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateCase(caso.id, form);
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    setCaso((prev) => ({
      ...prev,
      name: form.name.trim(),
      sector: form.sector?.trim() || null,
      summary: form.summary?.trim() || null,
      results: form.results?.trim() || null,
      pedro_angle: form.pedro_angle?.trim() || null,
      notes: form.notes?.trim() || null,
    }));
    setEditing(false);
  }

  async function handleDeleteCase() {
    const ok = await confirm({
      title: "Excluir case",
      message: `Excluir "${caso.name}"? Fotos e analise serao apagadas permanentemente.`,
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const res = await deleteCase(caso.id);
    if ("error" in res) { setError(res.error); return; }
    router.push("/cases");
  }

  async function handleAddPhotos(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    Array.from(list).forEach((f) => fd.append("photos", f));
    const res = await uploadCasePhoto(caso.id, fd);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if ("error" in res) { setError(res.error); return; }
    router.refresh(); // recarrega com as signed URLs novas
  }

  async function handleDeletePhoto(photo: CasePhotoWithUrl) {
    const ok = await confirm({
      title: "Excluir foto",
      message: "Excluir esta foto do case?",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const res = await deleteCasePhoto(photo.id);
    if ("error" in res) { setError(res.error); return; }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function handleGenerate() {
    if (analysis) {
      const ok = await confirm({
        title: "Regerar analise",
        message: "A analise atual sera substituida pela nova. Continuar?",
        confirmLabel: "Regerar",
        danger: false,
      });
      if (!ok) return;
    }
    setGenerating(true);
    setError(null);
    const res = await generateCaseCarousel(caso.id);
    setGenerating(false);
    if ("error" in res) { setError(res.error); return; }
    setCaso((prev) => ({
      ...prev,
      analysis: res.analysis,
      analysis_generated_at: new Date().toISOString(),
    }));
  }

  const fullTextForCopy = analysis
    ? `${analysis.hook}\n\n${analysis.slides
        .map((s, i) => `SLIDE ${i + 1} — ${s.title}\n${s.text}`)
        .join("\n\n")}\n\n---LEGENDA---\n${analysis.caption}`
    : "";

  return (
    <div className="space-y-6">
      {/* ===== Header ===== */}
      <div>
        <Link
          href="/cases"
          className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text"
        >
          <ArrowLeft className="h-3 w-3" /> Cases
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-red/10">
              <Building2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-text">{caso.name}</h1>
              {caso.sector && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  {caso.sector}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing((v) => !v); setError(null); }}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-text-secondary hover:border-accent/40 hover:text-text"
            >
              {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editing ? "Cancelar" : "Editar"}
            </button>
            <button
              onClick={handleDeleteCase}
              className="flex items-center gap-1.5 rounded-xl border border-red/20 px-3 py-2 text-sm text-red hover:bg-red/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red/20 bg-red/5 px-4 py-2 text-xs text-red">
          {error}
        </p>
      )}

      {/* ===== Dados do case (leitura ou edicao) ===== */}
      {editing ? (
        <form onSubmit={handleSaveEdit} className="space-y-4 rounded-2xl border border-accent/20 bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="e-name" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">Empresa *</label>
              <input id="e-name" value={form.name} onChange={(e) => set("name", e.target.value)} required
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label htmlFor="e-sector" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">Setor</label>
              <input id="e-sector" value={form.sector} onChange={(e) => set("sector", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="e-summary" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">O que a empresa fez *</label>
            <textarea id="e-summary" value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={3} required
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="e-results" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">Resultados / numeros</label>
              <textarea id="e-results" value={form.results} onChange={(e) => set("results", e.target.value)} rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label htmlFor="e-angle" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">O angulo do Pedro</label>
              <textarea id="e-angle" value={form.pedro_angle} onChange={(e) => set("pedro_angle", e.target.value)} rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="e-notes" className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary">Notas</label>
            <textarea id="e-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !form.name.trim()}
              className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoBlock title="O que a empresa fez" text={caso.summary} />
          <InfoBlock title="Resultados / numeros" text={caso.results} />
          <InfoBlock title="O angulo do Pedro" text={caso.pedro_angle} accent />
          <InfoBlock title="Notas" text={caso.notes} />
        </div>
      )}

      {/* ===== Fotos reais ===== */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-text">
            Fotos reais <span className="font-mono text-[11px] font-normal text-text-muted">({photos.length})</span>
          </h2>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {uploading ? "Enviando..." : "Adicionar fotos"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={(e) => handleAddPhotos(e.target.files)}
              className="hidden"
            />
          </label>
        </div>

        {photos.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-muted">
            Nenhuma foto ainda — as fotos reais da empresa sao a capa e o fundo do carrossel.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p, i) => (
              <div key={p.id} className="group relative overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || `Foto ${i + 1} do case`} className="h-32 w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1">
                  <span className="font-mono text-[10px] text-white">#{i + 1}</span>
                  <span className="flex gap-1">
                    <a href={p.url} download target="_blank" rel="noreferrer" aria-label="Baixar foto"
                      className="rounded p-0.5 text-white/80 hover:text-white">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button onClick={() => handleDeletePhoto(p)} aria-label="Excluir foto"
                      className="rounded p-0.5 text-red hover:brightness-125">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Análise (carrossel) ===== */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-text">Analise do Pedro (carrossel)</h2>
            {caso.analysis_generated_at && (
              <p className="font-mono text-[11px] text-text-muted">
                Gerada em {new Date(caso.analysis_generated_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {analysis && <CopyButton text={fullTextForCopy} label="Copiar analise completa" />}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Gerando..." : analysis ? "Regerar" : "Gerar analise (carrossel)"}
            </button>
          </div>
        </div>

        {!analysis && !generating && (
          <p className="py-4 text-center text-xs text-text-muted">
            A IA vai analisar o case com a voz e os frameworks do Pedro — capa com gancho,
            slides de insight e licao final. Voce monta o carrossel com as fotos reais acima.
          </p>
        )}

        {analysis && (
          <div className="space-y-4">
            {/* Capa / hook */}
            <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-red/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
                    Capa (sobre a foto real)
                  </p>
                  <p className="mt-1 font-display text-lg font-bold leading-snug text-text">
                    {analysis.hook}
                  </p>
                </div>
                <CopyButton text={analysis.hook} label="Copiar frase da capa" />
              </div>
            </div>

            {/* Slides */}
            <div className="space-y-2">
              {analysis.slides.map((s, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 font-mono text-[11px] font-bold text-accent">
                    {i + 2}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text">{s.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{s.text}</p>
                  </div>
                  <CopyButton text={`${s.title}\n${s.text}`} label={`Copiar slide ${i + 2}`} />
                </div>
              ))}
            </div>

            {/* Legenda */}
            <div className="rounded-xl border border-border bg-surface/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Legenda do post
                </p>
                <CopyButton text={analysis.caption} label="Copiar legenda" />
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {analysis.caption}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBlock({ title, text, accent }: { title: string; text: string | null; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-accent/25 bg-accent/5" : "border-border bg-card"}`}>
      <p className={`font-mono text-[10px] uppercase tracking-widest ${accent ? "text-accent" : "text-text-muted"}`}>
        {title}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
        {text || <span className="text-text-muted/50">—</span>}
      </p>
    </div>
  );
}
