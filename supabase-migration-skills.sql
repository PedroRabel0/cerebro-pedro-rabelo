-- =============================================
-- Segundo Cérebro do Pedro — Migration: Skills
-- Hooks Bank + Content Calendar + Repurpose Tracking
-- =============================================

-- =============================================
-- 1. Hooks Bank (Banco de Hooks)
-- =============================================

create table if not exists public.hooks (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null check (category in ('curiosidade', 'polêmica', 'autoridade', 'dor', 'história', 'dado', 'pergunta', 'contraintuitivo')),
  content_type text,
  source text check (source in ('manual', 'generated', 'extracted')),
  used_count integer default 0,
  performance_score numeric,
  content_id uuid references public.generated_contents on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hooks enable row level security;
create policy "Authenticated users can read hooks" on public.hooks
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage hooks" on public.hooks
  for all using (auth.role() = 'authenticated');

-- =============================================
-- 2. Content Calendar (Calendário de Conteúdo)
-- =============================================

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.generated_contents on delete cascade,
  title text not null,
  content_type text not null,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'published', 'missed', 'cancelled')),
  platform text not null check (platform in ('instagram', 'linkedin', 'x', 'youtube')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_entries enable row level security;
create policy "Authenticated users can read calendar_entries" on public.calendar_entries
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage calendar_entries" on public.calendar_entries
  for all using (auth.role() = 'authenticated');

-- =============================================
-- 3. Repurpose Tracking (generated_contents)
-- =============================================

alter table public.generated_contents
  add column if not exists repurposed_from uuid references public.generated_contents on delete set null,
  add column if not exists repurpose_group uuid;
