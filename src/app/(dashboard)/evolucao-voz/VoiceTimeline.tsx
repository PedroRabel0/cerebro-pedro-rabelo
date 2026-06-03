"use client";

import { useState, useTransition } from "react";
import { captureSnapshot, deleteSnapshot, getSnapshots } from "./actions";
import type { VoiceSnapshot } from "@/lib/supabase/types";
import {
  Camera,
  Trash2,
  Loader2,
  ArrowRightLeft,
  Calendar,
} from "lucide-react";

export default function VoiceTimeline({
  initialSnapshots,
}: {
  initialSnapshots: VoiceSnapshot[];
}) {
  const [snapshots, setSnapshots] = useState<VoiceSnapshot[]>(initialSnapshots);
  const [isCapturing, startCapture] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCapture() {
    setError(null);
    startCapture(async () => {
      try {
        await captureSnapshot();
        const updated = await getSnapshots();
        setSnapshots(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao capturar snapshot.");
      }
    });
  }

  function handleDeleteConfirmed(id: string) {
    setDeleteConfirmId(null);
    setError(null);
    setDeletingId(id);
    startCapture(async () => {
      try {
        await deleteSnapshot(id);
        const updated = await getSnapshots();
        setSnapshots(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao deletar snapshot.");
      } finally {
        setDeletingId(null);
      }
    });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Capture button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {isCapturing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Capturar Snapshot Atual
        </button>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">
              Deletar este snapshot de voz? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:bg-surface hover:text-text"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteConfirmed(deleteConfirmId)}
                className="rounded-lg bg-red px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-red/80"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty state */}
      {snapshots.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <Camera className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-secondary">
            Nenhum snapshot ainda.
          </p>
          <p className="text-xs text-text-muted">
            Capture o primeiro para começar a acompanhar a evolução da voz.
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="relative space-y-6">
        {/* Vertical line */}
        {snapshots.length > 1 && (
          <div className="absolute left-5 top-8 bottom-8 w-px bg-border" />
        )}

        {snapshots.map((snap, idx) => (
          <div key={snap.id} className="relative pl-12">
            {/* Timeline dot */}
            <div className="absolute left-3 top-6 flex h-4 w-4 items-center justify-center">
              <div
                className={`h-3 w-3 rounded-full ${
                  idx === 0
                    ? "bg-accent ring-4 ring-accent/20"
                    : "bg-border"
                }`}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    {formatDate(snap.snapshot_date)}
                  </span>
                  {idx === 0 && (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
                      Mais recente
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setDeleteConfirmId(snap.id)}
                  disabled={deletingId === snap.id}
                  className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  title="Deletar snapshot"
                >
                  {deletingId === snap.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Tone & Positioning */}
              {snap.tone_descriptors && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Tom
                  </p>
                  <p className="text-sm text-text">{snap.tone_descriptors}</p>
                </div>
              )}

              {snap.positioning && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Posicionamento
                  </p>
                  <p className="text-sm text-text">{snap.positioning}</p>
                </div>
              )}

              {/* Tags: voice_uses (green) and voice_avoids (red) */}
              <div className="flex flex-wrap gap-2">
                {snap.voice_uses?.map((tag, i) => (
                  <span
                    key={`use-${i}`}
                    className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400"
                  >
                    {tag}
                  </span>
                ))}
                {snap.voice_avoids?.map((tag, i) => (
                  <span
                    key={`avoid-${i}`}
                    className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Analysis */}
              {snap.analysis && (
                <div className="rounded-lg bg-accent/5 border border-accent/10 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">
                    Análise
                  </p>
                  <p className="text-sm text-text leading-relaxed">
                    {snap.analysis}
                  </p>
                </div>
              )}

              {/* Comparison with previous */}
              {snap.comparison_with_previous && (
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-amber-400" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                      Mudanças desde o último snapshot
                    </p>
                  </div>
                  <p className="text-sm text-text leading-relaxed">
                    {snap.comparison_with_previous}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
