-- =====================================================================
-- MIGRATION: Cases de Empresas — idempotente / reexecutável
-- Rodar no Supabase SQL Editor ANTES do deploy da feature (a página
-- mostra aviso amigável se as tabelas não existirem, mas o ideal é
-- rodar primeiro).
-- =====================================================================

create table if not exists public.company_cases (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- nome da empresa
  sector text,                           -- setor/segmento
  summary text,                          -- o que a empresa fez
  results text,                          -- números/resultados
  pedro_angle text,                      -- o ângulo/opinião do Pedro (gancho da análise)
  notes text,
  analysis jsonb,                        -- {"hook","caption","slides":[{"title","text"}]}
  analysis_generated_at timestamptz,
  created_by uuid references public.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_case_photos (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.company_cases(id) on delete cascade,
  storage_path text not null,            -- caminho no bucket company-cases
  caption text,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_case_photos_case
  on public.company_case_photos(case_id, ordem);

-- RLS staff-only (mesmo padrão is_staff() das tabelas internas)
alter table public.company_cases enable row level security;
alter table public.company_case_photos enable row level security;
revoke all on public.company_cases from anon;
revoke all on public.company_case_photos from anon;

drop policy if exists "staff_full" on public.company_cases;
create policy "staff_full" on public.company_cases
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff_full" on public.company_case_photos;
create policy "staff_full" on public.company_case_photos
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Bucket PRIVADO para as fotos reais dos cases. Sem policies de storage =
-- só o service_role acessa; o app faz upload/leitura via server action
-- (admin client) + signed URLs de 1h — mesmo padrão do consulting-docs.
insert into storage.buckets (id, name, public)
values ('company-cases', 'company-cases', false)
on conflict (id) do nothing;

-- Verificação (opcional):
--   select tablename, rowsecurity from pg_tables
--   where tablename in ('company_cases','company_case_photos');
--   select id, public from storage.buckets where id = 'company-cases';
