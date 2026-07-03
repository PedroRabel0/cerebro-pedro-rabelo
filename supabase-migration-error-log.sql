-- ============================================================
-- ERROR LOG — rastreio persistente de erros de servidor
-- (logs de runtime da Vercel Hobby somem em ~1h; esta tabela
--  recebe todo erro nao tratado via src/instrumentation.ts)
-- Rodar no SQL Editor do Supabase.
-- ============================================================

create table if not exists public.error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  digest text,          -- id do erro que o Next mostra pro usuario ("codigo de suporte")
  stack text,
  path text,            -- URL requisitada (ex.: /consultoria?x=1)
  method text,          -- GET/POST
  route_path text,      -- rota do arquivo (ex.: /(dashboard)/consultoria)
  route_type text       -- render | route | action | proxy
);

create index if not exists idx_error_log_created_at
  on public.error_log (created_at desc);

-- Buscar um erro que o usuario reportou pelo digest exibido na tela:
--   select * from public.error_log where digest = '...' order by created_at desc;

-- RLS: so a equipe le; o insert vem do service_role (bypassa RLS).
alter table public.error_log enable row level security;

drop policy if exists "error_log_staff_read" on public.error_log;
create policy "error_log_staff_read" on public.error_log
  for select using (auth.role() = 'authenticated');

-- Limpeza opcional (manter 90 dias):
--   delete from public.error_log where created_at < now() - interval '90 days';
