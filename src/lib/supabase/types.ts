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
