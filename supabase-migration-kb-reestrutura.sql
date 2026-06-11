-- =============================================
-- Migração: Reestruturação da Base de Conhecimento
-- ADITIVA: mantém campos antigos, acrescenta novos
-- Reversível: DROP COLUMN / DROP TABLE para desfazer
-- =============================================

-- ============================================================
-- 1. TEMAS — adicionar hierarquia (parent_id = subtema)
-- ============================================================
ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.themes ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;

-- Índice para buscar subtemas de um tema
CREATE INDEX IF NOT EXISTS idx_themes_parent_id ON public.themes(parent_id);

COMMENT ON COLUMN public.themes.parent_id IS 'null = tema raiz; preenchido = subtema. MÁXIMO 2 níveis.';

-- ============================================================
-- 2. PLAYBOOKS — campos estruturados + proveniência + relações
-- ============================================================
ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS subtema_id uuid REFERENCES public.themes ON DELETE SET NULL,
  -- Estrutura (substitui o body_markdown solto)
  ADD COLUMN IF NOT EXISTS estrutura jsonb DEFAULT '{}',
  -- Proveniência (rastreabilidade)
  ADD COLUMN IF NOT EXISTS proveniencia jsonb DEFAULT '{}',
  -- Relações (grafo)
  ADD COLUMN IF NOT EXISTS relacoes jsonb DEFAULT '{}',
  -- Perguntas abertas gap-driven
  ADD COLUMN IF NOT EXISTS perguntas_abertas jsonb DEFAULT '[]',
  -- Status workflow
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'revisado', 'publicado')),
  -- Embedding para busca de similaridade (título + princípio)
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Índice para busca vetorial (requer extensão pgvector)
-- Se pgvector não estiver habilitado, rode: CREATE EXTENSION IF NOT EXISTS vector;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_playbooks_embedding ON public.playbooks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_playbooks_subtema ON public.playbooks(subtema_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON public.playbooks(status);

/*
  Formato esperado de 'estrutura':
  {
    "quando_aplica": "...",
    "erro_comum": "...",
    "principio": "...",
    "passos": [
      { "titulo": "...", "como_executar": ["..."] }
    ],
    "por_que_importa": "...",
    "exemplos": [
      { "texto": "...", "tipo": "vivido_por_voce|caso_de_terceiro", "proveniencia": "pedro|outros" }
    ]
  }

  Formato esperado de 'proveniencia':
  {
    "fonte_input_id": "uuid ou null",
    "fonte_tipo": "granola|youtube|texto",
    "trechos_fonte": [
      { "citacao_verbatim": "...", "timestamp": "..." }
    ],
    "nivel": "dito_por_voce|sintetizado|fonte_externa",
    "autor": "pedro|outros"
  }

  Formato esperado de 'relacoes':
  {
    "faz_parte_de": ["playbook_id", ...],
    "relacionado_a": ["playbook_id", ...],
    "historias_relacionadas": ["historia_pessoal_id", ...]
  }

  Formato esperado de 'perguntas_abertas':
  [
    {
      "campo_alvo": "passos[2].como_executar",
      "pergunta": "...",
      "trecho_gatilho": "...",
      "status": "aberta|respondida"
    }
  ]
*/

-- ============================================================
-- 3. HISTÓRIAS PESSOAIS (standalone) — entidade nova
-- ============================================================
CREATE TABLE IF NOT EXISTS public.historias_pessoais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  corpo_longo text, -- narrativa completa, enriquecida ao longo do tempo

  -- Estrutura Epiphany Bridge (Brunson, Segredo #8)
  estrutura_epiphany jsonb DEFAULT '{}',
  /*
    {
      "backstory": "onde você estava antes do aha",
      "desejo_externo": "o que queria alcançar (superfície)",
      "desejo_interno": "a luta interna real",
      "parede": "o obstáculo que iniciou a jornada",
      "epifania": "o aha / a nova oportunidade",
      "plano": "o que você montou",
      "conflito": "o que deu errado no caminho",
      "conquista": "o resultado final",
      "transformacao": "quem você virou no processo"
    }
  */

  -- Proveniência — autor SEMPRE "pedro"; terceiro nunca vira história pessoal
  proveniencia jsonb DEFAULT '{}',

  completude integer DEFAULT 0 CHECK (completude >= 0 AND completude <= 100),
  perguntas_abertas jsonb DEFAULT '[]',

  tema_id uuid REFERENCES public.themes ON DELETE SET NULL,

  created_by uuid REFERENCES public.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historias_pessoais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read historias_pessoais" ON public.historias_pessoais
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage historias_pessoais" ON public.historias_pessoais
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 4. PROPOSTAS — enriquecer com decisão, diff, itens afetados
-- ============================================================
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS decisao text CHECK (decisao IN ('NOVO', 'COMPLEMENTA', 'DUPLICATA')),
  ADD COLUMN IF NOT EXISTS playbook_alvo_id uuid REFERENCES public.playbooks ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tema_sugerido text,
  ADD COLUMN IF NOT EXISTS subtema_sugerido text,
  ADD COLUMN IF NOT EXISTS diff jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS itens_afetados jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resumo_para_pedro text,
  -- Candidato completo no schema novo (playbook/história extraído)
  ADD COLUMN IF NOT EXISTS candidato jsonb DEFAULT '{}';

-- Atualizar constraint de status para incluir 'edited'
-- (já existe 'edited' no check atual? Verificar — se não, ALTER)
-- A constraint original permite: pending, approved, rejected, edited — OK

/*
  Formato esperado de 'diff':
  [
    { "campo": "passos[3].como_executar", "atual": "...", "proposto": "..." }
  ]

  Formato esperado de 'itens_afetados':
  [
    { "id": "uuid", "titulo": "...", "por_que": "..." }
  ]

  Formato esperado de 'candidato':
  O playbook ou história completo no schema novo (estrutura, proveniencia, etc.)
*/

-- ============================================================
-- 5. FUNÇÃO HELPER: buscar playbooks por similaridade de embedding
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_playbooks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  title text,
  principio text,
  tema_name text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    (p.estrutura->>'principio')::text AS principio,
    t.name AS tema_name,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.playbooks p
  LEFT JOIN public.themes t ON t.id = p.theme_id
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 6. TRIGGER: atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Para historias_pessoais
DROP TRIGGER IF EXISTS set_updated_at_historias_pessoais ON public.historias_pessoais;
CREATE TRIGGER set_updated_at_historias_pessoais
  BEFORE UPDATE ON public.historias_pessoais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- NOTA: Extensão pgvector
-- Se não estiver habilitada no Supabase, rode:
-- CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
-- Ou habilite via Dashboard > Database > Extensions > vector
-- ============================================================
