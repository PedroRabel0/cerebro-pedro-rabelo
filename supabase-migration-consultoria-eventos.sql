-- ============================================================================
-- Vincular reunioes da consultoria a eventos do Google Calendar
-- ============================================================================
-- Guarda o ID do evento + a agenda, para reunioes agendadas/importadas poderem
-- ser editadas na agenda depois. Idempotente. Rodar no Supabase SQL Editor.
-- ============================================================================

alter table public.consulting_meetings add column if not exists google_event_id text;
alter table public.consulting_meetings add column if not exists google_calendar_id text;
