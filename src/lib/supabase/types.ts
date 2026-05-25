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
  created_at: string;
  updated_at: string;
}

export interface Playbook {
  id: string;
  theme_id: string | null;
  title: string;
  subtitle: string | null;
  body_markdown: string | null;
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
  shares: number | null;
  saves: number | null;
  hook_type: string | null;
  structure: string | null;
  length: string | null;
  tone: string | null;
  cta_type: string | null;
  main_theme: string | null;
  sub_theme: string | null;
  thesis: string | null;
  saved_as_reference: boolean | null;
  created_at: string;
  updated_at: string;
}

export type CaptureSourceType = "transcription" | "pdf" | "youtube" | "manual";
export type CaptureStatus = "pending" | "processing" | "processed" | "error";

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

export type ProposalType = "playbook" | "story" | "question";
export type ProposalStatus = "pending" | "approved" | "rejected";

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
}

export type ActivityActor = "system" | "pedro" | "henrique";

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
  citation_allowed: boolean | null;
  created_at: string;
  updated_at: string;
}

export type ContentType =
  | "instagram_reel"
  | "instagram_carousel"
  | "instagram_static"
  | "youtube_long"
  | "youtube_short"
  | "linkedin_post"
  | "x_thread"
  | "x_tweet";

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
export type ContentStatus = "draft" | "approved" | "rejected";

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
  feedback_rating: number | null;
  feedback_text: string | null;
  created_at: string;
  updated_at: string;
  playbook?: { id: string; title: string } | null;
  story?: { id: string; title: string } | null;
  format?: ContentFormat | null;
}
