"use server";


import { log } from '@/lib/logger';
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { processUniversalInput } from "@/lib/ai/universal";
import { extractYouTubeContent } from "@/lib/ai/youtube";
import { runFullPipeline, calculateCompletude } from "@/lib/ai/kb-pipeline";
import type { PipelineResult, EnrichedProposal } from "@/lib/ai/kb-pipeline";
import { scrapeInstagramPost } from "@/lib/ai/apify";
import { analyzeDNA } from "@/lib/ai";
import { getClient, logCost } from "@/lib/ai/client";
import type { CaptureSourceType } from "@/lib/supabase/types";

// --- Universal Input ---

function detectInstagramUrl(input: string): boolean {
  return /instagram\.com\/(p|reel|tv)\//i.test(input.trim());
}

async function handleInstagramInput(url: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  // 1. Scrape with Apify
  const scraped = await scrapeInstagramPost(url);
  if ("error" in scraped) {
    log.error("[Apify] Scrape failed:" + " " + String(scraped.error));
    return null;
  }

  // 2. Find or create profile
  let profileId: string | null = null;
  if (scraped.owner_username) {
    const { data: existing } = await supabase
      .from("reference_profiles")
      .select("id")
      .eq("handle", scraped.owner_username)
      .eq("platform", "instagram")
      .limit(1)
      .single();

    if (existing) {
      profileId = existing.id;
    } else {
      const { data: newProfile } = await supabase
        .from("reference_profiles")
        .insert({
          platform: "instagram",
          handle: scraped.owner_username,
          display_name: scraped.owner_full_name || scraped.owner_username,
          active: true,
        })
        .select("id")
        .single();
      profileId = newProfile?.id ?? null;
    }
  }

  // 3. Analyze DNA with Claude
  let dna: { hook_type?: string; structure?: string; length?: string; tone?: string; cta_type?: string; main_theme?: string; sub_theme?: string; thesis?: string } = {};
  if (scraped.caption) {
    const dnaResult = await analyzeDNA({ content: scraped.caption });
    if (!("error" in dnaResult)) {
      dna = dnaResult;
    }
  }

  // 4. Save reference post
  if (profileId) {
    await supabase.from("reference_posts").insert({
      profile_id: profileId,
      platform: "instagram",
      url,
      thumbnail_url: scraped.thumbnail_url,
      caption_text: scraped.caption,
      likes: scraped.likes,
      comments: scraped.comments,
      engagement_rate: scraped.engagement_rate,
      posted_at: scraped.posted_at,
      dna_hook_type: dna.hook_type || null,
      dna_structure: dna.structure || null,
      dna_length: dna.length || null,
      dna_tone: dna.tone || null,
      dna_cta_type: dna.cta_type || null,
      dna_main_theme: dna.main_theme || null,
      dna_sub_theme: dna.sub_theme || null,
      dna_thesis: dna.thesis || null,
      saved_as_reference: true,
    });
  }

  return scraped;
}

export async function submitFileInput(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { captureId: "", status: "saved_without_ai" as const, error: "Nenhum arquivo enviado" };
    }

    const fileName = file.name;
    const fileSize = file.size;
    const fileType = file.type;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    log.info(`[FileInput] Processing: ${fileName} (${(fileSize / 1024).toFixed(1)}KB, type: ${fileType}, ext: ${ext})`);

    // Reject files too large (10MB limit — matches next.config bodySizeLimit)
    if (fileSize > 10 * 1024 * 1024) {
      return { captureId: "", status: "saved_without_ai" as const, error: "Arquivo muito grande. Limite: 10MB." };
    }

    let textContent = "";

    // Handle by file type
    if (fileType === "application/pdf" || ext === "pdf") {
      // PDF: extract readable text, filtering out binary/metadata junk
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const rawStr = decoder.decode(bytes);

        const textRuns: string[] = [];

        // Method 1: Extract parenthesized strings (PDF text objects)
        const parenMatches = rawStr.match(/\(([^)]{5,})\)/g);
        if (parenMatches) {
          for (const m of parenMatches) {
            const inner = m.slice(1, -1)
              .replace(/\\n/g, "\n")
              .replace(/\\r/g, "")
              .replace(/\\\\/g, "\\")
              .replace(/\\([()])/g, "$1")
              .replace(/\0/g, "");
            // Only keep strings that look like real text (have multiple words)
            const wordCount = inner.trim().split(/\s+/).length;
            if (inner.length > 8 && wordCount >= 2 && /[a-zA-ZáàãâéèêíóòõôúçÁÀÃÂÉÈÊÍÓÒÕÔÚÇ]{2,}/.test(inner)) {
              textRuns.push(inner.trim());
            }
          }
        }

        // Method 2: Extract long readable runs (sentences/paragraphs)
        const readableRuns = rawStr.match(/[a-zA-ZáàãâéèêíóòõôúçÁÀÃÂÉÈÊÍÓÒÕÔÚÇ0-9\s,.;:!?()"-]{30,}/g);
        if (readableRuns) {
          for (const r of readableRuns) {
            const trimmed = r.trim();
            const words = trimmed.split(/\s+/).length;
            // Only keep if it has at least 4 words (real sentence, not font names)
            if (words >= 4 && !textRuns.some(t => t.includes(trimmed.slice(0, 30)))) {
              textRuns.push(trimmed);
            }
          }
        }

        // Filter out common PDF junk patterns
        const cleanRuns = textRuns.filter(run => {
          // Skip font declarations, encoding tables, metadata
          if (/^(\/[A-Z]|<<|>>|endobj|endstream|stream|xref|trailer)/i.test(run)) return false;
          if (/^[A-Z]{1,3}\d+\s/.test(run) && run.length < 20) return false; // PDF operators
          if (/^(Type|Font|Encoding|BaseFont|Subtype)/i.test(run)) return false;
          return true;
        });

        textContent = cleanRuns.join("\n").slice(0, 60000);

        if (textContent.length < 50) {
          return {
            captureId: "",
            status: "saved_without_ai" as const,
            error: `O PDF "${fileName}" não contém texto extraível. Pode ser um PDF de imagens/scan. Copie o texto do PDF manualmente e cole no campo de texto.`,
          };
        } else {
          log.info(`[FileInput] PDF text extracted: ${textContent.length} chars`);
        }
      } catch (pdfErr) {
        log.error("[FileInput] PDF extraction error:" + " " + String(pdfErr));
        return {
          captureId: "",
          status: "saved_without_ai" as const,
          error: `Erro ao ler "${fileName}". Tente copiar o texto do PDF e colar diretamente no campo de texto.`,
        };
      }

    } else if (ext === "docx" || fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // DOCX: use mammoth library for reliable extraction
      try {
        const mammoth = await import("mammoth");
        const buffer = await file.arrayBuffer();
        log.info(`[FileInput] DOCX buffer: ${buffer.byteLength} bytes`);

        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        textContent = (result.value || "").trim().slice(0, 60000);

        if (textContent.length < 20) {
          return {
            captureId: "",
            status: "saved_without_ai" as const,
            error: `O arquivo "${fileName}" parece vazio ou nao contem texto extraivel.`,
          };
        }

        log.info(`[FileInput] DOCX extracted via mammoth: ${textContent.length} chars`);
      } catch (docxErr) {
        log.error("[FileInput] DOCX extraction error:" + " " + String(docxErr));
        return {
          captureId: "",
          status: "saved_without_ai" as const,
          error: `Erro ao ler "${fileName}". Tente salvar como .txt e enviar novamente.`,
        };
      }

    } else {
      // Text-based files: .txt, .md, .csv, .json, .srt, .vtt, etc.
      try {
        textContent = await file.text();
      } catch {
        // Fallback: try reading as ArrayBuffer and decode
        try {
          const buffer = await file.arrayBuffer();
          const decoder = new TextDecoder("utf-8", { fatal: false });
          textContent = decoder.decode(buffer);
        } catch (encErr) {
          log.error("[FileInput] Text extraction error:" + " " + String(encErr));
          return { captureId: "", status: "saved_without_ai" as const, error: `Nao foi possivel ler o arquivo ${fileName}. Formato nao suportado.` };
        }
      }
    }

    if (!textContent || textContent.trim().length < 10) {
      return { captureId: "", status: "saved_without_ai" as const, error: `Arquivo ${fileName} parece vazio ou nao contém texto legivel.` };
    }

    log.info(`[FileInput] Final text: ${textContent.length} chars from ${fileName}`);

    // Sanitize: remove null bytes and control chars that crash PostgreSQL
    textContent = textContent
      .replace(/\0/g, "")                    // Remove null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ")  // Replace control chars with space
      .replace(/\s{3,}/g, "\n\n")            // Collapse excessive whitespace
      .trim();

    // Prefix with file metadata for AI context
    const enrichedInput = `[ARQUIVO: ${fileName} (${(fileSize / 1024).toFixed(1)}KB)]\n\n${textContent}`;

    log.info(`[FileInput] Sanitized text: ${enrichedInput.length} chars`);

    // Delegate to normal processing
    const origin = (formData.get("origin") as string) || "pedro";
    const skipInsights = formData.get("skipInsights") === "true";
    return submitUniversalInput(enrichedInput.slice(0, 60000), origin as "pedro" | "outros", skipInsights);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[FileInput] Unexpected error:" + " " + String(message));
    return { captureId: "", status: "saved_without_ai" as const, error: `Falha ao processar arquivo: ${message}` };
  }
}

export async function submitUniversalInput(
  input: string,
  origin: "pedro" | "outros" = "pedro",
  skipInsights: boolean = false
) {
  const supabase = await createClient();

  // Detect source type from URL
  const urlPattern = /^https?:\/\/[^\s]+$/i;
  const isUrl = urlPattern.test(input.trim());
  const isInstagram = isUrl && detectInstagramUrl(input);
  let sourceType: CaptureSourceType = "manual";

  if (isUrl) {
    const url = input.trim().toLowerCase();
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      sourceType = "youtube";
    }
  } else {
    sourceType = input.length > 500 ? "transcript" : "manual";
  }

  // 0. Deduplication — check if this exact input was already processed
  if (isUrl) {
    const { data: existing } = await supabase
      .from("captures")
      .select("id, title, status")
      .eq("source_url", input.trim())
      .eq("status", "processed")
      .limit(1)
      .single();
    if (existing) {
      log.info(`[Dedup] Input already processed: ${existing.id}`);
      revalidatePath("/");
      return {
        captureId: existing.id,
        status: "duplicate" as const,
        message: `Este link já foi processado anteriormente: "${existing.title}"`,
      };
    }
  }

  // 1. Save capture immediately (even if AI fails later)
  const title = isUrl
    ? `Input: ${new URL(input.trim()).hostname}`
    : input.slice(0, 80) + (input.length > 80 ? "..." : "");

  const { data: capture, error: captureError } = await supabase
    .from("captures")
    .insert({
      title,
      source_type: sourceType,
      source_url: isUrl ? input.trim() : null,
      raw_content: input.replace(/\0/g, "").slice(0, 60000),
      status: "pending",
      context: origin === "outros" ? "origem:outros" : "origem:pedro",
    })
    .select("id")
    .single();

  if (captureError) throw captureError;

  // 2. Log activity (fire-and-forget — don't wait)
  supabase.from("activity_log").insert({
    actor: "ia",
    action: `Novo input recebido: ${sourceType}${isInstagram ? " (Instagram)" : ""}`,
    entity_type: "capture",
    entity_id: capture.id,
    entity_title: isUrl ? input.trim() : input.slice(0, 60),
  }).then(() => {});

  // 3. Instagram scraping + AI processing — run in PARALLEL when possible
  let instagramData = null;
  let aiInput = input;

  if (isInstagram) {
    // For Instagram: scrape first (we need caption for AI), then process AI
    try {
      instagramData = await handleInstagramInput(input.trim(), supabase);
      if (instagramData?.caption) {
        aiInput = `URL: ${input.trim()}\n\nLegenda do post:\n${instagramData.caption}\n\nMétricas: ${instagramData.likes} likes, ${instagramData.comments} comentários`;
      }
      // Log scrape result (fire-and-forget)
      if (instagramData) {
        supabase.from("activity_log").insert({
          actor: "ia",
          action: `Instagram scrapado: ${instagramData.likes} likes, ${instagramData.comments} comments`,
          entity_type: "reference_post",
          entity_id: capture.id,
          entity_title: instagramData.caption?.slice(0, 60) || input.trim(),
        }).then(() => {});
      }
    } catch (err) {
      log.error("[Instagram] Scrape error:" + " " + String(err));
    }
  }

  // 3.5. YouTube: extrai titulo (+ transcricao se vier rapido) ANTES do pipeline,
  // pra ele receber conteudo real em vez de uma URL crua. extractYouTubeContent
  // ja tem orcamento de tempo interno (12s na transcricao), entao nao trava.
  if (sourceType === "youtube") {
    try {
      const yt = await extractYouTubeContent(input.trim());
      if (yt && !("error" in yt)) {
        // Trunca a transcricao: transcricoes longas (20k+ chars) fazem o pipeline
        // extrair playbooks demais e estourar o limite de 60s da Vercel.
        const transcript = yt.transcript ? yt.transcript.slice(0, 6000) : null;
        aiInput = transcript
          ? `Video do YouTube:\nTitulo: ${yt.title}\nCanal: ${yt.author}\n\nTranscricao:\n${transcript}`
          : `Video do YouTube (sem transcricao disponivel):\nTitulo: ${yt.title}\nCanal: ${yt.author}\nURL: ${input.trim()}\n\nGere propostas de conhecimento com base no titulo e tema provavel do video.`;
        log.info(`[Universal] YouTube enriquecido: "${yt.title}" — transcript ${transcript?.length ?? 0} chars (de ${yt.transcript?.length ?? 0})`);
      }
    } catch (err) {
      log.error("[YouTube] enrich error:" + " " + String(err));
    }
  }

  // 4. Skip insights mode — save directly to knowledge base as playbook
  if (skipInsights) {
    const originTag = origin === "outros" ? "origem:outros" : "origem:pedro";
    const playbookTitle = isUrl
      ? `Feed: ${new URL(input.trim()).hostname}`
      : input.slice(0, 80) + (input.length > 80 ? "..." : "");

    // Update capture as stored
    await supabase
      .from("captures")
      .update({
        title: playbookTitle,
        context: `${originTag} | Alimentado sem insights`,
        status: "stored",
      })
      .eq("id", capture.id);

    // Save directly as playbook in knowledge base
    await supabase.from("playbooks").insert({
      title: playbookTitle,
      body_markdown: input.replace(/\0/g, "").slice(0, 60000),
      completeness_score: 0.2,
      has_example: false,
      has_story: false,
      has_origin: false,
      has_counterexample: false,
    });

    await supabase.from("activity_log").insert({
      actor: "ia",
      action: "Input salvo na base de conhecimento (sem insights)",
      entity_type: "playbook",
      entity_id: capture.id,
      entity_title: playbookTitle,
    });

    revalidatePath("/base-de-conhecimento");
    revalidatePath("/");
    log.info(`[Universal] Stored as playbook without insights: ${capture.id}`);
    return {
      captureId: capture.id,
      status: "stored" as const,
      instagramData,
      origin,
    };
  }

  // 5. AI Processing — Pipeline KB v2 (extração + reconciliação + linkagem)
  try {
    const pipelineResult = await runFullPipeline(aiInput, sourceType);

    if ("error" in pipelineResult) {
      log.error("[Universal] KB Pipeline failed:" + " " + String(pipelineResult.error));
      // Se a falha foi timeout/parse (extracao ja foi lenta), NAO roda o legado —
      // seria outra chamada de IA de ~40s e garantiria o timeout de 60s da Vercel.
      const errStr = String(pipelineResult.error).toLowerCase();
      if (errStr.includes("timed out") || errStr.includes("timeout") || errStr.includes("parsear")) {
        log.info("[Universal] Falha lenta — pulando legado pra nao estourar 60s");
        revalidatePath("/");
        return { captureId: capture.id, status: "saved_without_ai" as const, instagramData };
      }
      // Fallback: tenta pipeline legado
      log.info("[Universal] Tentando pipeline legado como fallback...");
      const legacyResult = await processUniversalInput(aiInput);
      if ("error" in legacyResult) {
        revalidatePath("/");
        return { captureId: capture.id, status: "saved_without_ai" as const, instagramData };
      }
      // Salva propostas legadas (sem campos novos)
      const originTag = origin === "outros" ? "origem:outros" : "origem:pedro";
      await Promise.all([
        supabase.from("captures").update({
          title: legacyResult.title,
          context: `${originTag} | ${legacyResult.summary}`,
          status: "processed",
          speaker_verified: legacyResult.speaker_verified,
        }).eq("id", capture.id),
        // Filtra "question" — alimentar é só conhecimento (playbooks + stories)
        (() => {
          const knowledgeOnly = legacyResult.proposals.filter((p) => p.type !== "question");
          return knowledgeOnly.length > 0
            ? supabase.from("proposals").insert(
                knowledgeOnly.map((p) => ({
                  capture_id: capture.id,
                  type: p.type as "playbook" | "story",
                  title: p.title,
                  content_markdown: p.content_markdown,
                  suggested_tags: [originTag, ...(p.suggested_tags || [])],
                  status: "pending",
                }))
              )
            : Promise.resolve();
        })(),
      ]);
      revalidatePath("/");
      revalidatePath("/insights-pedro");
      return {
        captureId: capture.id,
        status: "processed" as const,
        result: legacyResult,
        instagramData,
        origin,
      };
    }

    // Pipeline v2 sucesso — salvar propostas ENRIQUECIDAS
    const originTag = origin === "outros" ? "origem:outros" : "origem:pedro";

    // Monta rows de propostas com os novos campos
    const proposalRows = pipelineResult.enriched_proposals.map((ep: EnrichedProposal) => {
      // Monta content_markdown legado a partir da estrutura (para UI existente)
      const estrutura = ep.candidato.estrutura;
      const markdownParts: string[] = [];
      if (estrutura.principio) markdownParts.push(`## Princípio\n\n${estrutura.principio}`);
      if (estrutura.quando_aplica) markdownParts.push(`## Quando Aplicar\n\n${estrutura.quando_aplica}`);
      if (estrutura.erro_comum) markdownParts.push(`## Erro Comum\n\n${estrutura.erro_comum}`);
      if (estrutura.passos && estrutura.passos.length > 0) {
        const stepsText = estrutura.passos.map((p, i) =>
          `${i + 1}. **${p.titulo}**\n${(p.como_executar || []).map(s => `   - ${s}`).join('\n')}`
        ).join('\n\n');
        markdownParts.push(`## Passos\n\n${stepsText}`);
      }
      if (estrutura.por_que_importa) markdownParts.push(`## Por que Importa\n\n${estrutura.por_que_importa}`);
      if (estrutura.exemplos && estrutura.exemplos.length > 0) {
        const exText = estrutura.exemplos.map(e => `- ${e.texto} *(${e.tipo})*`).join('\n');
        markdownParts.push(`## Exemplos\n\n${exText}`);
      }
      const contentMarkdown = markdownParts.join('\n\n');

      return {
        capture_id: capture.id,
        type: "playbook" as const,
        title: ep.candidato.titulo,
        content_markdown: contentMarkdown,
        suggested_tags: [originTag, ...(pipelineResult.extracted_themes || [])],
        status: "pending",
        // Novos campos da reconciliação
        decisao: ep.reconciliation.decisao,
        playbook_alvo_id: ep.reconciliation.playbook_alvo || null,
        tema_sugerido: ep.reconciliation.tema_sugerido,
        subtema_sugerido: ep.reconciliation.subtema_sugerido,
        diff: ep.reconciliation.diff,
        itens_afetados: ep.reconciliation.itens_afetados,
        resumo_para_pedro: ep.reconciliation.resumo_para_pedro,
        // Candidato completo no schema novo
        candidato: {
          titulo: ep.candidato.titulo,
          subtitulo: ep.candidato.subtitulo || null,
          estrutura: ep.candidato.estrutura,
          proveniencia: ep.candidato.proveniencia,
          relacoes: {
            faz_parte_de: ep.reconciliation.faz_parte_de,
            relacionado_a: ep.reconciliation.relacionado_a,
          },
          completude: ep.completude,
        },
      };
    });

    // Monta rows de histórias pessoais como propostas (tipo "story")
    const historiaRows = pipelineResult.historias_pessoais.map((h) => ({
      capture_id: capture.id,
      type: "story" as const,
      title: h.titulo,
      content_markdown: h.corpo_longo,
      suggested_tags: [originTag, "historia-pessoal"],
      status: "pending",
      decisao: "NOVO" as const,
      resumo_para_pedro: `Nova história pessoal: "${h.titulo}"`,
      candidato: {
        titulo: h.titulo,
        corpo_longo: h.corpo_longo,
        estrutura_epiphany: h.estrutura_epiphany,
        proveniencia: h.proveniencia,
      },
    }));

    const allRows = [...proposalRows, ...historiaRows];
    const totalProposals = allRows.length;

    // Salva tudo em paralelo
    await Promise.all([
      supabase.from("captures").update({
        title: pipelineResult.title,
        context: `${originTag} | ${pipelineResult.summary}`,
        status: "processed",
        speaker_verified: pipelineResult.speaker_verified,
      }).eq("id", capture.id),
      totalProposals > 0
        ? supabase.from("proposals").insert(allRows)
        : Promise.resolve(),
      supabase.from("activity_log").insert({
        actor: "ia",
        action: `Pipeline KB v2: ${totalProposals} proposta(s) ` +
          `(${proposalRows.filter(r => r.decisao === 'NOVO').length} novos, ` +
          `${proposalRows.filter(r => r.decisao === 'COMPLEMENTA').length} complementam, ` +
          `${proposalRows.filter(r => r.decisao === 'DUPLICATA').length} duplicatas)`,
        entity_type: "capture",
        entity_id: capture.id,
        entity_title: pipelineResult.title,
      }),
    ]);

    revalidatePath("/");
    revalidatePath("/insights-pedro");
    revalidatePath("/base-de-conhecimento");

    // Retorna resultado compatível com a UI existente
    const legacyProposals = allRows.map((r) => ({
      type: r.type,
      title: r.title,
      content_markdown: r.content_markdown || "",
      suggested_tags: r.suggested_tags,
    }));

    return {
      captureId: capture.id,
      status: "processed" as const,
      result: {
        detected_type: pipelineResult.detected_type,
        title: pipelineResult.title,
        summary: pipelineResult.summary,
        source_url: isUrl ? input.trim() : null,
        raw_content: input,
        proposals: legacyProposals,
        extracted_themes: pipelineResult.extracted_themes,
        speaker_verified: pipelineResult.speaker_verified,
      },
      instagramData,
      origin,
    };
  } catch (aiError) {
    log.error("[Universal] Processing error:" + " " + String(aiError));
    revalidatePath("/");
    return { captureId: capture.id, status: "saved_without_ai" as const, instagramData };
  }
}


// --- Dashboard Queries ---

export async function getRecentInputs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captures")
    .select("id, title, source_type, source_url, status, created_at, context")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const [capturesRes, playbooksRes, storiesRes, contentsRes, pendingRes] =
    await Promise.all([
      supabase.from("captures").select("id", { count: "exact", head: true }),
      supabase.from("playbooks").select("id", { count: "exact", head: true }),
      supabase.from("stories").select("id", { count: "exact", head: true }),
      supabase
        .from("generated_contents")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
  return {
    captures: capturesRes.count ?? 0,
    playbooks: playbooksRes.count ?? 0,
    stories: storiesRes.count ?? 0,
    contents: contentsRes.count ?? 0,
    pendingProposals: pendingRes.count ?? 0,
  };
}

// --- Brain Chat ---

export async function askBrain(question: string): Promise<string> {
  const supabase = await createClient();

  const [identity, playbooks, stories, recentRefs, brainRulesRes] = await Promise.all([
    supabase.from("identity").select("*").limit(1).single(),
    supabase
      .from("playbooks")
      .select("id, title, body_markdown")
      .limit(30),
    supabase
      .from("stories")
      .select("id, title, summary, body_markdown, tags")
      .limit(30),
    supabase
      .from("reference_posts")
      .select(
        "caption_text, dna_hook_type, dna_structure, dna_main_theme, profile:reference_profiles(display_name, handle)"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("decision_rules")
      .select("rule_text, context, category")
      .order("category"),
  ]);

  // Build context
  const parts: string[] = [];

  if (identity.data) {
    parts.push(
      `## Identidade do Pedro\n${JSON.stringify(identity.data, null, 2)}`
    );
  }

  if (playbooks.data && playbooks.data.length > 0) {
    const playbookText = playbooks.data
      .map(
        (p) =>
          `### ${p.title}\n${p.body_markdown || "(sem conteúdo)"}`
      )
      .join("\n\n");
    parts.push(`## Playbooks (${playbooks.data.length})\n${playbookText}`);
  }

  if (stories.data && stories.data.length > 0) {
    const storyText = stories.data
      .map(
        (s) =>
          `### ${s.title}\n${s.summary || ""}\n${s.body_markdown || "(sem conteúdo)"}\nTags: ${(s.tags || []).join(", ")}`
      )
      .join("\n\n");
    parts.push(`## Histórias (${stories.data.length})\n${storyText}`);
  }

  if (recentRefs.data && recentRefs.data.length > 0) {
    const refText = recentRefs.data
      .map((r) => {
        const profile = r.profile as unknown as {
          display_name: string;
          handle: string;
        } | null;
        const profileName = profile
          ? `${profile.display_name} (@${profile.handle})`
          : "Desconhecido";
        return `- ${profileName}: ${(r.caption_text || "").slice(0, 200)} [Hook: ${r.dna_hook_type || "?"}, Tema: ${r.dna_main_theme || "?"}]`;
      })
      .join("\n");
    parts.push(
      `## Referências Recentes (${recentRefs.data.length})\n${refText}`
    );
  }

  if (brainRulesRes.data && brainRulesRes.data.length > 0) {
    const rulesText = brainRulesRes.data
      .map((r: { rule_text: string; context?: string | null }) => `- ${r.rule_text}${r.context ? ` (${r.context})` : ''}`)
      .join("\n");
    parts.push(`## Regras de Decisao do Pedro (SIGA SEMPRE)\n${rulesText}`);
  }

  const knowledgeContext = parts.join("\n\n---\n\n");

  const systemPrompt =
    "Você é o Segundo Cérebro do Pedro Rabelo. Você sabe TUDO que está na base de conhecimento dele. " +
    "Responda como se fosse a memória e inteligência do Pedro — use os playbooks, histórias e referências " +
    "para dar respostas completas e contextualizadas. Se não souber algo, diga que ainda não tem essa " +
    "informação na base. Responda sempre em português brasileiro, de forma direta e útil.\n\n" +
    "=== BASE DE CONHECIMENTO ===\n\n" +
    knowledgeContext;

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user", content: question }],
  });

  logCost(
    "claude-sonnet-4-6",
    response.usage.input_tokens,
    response.usage.output_tokens
  );

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return text;
}

// --- Brain Chat (Persistent) ---

export async function getChats(): Promise<
  { id: string; title: string; updated_at: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brain_chats")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function createChat(): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brain_chats")
    .insert({ title: "Nova conversa" })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function getChatMessages(
  chatId: string
): Promise<
  { id: string; role: string; content: string; created_at: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brain_messages")
    .select("id, role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendChatMessage(
  chatId: string,
  question: string
): Promise<{ response: string }> {
  const supabase = await createClient();

  // 1. Save user message
  await supabase
    .from("brain_messages")
    .insert({ chat_id: chatId, role: "user", content: question });

  // 2. Fetch last 10 messages for conversation history
  const { data: previousMessages } = await supabase
    .from("brain_messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(10);

  const history = (previousMessages ?? []).reverse();

  // 3. Fetch knowledge context (same as askBrain)
  const [identity, playbooks, stories, recentRefs, chatRulesRes] = await Promise.all([
    supabase.from("identity").select("*").limit(1).single(),
    supabase
      .from("playbooks")
      .select("id, title, body_markdown")
      .limit(30),
    supabase
      .from("stories")
      .select("id, title, summary, body_markdown, tags")
      .limit(30),
    supabase
      .from("reference_posts")
      .select(
        "caption_text, dna_hook_type, dna_structure, dna_main_theme, profile:reference_profiles(display_name, handle)"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("decision_rules")
      .select("rule_text, context, category")
      .order("category"),
  ]);

  const parts: string[] = [];

  if (identity.data) {
    parts.push(
      `## Identidade do Pedro\n${JSON.stringify(identity.data, null, 2)}`
    );
  }

  if (playbooks.data && playbooks.data.length > 0) {
    const playbookText = playbooks.data
      .map(
        (p) =>
          `### ${p.title}\n${p.body_markdown || "(sem conteúdo)"}`
      )
      .join("\n\n");
    parts.push(`## Playbooks (${playbooks.data.length})\n${playbookText}`);
  }

  if (stories.data && stories.data.length > 0) {
    const storyText = stories.data
      .map(
        (s) =>
          `### ${s.title}\n${s.summary || ""}\n${s.body_markdown || "(sem conteúdo)"}\nTags: ${(s.tags || []).join(", ")}`
      )
      .join("\n\n");
    parts.push(`## Histórias (${stories.data.length})\n${storyText}`);
  }

  if (recentRefs.data && recentRefs.data.length > 0) {
    const refText = recentRefs.data
      .map((r) => {
        const profile = r.profile as unknown as {
          display_name: string;
          handle: string;
        } | null;
        const profileName = profile
          ? `${profile.display_name} (@${profile.handle})`
          : "Desconhecido";
        return `- ${profileName}: ${(r.caption_text || "").slice(0, 200)} [Hook: ${r.dna_hook_type || "?"}, Tema: ${r.dna_main_theme || "?"}]`;
      })
      .join("\n");
    parts.push(
      `## Referências Recentes (${recentRefs.data.length})\n${refText}`
    );
  }

  if (chatRulesRes.data && chatRulesRes.data.length > 0) {
    const rulesText = chatRulesRes.data
      .map((r: { rule_text: string; context?: string | null }) => `- ${r.rule_text}${r.context ? ` (${r.context})` : ''}`)
      .join("\n");
    parts.push(`## Regras de Decisao do Pedro (SIGA SEMPRE)\n${rulesText}`);
  }

  const knowledgeContext = parts.join("\n\n---\n\n");

  const systemPrompt =
    "Você é o Segundo Cérebro do Pedro Rabelo. Você sabe TUDO que está na base de conhecimento dele. " +
    "Responda como se fosse a memória e inteligência do Pedro — use os playbooks, histórias e referências " +
    "para dar respostas completas e contextualizadas. Se não souber algo, diga que ainda não tem essa " +
    "informação na base. Responda sempre em português brasileiro, de forma direta e útil.\n\n" +
    "=== BASE DE CONHECIMENTO ===\n\n" +
    knowledgeContext;

  // 4. Call Claude with conversation history
  const client = getClient();
  const messages = history.map((m) => ({
    role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages,
  });

  logCost(
    "claude-sonnet-4-6",
    response.usage.input_tokens,
    response.usage.output_tokens
  );

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // 5. Save brain response
  await supabase
    .from("brain_messages")
    .insert({ chat_id: chatId, role: "brain", content: text });

  // 6. Auto-update title on first message & update timestamp
  const { count } = await supabase
    .from("brain_messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId);

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (count !== null && count <= 2) {
    updates.title = question.slice(0, 50);
  }

  await supabase.from("brain_chats").update(updates).eq("id", chatId);

  return { response: text };
}

export async function deleteChat(chatId: string): Promise<void> {
  const supabase = await createClient();
  // Delete messages first, then chat
  await supabase.from("brain_messages").delete().eq("chat_id", chatId);
  await supabase.from("brain_chats").delete().eq("id", chatId);
}

export async function renameChat(
  chatId: string,
  title: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("brain_chats")
    .update({ title })
    .eq("id", chatId);
}

// --- Activity Feed ---

export async function getActivityFeed() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}
