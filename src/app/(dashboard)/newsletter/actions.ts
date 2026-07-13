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

    const systemPrompt =
      (identity
        ? buildContentGenerationSystemPrompt(identity)
        : "REGRA: TODA SUA RESPOSTA EM PT-BR. Voce e o ghostwriter do Pedro Rabelo.") +
      confidencialidade;

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
[A newsletter completa em Markdown, nesta estrutura:]

1. **Abertura** — o "clima" da semana em 2-3 linhas: qual foi o fio condutor.
2. **Os fenomenos da semana** — 2 a 4 temas que apareceram REPETIDO cruzando as fontes (conteudo do Pedro + outros criadores + reunioes anonimizadas). Subtitulo proprio pra cada fenomeno.
3. **Os playbooks e licoes que ficaram** — o que foi ensinado/aprendido, de forma APLICAVEL: o leitor termina sabendo o que fazer diferente.
4. **Exemplos reais** — sempre anonimizados quando vierem de reuniao ("um dos mentorados...", "uma empresa que acompanho...").
5. **Fechamento** — uma provocacao ou direcao pra semana seguinte.

## LINGUAGEM (REGRA DURA):
- Portugues simples e acessivel, gostoso de ler — como alguem inteligente explicando pra um amigo no bar. SEM jargao corporativo, SEM enrolacao.
- Frases curtas. Paragrafos curtos. Analogias e exemplos reais pra fixar a ideia.
- Tom do Pedro: direto, opiniao forte, pratico. Tem que dar PRAZER de ler ate o fim.
- NUNCA use travessao (—) nem meia-risca (–) como pontuacao: reescreva com ponto, virgula ou dois-pontos.
- Tudo em PT-BR.

## CONFIDENCIALIDADE (relembre antes de escrever):
- ZERO nome de empresa, cliente ou pessoa vindos de reuniao. Fenomeno e licao sim; caso identificavel, NUNCA.`;

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
