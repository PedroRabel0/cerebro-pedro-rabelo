-- =====================================================================
-- FIX: prompt de design grudado na legenda (aba Salvos da Geração)
--
-- Registros antigos de instagram_frase / instagram_carousel_educativo
-- salvavam o bloco "---PROMPT DE DESIGN---" DENTRO do content_text — por
-- isso o prompt aparecia na área da legenda do card.
--
-- Este script move o bloco para a coluna image_prompt (onde o painel
-- "Ver Prompt" lê e edita) e deixa o content_text só com a legenda.
-- Só preenche image_prompt se ele estiver diferente/vazio; nunca apaga um
-- prompt já existente com bloco vazio.
--
-- IDEMPOTENTE: após a 1ª execução nenhuma linha contém o marcador — rodar
-- de novo não altera nada. Rodar no Supabase SQL Editor.
-- =====================================================================

update public.generated_contents
set
  image_prompt = coalesce(
    nullif(trim(split_part(content_text, '---PROMPT DE DESIGN---', 2)), ''),
    image_prompt
  ),
  image_model = coalesce(image_model, 'prompt-only'),
  content_text = trim(split_part(content_text, '---PROMPT DE DESIGN---', 1))
where content_text like '%---PROMPT DE DESIGN---%';
