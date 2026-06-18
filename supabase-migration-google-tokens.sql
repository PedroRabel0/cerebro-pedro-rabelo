-- ============================================================================
-- Tokens do Google Calendar (Fase 3 da Consultoria)
-- ============================================================================
-- Guarda o refresh/access token do Google do operador para escrever lembretes
-- na agenda dele. Token e SENSIVEL: a policy restringe leitura ao proprio dono
-- (user_id = auth.uid()); as server actions usam service_role (bypassam RLS).
-- Idempotente. Rodar no Supabase Dashboard > SQL Editor.
-- ============================================================================

create table if not exists public.google_calendar_tokens (
  user_id uuid primary key,
  email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;
revoke all on public.google_calendar_tokens from anon;
drop policy if exists "own_tokens" on public.google_calendar_tokens;
create policy "own_tokens" on public.google_calendar_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
