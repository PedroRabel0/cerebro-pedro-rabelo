-- =====================================================================
-- ALINHAMENTO: api_cost_log x logApiCost (src/lib/ai/client.ts)
--
-- O logApiCost grava { provider, model, input_tokens, output_tokens,
-- cost_usd, created_at }, mas o schema VERSIONADO do repo só define
-- colunas antigas (model/task_type/tokens_*/estimated_cost). Se a tabela
-- em produção já tem as colunas novas (provável — o log roda desde a
-- auditoria), este script não muda nada. Se não tiver, ele as cria.
--
-- Também cria o índice usado pelo limite diário do formato Atualidades
-- (count de provider='anthropic-web-search' nas últimas 24h).
--
-- IDEMPOTENTE (add column/index IF NOT EXISTS) — pode rodar mais de uma
-- vez. Rodar no Supabase SQL Editor.
-- =====================================================================

alter table public.api_cost_log add column if not exists provider text;
alter table public.api_cost_log add column if not exists cost_usd numeric;
alter table public.api_cost_log add column if not exists input_tokens integer;
alter table public.api_cost_log add column if not exists output_tokens integer;
alter table public.api_cost_log add column if not exists created_at timestamptz default now();

create index if not exists api_cost_log_provider_created_idx
  on public.api_cost_log (provider, created_at desc);
