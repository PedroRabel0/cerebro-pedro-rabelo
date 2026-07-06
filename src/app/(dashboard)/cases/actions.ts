"use server";

import { log } from "@/lib/logger";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/api-guards";
import { getClient, logCost, parseJSON } from "@/lib/ai/client";
import { findSimilarPlaybooks } from "@/lib/ai/embeddings";
import { buildContentGenerationSystemPrompt } from "@/lib/ai/prompts";

const PATH = "/cases";
const BUCKET = "company-cases";
const MAX_PHOTO_MB = 10;

// --- Tipos ---

export interface CaseAnalysis {
  hook: string;
  caption: string;
  slides: { title: string; text: string }[];
}

export interface CompanyCase {
  id: string;
  name: string;
  sector: string | null;
  summary: string | null;
  results: string | null;
  pedro_angle: string | null;
  notes: string | null;
  analysis: CaseAnalysis | null;
  analysis_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseCard extends CompanyCase {
  photos: { count: number }[];
}

export interface CasePhotoWithUrl {
  id: string;
  caption: string | null;
  ordem: number;
  storage_path: string;
  /** Signed URL (1h) para exibir/baixar a foto real */
  url: string;
}

export interface CaseInput {
  name: string;
  sector?: string;
  summary?: string;
  results?: string;
  pedro_angle?: string;
  notes?: string;
}

/**
 * Converte erro tecnico em mensagem PT-BR (padrao do app): detalhe no log,
 * usuario ve o que fazer.
 */
function erroAmigavel(error: unknown, acao: string): { error: string } {
  const detalhe =
    error instanceof Error
      ? error.message
      : (error as { message?: string })?.message || JSON.stringify(error);
  log.error(`[Cases] Falha ao ${acao}: ${detalhe}`);
  return { error: `Nao foi possivel ${acao}. Tente novamente.` };
}

// --- CRUD de case ---

export async function getCases(): Promise<CaseCard[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_cases")
    .select("*, photos:company_case_photos(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error; // page.tsx captura e mostra aviso de migracao
  return (data ?? []) as CaseCard[];
}

export async function getCase(
  id: string
): Promise<{ case: CompanyCase; photos: CasePhotoWithUrl[] } | null> {
  await requireStaff();
  const supabase = await createClient();

  const { data: caseRow, error } = await supabase
    .from("company_cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !caseRow) return null;

  const { data: photoRows } = await supabase
    .from("company_case_photos")
    .select("id, caption, ordem, storage_path")
    .eq("case_id", id)
    .order("ordem", { ascending: true });

  // Signed URLs (1h) — bucket privado exige service_role
  const admin = await createAdminClient();
  const photos: CasePhotoWithUrl[] = [];
  for (const p of photoRows ?? []) {
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(p.storage_path, 3600);
    if (signed) photos.push({ ...p, url: signed.signedUrl });
  }

  return { case: caseRow as CompanyCase, photos };
}

export async function createCase(
  input: CaseInput
): Promise<{ id: string } | { error: string }> {
  const user = await requireStaff();
  if (!input.name?.trim()) return { error: "Informe o nome da empresa." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_cases")
    .insert({
      name: input.name.trim(),
      sector: input.sector?.trim() || null,
      summary: input.summary?.trim() || null,
      results: input.results?.trim() || null,
      pedro_angle: input.pedro_angle?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return erroAmigavel(error, "criar o case");

  revalidatePath(PATH);
  return { id: data.id as string };
}

export async function updateCase(
  id: string,
  input: CaseInput
): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  if (!input.name?.trim()) return { error: "Informe o nome da empresa." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_cases")
    .update({
      name: input.name.trim(),
      sector: input.sector?.trim() || null,
      summary: input.summary?.trim() || null,
      results: input.results?.trim() || null,
      pedro_angle: input.pedro_angle?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return erroAmigavel(error, "salvar o case");

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  return { ok: true };
}

export async function deleteCase(
  id: string
): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  const supabase = await createClient();

  // Remove as fotos do Storage antes (o cascade so apaga as linhas)
  const { data: photos } = await supabase
    .from("company_case_photos")
    .select("storage_path")
    .eq("case_id", id);
  if (photos && photos.length > 0) {
    const admin = await createAdminClient();
    await admin.storage.from(BUCKET).remove(photos.map((p) => p.storage_path));
  }

  const { error } = await supabase.from("company_cases").delete().eq("id", id);
  if (error) return erroAmigavel(error, "excluir o case");

  revalidatePath(PATH);
  return { ok: true };
}

// --- Fotos (upload real — NUNCA geradas por IA) ---

export async function uploadCasePhoto(
  caseId: string,
  formData: FormData
): Promise<{ ok: true; count: number } | { error: string }> {
  await requireStaff();
  const supabase = await createClient();

  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "photos" && value instanceof File && value.size > 0) {
      files.push(value);
    }
  }
  if (files.length === 0) return { error: "Nenhuma foto enviada." };

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return { error: `"${file.name}" nao e uma imagem.` };
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      return { error: `"${file.name}" passa de ${MAX_PHOTO_MB}MB.` };
    }
  }

  // Proxima posicao na ordem
  const { data: last } = await supabase
    .from("company_case_photos")
    .select("ordem")
    .eq("case_id", caseId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  let ordem = (last?.ordem ?? -1) + 1;

  // storage exige service_role (bucket privado, sem policies de storage)
  const admin = await createAdminClient();

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${caseId}/${Date.now()}-${ordem}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (upErr) return erroAmigavel(upErr, "enviar a foto");

    const { error: insErr } = await supabase
      .from("company_case_photos")
      .insert({ case_id: caseId, storage_path: path, ordem });
    if (insErr) {
      // nao deixa arquivo orfao no bucket
      await admin.storage.from(BUCKET).remove([path]);
      return erroAmigavel(insErr, "registrar a foto");
    }
    ordem++;
  }

  revalidatePath(`${PATH}/${caseId}`);
  return { ok: true, count: files.length };
}

export async function deleteCasePhoto(
  photoId: string
): Promise<{ ok: true } | { error: string }> {
  await requireStaff();
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("company_case_photos")
    .select("case_id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { error: "Foto nao encontrada." };

  const admin = await createAdminClient();
  await admin.storage.from(BUCKET).remove([photo.storage_path]);

  const { error } = await supabase
    .from("company_case_photos")
    .delete()
    .eq("id", photoId);
  if (error) return erroAmigavel(error, "excluir a foto");

  revalidatePath(`${PATH}/${photo.case_id}`);
  return { ok: true };
}

export async function getCasePhotoUrl(
  photoId: string
): Promise<{ url: string } | { error: string }> {
  await requireStaff();
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("company_case_photos")
    .select("storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { error: "Foto nao encontrada." };

  const admin = await createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(photo.storage_path, 3600);
  if (error || !data) return erroAmigavel(error, "gerar o link da foto");
  return { url: data.signedUrl };
}

// --- Geração da análise (carrossel) ---

/**
 * Gera a ANALISE do Pedro sobre o case — nao um resumo neutro. Combina os
 * dados do case + a identidade/voz (buildContentGenerationSystemPrompt) +
 * os playbooks relevantes (busca semantica). A saida e TEXTO estruturado
 * (hook + legenda + slides); as fotos reais entram na montagem manual.
 */
export async function generateCaseCarousel(
  caseId: string
): Promise<{ analysis: CaseAnalysis } | { error: string }> {
  await requireStaff();
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from("company_cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (!caseRow) return { error: "Case nao encontrado." };
  if (!caseRow.summary?.trim()) {
    return {
      error:
        'Preencha "O que a empresa fez" antes de gerar — e a materia-prima da analise.',
    };
  }

  // Identidade + regras de decisao (a voz do Pedro)
  const [{ data: identity }, { data: rules }] = await Promise.all([
    supabase.from("identity").select("*").limit(1).maybeSingle(),
    supabase
      .from("decision_rules")
      .select("rule_text, context, category")
      .order("category"),
  ]);
  if (!identity) return { error: "Identidade nao configurada em /identidade." };

  // Playbooks relevantes (RAG) — a lente da analise. O RPC devolve so o
  // principio curto; recarregamos o body_markdown completo dos relevantes
  // (mesmo padrao do chat do cerebro).
  let playbookContext = "";
  try {
    const similar = await findSimilarPlaybooks(
      `${caseRow.name} ${caseRow.sector || ""} ${caseRow.summary} ${caseRow.pedro_angle || ""}`,
      0.3,
      5
    );
    if (similar.length > 0) {
      const { data: full } = await supabase
        .from("playbooks")
        .select("id, title, body_markdown")
        .in("id", similar.map((s) => s.id));
      const byId = new Map((full ?? []).map((p) => [p.id, p]));
      playbookContext = similar
        .map((s) => {
          const p = byId.get(s.id);
          const body = p?.body_markdown || s.principio || "";
          return `### ${s.title}\n${body.slice(0, 1500)}`;
        })
        .join("\n\n");
    }
  } catch (err) {
    log.error("[Cases] embeddings: " + String(err));
  }

  const userPrompt = `Gere a ANALISE do Pedro sobre o case abaixo, em formato de carrossel de Instagram.

## O CASE
Empresa: ${caseRow.name}${caseRow.sector ? ` (setor: ${caseRow.sector})` : ""}
O que a empresa fez: ${caseRow.summary}
Resultados/numeros: ${caseRow.results || "(nao informado)"}
O ANGULO DO PEDRO (a tese da analise — construa o carrossel em cima disto): ${caseRow.pedro_angle || "(nao definido — escolha o angulo mais forte a partir do case e dos frameworks abaixo)"}
Notas adicionais: ${caseRow.notes || "-"}

## FRAMEWORKS/PLAYBOOKS DO PEDRO RELEVANTES (a lente da analise — cite-os quando couber)
${playbookContext || "(nenhum playbook diretamente relacionado — use o repertorio geral da identidade)"}

## O QUE GERAR
Um carrossel de 5 a 8 slides que e a ANALISE OPINATIVA do Pedro sobre esse case — NAO um resumo neutro da empresa. Estrutura obrigatoria:
- SLIDE 1 (capa): gancho forte na voz do Pedro, maximo 10 palavras de impacto. Vai por cima de uma FOTO REAL da empresa — precisa funcionar como headline.
- Slides do meio: o que a empresa fez (bem curto) → o INSIGHT do Pedro (por que funcionou ou falhou, usando os frameworks acima) → o que o Pedro faria igual ou diferente.
- Ultimo slide: a LICAO acionavel para o seguidor + CTA especifico (salvar/comentar/compartilhar com motivo concreto).
- Cada slide: "title" curto e memoravel + "text" de 1 a 3 frases diretas (sera lido em imagem, nao em texto corrido).
- "caption" (legenda do post): COMPLEMENTA os slides (nao repete), hook na primeira linha, 3-5 paragrafos curtos, CTA e 5-8 hashtags no final.
- Tudo em PT-BR, na voz do Pedro (opiniao, experiencia propria, zero tom de wikipedia).

Retorne APENAS um JSON valido, sem markdown e sem texto fora do JSON, neste formato exato:
{"hook":"frase da capa","caption":"legenda completa","slides":[{"title":"...","text":"..."}]}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: [
        {
          type: "text" as const,
          text: buildContentGenerationSystemPrompt(identity, rules ?? undefined),
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

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseJSON<CaseAnalysis>(text);

    // Valida o shape antes de gravar — JSON quebrado nao vira "analise"
    if (
      !parsed ||
      typeof parsed.hook !== "string" ||
      !parsed.hook.trim() ||
      typeof parsed.caption !== "string" ||
      !Array.isArray(parsed.slides) ||
      parsed.slides.length < 3 ||
      parsed.slides.some(
        (s) => typeof s?.title !== "string" || typeof s?.text !== "string"
      )
    ) {
      log.error("[Cases] JSON invalido da IA: " + text.slice(0, 300));
      return { error: "A IA retornou um formato inesperado. Tente gerar de novo." };
    }

    const analysis: CaseAnalysis = {
      hook: parsed.hook.trim(),
      caption: parsed.caption.trim(),
      slides: parsed.slides.map((s) => ({
        title: s.title.trim(),
        text: s.text.trim(),
      })),
    };

    const { error: saveErr } = await supabase
      .from("company_cases")
      .update({
        analysis,
        analysis_generated_at: new Date().toISOString(),
      })
      .eq("id", caseId);
    if (saveErr) return erroAmigavel(saveErr, "salvar a analise");

    revalidatePath(`${PATH}/${caseId}`);
    return { analysis };
  } catch (err) {
    log.error("[Cases] generateCaseCarousel: " + String(err));
    return {
      error: "Nao consegui gerar a analise agora. Tente de novo em instantes.",
    };
  }
}
