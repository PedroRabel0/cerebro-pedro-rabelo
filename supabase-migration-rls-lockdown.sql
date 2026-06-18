-- ============================================================================
-- RLS LOCKDOWN — corrige vazamento CRITICO de dados via anon key publica
-- ============================================================================
-- Contexto: a anon key e PUBLICA (vai no bundle do navegador). As tabelas
-- abaixo estavam com RLS DESLIGADO, entao qualquer pessoa lia/escrevia direto
-- pela API REST do Supabase, sem login, contornando o app. Confirmado ao vivo:
-- brain_chats, brain_messages, newsletters, voice_snapshots, content_metrics,
-- faq_responses retornavam dados reais para a anon key.
--
-- Esta migracao habilita RLS e cria uma policy que permite acesso apenas a
-- usuarios AUTENTICADOS. Nao quebra o app:
--   - server actions usam service_role (bypassa RLS) -> continuam funcionando
--   - usuarios logados no navegador usam o role 'authenticated' -> permitidos
--   - anonimos (anon key sem sessao) -> BLOQUEADOS
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- Como rodar: Supabase Dashboard > SQL Editor > cole tudo > Run.
-- ============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'brain_chats',
    'brain_messages',
    'newsletters',
    'voice_snapshots',
    'content_metrics',
    'faq_responses',
    'trends',
    'journal_entries',
    'news_themes',
    'news_articles',
    'news_digests'
  ];
begin
  foreach t in array tables
  loop
    -- so age em tabelas que existem (evita erro se alguma nao existir)
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon', t);
      execute format('drop policy if exists "auth_full_access" on public.%I', t);
      execute format(
        'create policy "auth_full_access" on public.%I for all to authenticated using (true) with check (true)',
        t
      );
      raise notice 'RLS habilitado + policy authenticated em: %', t;
    end if;
  end loop;
end $$;

-- ============================================================================
-- Verificacao (rode depois para confirmar). Deve listar todas com rowsecurity = true:
--   select tablename, rowsecurity from pg_tables
--   where schemaname='public'
--     and tablename in ('brain_chats','brain_messages','newsletters',
--       'voice_snapshots','content_metrics','faq_responses','trends','journal_entries');
-- ============================================================================
