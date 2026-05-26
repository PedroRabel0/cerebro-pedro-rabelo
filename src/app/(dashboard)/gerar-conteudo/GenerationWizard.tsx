"use client";

import { useState, useMemo } from "react";
import type { ContentType } from "@/lib/supabase/types";
import { createWizardContent, updateContentStatus } from "./actions";
import {
  Sparkles,
  Copy,
  RotateCcw,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  Pencil,
  ThumbsDown,
  ChevronDown,
} from "lucide-react";

// --------------- constants ---------------

type WizardStep = "source" | "types" | "details" | "result";
const STEPS: WizardStep[] = ["source", "types", "details", "result"];
const STEP_LABELS: Record<WizardStep, string> = {
  source: "Fonte & Topico",
  types: "Tipos de Conteudo",
  details: "Formato & Detalhes",
  result: "Resultado",
};

const SOURCE_OPTIONS = [
  { value: "base_only", label: "So minha base" },
  { value: "references_only", label: "So referencias" },
  { value: "both", label: "Pedro + referencias" },
] as const;

const TOPIC_MODES = [
  { value: "from_base", label: "Escolher da base" },
  { value: "free_text", label: "Escrever livremente" },
] as const;

const PULL_STORY_OPTIONS = [
  { value: "ai_suggests", label: "IA sugere" },
  { value: "choose", label: "Escolher" },
  { value: "no", label: "Nao" },
] as const;

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "instagram_reel", label: "Instagram Reels" },
  { value: "instagram_carousel", label: "Instagram Carousel" },
  { value: "instagram_static", label: "Instagram Estatico" },
  { value: "youtube_long", label: "YouTube Longo" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "x_thread", label: "X Thread" },
  { value: "x_tweet", label: "X Tweet" },
];

const OBJETIVO_OPTIONS = [
  { value: "educar", label: "Educar" },
  { value: "engajar", label: "Engajar" },
  { value: "posicionar", label: "Posicionar" },
  { value: "converter", label: "Converter" },
];

const OBJETIVO_YT_OPTIONS = [
  { value: "ensinar", label: "Ensinar" },
  { value: "compartilhar", label: "Compartilhar" },
  { value: "reagir", label: "Reagir" },
  { value: "responder", label: "Responder" },
];

const ABERTURA_OPTIONS = [
  { value: "cena", label: "Cena" },
  { value: "afirmacao", label: "Afirmacao" },
  { value: "pergunta", label: "Pergunta" },
  { value: "confissao", label: "Confissao" },
];

const TOM_TWEET_OPTIONS = [
  { value: "provocativo", label: "Provocativo" },
  { value: "didatico", label: "Didatico" },
  { value: "casual", label: "Casual" },
  { value: "reflexivo", label: "Reflexivo" },
];

const ENERGIA_OPTIONS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baixa", label: "Baixa" },
  { value: "provocativa", label: "Provocativa" },
  { value: "reflexiva", label: "Reflexiva" },
];

const ESTRUTURA_YT_OPTIONS = [
  { value: "lista", label: "Lista" },
  { value: "narrativa", label: "Narrativa" },
  { value: "problema_solucao", label: "Problema/Solucao" },
  { value: "tutorial", label: "Tutorial" },
  { value: "reagindo", label: "Reagindo" },
];

// --------------- types ---------------

interface PlaybookOption {
  id: string;
  title: string;
}

interface StoryOption {
  id: string;
  title: string;
}

type SourceType = "base_only" | "references_only" | "both";
type TopicMode = "from_base" | "free_text";
type PullStory = "ai_suggests" | "choose" | "no";

interface WizardState {
  // Step 1
  source: SourceType;
  topicMode: TopicMode;
  selectedPlaybookId: string;
  selectedStoryId: string;
  freeTopic: string;
  recorte: string;
  pullStory: PullStory;
  selectedStoryForPull: string;
  audience: string;
  extraContext: string;
  // Step 2
  selectedTypes: ContentType[];
  // Step 3 - per type details
  typeDetails: Record<string, Record<string, string>>;
}

const initialState: WizardState = {
  source: "base_only",
  topicMode: "from_base",
  selectedPlaybookId: "",
  selectedStoryId: "",
  freeTopic: "",
  recorte: "",
  pullStory: "ai_suggests",
  selectedStoryForPull: "",
  audience: "",
  extraContext: "",
  selectedTypes: [],
  typeDetails: {},
};

// --------------- sub-components ---------------

function StepIndicator({ current, steps }: { current: WizardStep; steps: WizardStep[] }) {
  const idx = steps.indexOf(current);
  return (
    <div className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold transition-all ${
              i <= idx
                ? "bg-accent text-bg"
                : "border border-border text-text-muted"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`hidden font-mono text-[10px] uppercase tracking-wider sm:inline ${
              i === idx ? "text-accent" : "text-text-muted"
            }`}
          >
            {STEP_LABELS[s]}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-6 ${
                i < idx ? "bg-accent" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function PillSelect<T extends string>({
  options,
  value,
  onChange,
  multi = false,
  selected,
  onToggle,
}: (
  | { multi?: false; value: T; onChange: (v: T) => void; selected?: never; onToggle?: never }
  | { multi: true; selected: T[]; onToggle: (v: T) => void; value?: never; onChange?: never }
) & { options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = multi ? selected!.includes(o.value) : value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => (multi ? onToggle!(o.value) : onChange!(o.value))}
            className={`rounded-xl px-3 py-1.5 font-mono text-xs transition-all ${
              active
                ? "bg-accent text-bg font-bold shadow-sm shadow-accent/20"
                : "bg-surface text-text-muted hover:text-text hover:bg-surface/80"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-border bg-card px-3 py-2 pr-8 text-sm text-text focus:border-accent focus:outline-none"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  if (rows && rows > 1) {
    return (
      <div>
        <FieldLabel>{label}</FieldLabel>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
        />
      </div>
    );
  }
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
    </div>
  );
}

// --------------- type detail forms ---------------

function InstagramCarouselFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objetivo</FieldLabel>
        <PillSelect
          options={OBJETIVO_OPTIONS}
          value={(details.objetivo as string) || "educar"}
          onChange={(v) => update("objetivo", v)}
        />
      </div>
      <NumberField
        label="Numero de slides"
        value={details.num_slides || "6"}
        onChange={(v) => update("num_slides", v)}
        min={4}
        max={12}
      />
      <TextField
        label="Slide 1 — Gancho"
        value={details.gancho || ""}
        onChange={(v) => update("gancho", v)}
        placeholder="Frase de abertura que prende a atencao"
      />
      <TextField
        label="Ultimo slide — CTA"
        value={details.cta || ""}
        onChange={(v) => update("cta", v)}
        placeholder="Chamada para acao do ultimo slide"
      />
      <div>
        <FieldLabel>Imagem de capa</FieldLabel>
        <PillSelect
          options={[
            { value: "foto", label: "Foto" },
            { value: "capa_frase", label: "Capa com frase" },
            { value: "ilustracao", label: "Ilustracao" },
          ]}
          value={(details.imagem_capa as string) || "capa_frase"}
          onChange={(v) => update("imagem_capa", v)}
        />
      </div>
    </div>
  );
}

function LinkedinPostFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objetivo</FieldLabel>
        <PillSelect
          options={OBJETIVO_OPTIONS}
          value={(details.objetivo as string) || "educar"}
          onChange={(v) => update("objetivo", v)}
        />
      </div>
      <div>
        <FieldLabel>Tamanho</FieldLabel>
        <PillSelect
          options={[
            { value: "curto", label: "Curto (<100 palavras)" },
            { value: "medio", label: "Medio (100-250)" },
            { value: "longo", label: "Longo (250-500)" },
          ]}
          value={(details.tamanho as string) || "medio"}
          onChange={(v) => update("tamanho", v)}
        />
      </div>
      <div>
        <FieldLabel>Abertura</FieldLabel>
        <PillSelect
          options={ABERTURA_OPTIONS}
          value={(details.abertura as string) || "cena"}
          onChange={(v) => update("abertura", v)}
        />
      </div>
      <div>
        <FieldLabel>Quebras de linha</FieldLabel>
        <PillSelect
          options={[
            { value: "muito", label: "Muitas" },
            { value: "medio", label: "Medio" },
            { value: "corrido", label: "Corrido" },
          ]}
          value={(details.quebras as string) || "medio"}
          onChange={(v) => update("quebras", v)}
        />
      </div>
      <div>
        <FieldLabel>Hashtags</FieldLabel>
        <PillSelect
          options={[
            { value: "nenhuma", label: "Nenhuma" },
            { value: "2-3", label: "2-3" },
            { value: "5+", label: "5+" },
          ]}
          value={(details.hashtags as string) || "2-3"}
          onChange={(v) => update("hashtags", v)}
        />
      </div>
      <TextField
        label="CTA"
        value={details.cta || ""}
        onChange={(v) => update("cta", v)}
        placeholder="Chamada para acao"
      />
      <div>
        <FieldLabel>Imagem</FieldLabel>
        <PillSelect
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Nao" },
          ]}
          value={(details.imagem as string) || "sim"}
          onChange={(v) => update("imagem", v)}
        />
      </div>
    </div>
  );
}

function XThreadFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objetivo</FieldLabel>
        <PillSelect
          options={OBJETIVO_OPTIONS}
          value={(details.objetivo as string) || "educar"}
          onChange={(v) => update("objetivo", v)}
        />
      </div>
      <TextField
        label="Tweet 1 — Tese"
        value={details.tese || ""}
        onChange={(v) => update("tese", v)}
        placeholder="A tese principal do primeiro tweet"
      />
      <NumberField
        label="Numero de tweets"
        value={details.num_tweets || "5"}
        onChange={(v) => update("num_tweets", v)}
        min={3}
        max={15}
      />
      <TextField
        label="Ultimo tweet — CTA"
        value={details.cta || ""}
        onChange={(v) => update("cta", v)}
        placeholder="Chamada para acao do ultimo tweet"
      />
    </div>
  );
}

function XTweetFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objetivo</FieldLabel>
        <PillSelect
          options={OBJETIVO_OPTIONS}
          value={(details.objetivo as string) || "educar"}
          onChange={(v) => update("objetivo", v)}
        />
      </div>
      <div>
        <FieldLabel>Tom</FieldLabel>
        <PillSelect
          options={TOM_TWEET_OPTIONS}
          value={(details.tom as string) || "provocativo"}
          onChange={(v) => update("tom", v)}
        />
      </div>
    </div>
  );
}

function InstagramReelsFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objetivo</FieldLabel>
        <PillSelect
          options={OBJETIVO_OPTIONS}
          value={(details.objetivo as string) || "educar"}
          onChange={(v) => update("objetivo", v)}
        />
      </div>
      <div>
        <FieldLabel>Duracao</FieldLabel>
        <PillSelect
          options={[
            { value: "15-30s", label: "15-30s" },
            { value: "30-60s", label: "30-60s" },
            { value: "60-90s", label: "60-90s" },
          ]}
          value={(details.duracao as string) || "30-60s"}
          onChange={(v) => update("duracao", v)}
        />
      </div>
      <div>
        <FieldLabel>Quem aparece</FieldLabel>
        <PillSelect
          options={[
            { value: "voce", label: "Voce" },
            { value: "voce_texto", label: "Voce + texto" },
            { value: "voiceover", label: "Voiceover" },
            { value: "so_texto", label: "So texto" },
          ]}
          value={(details.quem_aparece as string) || "voce"}
          onChange={(v) => update("quem_aparece", v)}
        />
      </div>
      <TextField
        label="Gancho 3s"
        value={details.gancho || ""}
        onChange={(v) => update("gancho", v)}
        placeholder="Primeiros 3 segundos — o que prende"
      />
      <div>
        <FieldLabel>Energia / Tom</FieldLabel>
        <PillSelect
          options={ENERGIA_OPTIONS}
          value={(details.energia as string) || "alta"}
          onChange={(v) => update("energia", v)}
        />
      </div>
      <TextField
        label="CTA"
        value={details.cta || ""}
        onChange={(v) => update("cta", v)}
        placeholder="Chamada para acao"
      />
    </div>
  );
}

function YoutubeLongoFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objetivo</FieldLabel>
        <PillSelect
          options={OBJETIVO_YT_OPTIONS}
          value={(details.objetivo as string) || "ensinar"}
          onChange={(v) => update("objetivo", v)}
        />
      </div>
      <div>
        <FieldLabel>Duracao</FieldLabel>
        <PillSelect
          options={[
            { value: "5-8min", label: "5-8 min" },
            { value: "8-12min", label: "8-12 min" },
            { value: "12-18min", label: "12-18 min" },
          ]}
          value={(details.duracao as string) || "8-12min"}
          onChange={(v) => update("duracao", v)}
        />
      </div>
      <TextField
        label="Gancho 15s"
        value={details.gancho || ""}
        onChange={(v) => update("gancho", v)}
        placeholder="Os primeiros 15 segundos do video"
      />
      <TextField
        label="Promessa explicita"
        value={details.promessa || ""}
        onChange={(v) => update("promessa", v)}
        placeholder="O que o espectador vai aprender/ganhar"
      />
      <div>
        <FieldLabel>Estrutura</FieldLabel>
        <PillSelect
          options={ESTRUTURA_YT_OPTIONS}
          value={(details.estrutura as string) || "narrativa"}
          onChange={(v) => update("estrutura", v)}
        />
      </div>
      <div>
        <FieldLabel>Inclui historia pessoal?</FieldLabel>
        <PillSelect
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Nao" },
          ]}
          value={(details.inclui_historia as string) || "sim"}
          onChange={(v) => update("inclui_historia", v)}
        />
      </div>
      <TextField
        label="CTA"
        value={details.cta || ""}
        onChange={(v) => update("cta", v)}
        placeholder="Chamada para acao"
      />
    </div>
  );
}

function YoutubeShortFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objetivo</FieldLabel>
        <PillSelect
          options={OBJETIVO_OPTIONS}
          value={(details.objetivo as string) || "educar"}
          onChange={(v) => update("objetivo", v)}
        />
      </div>
      <TextField
        label="Gancho 3s"
        value={details.gancho || ""}
        onChange={(v) => update("gancho", v)}
        placeholder="Primeiros 3 segundos"
      />
      <div>
        <FieldLabel>Energia</FieldLabel>
        <PillSelect
          options={ENERGIA_OPTIONS}
          value={(details.energia as string) || "alta"}
          onChange={(v) => update("energia", v)}
        />
      </div>
      <TextField
        label="CTA"
        value={details.cta || ""}
        onChange={(v) => update("cta", v)}
        placeholder="Chamada para acao"
      />
    </div>
  );
}

function InstagramEstaticoFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objetivo</FieldLabel>
        <PillSelect
          options={OBJETIVO_OPTIONS}
          value={(details.objetivo as string) || "educar"}
          onChange={(v) => update("objetivo", v)}
        />
      </div>
      <TextField
        label="Texto do post"
        value={details.texto_post || ""}
        onChange={(v) => update("texto_post", v)}
        placeholder="O texto que acompanha a imagem"
        rows={3}
      />
      <TextField
        label="CTA"
        value={details.cta || ""}
        onChange={(v) => update("cta", v)}
        placeholder="Chamada para acao"
      />
      <div>
        <FieldLabel>Imagem</FieldLabel>
        <PillSelect
          options={[
            { value: "foto", label: "Foto" },
            { value: "frase", label: "Frase" },
            { value: "ilustracao", label: "Ilustracao" },
          ]}
          value={(details.imagem as string) || "frase"}
          onChange={(v) => update("imagem", v)}
        />
      </div>
    </div>
  );
}

function TypeDetailFields({
  type,
  details,
  update,
}: {
  type: ContentType;
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  switch (type) {
    case "instagram_carousel":
      return <InstagramCarouselFields details={details} update={update} />;
    case "linkedin_post":
      return <LinkedinPostFields details={details} update={update} />;
    case "x_thread":
      return <XThreadFields details={details} update={update} />;
    case "x_tweet":
      return <XTweetFields details={details} update={update} />;
    case "instagram_reel":
      return <InstagramReelsFields details={details} update={update} />;
    case "youtube_long":
      return <YoutubeLongoFields details={details} update={update} />;
    case "youtube_short":
      return <YoutubeShortFields details={details} update={update} />;
    case "instagram_static":
      return <InstagramEstaticoFields details={details} update={update} />;
    default:
      return null;
  }
}

function typeLabel(t: ContentType): string {
  return CONTENT_TYPES.find((c) => c.value === t)?.label ?? t;
}

// --------------- result per type ---------------

interface GenerationResult {
  id: string;
  contentType: ContentType;
  content: string;
  sourceMap: Record<string, unknown> | null;
}

function SourceMapDisplay({ sourceMap }: { sourceMap: Record<string, unknown> | null }) {
  if (!sourceMap || Object.keys(sourceMap).length === 0) return null;
  const entries = Object.entries(sourceMap);
  return (
    <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-text-muted">
      {entries.map(([key, val], i) => (
        <span key={key}>
          {i > 0 && <span className="mx-1">&middot;</span>}
          {String(val)} {key}
        </span>
      ))}
    </div>
  );
}

function ResultCard({
  result,
  onRegenerate,
  regenerating,
  onFeedback,
}: {
  result: GenerationResult;
  onRegenerate: () => void;
  regenerating: boolean;
  onFeedback: (rating: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(result.content);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-accent uppercase tracking-wider">
          {typeLabel(result.contentType)}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1 font-mono text-[10px] text-text-muted transition hover:text-text hover:bg-surface"
          >
            {copied ? <Check className="h-3 w-3 text-green" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1 font-mono text-[10px] text-text-muted transition hover:text-text hover:bg-surface"
          >
            <Pencil className="h-3 w-3" />
            {editing ? "Pronto" : "Editar"}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-xl border border-accent/30 bg-card px-4 py-3 text-sm text-text leading-relaxed focus:border-accent focus:outline-none resize-none min-h-[120px]"
          rows={8}
        />
      ) : (
        <div className="rounded-xl bg-surface/50 px-4 py-3 whitespace-pre-wrap text-sm text-text leading-relaxed">
          {text}
        </div>
      )}

      <SourceMapDisplay sourceMap={result.sourceMap} />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 font-mono text-xs text-text-muted transition hover:border-accent/50 hover:text-text disabled:opacity-50"
        >
          {regenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
          Regenerar
        </button>

        <div className="ml-auto flex flex-wrap gap-1">
          <button
            onClick={() => onFeedback("good")}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-green transition hover:bg-green/10"
          >
            <ThumbsUp className="h-3 w-3" />
            Mandou bem
          </button>
          <button
            onClick={() => onFeedback("good_with_edits")}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-accent transition hover:bg-accent/10"
          >
            <Pencil className="h-3 w-3" />
            Com edicao
          </button>
          <button
            onClick={() => onFeedback("bad")}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[10px] text-red transition hover:bg-red/10"
          >
            <ThumbsDown className="h-3 w-3" />
            Ficou ruim
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------- main component ---------------

export default function GenerationWizard({
  playbooks,
  stories,
}: {
  playbooks: PlaybookOption[];
  stories: StoryOption[];
}) {
  const [step, setStep] = useState<WizardStep>("source");
  const [state, setState] = useState<WizardState>(initialState);
  const [generating, setGenerating] = useState(false);
  const [regeneratingType, setRegeneratingType] = useState<string | null>(null);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [error, setError] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState(0);

  const stepIdx = STEPS.indexOf(step);

  function updateState<K extends keyof WizardState>(key: K, val: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: val }));
  }

  function updateTypeDetail(type: string, field: string, value: string) {
    setState((prev) => ({
      ...prev,
      typeDetails: {
        ...prev.typeDetails,
        [type]: {
          ...(prev.typeDetails[type] || {}),
          [field]: value,
        },
      },
    }));
  }

  function toggleType(t: ContentType) {
    setState((prev) => {
      const sel = prev.selectedTypes.includes(t)
        ? prev.selectedTypes.filter((x) => x !== t)
        : [...prev.selectedTypes, t];
      return { ...prev, selectedTypes: sel };
    });
  }

  const canNext = useMemo(() => {
    switch (step) {
      case "source":
        if (state.topicMode === "from_base") return !!state.selectedPlaybookId;
        return state.freeTopic.trim().length > 0;
      case "types":
        return state.selectedTypes.length > 0;
      case "details":
        return true;
      default:
        return false;
    }
  }, [step, state.topicMode, state.selectedPlaybookId, state.freeTopic, state.selectedTypes]);

  function goNext() {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  }

  function goBack() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setResults([]);

    try {
      const payload = {
        source: state.source,
        topicMode: state.topicMode,
        playbookId: state.selectedPlaybookId || undefined,
        storyId: state.selectedStoryId || undefined,
        freeTopic: state.freeTopic || undefined,
        recorte: state.recorte || undefined,
        pullStory: state.pullStory,
        pullStoryId: state.selectedStoryForPull || undefined,
        audience: state.audience || undefined,
        extraContext: state.extraContext || undefined,
        contentTypes: state.selectedTypes,
        typeDetails: state.typeDetails,
      };

      const res = await createWizardContent(payload);

      if ("error" in res) {
        setError(res.error);
      } else {
        setResults(res.results);
        setStep("result");
      }
    } catch {
      setError("Erro inesperado ao gerar conteudo.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(contentType: ContentType) {
    setRegeneratingType(contentType);
    try {
      const payload = {
        source: state.source,
        topicMode: state.topicMode,
        playbookId: state.selectedPlaybookId || undefined,
        storyId: state.selectedStoryId || undefined,
        freeTopic: state.freeTopic || undefined,
        recorte: state.recorte || undefined,
        pullStory: state.pullStory,
        pullStoryId: state.selectedStoryForPull || undefined,
        audience: state.audience || undefined,
        extraContext: state.extraContext || undefined,
        contentTypes: [contentType],
        typeDetails: state.typeDetails,
      };

      const res = await createWizardContent(payload);

      if (!("error" in res) && res.results.length > 0) {
        setResults((prev) =>
          prev.map((r) =>
            r.contentType === contentType ? res.results[0] : r
          )
        );
      }
    } catch {
      // silent
    } finally {
      setRegeneratingType(null);
    }
  }

  async function handleFeedback(id: string, rating: string) {
    try {
      await updateContentStatus(id, "draft", rating);
    } catch {
      // silent
    }
  }

  function handleStartOver() {
    setState(initialState);
    setResults([]);
    setError("");
    setStep("source");
  }

  // --------------- render steps ---------------

  function renderSource() {
    return (
      <div className="space-y-5">
        <div>
          <FieldLabel>Fonte</FieldLabel>
          <PillSelect
            options={[...SOURCE_OPTIONS]}
            value={state.source}
            onChange={(v) => updateState("source", v as SourceType)}
          />
        </div>

        <div>
          <FieldLabel>Topico</FieldLabel>
          <PillSelect
            options={[...TOPIC_MODES]}
            value={state.topicMode}
            onChange={(v) => updateState("topicMode", v as TopicMode)}
          />
        </div>

        {state.topicMode === "from_base" ? (
          <div className="space-y-4">
            <SelectField
              label="Playbook"
              value={state.selectedPlaybookId}
              onChange={(v) => updateState("selectedPlaybookId", v)}
              options={playbooks.map((p) => ({ value: p.id, label: p.title }))}
              placeholder="Selecione um playbook..."
            />
            <SelectField
              label="Historia (opcional)"
              value={state.selectedStoryId}
              onChange={(v) => updateState("selectedStoryId", v)}
              options={stories.map((s) => ({ value: s.id, label: s.title }))}
              placeholder="Nenhuma"
            />
          </div>
        ) : (
          <TextField
            label="Escreva o topico"
            value={state.freeTopic}
            onChange={(v) => updateState("freeTopic", v)}
            placeholder="Ex: Post sobre frameworks de decisao, Thread sobre como lidar com incerteza..."
            rows={3}
          />
        )}

        <TextField
          label="Recorte especifico (opcional)"
          value={state.recorte}
          onChange={(v) => updateState("recorte", v)}
          placeholder="Angulo ou recorte especifico"
        />

        <div>
          <FieldLabel>Puxar historia?</FieldLabel>
          <PillSelect
            options={[...PULL_STORY_OPTIONS]}
            value={state.pullStory}
            onChange={(v) => updateState("pullStory", v as PullStory)}
          />
        </div>

        {state.pullStory === "choose" && (
          <SelectField
            label="Escolher historia"
            value={state.selectedStoryForPull}
            onChange={(v) => updateState("selectedStoryForPull", v)}
            options={stories.map((s) => ({ value: s.id, label: s.title }))}
            placeholder="Selecione uma historia..."
          />
        )}

        <TextField
          label="Pra quem e (opcional)"
          value={state.audience}
          onChange={(v) => updateState("audience", v)}
          placeholder="Ex: empreendedores iniciantes, lideres de equipe..."
        />

        <TextField
          label="Contexto extra (opcional)"
          value={state.extraContext}
          onChange={(v) => updateState("extraContext", v)}
          placeholder="Qualquer contexto adicional para a IA..."
          rows={2}
        />
      </div>
    );
  }

  function renderTypes() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Selecione um ou mais tipos de conteudo para gerar.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {CONTENT_TYPES.map((t) => {
            const active = state.selectedTypes.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleType(t.value)}
                className={`rounded-2xl border px-4 py-3 text-left font-mono text-xs transition-all ${
                  active
                    ? "border-accent bg-accent/10 text-accent font-bold"
                    : "border-border bg-card text-text-muted hover:border-border-light hover:text-text"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-md border-2 transition-all ${
                      active
                        ? "border-accent bg-accent"
                        : "border-text-muted"
                    }`}
                  />
                  {t.label}
                </div>
              </button>
            );
          })}
        </div>
        {state.selectedTypes.length > 0 && (
          <p className="text-xs text-text-muted">
            {state.selectedTypes.length} tipo{state.selectedTypes.length !== 1 ? "s" : ""} selecionado{state.selectedTypes.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    );
  }

  function renderDetails() {
    if (state.selectedTypes.length === 0) return null;

    const tabIdx = Math.min(activeDetailTab, state.selectedTypes.length - 1);

    return (
      <div className="space-y-4">
        {state.selectedTypes.length > 1 && (
          <div className="flex gap-1 rounded-xl bg-surface p-1 overflow-x-auto">
            {state.selectedTypes.map((t, i) => (
              <button
                key={t}
                onClick={() => setActiveDetailTab(i)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-mono text-[10px] transition-all ${
                  tabIdx === i
                    ? "bg-card text-accent shadow-sm font-bold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {typeLabel(t)}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-wider text-text">
            {typeLabel(state.selectedTypes[tabIdx])}
          </h3>
          <TypeDetailFields
            type={state.selectedTypes[tabIdx]}
            details={state.typeDetails[state.selectedTypes[tabIdx]] || {}}
            update={(k, v) => updateTypeDetail(state.selectedTypes[tabIdx], k, v)}
          />
        </div>
      </div>
    );
  }

  function renderResult() {
    return (
      <div className="space-y-4">
        {results.map((r) => (
          <ResultCard
            key={r.contentType}
            result={r}
            onRegenerate={() => handleRegenerate(r.contentType)}
            regenerating={regeneratingType === r.contentType}
            onFeedback={(rating) => handleFeedback(r.id, rating)}
          />
        ))}

        <button
          onClick={handleStartOver}
          className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text"
        >
          <RotateCcw className="h-3 w-3" />
          Comecar de novo
        </button>
      </div>
    );
  }

  // --------------- main render ---------------

  return (
    <div className="space-y-5">
      <StepIndicator current={step} steps={STEPS} />

      <div className="rounded-2xl border border-border bg-card p-5">
        {step === "source" && renderSource()}
        {step === "types" && renderTypes()}
        {step === "details" && renderDetails()}
        {step === "result" && renderResult()}

        {error && (
          <div className="mt-4 rounded-xl border border-red/20 bg-red/5 px-4 py-2 text-xs text-red">
            {error}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {step !== "result" && (
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={stepIdx === 0}
            className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 font-mono text-xs text-text-muted transition hover:border-border-light hover:text-text disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-3 w-3" />
            Voltar
          </button>

          {step === "details" ? (
            <button
              onClick={handleGenerate}
              disabled={generating || !canNext}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-mono text-sm font-bold text-bg transition hover:bg-accent-hover disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Gerar conteudo
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canNext}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-bg transition hover:bg-accent-hover disabled:opacity-50"
            >
              Proximo
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Generating animation */}
      {generating && (
        <div className="animate-pulse rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
            <Sparkles className="h-6 w-6 text-accent animate-pulse" />
          </div>
          <p className="text-sm font-medium text-text">
            Analisando base de conhecimento...
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Gerando {state.selectedTypes.length} tipo{state.selectedTypes.length !== 1 ? "s" : ""} de conteudo com base nos seus playbooks e historias.
          </p>
        </div>
      )}
    </div>
  );
}
