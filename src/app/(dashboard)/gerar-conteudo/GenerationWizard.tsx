"use client";

import { useState, useMemo, useTransition } from "react";
import type { ContentType } from "@/lib/supabase/types";
import { createWizardContent, updateContentStatus, generateImageForContent, uploadImageToContent, refineContent, addStoryToContent } from "./actions";
import type { StorySuggestion } from "./actions";
import SlideDesigner from "@/components/SlideDesigner";
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
  Image as ImageIcon,
  Upload,
  Send,
  BookMarked,
  Plus,
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


const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "instagram_reel", label: "Instagram Reels" },
  { value: "instagram_carousel", label: "Instagram Carousel" },
  { value: "instagram_carousel_educativo", label: "Carrossel Educativo" },
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

const TOM_EDUCATIVO_OPTIONS = [
  { value: "provocativo", label: "Provocativo" },
  { value: "didatico", label: "Didatico" },
  { value: "opinativo", label: "Opinativo" },
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

interface ThemeOption {
  id: string;
  name: string;
  color: string | null;
}

type SourceType = "base_only" | "references_only" | "both";

interface WizardState {
  // Step 1
  source: SourceType;
  topic: string;        // tema livre digitado pelo usuário
  recorte: string;
  audience: string;
  extraContext: string;
  // Step 2
  selectedTypes: ContentType[];
  // Step 3 - per type details
  typeDetails: Record<string, Record<string, string>>;
}

const initialState: WizardState = {
  source: "base_only",
  topic: "",
  recorte: "",
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

function CarrosselEducativoFields({
  details,
  update,
}: {
  details: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <NumberField
        label="Slides de conteudo"
        value={details.num_slides || "6"}
        onChange={(v) => update("num_slides", v)}
        min={4}
        max={8}
      />
      <div>
        <FieldLabel>Tom</FieldLabel>
        <PillSelect
          options={TOM_EDUCATIVO_OPTIONS}
          value={(details.tom as string) || "provocativo"}
          onChange={(v) => update("tom", v)}
        />
      </div>
      <TextField
        label="Gancho da capa (opcional)"
        value={details.gancho || ""}
        onChange={(v) => update("gancho", v)}
        placeholder="Frase provocativa para o slide 1 — se vazio, a IA cria"
      />
      <TextField
        label="CTA final (opcional)"
        value={details.cta || ""}
        onChange={(v) => update("cta", v)}
        placeholder="Chamada para acao do ultimo slide"
      />
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
    case "instagram_carousel_educativo":
      return <CarrosselEducativoFields details={details} update={update} />;
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
  imagePrompt?: string | null;
  source?: "base_only" | "references_only" | "both";
  storySuggestions?: StorySuggestion[];
}

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  base_only: { label: "Do Pedro", className: "bg-accent/15 text-accent border-accent/30" },
  references_only: { label: "De referências externas", className: "bg-blue/15 text-blue border-blue/30" },
  both: { label: "Pedro + Referências", className: "bg-purple/15 text-purple border-purple/30" },
  free_text: { label: "Texto livre", className: "bg-surface text-text-muted border-border" },
};

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

// --- Carousel Parsing ---

function parseCarouselSlides(content: string): {
  slides: string[];
  hook: string;
  cta: string;
} {
  // Try splitting by --- or numbered markers (1., 2., etc.)
  const parts = content
    .split(/---|\n\n(?=\d+\.)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      hook: parts[0],
      slides: parts.slice(1, -1),
      cta: parts[parts.length - 1],
    };
  }
  // Fallback: split by double newlines
  const lines = content.split(/\n\n+/).filter((s) => s.trim());
  return {
    hook: lines[0] || "",
    slides: lines.slice(1, -1),
    cta: lines[lines.length - 1] || "",
  };
}

function CarouselDesignPreview({
  content,
  wizardState,
}: {
  content: string;
  wizardState: WizardState;
}) {
  const parsed = parseCarouselSlides(content);
  const details = wizardState.typeDetails["instagram_carousel"] || {};
  const title =
    wizardState.topic ||
    wizardState.recorte ||
    "Carousel";

  return (
    <SlideDesigner
      slides={parsed.slides}
      hook={details.gancho || parsed.hook}
      cta={details.cta || parsed.cta}
      title={title}
      hashtags={[]}
    />
  );
}

function ImagePromptDisplay({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 rounded-xl border border-purple/20 bg-purple/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-purple" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-purple">
            Prompt de imagem
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg px-2 py-1 font-mono text-[10px] text-text-muted transition hover:text-text hover:bg-surface"
          >
            {expanded ? "Recolher" : "Expandir"}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg bg-purple/10 px-2.5 py-1 font-mono text-[10px] text-purple transition hover:bg-purple/20"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado!" : "Copiar prompt"}
          </button>
        </div>
      </div>
      <p className={`text-xs text-text-secondary leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
        {prompt}
      </p>
      {!expanded && prompt.length > 200 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 font-mono text-[10px] text-purple hover:text-purple/80"
        >
          Ver prompt completo →
        </button>
      )}
    </div>
  );
}

function DesignPromptSection({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
            Prompt de Design — Copie e cole no Claude
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 font-mono text-[11px] font-bold text-accent transition hover:bg-accent/25"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado!" : "Copiar Prompt"}
        </button>
      </div>
      <div className={`rounded-lg bg-card border border-border p-3 text-xs text-text-muted leading-relaxed whitespace-pre-wrap ${expanded ? "" : "max-h-32 overflow-hidden"}`}>
        {prompt}
      </div>
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 font-mono text-[11px] text-accent hover:text-accent/80"
        >
          Ver prompt completo →
        </button>
      )}
    </div>
  );
}

function ResultCard({
  result,
  onRegenerate,
  regenerating,
  onFeedback,
  wizardState,
}: {
  result: GenerationResult;
  onRegenerate: () => void;
  regenerating: boolean;
  onFeedback: (rating: string) => void;
  wizardState: WizardState;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(result.content);
  const [copied, setCopied] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineHistory, setRefineHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [addingStoryId, setAddingStoryId] = useState<string | null>(null);
  const [addedStoryIds, setAddedStoryIds] = useState<Set<string>>(new Set());

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setImageError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("images", files[i]);
      }
      const res = await uploadImageToContent(result.id, formData);
      if ("error" in res) {
        setImageError(res.error);
      } else {
        setUploadedImageUrl(res.imageUrl);
      }
    } catch {
      setImageError("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-accent uppercase tracking-wider">
          {typeLabel(result.contentType)}
        </span>
        {result.source && SOURCE_LABELS[result.source] && (
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${SOURCE_LABELS[result.source].className}`}>
            {SOURCE_LABELS[result.source].label}
          </span>
        )}
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

      {(() => {
        const hasDesignPrompt = result.contentType === "instagram_carousel_educativo" && text.includes("---PROMPT DE DESIGN---");
        const contentText = hasDesignPrompt ? text.split("---PROMPT DE DESIGN---")[0].trim() : text;
        const designPrompt = hasDesignPrompt ? text.split("---PROMPT DE DESIGN---")[1].trim() : null;

        return (
          <>
            {editing ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-xl border border-accent/30 bg-card px-4 py-3 text-sm text-text leading-relaxed focus:border-accent focus:outline-none resize-none min-h-[120px]"
                rows={8}
              />
            ) : (
              <div className="rounded-xl bg-surface/50 px-4 py-3 whitespace-pre-wrap text-sm text-text leading-relaxed">
                {contentText}
              </div>
            )}

            {designPrompt && !editing && (
              <DesignPromptSection prompt={designPrompt} />
            )}
          </>
        );
      })()}

      <SourceMapDisplay sourceMap={result.sourceMap} />

      {/* Warning when external references were used */}
      {(result.source === "references_only" || result.source === "both") && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-blue/20 bg-blue/5 px-3 py-2">
          <span className="text-blue text-[11px]">↗</span>
          <span className="text-[11px] text-blue">
            {result.source === "both"
              ? "Este conteudo usa a base do Pedro + referencias externas. Verifique antes de publicar."
              : "Este conteudo foi gerado a partir de referencias externas, nao da base do Pedro."}
          </span>
        </div>
      )}

      {/* Image prompt for user to copy to their preferred AI tool */}
      {result.imagePrompt && (
        <ImagePromptDisplay prompt={result.imagePrompt} />
      )}

      {/* Generated image preview */}
      {generatedImageUrl && (
        <div className="mt-3 rounded-xl border border-violet/20 bg-violet/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-violet">
              Imagem gerada
            </span>
            <a
              href={generatedImageUrl}
              download={`${result.contentType}-image.webp`}
              className="flex items-center gap-1 rounded-lg bg-violet/10 px-2.5 py-1 font-mono text-[11px] text-violet transition hover:bg-violet/20"
            >
              Baixar
            </a>
          </div>
          <img
            src={generatedImageUrl}
            alt="Imagem gerada por IA"
            className="w-full max-w-md rounded-lg border border-border"
          />
        </div>
      )}

      {/* Image generation error */}
      {imageError && (
        <div className="mt-3 rounded-xl border border-red/20 bg-red/5 px-3 py-2 text-xs text-red">
          {imageError}
        </div>
      )}

      {/* Uploaded external image preview */}
      {uploadedImageUrl && (
        <div className="mt-3 rounded-xl border border-green/20 bg-green/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-green">
              Imagem anexada
            </span>
            <span className="rounded-full bg-green/10 px-2 py-0.5 font-mono text-[10px] text-green">
              Salvo
            </span>
          </div>
          {(() => {
            // Handle multiple images (JSON array)
            try {
              const urls = JSON.parse(uploadedImageUrl);
              if (Array.isArray(urls)) {
                return (
                  <div className="grid grid-cols-3 gap-2">
                    {urls.map((url: string, i: number) => (
                      <img key={i} src={url} alt={`Slide ${i + 1}`} className="w-full rounded-lg border border-border" />
                    ))}
                  </div>
                );
              }
            } catch {
              // Single URL
            }
            return <img src={uploadedImageUrl} alt="Imagem do post" className="w-full max-w-md rounded-lg border border-border" />;
          })()}
        </div>
      )}

      {/* Upload external image (Claude Design etc) */}
      {!uploadedImageUrl && !generatedImageUrl && (
        <div className="mt-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface/30 px-4 py-6 transition-colors hover:border-accent/40 hover:bg-surface/50">
            <input
              type="file"
              accept="image/*"
              multiple={result.contentType === "instagram_carousel"}
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span className="font-mono text-xs text-accent">Subindo imagem...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-text-muted" />
                <span className="font-mono text-xs text-text-muted">
                  {result.contentType === "instagram_carousel"
                    ? "Upload das imagens do carrossel (múltiplas)"
                    : "Upload da imagem do post (Claude Design, Canva, etc)"}
                </span>
              </>
            )}
          </label>
        </div>
      )}

      {/* Refine chat */}
      <div className="space-y-2 rounded-xl border border-accent/20 bg-accent/5 p-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            Ajustar com IA
          </span>
        </div>

        {refineHistory.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1.5 rounded-lg bg-surface/50 p-2">
            {refineHistory.map((msg, i) => (
              <div
                key={i}
                className={`text-xs leading-relaxed ${
                  msg.role === "user" ? "text-text font-medium" : "text-text-muted italic"
                }`}
              >
                <span className={`font-mono text-[9px] uppercase ${msg.role === "user" ? "text-accent" : "text-green"}`}>
                  {msg.role === "user" ? "Voce" : "IA"}:
                </span>{" "}
                {msg.text}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={refineInput}
            onChange={(e) => setRefineInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && !e.shiftKey && refineInput.trim()) {
                e.preventDefault();
                const userMsg = refineInput.trim();
                setRefineHistory((prev) => [...prev, { role: "user", text: userMsg }]);
                setRefineInput("");
                setRefining(true);
                const res = await refineContent(
                  result.id, text, userMsg, result.contentType,
                  true, result.imagePrompt,
                );
                if ("error" in res) {
                  setRefineHistory((prev) => [...prev, { role: "ai", text: `Erro: ${res.error}` }]);
                } else {
                  setText(res.text);
                  if (res.imagePrompt) {
                    result.imagePrompt = res.imagePrompt;
                  }
                  setRefineHistory((prev) => [...prev, { role: "ai", text: res.imagePrompt ? "Pronto, ajustei texto e prompt de imagem." : "Pronto, ajustei." }]);
                }
                setRefining(false);
              }
            }}
            placeholder="Ex: encurta, muda o tom, tira hashtags, muda o design..."
            disabled={refining}
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={async () => {
              if (!refineInput.trim()) return;
              const userMsg = refineInput.trim();
              setRefineHistory((prev) => [...prev, { role: "user", text: userMsg }]);
              setRefineInput("");
              setRefining(true);
              const res = await refineContent(
                result.id, text, userMsg, result.contentType,
                true, result.imagePrompt,
              );
              if ("error" in res) {
                setRefineHistory((prev) => [...prev, { role: "ai", text: `Erro: ${res.error}` }]);
              } else {
                setText(res.text);
                if (res.imagePrompt) {
                  result.imagePrompt = res.imagePrompt;
                }
                setRefineHistory((prev) => [...prev, { role: "ai", text: res.imagePrompt ? "Pronto, ajustei texto e prompt de imagem." : "Pronto, ajustei." }]);
              }
              setRefining(false);
            }}
            disabled={refining || !refineInput.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 font-mono text-xs font-bold text-bg transition hover:bg-accent-hover disabled:opacity-50"
          >
            {refining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* SlideDesigner for carousels */}
      {result.contentType === "instagram_carousel" && (
        <div className="mt-4">
          <CarouselDesignPreview content={text} wizardState={wizardState} />
        </div>
      )}

      {/* Story suggestions — histórias que cabem neste post */}
      {result.storySuggestions && result.storySuggestions.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber/20 bg-amber/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <BookMarked className="h-3.5 w-3.5 text-amber" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber">
              Historias que cabem neste post
            </span>
          </div>
          {result.storySuggestions.map((story) => {
            const isAdded = addedStoryIds.has(story.id);
            const isAdding = addingStoryId === story.id;
            return (
              <div
                key={story.id}
                className={`flex items-start gap-3 rounded-lg p-2.5 transition ${
                  isAdded ? "bg-green/10 border border-green/20" : "bg-card/50 border border-border/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text">{story.title}</p>
                  {story.summary && (
                    <p className="mt-0.5 text-[11px] text-text-muted line-clamp-2">{story.summary}</p>
                  )}
                  <p className="mt-1 text-[11px] text-amber italic">
                    {isAdded ? "Historia adicionada ao post!" : story.suggestion}
                  </p>
                </div>
                {!isAdded && (
                  <button
                    onClick={async () => {
                      setAddingStoryId(story.id);
                      const res = await addStoryToContent(result.id, story.id, text, result.contentType);
                      if (!("error" in res)) {
                        setText(res.text);
                        setAddedStoryIds((prev) => new Set(prev).add(story.id));
                      }
                      setAddingStoryId(null);
                    }}
                    disabled={isAdding || addingStoryId !== null}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-amber/15 px-2.5 py-1.5 font-mono text-[10px] font-bold text-amber transition hover:bg-amber/25 disabled:opacity-50"
                  >
                    {isAdding ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {isAdding ? "Adicionando..." : "Adicionar"}
                  </button>
                )}
                {isAdded && (
                  <span className="flex shrink-0 items-center gap-1 rounded-lg bg-green/15 px-2.5 py-1.5 font-mono text-[10px] font-bold text-green">
                    <Check className="h-3 w-3" />
                    Adicionada
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

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

        <button
          onClick={async () => {
            setGeneratingImage(true);
            setImageError(null);
            const res = await generateImageForContent(result.id, text, result.contentType);
            if ("error" in res) {
              setImageError(res.error);
            } else {
              setGeneratedImageUrl(res.imageUrl);
            }
            setGeneratingImage(false);
          }}
          disabled={generatingImage}
          className="flex items-center gap-1.5 rounded-xl border border-violet/30 bg-violet/10 px-3 py-1.5 font-mono text-xs text-violet transition hover:bg-violet/20 disabled:opacity-50"
        >
          {generatingImage ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ImageIcon className="h-3 w-3" />
          )}
          {generatingImage ? "Gerando..." : "Gerar Imagem"}
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
  stories: _stories,
  themes,
}: {
  playbooks: PlaybookOption[];
  stories: StoryOption[];
  themes: ThemeOption[];
}) {
  const [step, setStep] = useState<WizardStep>("source");
  const [state, setState] = useState<WizardState>(initialState);
  const [generating, setGenerating] = useState(false);
  const [regeneratingType, setRegeneratingType] = useState<string | null>(null);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [error, setError] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [customTopic, setCustomTopic] = useState(false);

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

  // Auto-advance when a type is selected (go to details step)
  function selectTypeAndAdvance(t: ContentType) {
    setState((prev) => {
      const sel = prev.selectedTypes.includes(t)
        ? prev.selectedTypes.filter((x) => x !== t)
        : [...prev.selectedTypes, t];
      return { ...prev, selectedTypes: sel };
    });
    // Small delay so user sees the selection before advancing
    if (!state.selectedTypes.includes(t)) {
      setTimeout(() => setStep("details"), 200);
    }
  }

  const canNext = useMemo(() => {
    switch (step) {
      case "source":
        return state.topic.trim().length > 0;
      case "types":
        return state.selectedTypes.length > 0;
      case "details":
        return true;
      default:
        return false;
    }
  }, [step, state.topic, state.selectedTypes]);

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
    setElapsedSeconds(0);

    // Start timer so user sees progress
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);

    startTransition(async () => {
      try {
        const payload = {
          source: state.source,
          topic: state.topic,
          recorte: state.recorte || undefined,
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
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[GenerationWizard] Error:", msg);
        setError(msg.includes("timeout") || msg.includes("504")
          ? "A geracao demorou demais. Tente novamente com menos tipos selecionados."
          : `Erro ao gerar conteudo: ${msg.slice(0, 200)}`);
      } finally {
        clearInterval(timer);
        setGenerating(false);
      }
    });
  }

  async function handleRegenerate(contentType: ContentType) {
    setRegeneratingType(contentType);
    try {
      const payload = {
        source: state.source,
        topic: state.topic,
        recorte: state.recorte || undefined,
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

        {/* Temas macro da base de conhecimento */}
        <div>
          <FieldLabel>Sobre o que quer falar?</FieldLabel>

          {themes.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {themes.map((theme) => {
                const isSelected = !customTopic && state.topic === theme.name;
                const color = theme.color || "#d4783c";
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setCustomTopic(false);
                      updateState("topic", isSelected ? "" : theme.name);
                    }}
                    className={`rounded-xl border-2 px-4 py-3 text-center text-sm font-medium transition-all ${
                      isSelected
                        ? "shadow-sm"
                        : "border-border bg-card text-text-muted hover:text-text"
                    }`}
                    style={
                      isSelected
                        ? { borderColor: color, backgroundColor: color + "18", color }
                        : undefined
                    }
                  >
                    {theme.name}
                  </button>
                );
              })}

              {/* Outro tema */}
              <button
                type="button"
                onClick={() => {
                  setCustomTopic(true);
                  updateState("topic", "");
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                  customTopic
                    ? "border-accent bg-accent/10 text-accent shadow-sm"
                    : "border-dashed border-border bg-card text-text-muted hover:border-accent/40 hover:text-text"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Outro tema
              </button>
            </div>
          )}

          {themes.length === 0 && (
            <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-text-muted">
              Nenhum tema cadastrado. Adicione temas na Base de Conhecimento.
            </p>
          )}

          {customTopic && (
            <textarea
              autoFocus
              value={state.topic}
              onChange={(e) => updateState("topic", e.target.value)}
              placeholder="Ex: venda de empresa, TikTok Shop, como escalar e-commerce..."
              rows={2}
              className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
            />
          )}

          <p className="mt-2 text-[11px] text-text-muted">
            A IA cruza todos os dados da base sobre o tema escolhido. Mesmo repetindo, o conteudo sera sempre diferente.
          </p>
        </div>

        <TextField
          label="Recorte especifico (opcional)"
          value={state.recorte}
          onChange={(v) => updateState("recorte", v)}
          placeholder="Angulo ou recorte especifico"
        />

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
                onClick={() => selectTypeAndAdvance(t.value)}
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
        <p className="text-[10px] text-text-muted">
          Clique para selecionar e avancar. Clique novamente para desmarcar.
        </p>
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
            wizardState={state}
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

      {/* Generating animation with timer */}
      {generating && (
        <div className="animate-slide-in rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-violet/5 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/10 to-violet/10">
            <Sparkles className="h-6 w-6 text-accent animate-pulse" />
          </div>
          <p className="text-sm font-medium text-text">
            {elapsedSeconds < 5
              ? "Analisando base de conhecimento..."
              : elapsedSeconds < 15
                ? "Montando prompt com seus playbooks e historias..."
                : elapsedSeconds < 30
                  ? "Gerando conteudo com Claude AI..."
                  : "Quase la — finalizando a geracao..."}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {state.selectedTypes.length} tipo{state.selectedTypes.length !== 1 ? "s" : ""} de conteudo · {elapsedSeconds}s
          </p>
          <p className="mt-2 text-[11px] text-text-muted">
            Voce pode navegar — a geracao continua no servidor.
          </p>
        </div>
      )}
    </div>
  );
}
