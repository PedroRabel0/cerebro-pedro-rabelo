-- =============================================
-- Segundo Cérebro do Pedro — Schema SQL
-- Execute no SQL Editor do Supabase
-- =============================================

-- Usuários e permissões
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null default '',
  role text not null check (role in ('pedro', 'henrique')) default 'henrique',
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'henrique'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Temas
create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.themes enable row level security;
create policy "Authenticated users can read themes" on public.themes
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage themes" on public.themes
  for all using (auth.role() = 'authenticated');

-- Playbooks
create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references public.themes on delete set null,
  title text not null,
  subtitle text,
  body_markdown text,
  version_current jsonb,
  version_previous jsonb,
  completeness_score integer default 0 check (completeness_score >= 0 and completeness_score <= 100),
  has_example boolean default false,
  has_story boolean default false,
  has_origin boolean default false,
  has_counterexample boolean default false,
  created_by uuid references public.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.playbooks enable row level security;
create policy "Authenticated users can read playbooks" on public.playbooks
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage playbooks" on public.playbooks
  for all using (auth.role() = 'authenticated');

-- Histórias
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  body_markdown text,
  period text check (period in ('pre-2012', '2012-2017', '2018-2023', '2024-now')),
  tags text[] default '{}',
  lesson text,
  version_current jsonb,
  version_previous jsonb,
  created_by uuid references public.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stories enable row level security;
create policy "Authenticated users can read stories" on public.stories
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage stories" on public.stories
  for all using (auth.role() = 'authenticated');

-- Relação Histórias <-> Temas (N:N)
create table if not exists public.story_themes (
  story_id uuid references public.stories on delete cascade,
  theme_id uuid references public.themes on delete cascade,
  primary key (story_id, theme_id)
);

alter table public.story_themes enable row level security;
create policy "Authenticated users can manage story_themes" on public.story_themes
  for all using (auth.role() = 'authenticated');

-- Identidade (singleton)
create table if not exists public.identity (
  id integer primary key default 1 check (id = 1),
  colors jsonb default '[]',
  fonts jsonb default '{}',
  voice_uses jsonb default '[]',
  voice_avoids jsonb default '[]',
  tone_descriptors jsonb default '[]',
  opening_style text,
  closing_style text,
  positioning text,
  reference_creators jsonb default '[]',
  brandbook_url text,
  updated_at timestamptz not null default now()
);

alter table public.identity enable row level security;
create policy "Authenticated users can read identity" on public.identity
  for select using (auth.role() = 'authenticated');
create policy "Pedro can update identity" on public.identity
  for update using (auth.role() = 'authenticated');

-- Seed identity singleton
insert into public.identity (id) values (1) on conflict do nothing;

-- Capturas (Insights Pedro)
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  context text,
  source_type text not null check (source_type in ('transcript', 'pdf', 'youtube', 'manual')),
  source_url text,
  raw_content text,
  processed_at timestamptz,
  speaker_verified boolean default false,
  status text not null default 'pending' check (status in ('pending', 'processed', 'archived')),
  created_by uuid references public.users on delete set null,
  created_at timestamptz not null default now()
);

alter table public.captures enable row level security;
create policy "Authenticated users can read captures" on public.captures
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage captures" on public.captures
  for all using (auth.role() = 'authenticated');

-- Propostas da IA
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid references public.captures on delete cascade,
  type text not null check (type in ('playbook', 'story', 'question')),
  title text not null,
  content_markdown text,
  suggested_theme_id uuid references public.themes on delete set null,
  suggested_tags text[] default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'edited')),
  reviewed_by uuid references public.users on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.proposals enable row level security;
create policy "Authenticated users can read proposals" on public.proposals
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage proposals" on public.proposals
  for all using (auth.role() = 'authenticated');

-- Timeline de atividade
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null check (actor in ('pedro', 'henrique', 'ia')),
  action text not null,
  entity_type text,
  entity_id uuid,
  entity_title text,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;
create policy "Authenticated users can read activity_log" on public.activity_log
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert activity_log" on public.activity_log
  for insert with check (auth.role() = 'authenticated');

-- Referências (Antena) — Perfis
create table if not exists public.reference_profiles (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'linkedin', 'x', 'youtube')),
  handle text not null,
  display_name text,
  last_scraped_at timestamptz,
  active boolean default true
);

alter table public.reference_profiles enable row level security;
create policy "Authenticated users can manage reference_profiles" on public.reference_profiles
  for all using (auth.role() = 'authenticated');

-- Posts inspiração (Antena)
create table if not exists public.reference_posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.reference_profiles on delete cascade,
  platform text not null,
  url text,
  thumbnail_url text,
  caption_text text,
  likes integer default 0,
  comments integer default 0,
  engagement_rate numeric,
  posted_at timestamptz,
  scraped_at timestamptz default now(),
  dna_hook_type text,
  dna_structure text,
  dna_length text,
  dna_tone text,
  dna_cta_type text,
  dna_main_theme text,
  dna_sub_theme text,
  dna_thesis text,
  saved_as_reference boolean default false
);

alter table public.reference_posts enable row level security;
create policy "Authenticated users can manage reference_posts" on public.reference_posts
  for all using (auth.role() = 'authenticated');

-- Referências de conhecimento de terceiros
create table if not exists public.reference_knowledge (
  id uuid primary key default gen_random_uuid(),
  author text,
  source_type text check (source_type in ('youtube', 'book_pdf', 'article')),
  source_url text,
  title text,
  extracted_playbooks jsonb default '[]',
  tags text[] default '{}',
  citation_allowed text default 'attributed' check (citation_allowed in ('yes', 'attributed', 'no')),
  created_at timestamptz not null default now()
);

alter table public.reference_knowledge enable row level security;
create policy "Authenticated users can manage reference_knowledge" on public.reference_knowledge
  for all using (auth.role() = 'authenticated');

-- Formatos de conteúdo (biblioteca)
create table if not exists public.content_formats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content_type text not null,
  description text,
  structure_markdown text,
  reference_urls jsonb default '[]',
  reference_screenshots jsonb default '[]',
  usage_count integer default 0,
  version integer default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_formats enable row level security;
create policy "Authenticated users can manage content_formats" on public.content_formats
  for all using (auth.role() = 'authenticated');

-- Conteúdos gerados
create table if not exists public.generated_contents (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid references public.playbooks on delete set null,
  story_id uuid references public.stories on delete set null,
  reference_knowledge_ids uuid[] default '{}',
  source_type text not null check (source_type in ('base_only', 'references_only', 'both', 'free_text')),
  free_text_input text,
  content_type text not null,
  format_id uuid references public.content_formats on delete set null,
  generation_params jsonb default '{}',
  content_text text,
  image_prompt text,
  image_url text,
  image_model text,
  source_map jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published')),
  published_url text,
  feedback_rating text check (feedback_rating in ('good', 'good_with_edits', 'bad')),
  feedback_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generated_contents enable row level security;
create policy "Authenticated users can manage generated_contents" on public.generated_contents
  for all using (auth.role() = 'authenticated');

-- API Cost Log
create table if not exists public.api_cost_log (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  task_type text not null,
  tokens_input integer default 0,
  tokens_output integer default 0,
  estimated_cost numeric default 0,
  created_at timestamptz not null default now()
);

alter table public.api_cost_log enable row level security;
create policy "Authenticated users can read api_cost_log" on public.api_cost_log
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert api_cost_log" on public.api_cost_log
  for insert with check (auth.role() = 'authenticated');
