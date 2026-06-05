"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClient, logCost } from "@/lib/ai/client";
import { buildContentGenerationSystemPrompt } from "@/lib/ai/prompts";
import type { Newsletter, NewsletterStatus } from "@/lib/supabase/types";

const PATH = "/newsletter";

// --- Fetch all newsletters ---

export async function getNewsletters(): Promise<Newsletter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Newsletter[];
}

// --- Generate newsletter from weekly activity ---

export async function generateNewsletter(
  theme: string,
  weekLabel?: string
): Promise<Newsletter> {
  const supabase = await createClient();

  // Fetch EVERYTHING from this week: identity, content, captures, proposals, activity
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStart = sevenDaysAgo.toISOString();

  const [
    identityRes,
    playbooksRes,
    storiesRes,
    contentsRes,
    capturesRes,
    proposalsRes,
    activityRes,
    hooksRes,
  ] = await Promise.all([
    supabase.from("identity").select("*").limit(1).single(),
    supabase.from("playbooks").select("id, title, body_markdown, created_at")
      .gte("created_at", weekStart).order("created_at", { ascending: false }),
    supabase.from("stories").select("id, title, summary, created_at")
      .gte("created_at", weekStart).order("created_at", { ascending: false }),
    supabase.from("generated_contents").select("id, content_type, content_text, status, created_at")
      .gte("created_at", weekStart).order("created_at", { ascending: false }).limit(20),
    supabase.from("captures").select("id, title, status, source_type, created_at")
      .gte("created_at", weekStart).order("created_at", { ascending: false }),
    supabase.from("proposals").select("id, title, type, status, created_at")
      .gte("created_at", weekStart).order("created_at", { ascending: false }),
    supabase.from("activity_log").select("action, entity_title, created_at")
      .gte("created_at", weekStart).order("created_at", { ascending: false }).limit(30),
    supabase.from("hooks").select("id, text, category, created_at")
      .gte("created_at", weekStart).order("created_at", { ascending: false }).limit(10),
  ]);

  const identity = identityRes.data;
  const playbooks = playbooksRes.data ?? [];
  const stories = storiesRes.data ?? [];
  const contents = contentsRes.data ?? [];
  const captures = capturesRes.data ?? [];
  const proposals = proposalsRes.data ?? [];
  const activities = activityRes.data ?? [];
  const hooks = hooksRes.data ?? [];

  // Build system prompt
  const systemPrompt = identity
    ? buildContentGenerationSystemPrompt(identity)
    : "REGRA: TODA SUA RESPOSTA EM PT-BR. Voce e o ghostwriter do Pedro Rabelo.";

  // Build weekly panorama
  const weeklyStats = {
    playbooks_created: playbooks.length,
    stories_created: stories.length,
    contents_generated: contents.length,
    captures_processed: captures.filter(c => c.status === "processed").length,
    proposals_approved: proposals.filter(p => p.status === "approved").length,
    proposals_total: proposals.length,
    hooks_created: hooks.length,
  };

  const playbooksList = playbooks.length > 0
    ? playbooks.map(p => `- ${p.title}`).join("\n")
    : "(nenhum novo esta semana)";

  const storiesList = stories.length > 0
    ? stories.map(s => `- ${s.title}: ${s.summary || ""}`).join("\n")
    : "(nenhuma nova esta semana)";

  const contentsList = contents.length > 0
    ? contents.map(c => `- [${c.content_type}] ${(c.content_text || "").slice(0, 150)}`).join("\n")
    : "(nenhum conteudo gerado esta semana)";

  const hooksList = hooks.length > 0
    ? hooks.map(h => `- [${h.category}] "${h.text}"`).join("\n")
    : "(nenhum hook esta semana)";

  const activitySummary = activities.slice(0, 15)
    .map(a => `- ${a.action}${a.entity_title ? ": " + a.entity_title : ""}`)
    .join("\n");

  const userPrompt = `## Tarefa
Gere uma newsletter semanal que faca um PANORAMA COMPLETO de tudo que aconteceu na semana na plataforma do Pedro.
${theme ? `Tema/foco adicional: **${theme}**` : ""}
${weekLabel ? `Semana: ${weekLabel}` : `Semana: ultimos 7 dias`}

## DADOS REAIS DA SEMANA (use esses dados, nao invente):

### Numeros da semana:
- ${weeklyStats.playbooks_created} playbooks novos
- ${weeklyStats.stories_created} historias novas
- ${weeklyStats.contents_generated} conteudos gerados
- ${weeklyStats.captures_processed} inputs processados
- ${weeklyStats.proposals_approved} propostas aprovadas (de ${weeklyStats.proposals_total} total)
- ${weeklyStats.hooks_created} hooks criados

### Playbooks criados esta semana:
${playbooksList}

### Historias criadas esta semana:
${storiesList}

### Conteudos gerados esta semana:
${contentsList}

### Hooks criados esta semana:
${hooksList}

### Atividade recente:
${activitySummary || "(sem atividade registrada)"}

## Estrutura da newsletter (retorne EXATAMENTE neste formato):

SUBJECT: [assunto impactante sobre a semana]
TITLE: [titulo da newsletter]
TOPICS: [topicos separados por virgula]

---BODY---
[Newsletter completa em Markdown:]

1. **Resumo da semana** - O que aconteceu em numeros e destaques (use os dados reais acima)
2. **Destaque: Playbook/Historia da semana** - Aprofunde no conteudo mais relevante criado
3. **Conteudos produzidos** - Resumo do que foi gerado e publicado
4. **Melhores hooks da semana** - Os ganchos mais criativos criados
5. **O que vem pela frente** - Provocacao ou direcao para a proxima semana

## Regras:
- Use os DADOS REAIS acima, nao invente numeros
- Se nao teve atividade em alguma area, mencione que esta semana foi mais leve nesse ponto
- Tom do Pedro: direto, pratico, sem enrolacao
- Paragrafos curtos
- Se a semana foi produtiva, celebre. Se foi fraca, provoque acao.`;

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

  const subject = subjectMatch?.[1]?.trim() || `Newsletter: ${theme}`;
  const title = titleMatch?.[1]?.trim() || theme;
  const topics = topicsMatch?.[1]
    ? topicsMatch[1].split(",").map((t) => t.trim())
    : [theme];
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
      week_label: weekLabel || null,
      topics,
    })
    .select("*")
    .single();

  if (error) throw error;

  revalidatePath(PATH);
  return inserted as Newsletter;
}

// --- Update newsletter status ---

export async function updateNewsletterStatus(
  id: string,
  status: NewsletterStatus
) {
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletters")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}
