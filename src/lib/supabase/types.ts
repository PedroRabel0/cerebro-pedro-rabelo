export interface ApiCostLog {
  id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

export type UserRole = "pedro" | "henrique";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  parent_id?: string | null; // null = tema raiz; preenchido = subtema. Máx 2 níveis
  ordem?: number;
  created_at: string;
  updated_at: string;
  subtemas?: Theme[]; // populated by joins
}

// --- Playbook: estrutura decontextualizada ---

export interface PlaybookPasso {
  titulo: string;
  como_executar: string[];
}

export interface PlaybookExemplo {
  texto: string;
  tipo: "vivido_por_voce" | "caso_de_terceiro";
  proveniencia: "pedro" | "outros";
}

export interface PlaybookEstrutura {
  quando_aplica?: string;
  erro_comum?: string;
  principio?: string;
  passos?: PlaybookPasso[];
  por_que_importa?: string;
  exemplos?: PlaybookExemplo[];
}

export interface TrechoFonte {
  citacao_verbatim: string;
  timestamp?: string;
}

export type ProvenanciaFonteTipo = "granola" | "youtube" | "texto";
export type ProvenanciaLevel = "dito_por_voce" | "sintetizado" | "fonte_externa";
export type ProvenanciaAutor = "pedro" | "outros";

export interface PlaybookProveniencia {
  fonte_input_id?: string | null;
  fonte_tipo?: ProvenanciaFonteTipo;
  trechos_fonte?: TrechoFonte[];
  nivel?: ProvenanciaLevel;
  autor?: ProvenanciaAutor;
}

export interface PlaybookRelacoes {
  faz_parte_de?: string[];
  relacionado_a?: string[];
  historias_relacionadas?: string[];
}

export type PerguntaStatus = "aberta" | "respondida";

export interface PerguntaAberta {
  campo_alvo: string;
  pergunta: string;
  trecho_gatilho: string;
  status: PerguntaStatus;
}

export type PlaybookStatus = "rascunho" | "revisado" | "publicado";

export interface Playbook {
  id: string;
  theme_id: string | null;
  subtema_id?: string | null;
  title: string;
  subtitle: string | null;
  body_markdown: string | null; // mantido (legado)
  // Novos campos estruturados (opcionais — DB tem defaults)
  estrutura?: PlaybookEstrutura;
  proveniencia?: PlaybookProveniencia;
  relacoes?: PlaybookRelacoes;
  perguntas_abertas?: PerguntaAberta[];
  status?: PlaybookStatus;
  // Campos legado de completude (mantidos para compatibilidade)
  completeness_score: number;
  has_example: boolean;
  has_story: boolean;
  has_origin: boolean;
  has_counterexample: boolean;
  version_current: Record<string, unknown> | null;
  version_previous: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  theme?: Theme;
  subtema?: Theme;
}

export interface Story {
  id: string;
  title: string;
  summary: string | null;
  body_markdown: string | null;
  period: string | null;
  tags: string[];
  lesson: string | null;
  version_current: Record<string, unknown> | null;
  version_previous: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  themes?: Theme[];
}

// --- História Pessoal (standalone) — formato Epiphany Bridge ---

export interface EstruturaEpiphany {
  backstory?: string;
  desejo_externo?: string;
  desejo_interno?: string;
  parede?: string;
  epifania?: string;
  plano?: string;
  conflito?: string;
  conquista?: string;
  transformacao?: string;
}

export interface HistoriaPessoal {
  id: string;
  titulo: string;
  corpo_longo: string | null;
  estrutura_epiphany: EstruturaEpiphany;
  proveniencia: PlaybookProveniencia; // autor SEMPRE "pedro"
  completude: number; // 0-100
  perguntas_abertas: PerguntaAberta[];
  tema_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tema?: Theme;
}

export interface ReferenceProfile {
  id: string;
  platform: string;
  handle: string;
  display_name: string;
  last_scraped_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferencePost {
  id: string;
  profile_id: string;
  platform: string;
  url: string | null;
  thumbnail_url: string | null;
  caption_text: string | null;
  likes: number | null;
  comments: number | null;
  engagement_rate: number | null;
  dna_hook_type: string | null;
  dna_structure: string | null;
  dna_length: string | null;
  dna_tone: string | null;
  dna_cta_type: string | null;
  dna_main_theme: string | null;
  dna_sub_theme: string | null;
  dna_thesis: string | null;
  saved_as_reference: boolean | null;
  posted_at: string | null;
  scraped_at: string;
}

export type CaptureSourceType = "transcript" | "pdf" | "youtube" | "manual";
export type CaptureStatus = "pending" | "processed" | "archived";

export interface Capture {
  id: string;
  title: string;
  context: string | null;
  source_type: CaptureSourceType;
  source_url: string | null;
  raw_content: string | null;
  processed_at: string | null;
  speaker_verified: boolean;
  status: CaptureStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProposalType = "playbook" | "story" | "question" | "instagram_carousel" | "linkedin_post" | "x_thread";
export type ProposalStatus = "pending" | "approved" | "rejected" | "edited";
export type ProposalDecisao = "NOVO" | "COMPLEMENTA" | "DUPLICATA";

export interface ProposalDiff {
  campo: string;
  atual: string;
  proposto: string;
}

export interface ProposalItemAfetado {
  id: string;
  titulo: string;
  por_que: string;
}

export interface Proposal {
  id: string;
  capture_id: string;
  type: ProposalType;
  title: string;
  content_markdown: string | null;
  suggested_theme_id: string | null;
  suggested_tags: string[];
  status: ProposalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // Campos legado (content generation)
  caption?: string;
  hashtags?: string[];
  hook?: string;
  cta?: string;
  slides?: string[];
  platform?: string;
  // Novos campos da reconciliação (opcionais — DB tem defaults)
  decisao?: ProposalDecisao | null;
  playbook_alvo_id?: string | null;
  tema_sugerido?: string | null;
  subtema_sugerido?: string | null;
  diff?: ProposalDiff[];
  itens_afetados?: ProposalItemAfetado[];
  resumo_para_pedro?: string | null;
  candidato?: Record<string, unknown>; // playbook/história no schema novo
}

export type ActivityActor = "ia" | "pedro" | "henrique";

export interface ActivityLogEntry {
  id: string;
  actor: ActivityActor;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_title: string | null;
  created_at: string;
}

export interface ReferenceKnowledge {
  id: string;
  author: string | null;
  source_type: string | null;
  source_url: string | null;
  title: string;
  extracted_playbooks: Record<string, unknown> | null;
  tags: string[];
  citation_allowed: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentType =
  | "instagram_reel"
  | "instagram_carousel"
  | "instagram_carousel_educativo"
  | "instagram_static"
  | "youtube_long"
  | "youtube_short"
  | "linkedin_post"
  | "x_thread"
  | "x_tweet";

export type CalendarStatus = "scheduled" | "published" | "missed" | "cancelled";
export type Platform = "instagram" | "linkedin" | "x" | "youtube";

export interface CalendarEntry {
  id: string;
  content_id: string | null;
  title: string;
  content_type: string;
  scheduled_for: string;
  status: CalendarStatus;
  platform: Platform;
  notes: string | null;
  created_at: string;
  updated_at: string;
  content?: GeneratedContent | null;
}

export interface ContentFormat {
  id: string;
  name: string;
  content_type: ContentType;
  description: string | null;
  structure_markdown: string | null;
  reference_urls: string[];
  reference_screenshots: string[];
  usage_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export type SourceType = "base_only" | "references_only" | "both" | "free_text";
// --- Content Metrics (Analytics) ---
export interface ContentMetric {
  id: string;
  content_id: string | null;
  title: string;
  platform: string;
  content_type: string | null;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
  views: number;
  engagement_rate: number;
  posted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// --- Trends ---
export type TrendStatus = "pending" | "analyzed";

export interface Trend {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  source_text: string | null;
  analysis: string | null;
  suggested_angles: { angle: string; why: string }[];
  status: TrendStatus;
  created_at: string;
  updated_at: string;
}

// --- FAQ Responses (Pedro Clone) ---
export interface FaqResponse {
  id: string;
  question: string;
  answer: string;
  category: string;
  source: "manual" | "generated";
  used_count: number;
  created_at: string;
  updated_at: string;
}

// --- Newsletters ---
export type NewsletterStatus = "draft" | "approved" | "sent";

export interface Newsletter {
  id: string;
  title: string;
  subject: string;
  body_markdown: string;
  status: NewsletterStatus;
  week_label: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
}

// --- Voice Snapshots ---
export interface VoiceSnapshot {
  id: string;
  snapshot_date: string;
  tone_descriptors: string | null;
  voice_uses: string[];
  voice_avoids: string[];
  positioning: string | null;
  opening_style: string | null;
  closing_style: string | null;
  analysis: string | null;
  comparison_with_previous: string | null;
  created_at: string;
}

// --- News Hub ---
export interface NewsTheme {
  id: string;
  name: string;
  keywords: string[];
  active: boolean;
  created_at: string;
}

export interface NewsArticle {
  id: string;
  theme_id: string | null;
  title: string;
  description: string | null;
  url: string;
  source_name: string | null;
  image_url: string | null;
  published_at: string | null;
  pedro_angle: string | null;
  created_at: string;
}

export interface NewsDigest {
  id: string;
  theme_id: string | null;
  theme_name: string;
  period: string;
  digest_markdown: string;
  pedro_angles: { angle: string; news: string }[];
  articles_count: number;
  created_at: string;
}

export type ContentStatus = "draft" | "approved" | "published";

export interface GeneratedContent {
  id: string;
  playbook_id: string | null;
  story_id: string | null;
  reference_knowledge_ids: string[];
  source_type: SourceType;
  free_text_input: string | null;
  content_type: ContentType;
  format_id: string | null;
  generation_params: Record<string, unknown> | null;
  content_text: string | null;
  image_prompt: string | null;
  image_url: string | null;
  image_model: string | null;
  source_map: Record<string, unknown> | null;
  status: ContentStatus;
  published_url: string | null;
  feedback_rating: string | null;
  feedback_text: string | null;
  created_at: string;
  updated_at: string;
  playbook?: { id: string; title: string } | null;
  story?: { id: string; title: string } | null;
  format?: ContentFormat | null;
}

// --- Trend Scans (Radar de Referências) ---
export interface TrendScan {
  id: string;
  scanned_at: string;
  profiles_scanned: number;
  total_posts_analyzed: number;
  new_posts_found: number;
  cross_profile_insights: string | null;
  top_themes: { theme: string; count: number; profiles: string[] }[];
  content_recommendations: { title: string; hook: string; format: string; why: string; inspired_by: string }[];
  per_profile_summary: { profile_id: string; handle: string; display_name: string; platform: string; posts_count: number; top_themes: string[]; avg_engagement: number; highlight: string }[];
  created_at: string;
}
