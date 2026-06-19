/**
 * KB Pipeline — Extração, Reconciliação, Classificação, Linkagem, Perguntas
 *
 * Prompts 4.1–4.5 do briefing de reestruturação.
 * Cada função retorna dados estruturados no schema novo.
 */
import { getClient, logCost, parseJSON } from './client';
import { log } from '@/lib/logger';
import { findSimilarPlaybooks, generateEmbedding } from './embeddings';
import { createClient } from '@/lib/supabase/server';
import type {
  PlaybookEstrutura,
  PlaybookProveniencia,
  PlaybookRelacoes,
  PerguntaAberta,
  EstruturaEpiphany,
  ProposalDiff,
  ProposalItemAfetado,
} from '@/lib/supabase/types';

// ============================================================
// Types
// ============================================================

export interface ExtractedPlaybook {
  titulo: string;
  subtitulo?: string;
  estrutura: PlaybookEstrutura;
  proveniencia: PlaybookProveniencia;
}

export interface ExtractedHistoria {
  titulo: string;
  corpo_longo: string;
  estrutura_epiphany: EstruturaEpiphany;
  proveniencia: PlaybookProveniencia;
}

export interface ExtractionResult {
  playbooks: ExtractedPlaybook[];
  historias_pessoais: ExtractedHistoria[];
  detected_type: string;
  title: string;
  summary: string;
  extracted_themes: string[];
  speaker_verified: boolean;
}

export interface ReconciliationInput {
  candidato: ExtractedPlaybook;
  conhecimento_existente: {
    id: string;
    title: string;
    principio: string | null;
    tema_name: string | null;
    similarity: number;
  }[];
  temas_existentes: { id: string; name: string; parent_id: string | null }[];
}

export interface ReconciliationResult {
  decisao: 'NOVO' | 'COMPLEMENTA' | 'DUPLICATA';
  playbook_alvo: string | null;
  tema_sugerido: string;
  subtema_sugerido: string;
  diff: ProposalDiff[];
  itens_afetados: ProposalItemAfetado[];
  resumo_para_pedro: string;
  // Linkagem (4.4) — incluída na mesma chamada
  faz_parte_de: string[];
  relacionado_a: string[];
  merge_sugerido: { playbook_id: string; motivo: string; unico_de_cada: string }[];
}

export interface QuestionsResult {
  perguntas: PerguntaAberta[];
}

export interface MergeAnswerResult {
  campo_atualizado: string;
  novo_valor: string;
  proveniencia_add: PlaybookProveniencia;
  completude: number;
}

// ============================================================
// 4.1 — Prompt de Extração
// ============================================================

const EXTRACTION_SYSTEM_PROMPT = `Voce e o motor de extracao do Segundo Cerebro do Pedro. Recebe um INPUT bruto
(transcricao do Granola, video do YouTube ou texto) e transforma em conhecimento
estruturado e REUTILIZAVEL.

REGRA DE OURO — DECONTEXTUALIZAR
O input e uma conversa especifica. O playbook NAO e. Antes de escrever, abstraia
o principio do caso:
- Remova marcas de conversa: "a proposta discutida foi", "no nosso caso",
  "como falei", "naquela reuniao".
- Tire nomes de empresa/pessoa/reuniao e numeros especificos do CORPO do playbook.
  Eles vao para 'proveniencia'; quando formam narrativa, viram historia pessoal
  ou exemplo (ver NARRATIVAS abaixo).
- Escreva como se ensinasse o principio a qualquer pessoa, sem ela precisar
  conhecer a conversa de origem.

GRANULARIDADE — 1 PLAYBOOK = 1 PRINCIPIO
- Um playbook cobre UM principio com UM procedimento. Se o input traz 3 angulos
  do mesmo principio, e 1 playbook com varios passos — nao 3 playbooks.
- Antes de criar, cheque se nao e so uma TATICA de um principio maior. Se for,
  registre como passo (ou marque 'faz_parte_de' depois, na etapa de linkagem).

ESTRUTURA DO PLAYBOOK (sempre nesta ordem)
1. titulo: afirmacao-promessa ("Como [resultado] sem [dor]") ou tese declarativa.
2. quando_aplica: o gatilho universal.
3. erro_comum: o que a maioria faz errado (a crenca velha a quebrar).
4. principio: a verdade nova em UMA frase.
5. passos: lista ordenada. Cada passo tem 'titulo' e 'como_executar' (sub-itens
   concretos). E AQUI que mora a tatica.
6. por_que_importa: o que esta em jogo se ignorar.
7. exemplos: contexto CURTO que ilustra/explica o principio, com tipo e proveniencia.

PROVENIENCIA — OBRIGATORIA E HONESTA
Para CADA playbook e CADA afirmacao numerica:
- trechos_fonte: cite VERBATIM o trecho do input que a sustenta (+ timestamp se houver).
- Se nao houver trecho que sustente, NAO invente: marque nivel "sintetizado".
- nivel: "dito_por_voce" | "sintetizado" | "fonte_externa".
- autor: "pedro" (fala do Pedro) | "outros" (terceiro/fonte externa).
NUNCA atribua ao Pedro algo que ele nao disse. Na duvida, "sintetizado".

NARRATIVAS — ROTEIE CERTO (sao DOIS tipos)
Se o input traz um caso narrado, decida o tipo:
- HISTORIA PESSOAL (standalone): episodio de vida SEU e substancial (ex.: "como
  vendi a Bagy"). Crie uma HistoriaPessoal longa, no formato Epiphany Bridge.
  So se for do Pedro. Caso de terceiro NUNCA vira historia pessoal.
- EXEMPLO (contexto de um playbook): caso CURTO que explica a origem do playbook
  ou da clareza ao ponto. NAO crie historia: coloque em playbook.estrutura.exemplos,
  com tipo "vivido_por_voce" ou "caso_de_terceiro" e a proveniencia correta.
NUNCA atribua um caso de terceiro ao Pedro.

SAIDA
Responda SOMENTE com JSON valido no schema abaixo. Sem texto fora do JSON.
{
  "detected_type": "youtube|transcript|article|free_text|unknown",
  "title": "Titulo descritivo do conteudo",
  "summary": "Resumo em 3-5 frases",
  "playbooks": [
    {
      "titulo": "...",
      "subtitulo": "...",
      "estrutura": {
        "quando_aplica": "...",
        "erro_comum": "...",
        "principio": "...",
        "passos": [{"titulo": "...", "como_executar": ["..."]}],
        "por_que_importa": "...",
        "exemplos": [{"texto": "...", "tipo": "vivido_por_voce|caso_de_terceiro", "proveniencia": "pedro|outros"}]
      },
      "proveniencia": {
        "fonte_tipo": "granola|youtube|texto",
        "trechos_fonte": [{"citacao_verbatim": "...", "timestamp": "..."}],
        "nivel": "dito_por_voce|sintetizado|fonte_externa",
        "autor": "pedro|outros"
      }
    }
  ],
  "historias_pessoais": [
    {
      "titulo": "...",
      "corpo_longo": "narrativa completa...",
      "estrutura_epiphany": {
        "backstory": "...", "desejo_externo": "...", "desejo_interno": "...",
        "parede": "...", "epifania": "...", "plano": "...",
        "conflito": "...", "conquista": "...", "transformacao": "..."
      },
      "proveniencia": {
        "trechos_fonte": [{"citacao_verbatim": "..."}],
        "nivel": "dito_por_voce",
        "autor": "pedro"
      }
    }
  ],
  "extracted_themes": ["tema1", "tema2"],
  "speaker_verified": true
}`;

/**
 * 4.1 — Extração: input bruto → playbooks estruturados + histórias pessoais
 */
export async function extractFromInput(
  rawContent: string,
  sourceType: string,
): Promise<ExtractionResult | { error: string }> {
  try {
    const client = getClient();

    const response = await client.messages.create({
      // Haiku (~100 tok/s) em vez de Sonnet (~49 tok/s): com 8192 tokens o Sonnet
      // levava ~168s e estourava o limite de 60s da Vercel. Haiku + 4096 cabe (~40s).
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: [
        {
          type: 'text' as const,
          text: EXTRACTION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `INPUT (tipo: ${sourceType}):\n\n${rawContent.slice(0, 6000)}\n\n---\nORÇAMENTO DE TOKENS (CRÍTICO): sua resposta JSON DEVE terminar completa e fechada. Para caber:\n- NO MÁXIMO 4 playbooks essenciais.\n- Cada playbook CONCISO: principio em 1 frase, 2-3 passos curtos (como_executar com 1-2 itens), 1 exemplo curto, NO MÁXIMO 1 trecho_fonte.\n- historias_pessoais: NO MÁXIMO 1, com corpo_longo de NO MÁXIMO 4 frases (ou [] se não houver história pessoal do Pedro).\nPriorize COMPLETAR o JSON acima de detalhar.`,
        },
      ],
    });

    logCost(
      'claude-haiku-4-5-20251001',
      response.usage.input_tokens,
      response.usage.output_tokens,
    );

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = parseJSON<ExtractionResult>(text);

    if (!parsed) {
      log.error('[KB Extract] Failed to parse. Raw: ' + text.slice(0, 500));
      return { error: 'Falha ao parsear resposta da extração' };
    }

    log.info(
      `[KB Extract] ${parsed.playbooks?.length ?? 0} playbooks, ` +
      `${parsed.historias_pessoais?.length ?? 0} histórias`,
    );

    return {
      playbooks: parsed.playbooks || [],
      historias_pessoais: parsed.historias_pessoais || [],
      detected_type: parsed.detected_type || 'unknown',
      title: parsed.title || 'Input sem título',
      summary: parsed.summary || '',
      extracted_themes: parsed.extracted_themes || [],
      speaker_verified: parsed.speaker_verified ?? false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    log.error('[KB Extract] ' + msg);
    return { error: `Falha na extração: ${msg}` };
  }
}

// ============================================================
// 4.2 + 4.3 + 4.4 — Reconciliação + Classificação + Linkagem
// (uma única chamada Haiku para economizar tokens)
// ============================================================

function buildReconciliationPrompt(input: ReconciliationInput): string {
  const vizinhos = input.conhecimento_existente
    .map(
      (p) =>
        `- [${p.id}] "${p.title}" | principio: ${p.principio || '(vazio)'} | tema: ${p.tema_name || '(sem tema)'} | sim: ${p.similarity.toFixed(2)}`,
    )
    .join('\n');

  const temas = input.temas_existentes
    .map(
      (t) =>
        `- [${t.id}] ${t.name}${t.parent_id ? ' (subtema)' : ' (tema raiz)'}`,
    )
    .join('\n');

  return `Voce e a etapa de RECONCILIACAO + CLASSIFICACAO + LINKAGEM do Segundo Cerebro.
Compara um candidato recem-extraido com o conhecimento existente e decide:
se e novo, se complementa algo, ou se e duplicata. Tambem classifica em
tema/subtema e detecta relacoes.

CANDIDATO:
titulo: ${input.candidato.titulo}
principio: ${input.candidato.estrutura.principio || '(vazio)'}
quando_aplica: ${input.candidato.estrutura.quando_aplica || '(vazio)'}
passos: ${(input.candidato.estrutura.passos || []).map((p) => p.titulo).join(', ')}

PLAYBOOKS MAIS SIMILARES (por embedding):
${vizinhos || '(nenhum — base vazia ou similaridade abaixo do limiar)'}

TAXONOMIA ATUAL:
${temas || '(nenhum tema criado ainda)'}

DECISAO (uma opcao):
- NOVO: nao existe nada parecido.
- COMPLEMENTA: ja existe playbook do mesmo principio, mas o candidato acrescenta algo.
- DUPLICATA: nao acrescenta nada relevante.

CLASSIFICACAO:
- Escolha tema/subtema existentes. So proponha NOVO se nenhum servir E for recorrente.
- Maximo 2 niveis. Prefira reusar.

LINKAGEM:
- faz_parte_de: este playbook e TATICA/parte de um principio maior existente?
- relacionado_a: playbooks de assunto vizinho.
- merge_sugerido: diz a MESMA coisa que outro? Sinalize candidato a fusao.

SAIDA (JSON unico):
{
  "decisao": "NOVO|COMPLEMENTA|DUPLICATA",
  "playbook_alvo": "id ou null",
  "tema_sugerido": "nome do tema",
  "subtema_sugerido": "nome do subtema",
  "diff": [{"campo": "...", "atual": "...", "proposto": "..."}],
  "itens_afetados": [{"id": "...", "titulo": "...", "por_que": "..."}],
  "resumo_para_pedro": "1-2 frases claras",
  "faz_parte_de": ["id", ...],
  "relacionado_a": ["id", ...],
  "merge_sugerido": [{"playbook_id": "...", "motivo": "...", "unico_de_cada": "..."}]
}

Responda SOMENTE com o JSON.`;
}

/**
 * 4.2+4.3+4.4 — Reconciliação + Classificação + Linkagem em uma chamada
 * Usa Haiku (barato) com apenas os top-N vizinhos por embedding.
 */
export async function reconcileAndLink(
  input: ReconciliationInput,
): Promise<ReconciliationResult | { error: string }> {
  try {
    // Se não há vizinhos similares, é NOVO automaticamente (sem chamar LLM)
    if (input.conhecimento_existente.length === 0) {
      log.info('[KB Reconcile] Nenhum vizinho similar — marcando NOVO sem LLM');
      return {
        decisao: 'NOVO',
        playbook_alvo: null,
        tema_sugerido: input.temas_existentes[0]?.name || 'Geral',
        subtema_sugerido: '',
        diff: [],
        itens_afetados: [],
        resumo_para_pedro: `Novo playbook: "${input.candidato.titulo}". Nenhum similar encontrado na base.`,
        faz_parte_de: [],
        relacionado_a: [],
        merge_sugerido: [],
      };
    }

    const client = getClient();
    const prompt = buildReconciliationPrompt(input);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    logCost(
      'claude-haiku-4-5-20251001',
      response.usage.input_tokens,
      response.usage.output_tokens,
    );

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = parseJSON<ReconciliationResult>(text);

    if (!parsed) {
      log.error('[KB Reconcile] Parse failed. Raw: ' + text.slice(0, 500));
      return { error: 'Falha ao parsear reconciliação' };
    }

    log.info(
      `[KB Reconcile] "${input.candidato.titulo}" → ${parsed.decisao}` +
      (parsed.playbook_alvo ? ` (alvo: ${parsed.playbook_alvo})` : ''),
    );

    return {
      decisao: parsed.decisao || 'NOVO',
      playbook_alvo: parsed.playbook_alvo || null,
      tema_sugerido: parsed.tema_sugerido || '',
      subtema_sugerido: parsed.subtema_sugerido || '',
      diff: parsed.diff || [],
      itens_afetados: parsed.itens_afetados || [],
      resumo_para_pedro: parsed.resumo_para_pedro || '',
      faz_parte_de: parsed.faz_parte_de || [],
      relacionado_a: parsed.relacionado_a || [],
      merge_sugerido: parsed.merge_sugerido || [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    log.error('[KB Reconcile] ' + msg);
    return { error: `Falha na reconciliação: ${msg}` };
  }
}

// ============================================================
// 4.5a — Perguntas gap-driven
// ============================================================

const QUESTIONS_SYSTEM_PROMPT = `Voce revisa um playbook e gera perguntas que, ao serem respondidas, MELHORAM
campos especificos. Nao e quiz — e diagnostico de lacuna.

Para CADA lacuna, gere UMA pergunta que:
- Aponte o CAMPO ALVO (ex.: "passo 3 esta vago", "falta quando NAO aplicar").
- Cite o TRECHO GATILHO: a parte do playbook que gerou a duvida.
- Seja especifica e respondivel em 1-2 frases.

Lacunas tipicas a checar:
- quando_aplica existe e e universal?
- erro_comum (crenca velha) esta explicito?
- cada passo tem como_executar concreto, ou e generico demais?
- falta o limite: "quando NAO usar isto" / excecoes?
- falta exemplo/prova (historia linkada)?
- algum numero aparece sem fonte?

NAO pergunte "o que voce quis dizer?". Pergunte assim:
"O passo 2 diz 'identifique o que contamina a janela', mas nao diz COMO.
Quais sinais voce checa na pratica para saber que a janela esta contaminada?"

SAIDA (JSON): { "perguntas": [{ "campo_alvo": "...", "pergunta": "...", "trecho_gatilho": "...", "status": "aberta" }] }
Responda SOMENTE com o JSON.`;

/**
 * 4.5a — Gerar perguntas gap-driven para um playbook
 */
export async function generateGapQuestions(
  playbook: {
    titulo: string;
    estrutura: PlaybookEstrutura;
    completude?: number;
  },
): Promise<QuestionsResult | { error: string }> {
  try {
    const client = getClient();

    const playbookText = JSON.stringify(
      {
        titulo: playbook.titulo,
        ...playbook.estrutura,
        completude: playbook.completude ?? 0,
      },
      null,
      2,
    );

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: QUESTIONS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Revise este playbook e gere perguntas para preencher lacunas:\n\n${playbookText}`,
        },
      ],
    });

    logCost(
      'claude-haiku-4-5-20251001',
      response.usage.input_tokens,
      response.usage.output_tokens,
    );

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = parseJSON<QuestionsResult>(text);

    if (!parsed) {
      return { error: 'Falha ao parsear perguntas' };
    }

    const perguntas = (parsed.perguntas || []).map((p) => ({
      ...p,
      status: 'aberta' as const,
    }));

    log.info(`[KB Questions] ${perguntas.length} perguntas para "${playbook.titulo}"`);
    return { perguntas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    log.error('[KB Questions] ' + msg);
    return { error: `Falha ao gerar perguntas: ${msg}` };
  }
}

// ============================================================
// 4.5b — Merge da resposta do Pedro
// ============================================================

/**
 * 4.5b — Incorporar resposta do Pedro no campo certo do playbook
 */
export async function mergeAnswer(
  playbook: {
    titulo: string;
    estrutura: PlaybookEstrutura;
  },
  pergunta: PerguntaAberta,
  resposta: string,
): Promise<MergeAnswerResult | { error: string }> {
  try {
    const client = getClient();

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `O Pedro respondeu a uma pergunta sobre um playbook. Incorpore a resposta no
campo certo SEM reescrever o resto.

PLAYBOOK: ${JSON.stringify({ titulo: playbook.titulo, ...playbook.estrutura }, null, 2)}

PERGUNTA: ${pergunta.pergunta}
CAMPO ALVO: ${pergunta.campo_alvo}

RESPOSTA DO PEDRO: ${resposta}

TAREFA:
1. Reescreva APENAS o campo alvo, integrando a resposta (decontextualizado).
2. Registre proveniencia: nivel "dito_por_voce", autor "pedro", trecho verbatim.
3. Recalcule completude (campos preenchidos e concretos / total, 0-100).

SAIDA (JSON):
{ "campo_atualizado": "...", "novo_valor": "...", "proveniencia_add": { "nivel": "dito_por_voce", "autor": "pedro", "trechos_fonte": [{"citacao_verbatim": "..."}] }, "completude": 75 }
Responda SOMENTE com o JSON.`,
        },
      ],
    });

    logCost(
      'claude-haiku-4-5-20251001',
      response.usage.input_tokens,
      response.usage.output_tokens,
    );

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = parseJSON<MergeAnswerResult>(text);

    if (!parsed) {
      return { error: 'Falha ao parsear merge' };
    }

    log.info(`[KB Merge] Campo "${parsed.campo_atualizado}" atualizado, completude: ${parsed.completude}%`);
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    log.error('[KB Merge] ' + msg);
    return { error: `Falha no merge: ${msg}` };
  }
}

// ============================================================
// Completude — cálculo local (sem LLM)
// ============================================================

/**
 * Calcula completude de um playbook (0-100) baseado nos campos preenchidos.
 * Sem chamar LLM — puro cálculo local.
 */
export function calculateCompletude(estrutura: PlaybookEstrutura): number {
  let filled = 0;
  const total = 7; // quando_aplica, erro_comum, principio, passos, por_que_importa, exemplos, pelo menos 1 passo com como_executar

  if (estrutura.quando_aplica && estrutura.quando_aplica.length > 10) filled++;
  if (estrutura.erro_comum && estrutura.erro_comum.length > 10) filled++;
  if (estrutura.principio && estrutura.principio.length > 10) filled++;
  if (estrutura.passos && estrutura.passos.length > 0) filled++;
  if (estrutura.por_que_importa && estrutura.por_que_importa.length > 10) filled++;
  if (estrutura.exemplos && estrutura.exemplos.length > 0) filled++;

  // Bonus: passos têm como_executar concreto
  const passosConcretos = (estrutura.passos || []).filter(
    (p) => p.como_executar && p.como_executar.length > 0,
  );
  if (passosConcretos.length > 0) filled++;

  return Math.round((filled / total) * 100);
}

// ============================================================
// Orquestrador — Pipeline completo (4.1 → 4.2+4.3+4.4)
// ============================================================

/**
 * Resultado enriquecido de cada playbook processado pelo pipeline.
 * Inclui extração, reconciliação, classificação e linkagem.
 */
export interface EnrichedProposal {
  /** Dados extraídos (4.1) */
  candidato: ExtractedPlaybook;
  /** Resultado da reconciliação (4.2+4.3+4.4) */
  reconciliation: ReconciliationResult;
  /** Completude calculada (0-100) */
  completude: number;
  /** Embedding gerado (para salvar no DB) */
  embedding?: number[];
}

export interface PipelineResult {
  /** Tipo detectado do input */
  detected_type: string;
  /** Título geral do input */
  title: string;
  /** Resumo geral */
  summary: string;
  /** Temas detectados */
  extracted_themes: string[];
  /** Se o Pedro é quem fala */
  speaker_verified: boolean;
  /** Playbooks enriquecidos (prontos para virar proposals no DB) */
  enriched_proposals: EnrichedProposal[];
  /** Histórias pessoais extraídas (standalone) */
  historias_pessoais: ExtractedHistoria[];
}

/**
 * Pipeline completo: Input bruto → extração → embedding → reconciliação → propostas enriquecidas
 *
 * Fluxo:
 * 1. Extração com Sonnet (4.1) — decontextualização, playbooks estruturados
 * 2. Para cada playbook extraído:
 *    a. Gera embedding (OpenAI text-embedding-3-small)
 *    b. Busca vizinhos similares na base via pgvector
 *    c. Reconcilia + Classifica + Linka com Haiku (4.2+4.3+4.4)
 * 3. Retorna resultado enriquecido para salvar como proposals
 */
export async function runFullPipeline(
  rawContent: string,
  sourceType: string,
): Promise<PipelineResult | { error: string }> {
  // ---- PASSO 1: Extração (Haiku) ----
  // Uma chamada de extração só aguenta ~6000 chars sem estourar o teto de tokens.
  // Para entradas longas (docs, transcrições grandes), dividimos em até 2 pedaços
  // de 6000 chars e extraímos em PARALELO — recupera a riqueza sem passar dos 60s.
  const CHUNK_SIZE = 6000;
  const MAX_CHUNKS = 2;
  const chunks: string[] = [];
  for (let i = 0; i < rawContent.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE) {
    chunks.push(rawContent.slice(i, i + CHUNK_SIZE));
  }
  log.info(`[KB Pipeline] Iniciando extração (${rawContent.length} chars → ${chunks.length} pedaço(s), tipo: ${sourceType})`);

  const parts = await Promise.all(chunks.map((c) => extractFromInput(c, sourceType)));
  const oks = parts.filter((p): p is ExtractionResult => !('error' in p));
  if (oks.length === 0) {
    return ('error' in parts[0] ? parts[0] : { error: 'Falha na extração' });
  }

  // Combina os pedaços (limita o total pra não sobrecarregar o PASSO 3)
  const extraction: ExtractionResult = {
    playbooks: oks.flatMap((e) => e.playbooks).slice(0, 8),
    historias_pessoais: oks.flatMap((e) => e.historias_pessoais).slice(0, 3),
    detected_type: oks[0].detected_type,
    title: oks[0].title,
    summary: oks[0].summary,
    extracted_themes: [...new Set(oks.flatMap((e) => e.extracted_themes))],
    speaker_verified: oks.some((e) => e.speaker_verified),
  };

  log.info(
    `[KB Pipeline] Extração OK: ${extraction.playbooks.length} playbooks, ` +
    `${extraction.historias_pessoais.length} histórias`,
  );

  // Se não extraiu nenhum playbook, retorna resultado vazio (mas não erro)
  if (extraction.playbooks.length === 0 && extraction.historias_pessoais.length === 0) {
    return {
      detected_type: extraction.detected_type,
      title: extraction.title,
      summary: extraction.summary,
      extracted_themes: extraction.extracted_themes,
      speaker_verified: extraction.speaker_verified,
      enriched_proposals: [],
      historias_pessoais: [],
    };
  }

  // ---- PASSO 2: Buscar temas existentes (para reconciliação) ----
  const supabase = await createClient();
  const { data: temasExistentes } = await supabase
    .from('themes')
    .select('id, name, parent_id')
    .order('name');

  const temas = (temasExistentes || []).map((t) => ({
    id: t.id,
    name: t.name,
    parent_id: t.parent_id || null,
  }));

  // ---- PASSO 3: Para cada playbook → embedding + reconciliação (em PARALELO) ----
  // Antes era um loop SEQUENCIAL (N playbooks = N chamadas de IA em série), o que
  // estourava o limite de 60s da Vercel em transcricoes grandes. Agora roda em
  // paralelo e limita a quantidade.
  const MAX_PLAYBOOKS = 6;
  const candidatos = extraction.playbooks.slice(0, MAX_PLAYBOOKS);
  if (extraction.playbooks.length > MAX_PLAYBOOKS) {
    log.info(`[KB Pipeline] Limitando a ${MAX_PLAYBOOKS} de ${extraction.playbooks.length} playbooks extraidos`);
  }

  const enrichedProposals: EnrichedProposal[] = await Promise.all(
    candidatos.map(async (candidato): Promise<EnrichedProposal> => {
      try {
        // 3a. Gera embedding do candidato
        const queryText = `${candidato.titulo} ${candidato.estrutura.principio || ''}`;
        let embedding: number[] | undefined;
        let vizinhos: Awaited<ReturnType<typeof findSimilarPlaybooks>> = [];

        try {
          embedding = await generateEmbedding(queryText);
          // 3b. Busca vizinhos similares (top 8, threshold 0.5)
          vizinhos = await findSimilarPlaybooks(queryText, 0.5, 8);
        } catch (embErr) {
          log.error(`[KB Pipeline] Embedding falhou para "${candidato.titulo}": ${embErr}`);
          // Continua sem embedding — reconciliação funcionará sem vizinhos
        }

        // 3c. Reconciliação + Classificação + Linkagem (Haiku)
        // Sem vizinhos similares (ex: base recém-resetada) já é NOVO — não gasta
        // uma chamada de IA pra concluir o óbvio. Economiza muito tempo na Vercel.
        const reconciliation = vizinhos.length === 0
          ? {
              decisao: 'NOVO' as const,
              playbook_alvo: null,
              tema_sugerido: temas[0]?.name || 'Geral',
              subtema_sugerido: '',
              diff: [],
              itens_afetados: [],
              resumo_para_pedro: `Novo playbook: "${candidato.titulo}".`,
              faz_parte_de: [],
              relacionado_a: [],
              merge_sugerido: [],
            }
          : await reconcileAndLink({
              candidato,
              conhecimento_existente: vizinhos,
              temas_existentes: temas,
            });

        if ('error' in reconciliation) {
          log.error(`[KB Pipeline] Reconciliação falhou para "${candidato.titulo}": ${reconciliation.error}`);
          return {
            candidato,
            reconciliation: {
              decisao: 'NOVO',
              playbook_alvo: null,
              tema_sugerido: temas[0]?.name || 'Geral',
              subtema_sugerido: '',
              diff: [],
              itens_afetados: [],
              resumo_para_pedro: `Novo playbook: "${candidato.titulo}" (reconciliação falhou).`,
              faz_parte_de: [],
              relacionado_a: [],
              merge_sugerido: [],
            },
            completude: calculateCompletude(candidato.estrutura),
            embedding,
          };
        }

        log.info(
          `[KB Pipeline] "${candidato.titulo}" → ${reconciliation.decisao}` +
          ` | tema: ${reconciliation.tema_sugerido}`,
        );
        return {
          candidato,
          reconciliation,
          completude: calculateCompletude(candidato.estrutura),
          embedding,
        };
      } catch (err) {
        log.error(`[KB Pipeline] Erro processando "${candidato.titulo}": ${err}`);
        // Não falha tudo por um playbook
        return {
          candidato,
          reconciliation: {
            decisao: 'NOVO',
            playbook_alvo: null,
            tema_sugerido: 'Geral',
            subtema_sugerido: '',
            diff: [],
            itens_afetados: [],
            resumo_para_pedro: `Novo playbook: "${candidato.titulo}" (erro no pipeline).`,
            faz_parte_de: [],
            relacionado_a: [],
            merge_sugerido: [],
          },
          completude: calculateCompletude(candidato.estrutura),
        };
      }
    })
  );

  log.info(
    `[KB Pipeline] Completo: ${enrichedProposals.length} propostas enriquecidas ` +
    `(${enrichedProposals.filter((p) => p.reconciliation.decisao === 'NOVO').length} NOVO, ` +
    `${enrichedProposals.filter((p) => p.reconciliation.decisao === 'COMPLEMENTA').length} COMPLEMENTA, ` +
    `${enrichedProposals.filter((p) => p.reconciliation.decisao === 'DUPLICATA').length} DUPLICATA)`,
  );

  return {
    detected_type: extraction.detected_type,
    title: extraction.title,
    summary: extraction.summary,
    extracted_themes: extraction.extracted_themes,
    speaker_verified: extraction.speaker_verified,
    enriched_proposals: enrichedProposals,
    historias_pessoais: extraction.historias_pessoais,
  };
}
