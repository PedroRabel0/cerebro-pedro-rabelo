"use server";


import { log } from '@/lib/logger';
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateContent } from "@/lib/ai";
import { generateImagePrompt } from "@/lib/ai/gemini";
import { generateImage } from "@/lib/ai/image-gen";
import type { ContentType } from "@/lib/supabase/types";

const PATH = "/gerar-conteudo";

// --- Content Formats ---

export async function getFormats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_formats")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createFormat(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("content_formats").insert({
    name: formData.get("name") as string,
    content_type: formData.get("content_type") as string,
    description: (formData.get("description") as string) || null,
    structure_markdown: (formData.get("structure_markdown") as string) || null,
  });
  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteFormat(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_formats")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Generated Contents ---

export async function getGeneratedContents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_contents")
    .select(
      "*, playbook:playbooks(id, title), story:stories(id, title), format:content_formats(*)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createGeneratedContent(formData: FormData) {
  const supabase = await createClient();
  const sourceType = formData.get("source_type") as string;
  const playbookId = (formData.get("playbook_id") as string) || null;
  const storyId = (formData.get("story_id") as string) || null;
  const freeTextInput = (formData.get("free_text_input") as string) || null;
  const contentType = formData.get("content_type") as string;
  const formatId = (formData.get("format_id") as string) || null;

  const { data: inserted, error } = await supabase
    .from("generated_contents")
    .insert({
      source_type: sourceType,
      playbook_id: playbookId,
      story_id: storyId,
      free_text_input: freeTextInput,
      content_type: contentType,
      format_id: formatId,
      content_text:
        "Geração de conteúdo pendente — integração com IA em breve",
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;

  // AI generation (non-blocking — record is already saved)
  try {
    // Fetch supporting data for AI
    const [identityRes, playbookRes, storyRes, formatRes, feedbackRes, rulesRes] =
      await Promise.all([
        supabase.from("identity").select("*").limit(1).single(),
        playbookId
          ? supabase.from("playbooks").select("*").eq("id", playbookId).single()
          : Promise.resolve({ data: null }),
        storyId
          ? supabase.from("stories").select("*").eq("id", storyId).single()
          : Promise.resolve({ data: null }),
        formatId
          ? supabase
              .from("content_formats")
              .select("*")
              .eq("id", formatId)
              .single()
          : Promise.resolve({ data: null }),
        supabase
          .from("generated_contents")
          .select("feedback_text, feedback_rating")
          .not("feedback_text", "is", null)
          .eq("feedback_rating", "bad")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("decision_rules")
          .select("rule_text, context, category")
          .order("category"),
      ]);

    const result = await generateContent({
      identity: identityRes.data,
      playbook: playbookRes.data,
      story: storyRes.data,
      format: formatRes.data,
      freeText: freeTextInput ?? undefined,
      contentType,
      recentFeedbacks: feedbackRes.data ?? [],
      rules: rulesRes.data ?? undefined,
    });

    if (!("error" in result)) {
      await supabase
        .from("generated_contents")
        .update({
          content_text: result.content_text,
          source_map: result.source_map,
        })
        .eq("id", inserted.id);

      // Generate image PROMPT only (user copies to their own image AI)
      try {
        const promptResult = await generateImagePrompt(
          result.content_text,
          contentType
        );

        if (!("error" in promptResult)) {
          await supabase
            .from("generated_contents")
            .update({
              image_prompt: promptResult.image_prompt,
              image_model: "prompt-only",
            })
            .eq("id", inserted.id);
        }
      } catch (imgError) {
        log.error("[AI] Image prompt generation error:" + " " + String(imgError));
      }
    }
  } catch (aiError) {
    log.error("[AI] generateContent failed:" + " " + String(aiError));
  }

  revalidatePath(PATH);
}

export async function createQuickContent(
  formData: FormData
): Promise<{ content: string; id: string } | { error: string }> {
  const supabase = await createClient();
  const topic = formData.get("topic") as string;
  const contentType = formData.get("content_type") as string;

  if (!topic || !contentType) {
    return { error: "Topico e tipo de conteudo sao obrigatorios." };
  }

  try {
    // Fetch identity, all playbooks, all stories in parallel
    const [identityRes, playbooksRes, storiesRes, feedbackRes, rulesRes] =
      await Promise.all([
        supabase.from("identity").select("*").limit(1).single(),
        supabase
          .from("playbooks")
          .select("id, title, body_markdown")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("stories")
          .select("id, title, summary, body_markdown")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("generated_contents")
          .select("feedback_text, feedback_rating")
          .not("feedback_text", "is", null)
          .eq("feedback_rating", "bad")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("decision_rules")
          .select("rule_text, context, category")
          .order("category"),
      ]);

    // Pick top 3 playbooks relevant to the topic (simple keyword match, fallback to first 3)
    const allPlaybooks = playbooksRes.data ?? [];
    const topicLower = topic.toLowerCase();
    const relevantPlaybooks = allPlaybooks
      .filter(
        (p) =>
          p.title.toLowerCase().includes(topicLower) ||
          topicLower.split(" ").some((w: string) => w.length > 3 && p.title.toLowerCase().includes(w))
      )
      .slice(0, 3);
    const selectedPlaybooks =
      relevantPlaybooks.length > 0
        ? relevantPlaybooks
        : allPlaybooks.slice(0, 3);

    // Pick top 2 stories relevant to the topic
    const allStories = storiesRes.data ?? [];
    const relevantStories = allStories
      .filter(
        (s) =>
          s.title.toLowerCase().includes(topicLower) ||
          (s.summary && s.summary.toLowerCase().includes(topicLower)) ||
          topicLower.split(" ").some((w) => w.length > 3 && s.title.toLowerCase().includes(w))
      )
      .slice(0, 2);
    const selectedStories =
      relevantStories.length > 0
        ? relevantStories
        : allStories.slice(0, 2);

    // Build playbook context
    const playbookContext = selectedPlaybooks
      .map(
        (p) =>
          `### ${p.title}\n${(p.body_markdown || "").slice(0, 1500)}`
      )
      .join("\n\n");

    // Build story context
    const storyContext = selectedStories
      .map(
        (s) =>
          `### ${s.title}\n${s.summary || ""}\n${(s.body_markdown || "").slice(0, 1000)}`
      )
      .join("\n\n");

    // Use the existing generateContent function with constructed inputs
    const result = await generateContent({
      identity: identityRes.data,
      playbook: selectedPlaybooks[0]
        ? {
            id: selectedPlaybooks[0].id,
            title: selectedPlaybooks[0].title,
            body_markdown: selectedPlaybooks[0].body_markdown,
            subtitle: null,
            completeness_score: 0,
            has_example: false,
            has_story: false,
            has_origin: false,
            has_counterexample: false,
            version_current: null,
            version_previous: null,
            created_by: null,
            created_at: "",
            updated_at: "",
            theme_id: null,
          }
        : undefined,
      story: selectedStories[0]
        ? {
            id: selectedStories[0].id,
            title: selectedStories[0].title,
            summary: selectedStories[0].summary,
            body_markdown: selectedStories[0].body_markdown,
            period: null,
            tags: [],
            lesson: null,
            version_current: null,
            version_previous: null,
            created_by: null,
            created_at: "",
            updated_at: "",
          }
        : undefined,
      contentType,
      rules: rulesRes.data ?? undefined,
      freeText: `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUES BRASILEIRO (PT-BR).

TOPICO SOLICITADO: ${topic}

CONTEXTO ADICIONAL DA BASE DE CONHECIMENTO:

## Playbooks Relevantes:
${playbookContext || "Nenhum playbook encontrado."}

## Historias Relevantes:
${storyContext || "Nenhuma historia encontrada."}

INSTRUCAO: Gere um conteudo PRONTO PARA POSTAR sobre o topico acima. Use as informacoes dos playbooks e historias como base. O conteudo deve ser direto, pratico e refletir o tom e voz da identidade fornecida.`,
      recentFeedbacks: feedbackRes.data ?? [],
    });

    if ("error" in result) {
      return { error: result.error };
    }

    // Save to database
    const { data: inserted, error: insertError } = await supabase
      .from("generated_contents")
      .insert({
        source_type: "free_text" as const,
        playbook_id: selectedPlaybooks[0]?.id || null,
        story_id: selectedStories[0]?.id || null,
        free_text_input: topic,
        content_type: contentType,
        format_id: null,
        content_text: result.content_text,
        source_map: result.source_map,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Generate image PROMPT only (user copies to their own image AI)
    try {
      const promptResult = await generateImagePrompt(
        result.content_text,
        contentType
      );
      if (!("error" in promptResult)) {
        await supabase
          .from("generated_contents")
          .update({
            image_prompt: promptResult.image_prompt,
            image_model: "prompt-only",
          })
          .eq("id", inserted.id);
      }
    } catch (imgError) {
      log.error("[AI] Image prompt error:" + " " + String(imgError));
    }

    revalidatePath(PATH);

    return {
      content: result.content_text,
      id: inserted.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[QuickContent] Error:" + " " + String(message));
    return { error: `Falha ao gerar conteudo: ${message}` };
  }
}

export async function updateContentStatus(
  id: string,
  status: string,
  feedbackRating?: string,
  feedbackText?: string
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = { status };
  if (feedbackRating !== undefined) update.feedback_rating = feedbackRating;
  if (feedbackText !== undefined) update.feedback_text = feedbackText;

  const { error } = await supabase
    .from("generated_contents")
    .update(update)
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

export async function deleteContent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("generated_contents")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

// --- Lookup data ---

export async function getPlaybooks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbooks")
    .select("id, title")
    .order("title");
  if (error) throw error;
  return data;
}

export async function getStories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("id, title")
    .order("title");
  if (error) throw error;
  return data;
}

export async function getThemes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

// --- Wizard Content Generation ---

export interface WizardPayload {
  source: string;
  topicMode: string;
  playbookId?: string;
  storyId?: string;
  freeTopic?: string;
  recorte?: string;
  pullStory: string;
  pullStoryId?: string;
  audience?: string;
  extraContext?: string;
  contentTypes: string[];
  typeDetails: Record<string, Record<string, string>>;
}

export interface WizardResult {
  id: string;
  contentType: ContentType;
  content: string;
  sourceMap: Record<string, unknown> | null;
  imagePrompt?: string | null;
  source: "base_only" | "references_only" | "both" | "free_text";
}

export async function createWizardContent(
  payload: WizardPayload
): Promise<{ results: WizardResult[] } | { error: string }> {
  const supabase = await createClient();

  if (!payload.contentTypes || payload.contentTypes.length === 0) {
    return { error: "Selecione pelo menos um tipo de conteudo." };
  }

  try {
    // Fetch identity, playbook, stories in parallel
    const playbookId = payload.playbookId || null;
    const storyId = payload.storyId || payload.pullStoryId || null;

    const [identityRes, playbooksRes, storiesRes, feedbackRes, playbookRes, storyRes, wizardRulesRes] =
      await Promise.all([
        supabase.from("identity").select("*").limit(1).single(),
        supabase
          .from("playbooks")
          .select("id, title, body_markdown")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("stories")
          .select("id, title, summary, body_markdown")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("generated_contents")
          .select("feedback_text, feedback_rating")
          .not("feedback_text", "is", null)
          .eq("feedback_rating", "bad")
          .order("created_at", { ascending: false })
          .limit(5),
        playbookId
          ? supabase.from("playbooks").select("*").eq("id", playbookId).single()
          : Promise.resolve({ data: null }),
        storyId
          ? supabase.from("stories").select("*").eq("id", storyId).single()
          : Promise.resolve({ data: null }),
        supabase
          .from("decision_rules")
          .select("rule_text, context, category")
          .order("category"),
      ]);

    // Fetch reference posts when source is "both" or "references_only"
    let referenceContext = "";
    if (payload.source !== "base_only") {
      const { data: refPosts } = await supabase
        .from("reference_posts")
        .select("caption_text, profile_id, dna_hook_type, dna_structure, dna_main_theme")
        .order("posted_at", { ascending: false })
        .limit(10);

      // Fetch profile info for attribution
      let profileMap: Record<string, string> = {};
      if (refPosts && refPosts.length > 0) {
        const profileIds = [...new Set(refPosts.map((p) => p.profile_id).filter(Boolean))];
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from("reference_profiles")
            .select("id, display_name, handle")
            .in("id", profileIds);
          if (profiles) {
            profileMap = Object.fromEntries(
              profiles.map((p) => [p.id, `@${p.handle || p.display_name}`])
            );
          }
        }
      }

      if (refPosts && refPosts.length > 0) {
        referenceContext = refPosts
          .map((p) => {
            const handle = profileMap[p.profile_id] || "desconhecido";
            const dna = [p.dna_hook_type, p.dna_structure, p.dna_main_theme]
              .filter(Boolean)
              .join(" | ");
            const caption = (p.caption_text || "").slice(0, 800);
            return `### Ref: ${handle}${dna ? ` (${dna})` : ""}\n${caption}`;
          })
          .join("\n\n");
      }
    }

    // Build context from knowledge base
    const allPlaybooks = playbooksRes.data ?? [];
    const allStories = storiesRes.data ?? [];

    const topicText = payload.freeTopic || playbookRes.data?.title || "conteudo";
    const topicLower = topicText.toLowerCase();

    // Pick relevant playbooks
    const relevantPlaybooks = playbookId
      ? allPlaybooks.filter((p) => p.id === playbookId)
      : allPlaybooks
          .filter(
            (p) =>
              p.title.toLowerCase().includes(topicLower) ||
              topicLower
                .split(" ")
                .some((w: string) => w.length > 3 && p.title.toLowerCase().includes(w))
          )
          .slice(0, 3);
    const selectedPlaybooks =
      relevantPlaybooks.length > 0
        ? relevantPlaybooks
        : allPlaybooks.slice(0, 3);

    // Pick relevant stories
    let selectedStories: typeof allStories = [];
    if (storyId) {
      selectedStories = allStories.filter((s) => s.id === storyId);
    } else if (payload.pullStory === "no") {
      selectedStories = [];
    } else {
      const relevant = allStories
        .filter(
          (s) =>
            s.title.toLowerCase().includes(topicLower) ||
            (s.summary && s.summary.toLowerCase().includes(topicLower)) ||
            topicLower
              .split(" ")
              .some((w: string) => w.length > 3 && s.title.toLowerCase().includes(w))
        )
        .slice(0, 2);
      selectedStories = relevant.length > 0 ? relevant : allStories.slice(0, 2);
    }

    // Build context strings
    const playbookContext = selectedPlaybooks
      .map((p) => `### ${p.title}\n${(p.body_markdown || "").slice(0, 1500)}`)
      .join("\n\n");

    const storyContext = selectedStories
      .map(
        (s) =>
          `### ${s.title}\n${s.summary || ""}\n${(s.body_markdown || "").slice(0, 1000)}`
      )
      .join("\n\n");

    // Generate content for each selected type
    const results: WizardResult[] = [];

    for (const contentType of payload.contentTypes) {
      const details = payload.typeDetails[contentType] || {};

      // Build type-specific instructions
      let typeInstructions = "";
      switch (contentType) {
        case "instagram_carousel":
          typeInstructions = `FORMATO: Instagram Carousel (${details.num_slides || "6"} slides)
OBJETIVO: ${details.objetivo || "educar"}

ESTRUTURA OBRIGATÓRIA:

**SLIDE 1 — CAPA (o mais importante):**
Frase de impacto curta que faça a pessoa parar de rolar o feed.${details.gancho ? ` Use como base: "${details.gancho}"` : ""}
- Máximo 8-10 palavras
- Deve gerar curiosidade ou identificação imediata
- Funciona sozinha sem contexto — é o que decide se a pessoa desliza ou não
- Exemplos de estrutura: "X coisas que [público] faz errado", "O que ninguém te conta sobre [tema]", "Como eu [resultado] em [tempo]"

**SLIDES 2 a ${(parseInt(details.num_slides) || 6) - 1} — CONTEÚDO:**
- Cada slide = 1 ideia/ponto. NUNCA mais de uma ideia por slide.
- Texto curto: 2-4 frases por slide (vai ser lido em imagem, não em texto corrido)
- Use numeração ou títulos em cada slide ("1. ...", "2. ...")
- Alterne entre: dado concreto → exemplo → provocação → framework
- Linguagem direta, como se estivesse explicando pra um amigo

**ÚLTIMO SLIDE — CTA:**
${details.cta ? `CTA definido: "${details.cta}"` : "Termine com CTA forte: salvar, compartilhar, ou pergunta nos comentários."}
- Deve dar um motivo CONCRETO pra interagir ("Salva pra consultar quando precisar")
- Pode incluir: "Siga @pedrorabelo pra mais conteúdo sobre [tema]"

**LEGENDA DO POST (após os slides):**
IMPORTANTE: A legenda NÃO repete o conteúdo dos slides. Os slides já ensinam — a legenda COMPLEMENTA com:
- Hook forte na primeira linha
- 2-4 parágrafos curtos: contexto pessoal, por que esse tema importa, ou bastidor
- CTA final + 5-8 hashtags
- Máximo 100-120 palavras na legenda

FORMATO DE RESPOSTA:
Primeiro gere cada slide numerado (SLIDE 1:, SLIDE 2:, etc.), depois uma seção "---LEGENDA---" com a legenda completa.`;
          break;
        case "linkedin_post":
          typeInstructions = `FORMATO: LinkedIn Post
OBJETIVO: ${details.objetivo || "educar e gerar autoridade"}
TAMANHO: ${details.tamanho || "medio"} (curto <100 palavras, medio 100-200, longo 200-300). NUNCA passe de 300 palavras.

ESTRUTURA OBRIGATÓRIA:

**LINHA 1 — HOOK (aparece no preview do feed):**
${details.abertura === "dado" ? "Comece com um dado ou número surpreendente." : details.abertura === "pergunta" ? "Comece com uma pergunta provocativa." : details.abertura === "historia" ? "Comece com o início de uma história pessoal." : "Comece com uma frase de impacto que gere identificação."}
- No LinkedIn, as primeiras 2 linhas decidem tudo. Pense em "manchete de jornal".
- NUNCA comece com "Hoje quero compartilhar..." ou "Essa semana eu..."

**CORPO:**
- Cada parágrafo = 1-2 linhas. Texto longo no LinkedIn não performa.
- Use MUITA quebra de linha — cada frase pode ser um parágrafo
- Tom: profissional mas humano. Não é artigo acadêmico, é conversa entre profissionais.
- Inclua pelo menos 1 experiência pessoal concreta (com números se possível)
- Frameworks e listas funcionam bem ("3 aprendizados:", "O que eu faria diferente:")
- Evite: emojis excessivos, linguagem de Instagram, tom de coach motivacional
- LinkedIn premia conteúdo que gera comentários longos — faça perguntas ao longo do texto

**FECHAMENTO:**
${details.cta ? `CTA: "${details.cta}"` : "CTA que incentive comentários (LinkedIn valoriza isso no algoritmo). Faça uma pergunta ESPECÍFICA, não genérica."}
- BOM: "Qual foi a decisão mais difícil que você já tomou no seu negócio? Conta aqui 👇"
- RUIM: "Concorda? Curta e compartilhe!"

**HASHTAGS:** 3-5 hashtags profissionais no final (${details.hashtags || "#ecommerce #empreendedorismo #gestão #liderança #negócios"})`;
          break;
        case "x_thread":
          typeInstructions = `FORMATO: X/Twitter Thread (${details.num_tweets || "5-7"} tweets)
OBJETIVO: ${details.objetivo || "educar"}

REGRAS DO X/TWITTER:
- Cada tweet MÁXIMO 280 caracteres (isso é INEGOCIÁVEL)
- Linguagem mais direta e afiada que Instagram — sem enrolação
- Threads que viralizam: opinião forte + exemplos + actionable

ESTRUTURA OBRIGATÓRIA:

**TWEET 1 — TESE (o tweet que faz a pessoa clicar "Mostrar thread"):**
${details.tese ? `Tese definida: "${details.tese}"` : "Afirmação forte e provocativa sobre o tema. Deve funcionar sozinha como tweet."}
- Deve ser autocontido — alguém que vê só esse tweet já se interessa
- Termine com "🧵" ou "Thread:" pra sinalizar que tem mais

**TWEETS 2 a ${(parseInt(details.num_tweets) || 5) - 1} — DESENVOLVIMENTO:**
- 1 ideia por tweet, sem tentar enfiar tudo junto
- Alterne entre: insight → exemplo concreto → provocação → dado
- Use "→" e quebras pra facilitar leitura
- Pode usar 1-2 emojis por tweet se fizer sentido (mais que isso fica infantil no X)
- Numere os tweets: "1/", "2/", etc.

**ÚLTIMO TWEET — CTA + RESUMO:**
${details.cta ? `CTA: "${details.cta}"` : "Resuma a thread em 1 frase + peça RT/like/follow"}
- BOM: "Se isso fez sentido, dá RT no primeiro tweet. Ajuda mais gente a ver. 🔄"
- Pode fechar com: "Me segue pra mais threads sobre [tema] 📌"

**HASHTAGS:** 1-2 máximo, só no último tweet. No X hashtag em excesso é amador.`;
          break;
        case "x_tweet":
          typeInstructions = `FORMATO: X/Twitter — Tweet Único
OBJETIVO: ${details.objetivo || "provocar reflexão"}
TOM: ${details.tom || "provocativo e direto"}

REGRAS:
- MÁXIMO 280 CARACTERES (isso é INEGOCIÁVEL, conte os caracteres)
- Um tweet viral = 1 ideia afiada, não um resumo de post
- Priorize: opinião forte, observação inteligente, ou pergunta que gera debate
- Tom do X é mais seco e direto que Instagram. Sem firula.
- Pode usar 1 emoji se fizer sentido. Zero emojis também é ok.
- Sem hashtags no corpo (no máximo 1 se for relevante)

ESTRUTURAS QUE FUNCIONAM NO X:
- Opinião polêmica: "Hot take: [opinião]"
- Observação: "[Fato inesperado]. E ninguém fala sobre isso."
- Framework curto: "Regra de ouro: [regra em 1 frase]"
- Pergunta retórica: "Por que [situação absurda] ainda acontece?"
- Contraste: "Todo mundo faz X. Os melhores fazem Y."

Gere APENAS o tweet. Nada antes, nada depois.`;
          break;
        case "instagram_reel":
          typeInstructions = `FORMATO: Instagram Reels — Roteiro de Gravação
OBJETIVO: ${details.objetivo || "educar e entreter"}
DURAÇÃO: ${details.duracao || "30-60 segundos"}
QUEM APARECE: ${details.quem_aparece || "Pedro (falando direto pra câmera)"}
ENERGIA: ${details.energia || "alta, confiante"}

ESTRUTURA OBRIGATÓRIA:

**[0-3s] GANCHO — Os 3 segundos que decidem tudo:**
${details.gancho ? `Gancho definido: "${details.gancho}"` : "Crie um gancho que faça a pessoa parar de rolar IMEDIATAMENTE."}
- Técnicas: pergunta chocante, afirmação polêmica, "Isso aqui mudou meu negócio", mostrar resultado
- Tom: urgência + curiosidade. A pessoa tem que pensar "preciso ver o resto"
- NUNCA comece com: "Fala galera", "E aí pessoal", "Nesse vídeo eu vou..."

**[3-${details.duracao === "15-30s" ? "25" : "50"}s] DESENVOLVIMENTO:**
- Linguagem oral/natural — como se estivesse contando pra um amigo
- Frases CURTAS. No vídeo curto, cada segundo conta.
- Indique mudanças visuais: [CORTE], [TEXTO NA TELA: "..."], [B-ROLL: ...]
- Inclua pelo menos 1 momento de "prova" (dado, resultado, exemplo real)
- Mantenha ritmo acelerado — sem pausas longas

**[Últimos 5-10s] CTA:**
${details.cta ? `CTA: "${details.cta}"` : "CTA verbal + visual: 'Salva esse vídeo', 'Segue pra mais', 'Comenta SIM'"}
- Funciona melhor quando o CTA é específico e simples

FORMATO DE RESPOSTA:
Gere o roteiro com marcações de tempo [0:00-0:03], instruções entre colchetes [CORTE], [TEXTO NA TELA], e o texto falado em formato natural.

Após o roteiro, gere a LEGENDA do Reel:
- 2-4 parágrafos curtos
- Hook na primeira linha
- CTA + 5-8 hashtags (incluir #reels #viral + nicho)`;
          break;
        case "youtube_long":
          typeInstructions = `FORMATO: YouTube Longo — Roteiro Completo
OBJETIVO: ${details.objetivo || "ensinar com profundidade"}
DURAÇÃO: ${details.duracao || "8-12 minutos"}
INCLUI HISTÓRIA PESSOAL: ${details.inclui_historia || "sim"}

ESTRUTURA OBRIGATÓRIA:

**[0:00-0:15] GANCHO — Primeiros 15 segundos (decidem se fica ou sai):**
${details.gancho ? `Gancho: "${details.gancho}"` : "Comece com promessa clara do que a pessoa vai aprender/ganhar assistindo até o final."}
- Mostre o RESULTADO antes de explicar o processo
- "Nesse vídeo eu vou te mostrar exatamente como [resultado]. E no final, [bônus]."

**[0:15-1:00] PROMESSA + CONTEXTO:**
${details.promessa ? `Promessa: "${details.promessa}"` : "Defina claramente o que a pessoa vai sair sabendo fazer."}
- Gere credibilidade: "Eu testei isso no meu próprio negócio e [resultado]"
- Quebre objeção: "E não, você não precisa de [coisa que acham que precisam]"

**[1:00-${details.duracao === "15-20min" ? "15:00" : "9:00"}] CONTEÚDO PRINCIPAL:**
- Estrutura: ${details.estrutura || "problema → framework → exemplos → aplicação"}
- Divida em seções claras com títulos (ajuda na retenção)
- A cada 2-3 minutos, inclua um "loop" que mantém atenção ("Mas calma, tem mais...")
- Inclua exemplos concretos, dados e histórias pessoais
- Indique: [B-ROLL], [GRÁFICO NA TELA], [TEXTO: "..."]

**[Últimos 1-2min] RESUMO + CTA:**
${details.cta ? `CTA: "${details.cta}"` : "Resuma os pontos principais + CTA: curtir, se inscrever, próximo vídeo."}
- "Se esse vídeo te ajudou, deixa o like — isso ajuda o YouTube a mostrar pra mais gente."
- Sugira o próximo vídeo relacionado

FORMATO DE RESPOSTA:
Roteiro com marcações de tempo, indicações visuais entre colchetes, e texto natural (não robótico).
Inclua no final: TÍTULO DO VÍDEO (até 60 chars, com keyword) + DESCRIÇÃO (2-3 parágrafos + links).`;
          break;
        case "youtube_short":
          typeInstructions = `FORMATO: YouTube Short — Roteiro Vertical
OBJETIVO: ${details.objetivo || "educar rápido e viralizar"}
DURAÇÃO: máximo 60 segundos (idealmente 30-45s)
ENERGIA: ${details.energia || "alta e direta"}

ESTRUTURA OBRIGATÓRIA:

**[0-3s] GANCHO IMEDIATO:**
${details.gancho ? `Gancho: "${details.gancho}"` : "Primeira frase = hook. Se não prender em 2 segundos, perdeu."}
- Shorts competem com TikTok — tem que prender INSTANTANEAMENTE
- Técnicas: "A maioria faz [X] errado", "Em 30 segundos eu vou te ensinar [Y]", dado chocante

**[3-50s] CONTEÚDO DIRETO:**
- Vai direto ao ponto. Sem introdução, sem "antes disso let me explain"
- 1 ideia central, desenvolvida rápido com 2-3 exemplos
- Frases curtas, ritmo acelerado
- Indique: [TEXTO NA TELA: "..."], [CORTE RÁPIDO]

**[Últimos 5-10s] CTA:**
${details.cta ? `CTA: "${details.cta}"` : "CTA rápido: 'Se inscreve', 'Comenta o que achou', 'Segue pra parte 2'"}

FORMATO DE RESPOSTA:
Roteiro com marcações de tempo e instruções visuais entre colchetes.
Texto falado em linguagem natural, como conversa.`;
          break;
        case "instagram_static":
          typeInstructions = `FORMATO: Instagram Post Estático (imagem + legenda)
OBJETIVO: ${details.objetivo || "educar e gerar engajamento"}

IMPORTANTE: O design/imagem do post é criado SEPARADAMENTE. A legenda NÃO deve repetir o conteúdo visual — ela COMPLEMENTA.

GERE UMA LEGENDA CURTA E DIRETA (máximo 100-150 palavras):

1. HOOK (1ª linha): Frase de impacto que pare o scroll. Max 125 caracteres.
${details.texto_post ? `   Tema/base: "${details.texto_post}"` : ""}
2. CORPO (3-5 parágrafos de 1-2 linhas): Contextualize o tema, conte algo pessoal, dê 1 insight prático. NÃO liste tópicos que já estão no design.
3. CTA: ${details.cta ? `"${details.cta}"` : "Pergunta específica ou convite a salvar/comentar."}
4. HASHTAGS: 5-8 no final

Tom: conversa direta, como se falasse 1:1 com alguém. Sem enrolação.`;
          break;
      }

      // Build source-specific instructions
      let sourceInstructions = "";
      if (payload.source === "both") {
        sourceInstructions = `
## REGRAS DE FONTE (MODO AMBOS - Pedro + Terceiros):
- Use o conteudo do Pedro (playbooks, historias) como BASE PRINCIPAL e espinha dorsal
- Use referencias externas apenas como complemento, inspiracao ou contraponto
- Sempre que usar insight de terceiros, cite a fonte: [Ref: @handle]
- O conteudo final deve soar 100% como Pedro, nunca como copia de terceiros
- A voz, tom e estilo sao SEMPRE do Pedro — referencias sao apenas tempero`;
      } else if (payload.source === "references_only") {
        sourceInstructions = `
## REGRAS DE FONTE (MODO REFERENCIAS):
- Use as referencias externas como inspiracao principal
- Adapte completamente para a voz e tom do Pedro
- Cite as fontes quando relevante: [Ref: @handle]
- O conteudo final deve parecer 100% Pedro, mesmo baseado em referencias`;
      }

      const freeTextPrompt = `REGRA ABSOLUTA: TODA SUA RESPOSTA DEVE SER EM PORTUGUES BRASILEIRO (PT-BR).

TOPICO PRINCIPAL: ${topicText}
${payload.recorte ? `RECORTE/ANGULO ESPECIFICO: ${payload.recorte}` : ""}
${payload.audience ? `PUBLICO-ALVO: ${payload.audience}` : ""}
${payload.extraContext ? `CONTEXTO ADICIONAL: ${payload.extraContext}` : ""}
${sourceInstructions}

${typeInstructions}

---

BASE DE CONHECIMENTO DO PEDRO (use como fonte de verdade):

## Playbooks Relevantes:
${playbookContext || "Nenhum playbook encontrado."}

## Historias Relevantes:
${storyContext || "Nenhuma historia encontrada."}
${referenceContext ? `
## Referencias Externas (terceiros — use como inspiração, não copie):
${referenceContext}
` : ""}

---

INSTRUCOES FINAIS:
1. SEJA CURTO E DIRETO. A legenda deve ter no MÁXIMO 150 palavras (Instagram/X) ou 250 palavras (LinkedIn). Menos é mais.
2. A legenda COMPLEMENTA o design visual — NÃO repita o que já está na imagem. Se o design mostra "5 passos pra X", a legenda NÃO lista os 5 passos de novo. Ela contextualiza, provoca ou conta a história por trás.
3. Use o TÓPICO como tema REAL — não generalize
4. A primeira linha DEVE ser um hook forte
5. Vá DIRETO ao ponto — sem introdução longa, sem "Hoje quero compartilhar..."
6. 1 ideia central por post. Não tente cobrir tudo.
7. O conteúdo deve soar como Pedro Rabelo falando, não como IA gerando texto
8. NÃO inclua meta-comentários ("aqui está a legenda", "segue o conteúdo")
9. PRONTO PRA COPIAR E COLAR — sem placeholders, sem adaptações necessárias`;

      const result = await generateContent({
        identity: identityRes.data,
        playbook: playbookRes.data
          ? {
              id: playbookRes.data.id,
              title: playbookRes.data.title,
              body_markdown: playbookRes.data.body_markdown,
              subtitle: null,
              completeness_score: 0,
              has_example: false,
              has_story: false,
              has_origin: false,
              has_counterexample: false,
              version_current: null,
              version_previous: null,
              created_by: null,
              created_at: "",
              updated_at: "",
              theme_id: null,
            }
          : selectedPlaybooks[0]
            ? {
                id: selectedPlaybooks[0].id,
                title: selectedPlaybooks[0].title,
                body_markdown: selectedPlaybooks[0].body_markdown,
                subtitle: null,
                completeness_score: 0,
                has_example: false,
                has_story: false,
                has_origin: false,
                has_counterexample: false,
                version_current: null,
                version_previous: null,
                created_by: null,
                created_at: "",
                updated_at: "",
                theme_id: null,
              }
            : undefined,
        story: storyRes.data
          ? {
              id: storyRes.data.id,
              title: storyRes.data.title,
              summary: storyRes.data.summary,
              body_markdown: storyRes.data.body_markdown,
              period: null,
              tags: [],
              lesson: null,
              version_current: null,
              version_previous: null,
              created_by: null,
              created_at: "",
              updated_at: "",
            }
          : selectedStories[0]
            ? {
                id: selectedStories[0].id,
                title: selectedStories[0].title,
                summary: selectedStories[0].summary,
                body_markdown: selectedStories[0].body_markdown,
                period: null,
                tags: [],
                lesson: null,
                version_current: null,
                version_previous: null,
                created_by: null,
                created_at: "",
                updated_at: "",
              }
            : undefined,
        contentType,
        freeText: freeTextPrompt,
        recentFeedbacks: feedbackRes.data ?? [],
        rules: wizardRulesRes.data ?? undefined,
      });

      if ("error" in result) {
        return { error: result.error };
      }

      // Save to DB
      const { data: inserted, error: insertError } = await supabase
        .from("generated_contents")
        .insert({
          source_type: payload.source as "base_only" | "references_only" | "both" | "free_text",
          playbook_id: playbookId || selectedPlaybooks[0]?.id || null,
          story_id: storyId || selectedStories[0]?.id || null,
          free_text_input: payload.freeTopic || null,
          content_type: contentType,
          format_id: null,
          content_text: result.content_text,
          source_map: result.source_map,
          generation_params: {
            wizard: true,
            details,
            audience: payload.audience,
            recorte: payload.recorte,
            pullStory: payload.pullStory,
          },
          status: "draft",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Generate image prompt inline so it's included in results
      let imagePrompt: string | null = null;
      try {
        const promptResult = await generateImagePrompt(result.content_text, contentType);
        if (!("error" in promptResult)) {
          imagePrompt = promptResult.image_prompt;
          await supabase
            .from("generated_contents")
            .update({ image_prompt: imagePrompt, image_model: "prompt-only" })
            .eq("id", inserted.id);
        }
      } catch (e) {
        log.error("[AI] Image prompt error:" + " " + String(e));
      }

      results.push({
        id: inserted.id,
        contentType: contentType as ContentType,
        content: result.content_text,
        sourceMap: result.source_map,
        imagePrompt,
        source: payload.source as "base_only" | "references_only" | "both" | "free_text",
      });
    }

    revalidatePath(PATH);

    return { results };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[WizardContent] Error:" + " " + String(message));
    return { error: `Falha ao gerar conteudo: ${message}` };
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

/**
 * Upload external image(s) to a generated content.
 * Supports single image or multiple (carousel).
 * Saves to Supabase Storage and updates the content's image_url.
 */
export async function uploadImageToContent(
  contentId: string,
  formData: FormData
): Promise<{ imageUrl: string } | { error: string }> {
  const supabase = await createClient();

  try {
    const files: File[] = [];
    // Support multiple files (carousel)
    for (const [key, value] of formData.entries()) {
      if (key === "images" && value instanceof File && value.size > 0) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return { error: "Nenhuma imagem enviada" };
    }

    const uploadedUrls: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop() || "png";
      const filePath = `content-images/${contentId}-${timestamp}-${i}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("generated-images")
        .upload(filePath, buffer, {
          contentType: file.type || "image/png",
          upsert: false,
        });

      if (uploadError) {
        log.error("[UploadImage] Storage error: " + uploadError.message);
        return { error: "Falha no upload: " + uploadError.message };
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("generated-images").getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    // For multiple images (carousel), store as JSON array; for single, store the URL
    const imageUrl = uploadedUrls.length === 1
      ? uploadedUrls[0]
      : JSON.stringify(uploadedUrls);

    await supabase
      .from("generated_contents")
      .update({ image_url: imageUrl, image_model: "external" })
      .eq("id", contentId);

    log.info(`[UploadImage] ${uploadedUrls.length} image(s) uploaded for ${contentId}`);
    revalidatePath(PATH);
    revalidatePath("/calendario");

    return { imageUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[UploadImage] Error: " + message);
    return { error: `Falha ao fazer upload: ${message}` };
  }
}

/**
 * Refine/adjust generated content based on user instruction.
 * Uses Claude to modify the existing text following the user's direction.
 * Can optionally also regenerate the image prompt.
 */
export async function refineContent(
  contentId: string,
  currentText: string,
  instruction: string,
  contentType: string,
  alsoRefinePrompt?: boolean,
  currentPrompt?: string | null,
): Promise<{ text: string; imagePrompt?: string | null } | { error: string }> {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `Voce e um editor de conteudo para redes sociais. O usuario gerou um conteudo e quer fazer ajustes.

REGRAS:
- Faca EXATAMENTE o que o usuario pedir, nada mais
- Mantenha o tom, estilo e estrutura original a menos que ele peca pra mudar
- Responda APENAS com o texto final editado, sem explicacoes, sem "Aqui esta:", sem markdown
- O texto deve estar pronto para copiar e colar na rede social
- Mantenha hashtags se ja existiam, a menos que peca pra remover
- Mantenha emojis se ja existiam, a menos que peca pra remover
- Se o usuario pedir algo sobre design, imagem, visual, piramide, diagrama, prompt — ajuste a LEGENDA para refletir o novo conceito visual (o prompt de imagem sera ajustado separadamente)`,
      messages: [
        {
          role: 'user',
          content: `CONTEUDO ATUAL (${contentType}):\n---\n${currentText}\n---\n\nINSTRUCAO DO USUARIO: ${instruction}\n\nResponda APENAS com o texto ajustado, nada mais.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const refinedText = textBlock?.text?.trim() || '';

    if (!refinedText) {
      return { error: 'Claude nao retornou texto' };
    }

    // Save to DB
    const supabase = await createClient();
    await supabase
      .from('generated_contents')
      .update({ content_text: refinedText })
      .eq('id', contentId);

    // Also refine image prompt if requested
    let refinedPrompt: string | null = null;
    if (alsoRefinePrompt && currentPrompt) {
      const promptResponse = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: `Voce e um editor de prompts para geracao de imagens. Ajuste o prompt de imagem conforme a instrucao do usuario. Responda APENAS com o prompt ajustado em ingles, nada mais.`,
        messages: [
          {
            role: 'user',
            content: `PROMPT ATUAL:\n---\n${currentPrompt}\n---\n\nINSTRUCAO: ${instruction}\n\nResponda APENAS com o prompt ajustado.`,
          },
        ],
      });

      const promptBlock = promptResponse.content.find((b) => b.type === 'text');
      refinedPrompt = promptBlock?.text?.trim() || null;

      if (refinedPrompt) {
        await supabase
          .from('generated_contents')
          .update({ image_prompt: refinedPrompt })
          .eq('id', contentId);
      }
    }

    // Log cost
    const { logApiCost } = await import('@/lib/ai/client');
    const inputTokens = response.usage?.input_tokens ?? 500;
    const outputTokens = response.usage?.output_tokens ?? 300;
    const cost = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;
    logApiCost('anthropic', 'claude-sonnet-4', cost, { input_tokens: inputTokens, output_tokens: outputTokens });

    log.info(`[Refine] Content ${contentId} refined: "${instruction.slice(0, 50)}..."`);
    revalidatePath(PATH);

    return { text: refinedText, imagePrompt: refinedPrompt };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    log.error('[Refine] Error: ' + message);
    return { error: `Falha ao ajustar: ${message}` };
  }
}

/**
 * Remove the image from a content (set image_url to null).
 * Also removes the file(s) from Supabase Storage if possible.
 */
export async function removeContentImage(
  contentId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  try {
    // Get current image_url to delete from storage
    const { data: content } = await supabase
      .from("generated_contents")
      .select("image_url")
      .eq("id", contentId)
      .single();

    if (content?.image_url) {
      // Try to extract storage paths and delete files
      const urls: string[] = [];
      try {
        const parsed = JSON.parse(content.image_url);
        if (Array.isArray(parsed)) urls.push(...parsed);
      } catch {
        urls.push(content.image_url);
      }

      // Extract file paths from public URLs and delete from storage
      for (const url of urls) {
        const match = url.match(/generated-images\/(.+)$/);
        if (match) {
          await supabase.storage
            .from("generated-images")
            .remove([match[1]]);
        }
      }
    }

    // Clear image_url and image_model in DB
    await supabase
      .from("generated_contents")
      .update({ image_url: null, image_model: null })
      .eq("id", contentId);

    log.info(`[RemoveImage] Image removed for ${contentId}`);
    revalidatePath(PATH);
    revalidatePath("/calendario");

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[RemoveImage] Error: " + message);
    return { error: `Falha ao remover imagem: ${message}` };
  }
}

export async function savePublishedUrl(contentId: string, url: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("generated_contents")
    .update({ published_url: url, status: "published" })
    .eq("id", contentId);
  if (error) throw error;
  revalidatePath(PATH);
}

export async function updateContentText(id: string, text: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("generated_contents")
    .update({ content_text: text })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(PATH);
}

/**
 * Generate an image for a content piece using GPT-image-1.
 * First generates the prompt (via Gemini/GPT-4o), then generates the actual image.
 * Saves image as base64 data URL to the content's image_url field.
 */
export async function generateImageForContent(
  contentId: string,
  contentText: string,
  contentType: string,
): Promise<{ imageUrl: string; imagePrompt: string } | { error: string }> {
  const supabase = await createClient();

  try {
    // Step 1: Generate the image prompt
    log.info(`[ImageForContent] Generating prompt for ${contentType}...`);
    const promptResult = await generateImagePrompt(contentText, contentType);

    let imagePrompt: string;
    if ("error" in promptResult) {
      // If prompt generation fails, use a simple fallback
      imagePrompt = `Professional Instagram infographic slide, 1080x1080px, dark background, clean design about: ${contentText.slice(0, 200)}`;
      log.info(`[ImageForContent] Prompt gen failed, using fallback`);
    } else {
      imagePrompt = promptResult.image_prompt;
    }

    // Step 2: Generate the actual image
    log.info(`[ImageForContent] Generating image (${imagePrompt.length} char prompt)...`);

    // Choose size based on content type
    const sizeMap: Record<string, '1024x1024' | '1536x1024' | '1024x1536'> = {
      instagram_carousel: '1024x1024',
      instagram_static: '1024x1024',
      instagram_reel: '1024x1536',
      linkedin_post: '1024x1024',
      youtube_long: '1536x1024',
      youtube_short: '1024x1536',
      x_thread: '1536x1024',
      x_tweet: '1536x1024',
    };

    const imageResult = await generateImage(imagePrompt, {
      size: sizeMap[contentType] || '1024x1024',
      quality: 'medium',
      format: 'webp',
    });

    if ("error" in imageResult) {
      // Save prompt even if image fails
      await supabase.from("generated_contents").update({
        image_prompt: imagePrompt,
        image_model: 'gpt-image-1-failed',
      }).eq("id", contentId);
      revalidatePath(PATH);

      return { error: imageResult.error };
    }

    // Step 3: Save to DB
    const imageUrl = `data:image/${imageResult.format};base64,${imageResult.base64}`;

    await supabase.from("generated_contents").update({
      image_url: imageUrl,
      image_prompt: imagePrompt,
      image_model: 'gpt-image-1',
    }).eq("id", contentId);

    revalidatePath(PATH);
    log.info(`[ImageForContent] Image saved for content ${contentId}`);

    return { imageUrl, imagePrompt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log.error("[ImageForContent] Error:" + " " + String(message));
    return { error: `Falha ao gerar imagem: ${message}` };
  }
}
