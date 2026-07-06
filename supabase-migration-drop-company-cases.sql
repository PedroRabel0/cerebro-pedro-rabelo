-- =====================================================================
-- LIMPEZA (OPCIONAL): remove a infra da antiga aba "Cases de Empresas"
-- (substituída pelo tipo de conteúdo "Case de Empresa" na Geração, que
--  não usa banco próprio — reusa generated_contents).
--
-- Rodar no Supabase SQL Editor SE quiser remover as tabelas/bucket
-- órfãos. Idempotente. ATENÇÃO: apaga quaisquer cases/fotos que tenham
-- sido criados na aba antiga.
-- =====================================================================

-- 1) Fotos no Storage primeiro (o bucket só pode ser removido vazio)
delete from storage.objects where bucket_id = 'company-cases';
delete from storage.buckets where id = 'company-cases';

-- 2) Tabelas (photos primeiro por causa da FK; cascade cobriria, mas
--    o drop explícito é mais claro)
drop table if exists public.company_case_photos;
drop table if exists public.company_cases;
