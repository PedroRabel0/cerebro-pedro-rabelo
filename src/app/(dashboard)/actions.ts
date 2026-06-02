"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { processUniversalInput } from "@/lib/ai/universal";
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
    console.error("[Apify] Scrape failed:", scraped.error);
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

    console.log(`[FileInput] Processing: ${fileName} (${(fileSize / 1024).toFixed(1)}KB, type: ${fileType}, ext: ${ext})`);

    // Reject files too large (10MB limit — matches next.config bodySizeLimit)
    if (fileSize > 10 * 1024 * 1024) {
      return { captureId: "", status: "saved_without_ai" as const, error: "Arquivo muito grande. Limite: 10MB." };
    }

    let textContent = "";

    // Handle by file type
    if (fileType === "application/pdf" || ext === "pdf") {
      // PDF: extract readable text strings
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const rawStr = decoder.decode(bytes);

        // Extract text between BT/ET markers (PDF text objects) or plain readable runs
        const textRuns: string[] = [];

        // Method 1: Extract parenthesized strings (PDF text)
        const parenMatches = rawStr.match(/\(([^)]{3,})\)/g);
        if (parenMatches) {
          for (const m of parenMatches) {
            const inner = m.slice(1, -1)
              .replace(/\\n/g, "\n")
              .replace(/\\r/g, "")
              .replace(/\\\\/g, "\\")
              .replace(/\\([()])/g, "$1");
            if (inner.length > 3 && /[a-zA-ZáàãâéèêíóòõôúçÁÀÃÂÉÈÊÍÓÒÕÔÚÇ]/.test(inner)) {
              textRuns.push(inner);
            }
          }
        }

        // Method 2: Also try extracting long readable runs
        const readableRuns = rawStr.match(/[a-zA-ZáàãâéèêíóòõôúçÁÀÃÂÉÈÊÍÓÒÕÔÚÇ0-9\s,.;:!?()"-]{20,}/g);
        if (readableRuns) {
          for (const r of readableRuns) {
            if (!textRuns.some(t => t.includes(r.trim().slice(0, 20)))) {
              textRuns.push(r.trim());
            }
          }
        }

        textContent = textRuns.join("\n").slice(0, 60000);

        if (textContent.length < 50) {
          return {
            captureId: "",
            status: "saved_without_ai" as const,
            error: `O PDF "${fileName}" não contém texto extraível. Pode ser um PDF de imagens/scan. Copie o texto do PDF manualmente e cole no campo de texto.`,
          };
        } else {
          console.log(`[FileInput] PDF text extracted: ${textContent.length} chars`);
        }
      } catch (pdfErr) {
        console.error("[FileInput] PDF extraction error:", pdfErr);
        return {
          captureId: "",
          status: "saved_without_ai" as const,
          error: `Erro ao ler "${fileName}". Tente copiar o texto do PDF e colar diretamente no campo de texto.`,
        };
      }

    } else if (ext === "docx") {
      // DOCX is a ZIP file — extract document.xml text
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const rawStr = decoder.decode(bytes);

        // Extract text between XML tags (rough but works for body text)
        const xmlText = rawStr.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
        if (xmlText && xmlText.length > 0) {
          textContent = xmlText
            .map(t => t.replace(/<[^>]+>/g, ""))
            .join(" ")
            .slice(0, 60000);
          console.log(`[FileInput] DOCX text extracted: ${textContent.length} chars`);
        } else {
          return {
            captureId: "",
            status: "saved_without_ai" as const,
            error: `Não foi possível extrair texto do arquivo "${fileName}". Tente salvar como .txt e enviar novamente.`,
          };
        }
      } catch (docxErr) {
        console.error("[FileInput] DOCX extraction error:", docxErr);
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
          console.error("[FileInput] Text extraction error:", encErr);
          return { captureId: "", status: "saved_without_ai" as const, error: `Nao foi possivel ler o arquivo ${fileName}. Formato nao suportado.` };
        }
      }
    }

    if (!textContent || textContent.trim().length < 10) {
      return { captureId: "", status: "saved_without_ai" as const, error: `Arquivo ${fileName} parece vazio ou nao contém texto legivel.` };
    }

    console.log(`[FileInput] Final text: ${textContent.length} chars from ${fileName}`);

    // Sanitize: remove null bytes and control chars that crash PostgreSQL
    textContent = textContent
      .replace(/\0/g, "")                    // Remove null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ")  // Replace control chars with space
      .replace(/\s{3,}/g, "\n\n")            // Collapse excessive whitespace
      .trim();

    // Prefix with file metadata for AI context
    const enrichedInput = `[ARQUIVO: ${fileName} (${(fileSize / 1024).toFixed(1)}KB)]\n\n${textContent}`;

    console.log(`[FileInput] Sanitized text: ${enrichedInput.length} chars`);

    // Delegate to normal processing
    const origin = (formData.get("origin") as string) || "pedro";
    return submitUniversalInput(enrichedInput.slice(0, 60000), origin as "pedro" | "outros");

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[FileInput] Unexpected error:", message);
    return { captureId: "", status: "saved_without_ai" as const, error: `Falha ao processar arquivo: ${message}` };
  }
}

export async function submitUniversalInput(
  input: string,
  origin: "pedro" | "outros" = "pedro"
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
      console.log(`[Dedup] Input already processed: ${existing.id}`);
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
      console.error("[Instagram] Scrape error:", err);
    }
  }

  // 4. AI Processing (Claude) — the main bottleneck
  try {
    const result = await processUniversalInput(aiInput);

    if ("error" in result) {
      console.error("[Universal] AI processing failed:", result.error);
      revalidatePath("/");
      return { captureId: capture.id, status: "saved_without_ai" as const, instagramData };
    }

    // Save all DB operations in PARALLEL (not sequential)
    await Promise.all([
      (async () => {
        await supabase
          .from("captures")
          .update({
            title: result.title,
            context: result.summary,
            status: "processed",
            speaker_verified: result.speaker_verified,
          })
          .eq("id", capture.id);
      })(),
      (async () => {
        if (result.proposals.length > 0) {
          const proposalRows = result.proposals.map((p) => ({
            capture_id: capture.id,
            type: p.type as "playbook" | "story" | "question",
            title: p.title,
            content_markdown: p.content_markdown,
            suggested_tags: p.suggested_tags || [],
            status: "pending",
          }));
          await supabase.from("proposals").insert(proposalRows);
        }
      })(),
      (async () => {
        await supabase.from("activity_log").insert({
          actor: "ia",
          action: `Processou input e gerou ${result.proposals.length} proposta(s)`,
          entity_type: "capture",
          entity_id: capture.id,
          entity_title: result.title,
        });
      })(),
    ]);

    revalidatePath("/");
    revalidatePath("/insights-pedro");
    revalidatePath("/base-de-conhecimento");

    return {
      captureId: capture.id,
      status: "processed" as const,
      result,
      instagramData,
      origin,
    };
  } catch (aiError) {
    console.error("[Universal] Processing error:", aiError);
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

  const [identity, playbooks, stories, recentRefs] = await Promise.all([
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
