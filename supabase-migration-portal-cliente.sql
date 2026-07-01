-- =====================================================================
-- MIGRATION: Portal do Cliente (Fase 1) — idempotente / reexecutável
-- Rodar no Supabase SQL Editor.
--
-- IMPORTANTE: depois de rodar, Pedro e Henrique precisam fazer LOGOUT + LOGIN
-- para o token JWT pegar o novo app_metadata.role (o backfill grava no banco,
-- mas a sessão só recebe o claim atualizado em um novo login).
-- =====================================================================

create extension if not exists vector;

-- 1) playbooks: flag compartilhável -------------------------------------------
alter table public.playbooks add column if not exists is_shareable boolean not null default false;
create index if not exists idx_playbooks_is_shareable on public.playbooks (is_shareable) where is_shareable = true;

-- 2) Novas tabelas ------------------------------------------------------------
create table if not exists public.consulting_client_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  contact_id uuid references public.consulting_contacts(id) on delete set null,
  name text,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_users_company on public.consulting_client_users(company_id);

create table if not exists public.consulting_chat_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  asked_by_user_id uuid,
  question text not null,
  answer text,
  has_context boolean not null default false,
  pending_question_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_company on public.consulting_chat_messages(company_id, created_at);

create table if not exists public.consulting_pending_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.consulting_companies(id) on delete cascade,
  asked_by_user_id uuid,
  asked_by_name text,
  question text not null,
  status text not null default 'pendente' check (status in ('pendente','respondida')),
  answer text,
  answered_by text,
  playbook_id uuid references public.playbooks(id) on delete set null,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists idx_pending_company on public.consulting_pending_questions(company_id);
create index if not exists idx_pending_status  on public.consulting_pending_questions(status);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chat_pending_fk') then
    alter table public.consulting_chat_messages add constraint chat_pending_fk
      foreign key (pending_question_id) references public.consulting_pending_questions(id) on delete set null;
  end if;
end $$;

-- 3) Claims seguros (lêem app_metadata do JWT — NÃO editável pelo usuário) -----
create or replace function public.is_staff() returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('pedro','henrique'), false)
$$;
create or replace function public.client_company_id() returns uuid language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid
$$;

-- 4) Backfill: role da equipe existente user_metadata -> app_metadata ----------
update auth.users set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', raw_user_meta_data ->> 'role')
where raw_user_meta_data ->> 'role' in ('pedro','henrique')
  and coalesce(raw_app_meta_data ->> 'role', '') = '';

-- 5) Trigger: novo usuário nasce NEUTRO ('membro'); nunca 'henrique' por padrão -
do $$ declare c text; begin
  select conname into c from pg_constraint
   where conrelid = 'public.users'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%role%';
  if c is not null then execute format('alter table public.users drop constraint %I', c); end if;
end $$;
alter table public.users add constraint users_role_check check (role in ('pedro','henrique','cliente','membro'));
alter table public.users alter column role set default 'membro';

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name, role) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    coalesce(new.raw_app_meta_data ->> 'role', 'membro')   -- app_metadata manda; neutro por padrão
  ) on conflict (id) do nothing;
  return new;
end $$;

-- 6) RPC: playbooks compartilháveis por similaridade (mesmo espaço vetorial) ---
create or replace function public.match_shareable_playbooks(
  query_embedding vector(1536), match_threshold float default 0.3, match_count int default 5
) returns table (id uuid, title text, body_markdown text, similarity float) language sql stable as $$
  select p.id, p.title, p.body_markdown, 1 - (p.embedding <=> query_embedding) as similarity
  from public.playbooks p
  where p.embedding is not null and p.is_shareable = true
    and 1 - (p.embedding <=> query_embedding) > match_threshold
  order by p.embedding <=> query_embedding
  limit match_count
$$;

-- 7) LOCKDOWN GERAL: toda tabela vira staff-only (cliente/anon = nada direto) --
--    Cliente externo também é 'authenticated'; sem isto, herdaria acesso total.
do $$ declare r record; p record; begin
  for r in select tablename from pg_tables where schemaname = 'public'
           and tablename <> 'google_calendar_tokens'   -- preserva policy own_tokens (user_id = auth.uid())
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
    execute format('revoke all on public.%I from anon;', r.tablename);
    for p in select policyname from pg_policies where schemaname='public' and tablename=r.tablename loop
      execute format('drop policy if exists %I on public.%I;', p.policyname, r.tablename);
    end loop;
    execute format('create policy "staff_full" on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff());', r.tablename);
  end loop;
end $$;

-- 8) CAMADA CLIENTE: políticas POR EMPRESA nas tabelas que o cliente usa -------
--    (adicionadas por cima do staff_full; sem estas, is_staff() bloquearia o próprio cliente)
--    Obs.: consulting_companies e consulting_meetings ficam staff-only de propósito
--    (evita vazar contract_value/payment_status/notes e transcript). Nome da
--    empresa e resumos chegam ao portal só via server action (service_role).
create policy "client_read_chat" on public.consulting_chat_messages
  for select to authenticated using (company_id = public.client_company_id());
create policy "client_self_mapping" on public.consulting_client_users
  for select to authenticated using (user_id = auth.uid());
create policy "client_read_shareable_playbooks" on public.playbooks
  for select to authenticated using (is_shareable = true);
