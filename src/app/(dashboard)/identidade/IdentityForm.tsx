"use client";

import { useState, useTransition, useRef, type KeyboardEvent } from "react";
import { upsertIdentity, resetToPedroDefaults } from "./actions";
import type { Identity } from "./actions";
import { X, Plus, Save, CheckCircle2, AlertCircle, Loader2, RotateCcw } from "lucide-react";

interface Props {
  initial: Identity | null;
  wasAutoFilled?: boolean;
}

function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function add() {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
    inputRef.current?.focus();
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  function remove(idx: number) {
    onChange(tags.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm text-text-secondary"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              className="ml-1 text-text-muted hover:text-red transition-colors"
              aria-label={`Remover ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Digite e pressione Enter"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>
    </div>
  );
}

export default function IdentityForm({ initial, wasAutoFilled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorsError, setColorsError] = useState<string | null>(null);
  const [fontsError, setFontsError] = useState<string | null>(null);

  const [colors, setColors] = useState(
    initial?.colors ? JSON.stringify(initial.colors, null, 2) : ""
  );
  const [fonts, setFonts] = useState(
    initial?.fonts ? JSON.stringify(initial.fonts, null, 2) : ""
  );
  const [voiceUses, setVoiceUses] = useState<string[]>(
    initial?.voice_uses ?? []
  );
  const [voiceAvoids, setVoiceAvoids] = useState<string[]>(
    initial?.voice_avoids ?? []
  );
  const [toneDescriptors, setToneDescriptors] = useState(
    initial?.tone_descriptors ?? ""
  );
  const [openingStyle, setOpeningStyle] = useState(
    initial?.opening_style ?? ""
  );
  const [closingStyle, setClosingStyle] = useState(
    initial?.closing_style ?? ""
  );
  const [positioning, setPositioning] = useState(initial?.positioning ?? "");
  const [referenceCreators, setReferenceCreators] = useState(
    initial?.reference_creators ?? ""
  );
  const [brandbookUrl, setBrandbookUrl] = useState(
    initial?.brandbook_url ?? ""
  );

  function validateJson(value: string, fieldName: string): boolean {
    if (!value.trim()) return true; // empty is ok
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  function handleColorsChange(value: string) {
    setColors(value);
    if (value.trim() && !validateJson(value, "cores")) {
      setColorsError("JSON inválido. Exemplo: {\"primary\": \"#c9412b\"}");
    } else {
      setColorsError(null);
    }
  }

  function handleFontsChange(value: string) {
    setFonts(value);
    if (value.trim() && !validateJson(value, "fontes")) {
      setFontsError("JSON inválido. Exemplo: {\"display\": \"Fraunces\"}");
    } else {
      setFontsError(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate JSON fields before submit
    if (colors.trim() && !validateJson(colors, "cores")) {
      setError("O campo Cores contém JSON inválido. Corrija antes de salvar.");
      return;
    }
    if (fonts.trim() && !validateJson(fonts, "fontes")) {
      setError("O campo Fontes contém JSON inválido. Corrija antes de salvar.");
      return;
    }

    const fd = new FormData();
    fd.set("colors", colors);
    fd.set("fonts", fonts);
    fd.set("voice_uses", JSON.stringify(voiceUses));
    fd.set("voice_avoids", JSON.stringify(voiceAvoids));
    fd.set("tone_descriptors", toneDescriptors);
    fd.set("opening_style", openingStyle);
    fd.set("closing_style", closingStyle);
    fd.set("positioning", positioning);
    fd.set("reference_creators", referenceCreators);
    fd.set("brandbook_url", brandbookUrl);

    startTransition(async () => {
      try {
        await upsertIdentity(fd);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  function handleReset() {
    setError(null);
    setSuccess(false);
    setShowResetConfirm(false);
    startResetTransition(async () => {
      try {
        await resetToPedroDefaults();
        // Reload to pick up the new defaults
        window.location.reload();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao resetar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="animate-slide-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm text-text">
              Resetar toda a identidade para os dados padrão do Pedro? Suas alterações serão perdidas.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:bg-surface hover:text-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-red px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-red/80"
              >
                Resetar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cores */}
      <section className={`rounded-2xl border bg-card p-5 ${colorsError ? "border-red" : "border-border"}`}>
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
          Cores
        </h2>
        <p className="text-[10px] text-text-muted mb-3">
          JSON com as cores da marca. Ex: {"{\"primary\": \"#c9412b\", \"secondary\": \"#3a5a7a\"}"}
        </p>
        <textarea
          value={colors}
          onChange={(e) => handleColorsChange(e.target.value)}
          rows={6}
          placeholder='{"primary": "#c9412b", "secondary": "#3a5a7a"}'
          className={`w-full rounded-lg border bg-card px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 resize-y ${colorsError ? "border-red focus:ring-red/40" : "border-border focus:ring-accent/40"}`}
        />
        {colorsError && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-red">
            <AlertCircle className="h-3 w-3" />
            {colorsError}
          </p>
        )}
      </section>

      {/* Fontes */}
      <section className={`rounded-2xl border bg-card p-5 ${fontsError ? "border-red" : "border-border"}`}>
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
          Fontes
        </h2>
        <p className="text-[10px] text-text-muted mb-3">
          JSON com as fontes da marca. Ex: {"{\"display\": \"Fraunces\", \"body\": \"Inter\"}"}
        </p>
        <textarea
          value={fonts}
          onChange={(e) => handleFontsChange(e.target.value)}
          rows={6}
          placeholder='{"display": "Fraunces", "body": "Inter"}'
          className={`w-full rounded-lg border bg-card px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 resize-y ${fontsError ? "border-red focus:ring-red/40" : "border-border focus:ring-accent/40"}`}
        />
        {fontsError && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-red">
            <AlertCircle className="h-3 w-3" />
            {fontsError}
          </p>
        )}
      </section>

      {/* Voz - Usa */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Voz &mdash; Usa
        </h2>
        <TagInput tags={voiceUses} onChange={setVoiceUses} />
      </section>

      {/* Voz - Evita */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Voz &mdash; Evita
        </h2>
        <TagInput tags={voiceAvoids} onChange={setVoiceAvoids} />
      </section>

      {/* Tom */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Tom
        </h2>
        <textarea
          value={toneDescriptors}
          onChange={(e) => setToneDescriptors(e.target.value)}
          rows={3}
          placeholder="Descreva o tom geral da comunicação..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Estilo de Abertura */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Estilo de Abertura
        </h2>
        <textarea
          value={openingStyle}
          onChange={(e) => setOpeningStyle(e.target.value)}
          rows={3}
          placeholder="Como o Pedro costuma abrir seus textos..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Estilo de Fechamento */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Estilo de Fechamento
        </h2>
        <textarea
          value={closingStyle}
          onChange={(e) => setClosingStyle(e.target.value)}
          rows={3}
          placeholder="Como o Pedro costuma fechar seus textos..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Posicionamento */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Posicionamento
        </h2>
        <textarea
          value={positioning}
          onChange={(e) => setPositioning(e.target.value)}
          rows={3}
          placeholder="Posicionamento de marca..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Criadores Referência */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Criadores Refer&ecirc;ncia
        </h2>
        <textarea
          value={referenceCreators}
          onChange={(e) => setReferenceCreators(e.target.value)}
          rows={3}
          placeholder="Criadores que servem como referência..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Brandbook URL */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Brandbook URL
        </h2>
        <input
          type="url"
          value={brandbookUrl}
          onChange={(e) => setBrandbookUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </section>

      {/* Status messages + Save + Reset */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="submit"
          disabled={isPending || isResetting}
          className="flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 transition-all disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Identidade
            </>
          )}
        </button>

        <button
          type="button"
          disabled={isPending || isResetting}
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface transition-colors disabled:opacity-50"
        >
          {isResetting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Resetando...
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />
              Resetar para dados do Pedro
            </>
          )}
        </button>

        {success && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green animate-fade-in">
            <CheckCircle2 className="h-4 w-4" />
            Salvo com sucesso!
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-red animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
