"use client";

import { useState } from "react";
import type { ContentFormat, ContentType, SourceType } from "@/lib/supabase/types";
import { createGeneratedContent } from "./actions";
import { contentTypeBadgeColor, contentTypeLabel } from "./FormatList";

const SOURCE_TYPES: { value: SourceType; label: string; desc: string }[] = [
  {
    value: "base_only",
    label: "Base de Conhecimento",
    desc: "Usar apenas playbooks e histórias",
  },
  {
    value: "references_only",
    label: "Referências",
    desc: "Usar apenas referências externas",
  },
  {
    value: "both",
    label: "Base + Referências",
    desc: "Combinar ambas as fontes",
  },
  {
    value: "free_text",
    label: "Texto Livre",
    desc: "Escrever o input manualmente",
  },
];

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "instagram_reel", label: "Instagram Reel" },
  { value: "instagram_carousel", label: "Instagram Carousel" },
  { value: "instagram_static", label: "Instagram Static" },
  { value: "youtube_long", label: "YouTube Long" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "x_thread", label: "X Thread" },
  { value: "x_tweet", label: "X Tweet" },
];

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < current;
        const isCurrent = step === current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold transition ${
                isCurrent
                  ? "bg-accent text-paper"
                  : isCompleted
                    ? "bg-green text-paper"
                    : "bg-paper-dark text-ink-muted"
              }`}
            >
              {isCompleted ? "✓" : step}
            </div>
            {step < total && (
              <div
                className={`h-px w-6 ${
                  isCompleted ? "bg-green" : "bg-rule"
                }`}
              />
            )}
          </div>
        );
      })}
      <span className="ml-2 font-mono text-[10px] text-ink-muted">
        {current}/{total}
      </span>
    </div>
  );
}

export default function GenerationWizard({
  formats,
  playbooks,
  stories,
}: {
  formats: ContentFormat[];
  playbooks: { id: string; title: string }[];
  stories: { id: string; title: string }[];
}) {
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<SourceType | "">("");
  const [playbookId, setPlaybookId] = useState("");
  const [storyId, setStoryId] = useState("");
  const [freeText, setFreeText] = useState("");
  const [contentType, setContentType] = useState<ContentType | "">("");
  const [formatId, setFormatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const filteredFormats = contentType
    ? formats.filter((f) => f.content_type === contentType)
    : formats;

  function canNext(): boolean {
    if (step === 1) return sourceType !== "";
    if (step === 2) {
      if (sourceType === "free_text") return freeText.trim().length > 0;
      return true; // playbook/story are optional selections
    }
    if (step === 3) return contentType !== "";
    return true;
  }

  async function handleGenerate() {
    setSaving(true);
    const fd = new FormData();
    fd.set("source_type", sourceType);
    fd.set("playbook_id", playbookId);
    fd.set("story_id", storyId);
    fd.set("free_text_input", freeText);
    fd.set("content_type", contentType);
    fd.set("format_id", formatId);
    await createGeneratedContent(fd);
    setSaving(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded border border-green bg-paper-dark p-6 text-center">
        <p className="font-sans text-sm text-ink">
          Conteúdo criado com sucesso! Confira na aba &quot;Conteúdos
          Salvos&quot;.
        </p>
        <button
          onClick={() => {
            setStep(1);
            setSourceType("");
            setPlaybookId("");
            setStoryId("");
            setFreeText("");
            setContentType("");
            setFormatId("");
            setDone(false);
          }}
          className="mt-4 rounded bg-accent px-4 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90"
        >
          Gerar outro
        </button>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator current={step} total={4} />

      <div className="rounded border border-rule bg-paper-dark p-5">
        {/* Step 1: Source Type */}
        {step === 1 && (
          <div>
            <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-ink-soft">
              Fonte do conteúdo
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {SOURCE_TYPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSourceType(s.value)}
                  className={`rounded border px-4 py-3 text-left transition ${
                    sourceType === s.value
                      ? "border-accent bg-paper"
                      : "border-rule hover:border-ink-muted"
                  }`}
                >
                  <span className="block font-sans text-sm font-medium text-ink">
                    {s.label}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {s.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select sources */}
        {step === 2 && (
          <div>
            <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-ink-soft">
              {sourceType === "free_text"
                ? "Texto de entrada"
                : "Selecionar fontes"}
            </h3>

            {sourceType === "free_text" ? (
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Escreva o texto base para geração..."
                rows={6}
                className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            ) : (
              <div className="space-y-3">
                {(sourceType === "base_only" || sourceType === "both") && (
                  <>
                    <div>
                      <label className="mb-1 block font-mono text-[10px] uppercase text-ink-muted">
                        Playbook
                      </label>
                      <select
                        value={playbookId}
                        onChange={(e) => setPlaybookId(e.target.value)}
                        className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                      >
                        <option value="">Nenhum selecionado</option>
                        {playbooks.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block font-mono text-[10px] uppercase text-ink-muted">
                        História
                      </label>
                      <select
                        value={storyId}
                        onChange={(e) => setStoryId(e.target.value)}
                        className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                      >
                        <option value="">Nenhuma selecionada</option>
                        {stories.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {sourceType === "references_only" && (
                  <p className="text-sm text-ink-muted">
                    As referências serão selecionadas automaticamente com base
                    no formato escolhido no próximo passo.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Content type and format */}
        {step === 3 && (
          <div>
            <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-ink-soft">
              Tipo e formato do conteúdo
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-ink-muted">
                  Tipo de conteúdo
                </label>
                <select
                  value={contentType}
                  onChange={(e) => {
                    setContentType(e.target.value as ContentType);
                    setFormatId("");
                  }}
                  className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">Selecione o tipo</option>
                  {CONTENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {contentType && (
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-ink-muted">
                    Formato (opcional)
                  </label>
                  <select
                    value={formatId}
                    onChange={(e) => setFormatId(e.target.value)}
                    className="w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Sem formato específico</option>
                    {filteredFormats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-ink-soft">
              Revisar e gerar
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="font-mono text-[10px] uppercase text-ink-muted">
                  Fonte:
                </span>
                <span className="text-ink">
                  {SOURCE_TYPES.find((s) => s.value === sourceType)?.label}
                </span>
              </div>
              {playbookId && (
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] uppercase text-ink-muted">
                    Playbook:
                  </span>
                  <span className="text-ink">
                    {playbooks.find((p) => p.id === playbookId)?.title}
                  </span>
                </div>
              )}
              {storyId && (
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] uppercase text-ink-muted">
                    História:
                  </span>
                  <span className="text-ink">
                    {stories.find((s) => s.id === storyId)?.title}
                  </span>
                </div>
              )}
              {freeText && (
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] uppercase text-ink-muted">
                    Texto:
                  </span>
                  <span className="truncate text-ink">
                    {freeText.slice(0, 80)}
                    {freeText.length > 80 ? "..." : ""}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="font-mono text-[10px] uppercase text-ink-muted">
                  Tipo:
                </span>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${contentTypeBadgeColor(contentType)}`}
                >
                  {contentTypeLabel(contentType)}
                </span>
              </div>
              {formatId && (
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] uppercase text-ink-muted">
                    Formato:
                  </span>
                  <span className="text-ink">
                    {formats.find((f) => f.id === formatId)?.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between border-t border-rule pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="rounded border border-rule px-4 py-1.5 font-mono text-xs text-ink-muted transition hover:text-ink-soft disabled:opacity-30"
          >
            Anterior
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="rounded bg-accent px-4 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
            >
              Próximo
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={saving}
              className="rounded bg-green px-4 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Gerando..." : "Gerar Conteúdo"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
