"use server";


import { log } from '@/lib/logger';
import { requireAdmin } from "@/lib/api-guards";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { analyzeCompleteness, generateBookQuestions } from "@/lib/ai";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { updatePlaybookEmbedding } from "@/lib/ai/embeddings";
import { calculateCompletude, generateGapQuestions } from "@/lib/ai/kb-pipeline";
import type { PlaybookEstrutura, PerguntaAberta } from "@/lib/supabase/types";

// --- Themes ---

export async function getThemes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createTheme(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("themes").insert({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    color: (formData.get("color") as string) || "#3a5a7a",
  });
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function deleteTheme(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("themes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

// --- Playbooks ---

export async function getPlaybooks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbooks")
    .select("*, theme:themes!playbooks_theme_id_fkey(*)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPlaybook(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbooks")
    .select("*, theme:themes!playbooks_theme_id_fkey(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPlaybook(formData: FormData) {
  const supabase = await createClient();
  const createdBy = (formData.get("created_by") as string) || "pedro";
  const { error } = await supabase.from("playbooks").insert({
    title: formData.get("title") as string,
    subtitle: (formData.get("subtitle") as string) || null,
    theme_id: (formData.get("theme_id") as string) || null,
    body_markdown: (formData.get("body_markdown") as string) || null,
    created_by: createdBy,
  });
  if (error) throw error;

  // Log activity with proper attribution
  await supabase.from("activity_log").insert({
    actor: createdBy as "pedro" | "henrique",
    action: `Criou playbook: "${formData.get("title")}"`,
    entity_type: "playbook",
    entity_title: formData.get("title") as string,
  });

  revalidatePath("/base-de-conhecimento");
}

export async function updatePlaybook(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("playbooks")
    .update({
      title: formData.get("title") as string,
      subtitle: (formData.get("subtitle") as string) || null,
      theme_id: (formData.get("theme_id") as string) || null,
      body_markdown: (formData.get("body_markdown") as string) || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function togglePlaybookOrigin(id: string, newOrigin: "pedro" | "outros") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("playbooks")
    .update({ created_by: newOrigin })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function deletePlaybook(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("playbooks").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

/**
 * Marca/desmarca um playbook como compartilhável com clientes do portal.
 * Restrito ao administrador (Pedro) — valida auth no topo (não confia no middleware).
 */
export async function setPlaybookShareable(playbookId: string, value: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("playbooks")
    .update({ is_shareable: value })
    .eq("id", playbookId);
  if (error) return { error: error.message };
  revalidatePath("/base-de-conhecimento");
  return { ok: true };
}

// --- Histórias Pessoais (Epiphany Bridge) ---

export async function getHistoriasPessoais() {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("historias_pessoais")
      .select("*, tema:themes(*)")
      .order("updated_at", { ascending: false });
    if (error) {
      // Tabela pode não existir ainda (migração SQL pendente) — retorna vazio
      log.error("[KB] getHistoriasPessoais error: " + error.message);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

export async function deleteHistoriaPessoal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("historias_pessoais").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

// --- Stories ---

export async function getStories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getStory(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createStory(formData: FormData) {
  const supabase = await createClient();
  const createdBy = (formData.get("created_by") as string) || "pedro";
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase.from("stories").insert({
    title: formData.get("title") as string,
    summary: (formData.get("summary") as string) || null,
    body_markdown: (formData.get("body_markdown") as string) || null,
    period: (formData.get("period") as string) || null,
    tags,
    lesson: (formData.get("lesson") as string) || null,
    created_by: createdBy,
  });
  if (error) throw error;

  // Log activity with proper attribution
  await supabase.from("activity_log").insert({
    actor: createdBy as "pedro" | "henrique",
    action: `Criou história: "${formData.get("title")}"`,
    entity_type: "story",
    entity_title: formData.get("title") as string,
  });

  revalidatePath("/base-de-conhecimento");
}

export async function updateStory(id: string, formData: FormData) {
  const supabase = await createClient();
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from("stories")
    .update({
      title: formData.get("title") as string,
      summary: (formData.get("summary") as string) || null,
      body_markdown: (formData.get("body_markdown") as string) || null,
      period: (formData.get("period") as string) || null,
      tags,
      lesson: (formData.get("lesson") as string) || null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function toggleStoryOrigin(id: string, newOrigin: "pedro" | "outros") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stories")
    .update({ created_by: newOrigin })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

export async function deleteStory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/base-de-conhecimento");
}

// --- Playbook Completeness Analysis ---

export async function analyzePlaybookCompleteness(id: string) {
  const supabase = await createClient();
  const { data: playbook, error } = await supabase
    .from("playbooks")
    .select("*, theme:themes!playbooks_theme_id_fkey(*)")
    .eq("id", id)
    .single();
  if (error) throw error;

  try {
    const result = await analyzeCompleteness(playbook);

    if ("error" in result) {
      throw new Error(result.error);
    }

    await supabase
      .from("playbooks")
      .update({
        completeness_score: result.completeness_score,
        has_example: result.has_example,
        has_story: result.has_story,
        has_origin: result.has_origin,
        has_counterexample: result.has_counterexample,
      })
      .eq("id", id);

    revalidatePath("/base-de-conhecimento");
    return result;
  } catch (aiError) {
    log.error("[AI] analyzeCompleteness failed:" + " " + String(aiError));
    throw new Error("Falha ao analisar completude do playbook");
  }
}

// --- Book Questions ---

export async function getBookQuestions(playbookId: string) {
  const supabase = await createClient();
  const { data: playbook, error } = await supabase
    .from("playbooks")
    .select("*, theme:themes!playbooks_theme_id_fkey(*)")
    .eq("id", playbookId)
    .single();
  if (error) throw error;

  const result = await generateBookQuestions(playbook);

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result;
}

export async function saveQuestionAnswer(
  playbookId: string,
  questionText: string,
  answer: string
) {
  const supabase = await createClient();
  const { data: playbook, error } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", playbookId)
    .single();
  if (error) throw error;

  // Append answer to body_markdown
  const existingBody = playbook.body_markdown || "";
  const section = `\n\n---\n\n**P:** ${questionText}\n\n**R:** ${answer}`;
  const updatedBody = existingBody + section;

  await supabase
    .from("playbooks")
    .update({ body_markdown: updatedBody })
    .eq("id", playbookId);

  // Re-analyze completeness
  const completenessResult = await analyzeCompleteness({ ...playbook, body_markdown: updatedBody });
  if (!("error" in completenessResult)) {
    await supabase
      .from("playbooks")
      .update({
        completeness_score: completenessResult.completeness_score,
        has_example: completenessResult.has_example,
        has_story: completenessResult.has_story,
        has_origin: completenessResult.has_origin,
        has_counterexample: completenessResult.has_counterexample,
      })
      .eq("id", playbookId);
  }

  revalidatePath("/base-de-conhecimento");

  // Return updated playbook
  const { data: updated } = await supabase
    .from("playbooks")
    .select("*, theme:themes!playbooks_theme_id_fkey(*)")
    .eq("id", playbookId)
    .single();
  return updated;
}

/**
 * Responde uma pergunta gap-driven e incorpora a resposta no playbook via mergeAnswer (4.5b).
 */
export async function answerGapQuestion(
  playbookId: string,
  questionIndex: number,
  answer: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: playbook, error: fetchError } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", playbookId)
    .single();

  if (fetchError || !playbook) return { success: false, error: "Playbook não encontrado" };

  const estrutura = playbook.estrutura as PlaybookEstrutura | null;
  const perguntas = (playbook.perguntas_abertas || []) as PerguntaAberta[];
  const pergunta = perguntas[questionIndex];

  if (!estrutura || !pergunta) return { success: false, error: "Pergunta não encontrada" };

  try {
    // Chama mergeAnswer (4.5b) — Haiku incorpora resposta no campo certo
    const { mergeAnswer: mergeAnswerFn } = await import("@/lib/ai/kb-pipeline");
    const result = await mergeAnswerFn(
      { titulo: playbook.title, estrutura },
      pergunta,
      answer,
    );

    if ("error" in result) {
      return { success: false, error: result.error };
    }

    // Atualiza o campo no playbook
    const updatedEstrutura = { ...estrutura };
    if (result.campo_atualizado && result.novo_valor) {
      (updatedEstrutura as Record<string, unknown>)[result.campo_atualizado] = result.novo_valor;
    }

    // Marca pergunta como respondida
    const updatedPerguntas = perguntas.map((p, i) =>
      i === questionIndex ? { ...p, status: "respondida" as const } : p
    );

    // Atualiza tudo no DB
    const { error: updateError } = await supabase
      .from("playbooks")
      .update({
        estrutura: updatedEstrutura,
        perguntas_abertas: updatedPerguntas,
        completeness_score: result.completude,
      })
      .eq("id", playbookId);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath("/base-de-conhecimento");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    log.error(`[GapAnswer] Erro: ${msg}`);
    return { success: false, error: msg };
  }
}

// ============================================================
// Fase 4 — Migração de playbooks legados para schema v2
// ============================================================

const MIGRATION_PROMPT = `Voce recebe um playbook legado (titulo + body_markdown) e o converte para o schema estruturado.
NAO invente informacao. SOMENTE reestruture o que ja esta escrito.

SAIDA (JSON valido):
{
  "estrutura": {
    "quando_aplica": "extraia do texto ou null",
    "erro_comum": "extraia do texto ou null",
    "principio": "a tese central em 1-2 frases",
    "passos": [{"titulo": "nome do passo", "como_executar": ["sub-item concreto"]}],
    "por_que_importa": "extraia do texto ou null",
    "exemplos": [{"texto": "...", "tipo": "vivido_por_voce|caso_de_terceiro", "proveniencia": "pedro|outros"}]
  },
  "proveniencia": {
    "nivel": "dito_por_voce|sintetizado",
    "autor": "pedro|outros"
  }
}

Regras:
- principio e OBRIGATORIO (extraia a ideia central)
- passos: se o texto tem lista ou etapas, converta. Se nao, crie 1-2 passos resumidos.
- quando_aplica: quando usar este playbook. Se o texto nao diz, infira do contexto ou null.
- erro_comum: se mencionado, extraia. Se nao, null.
- exemplos: se ha casos/historias no texto, extraia. Se nao, array vazio.
- NAO adicione informacao que nao esta no texto original.
Responda SOMENTE com o JSON.`;

/**
 * Migra UM playbook legado para o schema v2 (Haiku — barato).
 * Retorna o id do playbook migrado ou erro.
 */
export async function migratePlaybookToV2(playbookId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: playbook, error: fetchError } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", playbookId)
    .single();

  if (fetchError || !playbook) return { success: false, error: "Playbook não encontrado" };

  // Já migrado? Skip
  if (playbook.estrutura && typeof playbook.estrutura === "object") {
    const est = playbook.estrutura as Record<string, unknown>;
    if (est.principio && typeof est.principio === "string" && est.principio.length > 5) {
      log.info(`[Migration] Playbook "${playbook.title}" já migrado — skip`);
      return { success: true };
    }
  }

  const bodyText = playbook.body_markdown || "";
  if (bodyText.length < 20) {
    log.info(`[Migration] Playbook "${playbook.title}" sem body — skip`);
    return { success: true };
  }

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: MIGRATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `PLAYBOOK LEGADO:\nTítulo: ${playbook.title}\nSubtítulo: ${playbook.subtitle || "(sem subtítulo)"}\n\nConteúdo:\n${bodyText.slice(0, 8000)}`,
        },
      ],
    });

    logCost(
      "claude-haiku-4-5-20251001",
      response.usage.input_tokens,
      response.usage.output_tokens,
    );

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseJSON<{ estrutura: PlaybookEstrutura; proveniencia: Record<string, unknown> }>(text);

    if (!parsed || !parsed.estrutura) {
      log.error(`[Migration] Parse failed for "${playbook.title}". Raw: ${text.slice(0, 300)}`);
      return { success: false, error: "Falha ao parsear resposta" };
    }

    const completude = calculateCompletude(parsed.estrutura);

    // Update playbook com dados estruturados
    const { error: updateError } = await supabase
      .from("playbooks")
      .update({
        estrutura: parsed.estrutura,
        proveniencia: parsed.proveniencia || {},
        status: "rascunho",
        completeness_score: completude,
        has_example: !!(parsed.estrutura.exemplos && parsed.estrutura.exemplos.length > 0),
        has_origin: !!(parsed.proveniencia?.trechos_fonte),
      })
      .eq("id", playbookId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Gera embedding em background
    const principio = parsed.estrutura.principio || "";
    updatePlaybookEmbedding(playbookId, playbook.title, principio).catch(() => {});

    // Gera perguntas gap-driven em background
    generateGapQuestions({
      titulo: playbook.title,
      estrutura: parsed.estrutura,
      completude,
    }).then(async (result) => {
      if (!("error" in result) && result.perguntas.length > 0) {
        await supabase.from("playbooks").update({
          perguntas_abertas: result.perguntas,
        }).eq("id", playbookId);
      }
    }).catch(() => {});

    log.info(`[Migration] "${playbook.title}" migrado — completude: ${completude}%`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    log.error(`[Migration] Erro em "${playbook.title}": ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Migra TODOS os playbooks legados (sem estrutura) para o schema v2.
 * Processa um por vez para não sobrecarregar a API.
 * Retorna progresso: { total, migrated, errors }.
 */
export async function migrateAllPlaybooks(): Promise<{
  total: number;
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = await createClient();

  const { data: playbooks, error } = await supabase
    .from("playbooks")
    .select("id, title, estrutura, body_markdown")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!playbooks) return { total: 0, migrated: 0, skipped: 0, errors: [] };

  // Filtra os que precisam migrar (sem estrutura.principio preenchido)
  const needMigration = playbooks.filter((p) => {
    if (!p.body_markdown || p.body_markdown.length < 20) return false;
    const est = p.estrutura as Record<string, unknown> | null;
    if (est?.principio && typeof est.principio === "string" && est.principio.length > 5) return false;
    return true;
  });

  log.info(`[Migration] ${needMigration.length} de ${playbooks.length} playbooks precisam migrar`);

  let migrated = 0;
  const errors: string[] = [];

  for (const pb of needMigration) {
    const result = await migratePlaybookToV2(pb.id);
    if (result.success) {
      migrated++;
    } else {
      errors.push(`${pb.title}: ${result.error}`);
    }
    // Pequena pausa para não bater rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  // Log final
  await supabase.from("activity_log").insert({
    actor: "ia",
    action: `Migração KB v2: ${migrated}/${needMigration.length} playbooks migrados${errors.length > 0 ? `, ${errors.length} erros` : ""}`,
    entity_type: "playbook",
    entity_title: "Migração em lote",
  });

  revalidatePath("/base-de-conhecimento");

  log.info(`[Migration] Completa: ${migrated} migrados, ${playbooks.length - needMigration.length} já OK, ${errors.length} erros`);
  return {
    total: playbooks.length,
    migrated,
    skipped: playbooks.length - needMigration.length,
    errors,
  };
}
