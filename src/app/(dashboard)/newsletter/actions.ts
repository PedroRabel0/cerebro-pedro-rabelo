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

// --- Generate newsletter with AI ---

export async function generateNewsletter(
  theme: string,
  weekLabel?: string
): Promise<Newsletter> {
  const supabase = await createClient();

  // Fetch identity, recent playbooks, and stories in parallel
  const [identityRes, playbooksRes, storiesRes] = await Promise.all([
    supabase.from("identity").select("*").limit(1).single(),
    supabase
      .from("playbooks")
      .select("id, title, body_markdown")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("stories")
      .select("id, title, summary, body_markdown")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const identity = identityRes.data;
  const playbooks = playbooksRes.data ?? [];
  const stories = storiesRes.data ?? [];

  // Build system prompt from identity
  const systemPrompt = identity
    ? buildContentGenerationSystemPrompt(identity)
    : `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUES BRASILEIRO (PT-BR).
Voce e o ghostwriter do Pedro Rabelo. Gere conteudo que soe exatamente como ele falaria.`;

  // Build the newsletter-specific user prompt
  const playbookContext = playbooks
    .map((p) => `- **${p.title}**: ${(p.body_markdown || "").slice(0, 300)}`)
    .join("\n");

  const storyContext = stories
    .map(
      (s) =>
        `- **${s.title}**: ${s.summary || (s.body_markdown || "").slice(0, 200)}`
    )
    .join("\n");

  const userPrompt = `## Tarefa
Gere uma newsletter semanal completa sobre o tema: **${theme}**
${weekLabel ? `Semana: ${weekLabel}` : ""}

## Playbooks recentes para referencia
${playbookContext || "(nenhum playbook disponivel)"}

## Historias recentes para referencia
${storyContext || "(nenhuma historia disponivel)"}

## Estrutura obrigatoria da newsletter
Retorne EXATAMENTE no formato abaixo (sem blocos de codigo, apenas o texto):

SUBJECT: [linha de assunto impactante, curta, que gere curiosidade]
TITLE: [titulo da newsletter]
TOPICS: [lista de topicos separados por virgula]

---BODY---
[Corpo completo da newsletter em Markdown com as seguintes secoes:]

1. **Gancho de abertura** - Um paragrafo curto e impactante que conecte o tema ao dia-a-dia do leitor
2. **Topico principal** - Desenvolvimento do tema central com profundidade pratica
3. **Insights dos Playbooks** - 2 a 3 insights extraidos dos playbooks acima, com aplicacao pratica
4. **Historia em destaque** - Um destaque de uma historia real que ilustre o tema
5. **CTA (Chamada para Acao)** - Encerramento com uma provocacao ou acao concreta para o leitor

## Regras
- Escreva em portugues brasileiro
- Tom conversacional e direto, como se estivesse falando com um amigo
- Paragrafos curtos (maximo 3 linhas)
- Use exemplos concretos
- Evite jargoes corporativos
- O conteudo deve parecer escrito pelo Pedro, nao por uma IA`;

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
