-- ============================================================================
-- MODULO DE CONSULTORIA — empresas, contatos, reunioes, tarefas, docs, roadmap
-- ============================================================================
-- Todas as tabelas nascem com RLS ligado + policy authenticated-only (licao do
-- lockdown anterior). O app usa service_role nas server actions (bypassa RLS);
-- usuarios logados (authenticated) tambem tem acesso; anonimo = bloqueado.
-- Idempotente. Rodar no Supabase Dashboard > SQL Editor.
-- ============================================================================

-- 1. Empresas (clientes da consultoria)
create table if not exists public.consulting_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  goal text,
  status text not null default 'ativa' check (status in ('ativa','pausada','concluida')),
  contract_status text not null default 'sem_contrato' check (contract_status in ('sem_contrato','enviado','assinado')),
  contract_value numeric,
  payment_status text not null default 'em_dia' check (payment_status in ('em_dia','pendente','atrasado')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Contatos (pessoas de cada empresa)
create table if not exists public.consulting_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  name text not null,
  role text,
  whatsapp text,
  email text,
  is_primary boolean not null default false,
  consent boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3. Reunioes (transcricao colada + resumo)
create table if not exists public.consulting_meetings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  title text not null,
  held_at timestamptz not null default now(),
  transcript text,
  summary text,
  notes text,
  created_at timestamptz not null default now()
);

-- 4. Tarefas (acoes da reuniao — dono, prazo, lembrete, mensagem pronta)
create table if not exists public.consulting_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  meeting_id uuid references public.consulting_meetings(id) on delete set null,
  contact_id uuid references public.consulting_contacts(id) on delete set null,
  description text not null,
  owner_name text,
  due_date date,
  remind_at date,
  status text not null default 'pendente' check (status in ('pendente','feita','cancelada')),
  message_draft text,
  source text not null default 'manual' check (source in ('manual','ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Documentos (contrato, proposta, etc — arquivo em bucket privado)
create table if not exists public.consulting_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  name text not null,
  storage_path text not null,
  kind text not null default 'outro' check (kind in ('contrato','proposta','outro')),
  created_at timestamptz not null default now()
);

-- 6. Roadmap / passos do plano
create table if not exists public.consulting_steps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  title text not null,
  target_date date,
  status text not null default 'pendente' check (status in ('pendente','feita')),
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

-- Indices uteis
create index if not exists idx_consulting_contacts_company on public.consulting_contacts(company_id);
create index if not exists idx_consulting_meetings_company on public.consulting_meetings(company_id);
create index if not exists idx_consulting_tasks_company on public.consulting_tasks(company_id);
create index if not exists idx_consulting_tasks_status on public.consulting_tasks(status);
create index if not exists idx_consulting_documents_company on public.consulting_documents(company_id);
create index if not exists idx_consulting_steps_company on public.consulting_steps(company_id);

-- RLS + policy authenticated em todas as tabelas novas
do $$
declare
  t text;
  tables text[] := array[
    'consulting_companies','consulting_contacts','consulting_meetings',
    'consulting_tasks','consulting_documents','consulting_steps'
  ];
begin
  foreach t in array tables
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists "auth_full_access" on public.%I', t);
    execute format('create policy "auth_full_access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Bucket PRIVADO para os documentos da consultoria (contratos etc).
-- Upload e leitura sao feitos pelo servidor (service_role) + signed URLs.
insert into storage.buckets (id, name, public)
values ('consulting-docs', 'consulting-docs', false)
on conflict (id) do nothing;
