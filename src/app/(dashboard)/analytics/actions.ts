"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClient, logCost } from "@/lib/ai/client";
import type { ContentMetric } from "@/lib/supabase/types";

const PATH = "/analytics";

export async function getMetrics(): Promise<ContentMetric[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_metrics")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createMetric(data: {
  title: string;
  platform: string;
  content_type: string;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
  views: number;
  posted_at: string;
}) {
  const supabase = await createClient();

  const engagementRate =
    data.views > 0
      ? ((data.likes + data.saves + data.shares + data.comments) / data.views) *
        100
      : 0;

  const { error } = await supabase.from("content_metrics").insert({
    title: data.title,
    platform: data.platform,
    content_type: data.content_type,
    likes: data.likes,
    saves: data.saves,
    shares: data.shares,
    comments: data.comments,
    views: data.views,
    engagement_rate: parseFloat(engagementRate.toFixed(2)),
    posted_at: data.posted_at,
  });

  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteMetric(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_metrics")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

export async function getAnalyticsInsights(): Promise<string> {
  const supabase = await createClient();

  // Fetch all metrics
  const { data: metrics, error: metricsError } = await supabase
    .from("content_metrics")
    .select("*")
    .order("posted_at", { ascending: false });

  if (metricsError) throw metricsError;

  if (!metrics || metrics.length === 0) {
    return "Nenhuma metrica registrada ainda. Adicione dados de performance dos seus conteudos para gerar insights.";
  }

  // Fetch identity for context
  const { data: identity } = await supabase
    .from("identity")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const identityContext = identity
    ? `\nContexto do criador: posicionamento "${identity.positioning || "nao definido"}", tom "${identity.tone_descriptors || "nao definido"}", referências: ${identity.reference_creators || "nao definidas"}.`
    : "";

  const metricsJson = JSON.stringify(
    metrics.map((m) => ({
      title: m.title,
      platform: m.platform,
      content_type: m.content_type,
      likes: m.likes,
      saves: m.saves,
      shares: m.shares,
      comments: m.comments,
      views: m.views,
      engagement_rate: m.engagement_rate,
      posted_at: m.posted_at,
    })),
    null,
    2
  );

  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Voce e um analista de performance de conteudo digital. Analise os dados de metricas abaixo e gere insights acionaveis em portugues.
${identityContext}

Dados de metricas (${metrics.length} posts):
${metricsJson}

Gere uma analise completa com:
1. **Resumo geral** — como esta a performance no geral
2. **Melhor plataforma** — qual plataforma tem melhor engajamento e por que
3. **Tipo de conteudo que mais performa** — qual formato gera mais saves, shares, engagement
4. **Padroes de horario** — se ha correlacao entre horario de postagem e performance
5. **Top 3 posts** — quais foram os melhores posts e o que eles tem em comum
6. **Insights acionaveis** — 3-5 recomendacoes praticas (ex: "posts com hook X performam Y% melhor", "melhor horario para postar", "tipo de conteudo com mais saves")

Seja direto, use numeros concretos, e foque em insights que o criador pode usar imediatamente.`,
      },
    ],
  });

  logCost(
    "claude-sonnet-4-6",
    response.usage.input_tokens,
    response.usage.output_tokens
  );

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "Nao foi possivel gerar insights.";
}
