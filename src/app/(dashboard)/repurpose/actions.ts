"use server";


import { log } from '@/lib/logger';
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateContent } from "@/lib/ai";
import { generateImagePrompt } from "@/lib/ai/gemini";
import { randomUUID } from "crypto";

const PATH = "/repurpose";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  instagram_carousel: "Carrossel Instagram",
  instagram_reel: "Reels Instagram",
  instagram_static: "Post Estatico Instagram",
  youtube_long: "YouTube Longo",
  youtube_short: "YouTube Short",
  linkedin_post: "LinkedIn Post",
  x_thread: "Thread X",
  x_tweet: "Tweet X",
};

export async function getRepurposeableContents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_contents")
    .select("id, content_type, content_text, status, created_at")
    .not("content_text", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export interface RepurposeResult {
  id: string;
  contentType: string;
  content: string;
}

export async function repurposeContent(
  contentId: string,
  targetTypes: string[]
): Promise<{ results: RepurposeResult[] } | { error: string }> {
  const supabase = await createClient();

  if (!targetTypes || targetTypes.length === 0) {
    return { error: "Selecione pelo menos um tipo de conteudo destino." };
  }

  try {
    // Fetch the original content
    const { data: original, error: fetchError } = await supabase
      .from("generated_contents")
      .select("*")
      .eq("id", contentId)
      .single();

    if (fetchError || !original) {
      return { error: "Conteudo original nao encontrado." };
    }

    // Fetch identity for AI context
    const [identityRes, feedbackRes] = await Promise.all([
      supabase.from("identity").select("*").limit(1).single(),
      supabase
        .from("generated_contents")
        .select("feedback_text, feedback_rating")
        .not("feedback_text", "is", null)
        .eq("feedback_rating", "bad")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const repurposeGroup = randomUUID();
    const results: RepurposeResult[] = [];

    const originalTypeLabel =
      CONTENT_TYPE_LABELS[original.content_type] || original.content_type;

    for (const targetType of targetTypes) {
      const targetTypeLabel =
        CONTENT_TYPE_LABELS[targetType] || targetType;

      // Build format-specific adaptation instructions
      let adaptationGuide = "";
      switch (targetType) {
        case "instagram_carousel":
          adaptationGuide = `ADAPTACAO PARA CARROSSEL INSTAGRAM:
- Divida o conteudo em 5-8 slides numerados
- Slide 1: gancho forte que prende atencao (nao repita o titulo original)
- Slides intermediarios: 1 ideia por slide, frases curtas
- Ultimo slide: CTA claro
- Cada slide deve funcionar visualmente sozinho`;
          break;
        case "instagram_reel":
          adaptationGuide = `ADAPTACAO PARA REELS/VIDEO CURTO:
- Crie um ROTEIRO com marcacoes de tempo
- Gancho nos primeiros 3 segundos (diferente do original)
- Duracao total: 30-60 segundos
- Linguagem falada, nao escrita
- Energia alta, ritmo rapido
- CTA no final`;
          break;
        case "instagram_static":
          adaptationGuide = `ADAPTACAO PARA POST ESTATICO INSTAGRAM:
- Legenda de tamanho medio (100-200 palavras)
- Abertura com gancho forte
- Texto fluido com quebras de linha
- 3-5 hashtags relevantes no final
- CTA natural`;
          break;
        case "youtube_long":
          adaptationGuide = `ADAPTACAO PARA VIDEO YOUTUBE LONGO:
- Crie um ROTEIRO completo (8-12 minutos)
- Gancho nos primeiros 15 segundos
- Promessa clara do que o espectador vai aprender
- Divida em secoes com marcacoes de tempo
- Inclua transicoes e pontos de engajamento
- CTA para inscrever-se`;
          break;
        case "youtube_short":
          adaptationGuide = `ADAPTACAO PARA YOUTUBE SHORT:
- Roteiro de max 60 segundos
- Gancho imediato nos primeiros 3 segundos
- Uma unica ideia principal, direto ao ponto
- Linguagem falada, energetica
- CTA rapido no final`;
          break;
        case "linkedin_post":
          adaptationGuide = `ADAPTACAO PARA LINKEDIN:
- Tom mais profissional e reflexivo
- Abertura com frase impactante ou pergunta
- Paragrafos curtos com quebras de linha
- Conte a ideia como se fosse uma licao aprendida ou insight de carreira
- 2-3 hashtags profissionais
- CTA que convida reflexao ou debate`;
          break;
        case "x_thread":
          adaptationGuide = `ADAPTACAO PARA THREAD NO X:
- Tweet 1: tese forte e provocativa (max 280 chars)
- 4-7 tweets no total, cada um max 280 chars
- Cada tweet deve funcionar sozinho mas criar narrativa
- Use numeracao (1/, 2/, etc.)
- Ultimo tweet: resumo + CTA
- Tom direto e provocativo`;
          break;
        case "x_tweet":
          adaptationGuide = `ADAPTACAO PARA TWEET UNICO:
- Maximo 280 caracteres
- Capture a ESSENCIA do conteudo em uma unica frase
- Tom provocativo, opinativo ou com insight forte
- Sem hashtags (ou no maximo 1)
- Deve gerar vontade de curtir/repostar`;
          break;
      }

      const freeTextPrompt = `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUES BRASILEIRO (PT-BR).

TAREFA: REAPROVEITAMENTO DE CONTEUDO (REPURPOSE)

Voce recebeu um conteudo original no formato "${originalTypeLabel}" e deve ADAPTA-LO para o formato "${targetTypeLabel}".

IMPORTANTE: NAO copie o conteudo original. ADAPTE-O para o novo formato. Cada formato tem linguagem, estrutura e tom proprios. O conteudo deve parecer que foi CRIADO NATIVAMENTE para o formato destino.

## CONTEUDO ORIGINAL (${originalTypeLabel}):
${original.content_text}

## INSTRUCOES DE ADAPTACAO:
${adaptationGuide}

## REGRAS GERAIS:
- Mantenha a mensagem central e os insights principais
- Adapte o tom e a estrutura para o formato destino
- Nao mencione que eh um reaproveitamento
- O conteudo deve parecer original e nativo do formato
- Use a voz e identidade do Pedro
- Gere conteudo PRONTO PARA POSTAR`;

      const result = await generateContent({
        identity: identityRes.data,
        contentType: targetType,
        freeText: freeTextPrompt,
        recentFeedbacks: feedbackRes.data ?? [],
      });

      if ("error" in result) {
        log.error(`[Repurpose] Failed to generate ${targetType}: ${result.error}`);
        continue;
      }

      // Save to DB with repurpose metadata
      const { data: inserted, error: insertError } = await supabase
        .from("generated_contents")
        .insert({
          source_type: "free_text" as const,
          playbook_id: original.playbook_id || null,
          story_id: original.story_id || null,
          free_text_input: `Reaproveitado de ${originalTypeLabel}`,
          content_type: targetType,
          format_id: null,
          content_text: result.content_text,
          source_map: result.source_map,
          generation_params: {
            repurpose: true,
            original_id: contentId,
            original_type: original.content_type,
          },
          status: "draft",
          repurposed_from: contentId,
          repurpose_group: repurposeGroup,
        })
        .select("id")
        .single();

      if (insertError) {
        log.error(`[Repurpose] Insert error for ${targetType}:` + " " + String(insertError));
        continue;
      }

      results.push({
        id: inserted.id,
        contentType: targetType,
        content: result.content_text,
      });

      // Generate image in background
      generateImagePromptForContent(
        result.content_text,
        targetType,
        inserted.id
      ).catch((e) => log.error("[AI] Repurpose image error:" + " " + String(e)));
    }

    revalidatePath(PATH);
    revalidatePath("/gerar-conteudo");

    if (results.length === 0) {
      return { error: "Nenhum conteudo foi gerado. Tente novamente." };
    }

    return { results };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[Repurpose] Error:" + " " + String(message));
    return { error: `Falha ao reaproveitar conteudo: ${message}` };
  }
}

// Helper to generate image PROMPT in background (no actual image)
async function generateImagePromptForContent(
  contentText: string,
  contentType: string,
  contentId: string
) {
  const supabase = await createClient();

  const promptResult = await generateImagePrompt(contentText, contentType);

  if (!("error" in promptResult)) {
    await supabase
      .from("generated_contents")
      .update({
        image_prompt: promptResult.image_prompt,
        image_model: "prompt-only",
      })
      .eq("id", contentId);
  }

  revalidatePath(PATH);
}
