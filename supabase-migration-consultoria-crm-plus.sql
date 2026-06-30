-- ============================================================================
-- CONSULTORIA CRM+ — financeiro recorrente, renovacao, health e vitorias
-- ============================================================================
-- Adiciona ao modulo de consultoria o que faltava para gerir mentorias/board:
--   - Financeiro recorrente (mensalidade/MRR, dia de vencimento)
--   - Datas de contrato + renovacao (para alertar antes de vencer)
--   - last_contact_at (termometro de cliente — risco de esfriar)
--   - Tabela consulting_wins (log de vitorias/resultados por cliente)
--
-- Tudo idempotente (add column if not exists / create table if not exists) e
-- com RLS authenticated-only, no mesmo padrao das demais tabelas da consultoria.
-- Rodar no Supabase Dashboard > SQL Editor.
-- ============================================================================

-- 1. Campos novos em consulting_companies -----------------------------------
alter table public.consulting_companies add column if not exists monthly_fee numeric;       -- mensalidade (R$/mes) -> compoe o MRR
alter table public.consulting_companies add column if not exists billing_day int;            -- dia do vencimento (1-31)
alter table public.consulting_companies add column if not exists contract_start date;        -- inicio do contrato
alter table public.consulting_companies add column if not exists contract_end date;          -- fim/renovacao do contrato
alter table public.consulting_companies add column if not exists last_contact_at timestamptz; -- ultima interacao (health)

-- Constraint defensiva para o dia de vencimento (1-31). Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'consulting_companies_billing_day_chk'
  ) then
    alter table public.consulting_companies
      add constraint consulting_companies_billing_day_chk
      check (billing_day is null or (billing_day >= 1 and billing_day <= 31));
  end if;
end $$;

-- Backfill do last_contact_at: ultima reuniao ja realizada, senao a criacao.
update public.consulting_companies c
set last_contact_at = coalesce(
  (select max(m.held_at) from public.consulting_meetings m
     where m.company_id = c.id and m.held_at <= now()),
  c.created_at
)
where c.last_contact_at is null;

-- 2. Tabela de vitorias / resultados ----------------------------------------
create table if not exists public.consulting_wins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  description text not null,
  metric text,                 -- ex: "+30% faturamento", "dobrou o ticket"
  achieved_on date,
  created_at timestamptz not null default now()
);

create index if not exists idx_consulting_wins_company on public.consulting_wins(company_id);

-- 3. RLS + policy authenticated na tabela nova ------------------------------
alter table public.consulting_wins enable row level security;
revoke all on public.consulting_wins from anon;
drop policy if exists "auth_full_access" on public.consulting_wins;
create policy "auth_full_access" on public.consulting_wins
  for all to authenticated using (true) with check (true);
