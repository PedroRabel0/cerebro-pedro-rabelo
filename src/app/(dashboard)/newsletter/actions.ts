"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { log } from "@/lib/logger";
import { getClient, logCost } from "@/lib/ai/client";
import { buildContentGenerationSystemPrompt } from "@/lib/ai/prompts";
import type { Newsletter, NewsletterStatus } from "@/lib/supabase/types";
import { requireStaff } from "@/lib/api-guards";

const PATH = "/newsletter";

// --- Fetch all newsletters ---

export async function getNewsletters(): Promise<Newsletter[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Newsletter[];
}

// --- Generate newsletter: recap semanal de um PERIODO escolhido ---

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte as datas do seletor (input type=date, "2026-07-07") pros limites
 * do periodo no fuso de Brasilia: [inicio do dia "de", fim do dia "ate"].
 * Aceita tambem ISO completo (usado como veio). null = periodo invalido.
 */
function resolvePeriod(
  fromISO: string,
  toISO: string
): { from: Date; to: Date } | null {
  const from = DATE_ONLY_RE.test(fromISO)
    ? new Date(`${fromISO}T00:00:00-03:00`)
    : new Date(fromISO);
  const to = DATE_ONLY_RE.test(toISO)
    ? new Date(`${toISO}T23:59:59.999-03:00`)
    : new Date(toISO);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return null;
  return { from, to };
}

/** Label automatico do periodo: "07–13 jul 2026", "28 jun – 04 jul 2026". */
function buildWeekLabel(from: Date, to: Date): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts })
      .format(d)
      .replace(/\./g, "")
      .replace(/ de /g, " ");
  const mesAno = (d: Date) => fmt(d, { month: "numeric", year: "numeric" });
  const ano = (d: Date) => fmt(d, { year: "numeric" });
  if (mesAno(from) === mesAno(to)) {
    return `${fmt(from, { day: "2-digit" })}–${fmt(to, { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  if (ano(from) === ano(to)) {
    return `${fmt(from, { day: "2-digit", month: "short" })} – ${fmt(to, { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return `${fmt(from, { day: "2-digit", month: "short", year: "numeric" })} – ${fmt(to, { day: "2-digit", month: "short", year: "numeric" })}`;
}

/**
 * A newsletter e um RECAP do periodo escolhido: o Claude LE tudo que passou
 * pela semana do Pedro (conteudo dele, ideias de outros criadores, playbooks
 * e historias novas, reunioes de consultoria) e escreve uma ANALISE GERAL
 * dos fenomenos e licoes — sem estatistica de plataforma e SEM identificar
 * cliente (reuniao e material confidencial virando texto publico).
 */
export async function generateNewsletter(
  fromISO: string,
  toISO: string,
  focus?: string
): Promise<Newsletter | { error: string }> {
  await requireStaff();
  const supabase = await createClient();

  const period = resolvePeriod(fromISO, toISO);
  if (!period) return { error: "Período inválido: confira as datas De e Até." };
  const from = period.from.toISOString();
  const to = period.to.toISOString();
  const weekLabel = buildWeekLabel(period.from, period.to);
  const focusClean = focus?.trim().slice(0, 200) || "";

  try {
    // Tudo com data DENTRO do periodo. reference_posts nao tem created_at:
    // o fallback de posted_at null e scraped_at. Playbooks/stories contam
    // como "da semana" se foram criados OU atualizados nela.
    const [
      identityRes,
      contentsRes,
      referencesRes,
      playbooksRes,
      storiesRes,
      meetingsRes,
    ] = await Promise.all([
      supabase.from("identity").select("*").limit(1).single(),
      supabase
        .from("generated_contents")
        .select("content_type, content_text, created_at")
        .gte("created_at", from).lte("created_at", to)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("reference_posts")
        .select(
          "caption_text, dna_main_theme, dna_thesis, platform, posted_at, scraped_at, profile:reference_profiles(handle)"
        )
        .or(
          `and(posted_at.gte.${from},posted_at.lte.${to}),and(posted_at.is.null,scraped_at.gte.${from},scraped_at.lte.${to})`
        )
        .order("scraped_at", { ascending: false })
        .limit(30),
      supabase
        .from("playbooks")
        .select("title, subtitle, body_markdown, created_at, updated_at")
        .or(
          `and(created_at.gte.${from},created_at.lte.${to}),and(updated_at.gte.${from},updated_at.lte.${to})`
        )
        .order("updated_at", { ascending: false })
        .limit(15),
      supabase
        .from("stories")
        .select("title, summary, lesson, created_at, updated_at")
        .or(
          `and(created_at.gte.${from},created_at.lte.${to}),and(updated_at.gte.${from},updated_at.lte.${to})`
        )
        .order("updated_at", { ascending: false })
        .limit(15),
      // SEM join de consulting_companies de proposito: o nome do cliente
      // nem chega ao modelo. Titulo da reuniao tambem fica de fora (quase
      // sempre carrega o nome da empresa).
      supabase
        .from("consulting_meetings")
        .select("held_at, summary, notes, transcript")
        .gte("held_at", from).lte("held_at", to)
        .order("held_at", { ascending: false })
        .limit(20),
    ]);

    const identity = identityRes.data;
    const contents = contentsRes.data ?? [];
    const references = referencesRes.data ?? [];
    const playbooks = playbooksRes.data ?? [];
    const stories = storiesRes.data ?? [];
    const meetings = meetingsRes.data ?? [];

    if (
      contents.length === 0 &&
      references.length === 0 &&
      playbooks.length === 0 &&
      stories.length === 0 &&
      meetings.length === 0
    ) {
      return {
        error: `Nenhum material encontrado no período ${weekLabel}. Escolha outro intervalo.`,
      };
    }

    const diaCurto = (iso: string | null) =>
      iso
        ? new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "short",
            timeZone: "America/Sao_Paulo",
          }).format(new Date(iso)).replace(".", "")
        : "";

    const contentsList = contents.length
      ? contents
          .map(
            (c) =>
              `- [${c.content_type}, ${diaCurto(c.created_at)}] ${(c.content_text || "").trim().slice(0, 300)}`
          )
          .join("\n")
      : "(nenhum conteudo do Pedro no periodo)";

    const referencesList = references.length
      ? references
          .map((r) => {
            const handle =
              (r.profile as { handle?: string } | null)?.handle || "criador";
            const ideia = [r.dna_main_theme, r.dna_thesis]
              .filter(Boolean)
              .join(" — ");
            const trecho = (r.caption_text || "").trim().slice(0, 200);
            return `- @${handle} (${r.platform}): ${ideia || "(sem analise)"}${trecho ? ` | trecho: "${trecho}"` : ""}`;
          })
          .join("\n")
      : "(nenhum post de referencia no periodo)";

    const playbooksList = playbooks.length
      ? playbooks
          .map(
            (p) =>
              `- ${p.title}${p.subtitle ? ` (${p.subtitle})` : ""}: ${(p.body_markdown || "").trim().slice(0, 600)}`
          )
          .join("\n")
      : "(nenhum playbook novo/atualizado no periodo)";

    const storiesList = stories.length
      ? stories
          .map(
            (s) =>
              `- ${s.title}: ${(s.summary || "").trim().slice(0, 250)}${s.lesson ? ` | Licao: ${s.lesson.trim().slice(0, 200)}` : ""}`
          )
          .join("\n")
      : "(nenhuma historia nova/atualizada no periodo)";

    const meetingsList = meetings.length
      ? meetings
          .map((m) => {
            // O texto real da reuniao: summary primeiro (curado), depois
            // notes; transcript so como ultimo recurso (e enorme).
            const texto = (
              m.summary?.trim() ||
              m.notes?.trim() ||
              m.transcript?.trim().slice(0, 2000) ||
              ""
            ).slice(0, 1500);
            return `- Reuniao de ${diaCurto(m.held_at)}: ${texto || "(sem registro do conteudo)"}`;
          })
          .join("\n")
      : "(nenhuma reuniao de consultoria no periodo)";

    const confidencialidade = `

## CONFIDENCIALIDADE (REGRA INEGOCIÁVEL — vale acima de qualquer outra)
Parte do material vem de reuniões PRIVADAS de consultoria/mentoria e vai virar texto PÚBLICO:
- NUNCA cite nome de empresa, de cliente, de pessoa, de marca ou de produto de cliente, nem detalhe que permita identificar alguém (faturamento específico, nicho muito específico + região, cidade + setor).
- PODE falar do FENÔMENO e da LIÇÃO ("essa semana vi muito founder travar na hora de delegar", "apareceu de novo o erro de escalar venda sem processo"). Ensine o CONCEITO, não o caso identificável.
- Se precisar de exemplo, anonimize: "um dos mentorados", "uma empresa de serviço", "um e-commerce que acompanho".
- Criadores PÚBLICOS de conteúdo (posts de referência) podem ser citados pela IDEIA; na dúvida, generalize.
- Antes de finalizar, RELEIA o texto caçando qualquer nome ou detalhe identificável que tenha escapado e remova.`;

    // Reforco de tom no system (as regras completas vao no user prompt):
    // a newsletter e cronica, nao relatorio — o formato de "Fenomeno 1/2/3"
    // e os tiques de IA foram reprovados pelo Pedro.
    const tomReforco = `

## TOM DA NEWSLETTER (REFORCO)
A newsletter e uma CRONICA/CARTA fluida em primeira pessoa, NAO um relatorio: sem secoes carimbadas tipo "Fenomeno 1" ou titulos fixos que se repetem toda semana, sem cliches e ditados populares, sem paralelismo triplo perfeitinho, no maximo UMA frase de efeito por edicao, e sem se auto-referenciar ("essa semana postei sobre..."). Os assuntos se conectam com transicoes naturais e a ideia e entregue direto, como reflexao do Pedro. E ela ENSINA: cada tema desenvolvido termina com o ensinamento pratico (o que o leitor faz de diferente na segunda-feira); reflexao sem aplicacao, no maximo em um tema por edicao.`;

    const systemPrompt =
      (identity
        ? buildContentGenerationSystemPrompt(identity)
        : "REGRA: TODA SUA RESPOSTA EM PT-BR. Voce e o ghostwriter do Pedro Rabelo.") +
      confidencialidade +
      tomReforco;

    const userPrompt = `## Tarefa
Escreva a NEWSLETTER SEMANAL do Pedro: um RECAP do periodo ${weekLabel}. Abaixo esta TUDO que passou pela semana dele: o conteudo que ele publicou, as ideias de outros criadores que ele acompanha, os playbooks e historias que entraram na base e as reunioes de consultoria (CONFIDENCIAIS).

Seu trabalho NAO e listar item por item nem contar estatistica: e CRUZAR as fontes e encontrar os TEMAS TRANSVERSAIS da semana — o que apareceu repetido, o que conversa entre si, qual foi o fio condutor.
${focusClean ? `\nRECORTE PEDIDO PELO PEDRO (olhe a semana por esta lente): **${focusClean}**\n` : ""}
## MATERIAL DA SEMANA (${weekLabel}) — use SO isso como fato, nao invente:

### 1. Conteudo do Pedro no periodo (${contents.length}):
${contentsList}

### 2. Ideias de outros criadores que a plataforma acompanha (${references.length}):
${referencesList}

### 3. Playbooks novos/atualizados na base (${playbooks.length}):
${playbooksList}

### 4. Historias novas/atualizadas na base (${stories.length}):
${storiesList}

### 5. Reunioes de consultoria no periodo (${meetings.length}) — MATERIAL CONFIDENCIAL, anonimize SEMPRE:
${meetingsList}

## ESTRUTURA (retorne EXATAMENTE neste formato):

SUBJECT: [assunto de email que faz querer abrir — sobre o TEMA da semana, nunca "recap semanal" generico]
TITLE: [titulo da newsletter]
TOPICS: [3-6 topicos separados por virgula]

---BODY---
[A newsletter completa em Markdown: uma CRONICA da semana, fluida de ponta a ponta. Ao longo do texto, SEM blocos rotulados nem secoes fixas, ela precisa: abrir com o fio condutor da semana em 2-3 linhas; desenvolver os 2-4 temas que apareceram repetido cruzando as fontes, conectados por transicoes naturais; deixar licoes aplicaveis com exemplos reais (anonimizados quando vierem de reuniao); e fechar com uma provocacao ou direcao pra semana seguinte.]

## COMO ESCREVER (regras de tom — obrigatórias)
- Escreva como um humano inteligente CONVERSANDO, em primeira pessoa. O texto FLUI como uma crônica/carta: os assuntos se conectam com transições naturais, não em blocos isolados.
- Parágrafos curtos. Linguagem simples e direta. Opinião de verdade, com convicção.
- Exemplos concretos e reais (anonimizados quando vierem de reunião).
- ENSINAMENTO OBRIGATÓRIO: a newsletter ENSINA, não só reflete. Cada tema desenvolvido termina com o ensinamento prático dele, o que o leitor faz de diferente na segunda-feira (uma pergunta de diagnóstico, um teste concreto, uma ordem de passos). Reflexão sem aplicação é permitida em NO MÁXIMO um tema por edição. O ensinamento entra na prosa, fluido, sem virar seção rotulada.

## NUNCA FAÇA (o que deixou o texto ruim antes):
- NUNCA use estrutura de fôrma: proibido "Fenômeno 1 / Fenômeno 2 / Fenômeno 3", proibido títulos fixos que se repetem toda semana ("Os playbooks que ficaram", "Pra semana que vem" como seções carimbadas). Se usar algum subtítulo, que seja específico daquela edição e diferente a cada semana — ou não use subtítulo nenhum.
- NUNCA use clichês ou ditados populares. Proibido: "pulga atrás da orelha", "buraco é mais embaixo", "colocar a mão na massa", "ponta do iceberg", "no fim das contas", "jogar a toalha", "abrir o jogo" e afins. Fale com palavras próprias.
- NUNCA repita a mesma muleta de abertura em cada seção (ex: "essa foi a afirmação que mais gerou reação", "esse foi o tema mais recorrente"). Varie.
- NUNCA use paralelismo triplo perfeitinho ("olham pra X quando... olham pro Y quando... olham pro Z quando..."). Quebre o ritmo, escreva desigual como gente escreve.
- NO MÁXIMO UMA frase de efeito por edição, e só se for genuína. Nada de empilhar punchlines de coach ("não é fraqueza, é matemática comportamental" + "fase boa não espera" etc.).
- NUNCA se auto-referencie ("um post da semana sobre...", "essa semana postei sobre...", "no conteúdo que publiquei", "nos casos que estudei", "nos playbooks que revisitei"). Entregue a IDEIA direto, como reflexão sua — o leitor não precisa saber que veio de um post. Diga "uma coisa se repetiu a semana inteira: reunião aqui, conversa ali" e vá direto pra ideia.
- CONFIDENCIALIDADE: nunca cite nome de empresa/cliente/pessoa vindo de reunião de consultoria (nem apelidos como "Bagy"). Anonimize sempre ("um dos mentorados", "uma empresa de varejo"). Casos de empresas PÚBLICAS (ex: Havaianas, Localiza) podem ser citados.

## EXEMPLO — ESCREVA ASSIM (fluido, humano, sem tique):
"Uma coisa se repetiu a semana inteira e eu demorei pra sacar o padrão. Reunião aqui, conversa com founder ali — e no fundo era sempre o mesmo erro: gente brigando com o problema errado. O cara quer a ferramenta de IA, mas o buraco é o processo. O sócio quer aumentar o dividendo, mas o que está torto é como ele se paga.
Começa pela IA. Não sou contra adotar — sou contra adotar em cima de bagunça. Automatizar um processo ruim não conserta o processo; só faz ele errar mais rápido. Se eu te perguntar quantos pedidos a tua operação aguenta por dia e você travar na resposta, esquece escalar canal novo."

## EXEMPLO — NUNCA ASSIM (fôrma de relatório + tiques):
"## Fenômeno 1: IA não escala nada, processo escala
Essa foi a afirmação que mais gerou reação na semana. E faz sentido irritar, porque vai contra o que todo guru tem vendido. Estão olhando pra ferramenta quando o problema é o processo. Estão olhando pro dividendo quando o problema é a estrutura. Estão olhando pro conteúdo curto quando o problema é o tempo. Não é fraqueza, é matemática comportamental."

## LINGUAGEM:
- NUNCA use travessao (—) nem meia-risca (–) como pontuacao, em NENHUM campo: vale pro SUBJECT, pro TITLE, pros TOPICS e pro corpo. Reescreva com ponto, virgula ou dois-pontos. (Os exemplos acima usam travessao so pra ilustrar a FLUIDEZ; na sua resposta, nao use.)
- Tudo em PT-BR.`;

    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        {
          type: "text" as const,
          text: systemPrompt,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    logCost(
      "claude-sonnet-4-6",
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the structured response
    const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
    const titleMatch = text.match(/TITLE:\s*(.+)/);
    const topicsMatch = text.match(/TOPICS:\s*(.+)/);
    const bodyMatch = text.split("---BODY---");

    const subject = subjectMatch?.[1]?.trim() || `A semana ${weekLabel}`;
    const title = titleMatch?.[1]?.trim() || `Recap ${weekLabel}`;
    const topics = topicsMatch?.[1]
      ? topicsMatch[1].split(",").map((t) => t.trim())
      : focusClean
        ? [focusClean]
        : [weekLabel];
    const bodyMarkdown =
      bodyMatch.length > 1 ? bodyMatch[1].trim() : text.trim();

    // Save to DB
    const { data: inserted, error } = await supabase
      .from("newsletters")
      .insert({
        title,
        subject,
        body_markdown: bodyMarkdown,
        status: "draft",
        week_label: weekLabel,
        topics,
      })
      .select("*")
      .single();

    if (error) throw error;

    revalidatePath(PATH);
    return inserted as Newsletter;
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    log.error("[Newsletter] geracao falhou: " + message);
    return { error: `Falha ao gerar a newsletter: ${message}` };
  }
}

// --- Update newsletter status ---

export async function updateNewsletterStatus(
  id: string,
  status: NewsletterStatus
) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletters")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Update newsletter body ---

export async function updateNewsletterBody(id: string, body: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletters")
    .update({ body_markdown: body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Delete newsletter ---

export async function deleteNewsletter(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletters")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}
