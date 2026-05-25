"use client";

import { useState, useTransition, useRef, type KeyboardEvent } from "react";
import { upsertIdentity } from "./actions";
import type { Identity } from "./actions";

interface Props {
  initial: Identity | null;
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
            className="inline-flex items-center gap-1 rounded-full border border-rule bg-paper px-3 py-1 text-sm text-ink-soft"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              className="ml-1 text-ink-muted hover:text-accent transition-colors"
              aria-label={`Remover ${tag}`}
            >
              &times;
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
          className="flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-rule bg-paper px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper-dark transition-colors"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

export default function IdentityForm({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cores */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Cores
        </h2>
        <textarea
          value={colors}
          onChange={(e) => setColors(e.target.value)}
          rows={6}
          placeholder='{"primary": "#c9412b", "secondary": "#3a5a7a"}'
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Fontes */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Fontes
        </h2>
        <textarea
          value={fonts}
          onChange={(e) => setFonts(e.target.value)}
          rows={6}
          placeholder='{"display": "Fraunces", "body": "Inter"}'
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Voz - Usa */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Voz &mdash; Usa
        </h2>
        <TagInput tags={voiceUses} onChange={setVoiceUses} />
      </section>

      {/* Voz - Evita */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Voz &mdash; Evita
        </h2>
        <TagInput tags={voiceAvoids} onChange={setVoiceAvoids} />
      </section>

      {/* Tom */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Tom
        </h2>
        <textarea
          value={toneDescriptors}
          onChange={(e) => setToneDescriptors(e.target.value)}
          rows={3}
          placeholder="Descreva o tom geral da comunicação..."
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Estilo de Abertura */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Estilo de Abertura
        </h2>
        <textarea
          value={openingStyle}
          onChange={(e) => setOpeningStyle(e.target.value)}
          rows={3}
          placeholder="Como o Pedro costuma abrir seus textos..."
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Estilo de Fechamento */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Estilo de Fechamento
        </h2>
        <textarea
          value={closingStyle}
          onChange={(e) => setClosingStyle(e.target.value)}
          rows={3}
          placeholder="Como o Pedro costuma fechar seus textos..."
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Posicionamento */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Posicionamento
        </h2>
        <textarea
          value={positioning}
          onChange={(e) => setPositioning(e.target.value)}
          rows={3}
          placeholder="Posicionamento de marca..."
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Criadores Referência */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Criadores Refer&ecirc;ncia
        </h2>
        <textarea
          value={referenceCreators}
          onChange={(e) => setReferenceCreators(e.target.value)}
          rows={3}
          placeholder="Criadores que servem como referência..."
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </section>

      {/* Brandbook URL */}
      <section className="rounded-xl border border-rule bg-paper-dark p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Brandbook URL
        </h2>
        <input
          type="url"
          value={brandbookUrl}
          onChange={(e) => setBrandbookUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </section>

      {/* Status messages + Save */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar Identidade"}
        </button>

        {success && (
          <span className="text-sm font-medium text-green">
            Salvo com sucesso!
          </span>
        )}
        {error && (
          <span className="text-sm font-medium text-accent">{error}</span>
        )}
      </div>
    </form>
  );
}
