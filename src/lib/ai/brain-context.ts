/**
 * Contexto RAG do "Segundo Cerebro" — compartilhado pelo chat com streaming
 * (/api/brain-chat), pelo askBrain e pelo sendChatMessage (actions).
 * Extraido de (dashboard)/actions.ts para permitir o route handler de stream.
 */
import { createClient } from "@/lib/supabase/server";
import { findSimilarPlaybooks } from "./embeddings";

/**
 * Fetch the playbooks most relevant to `question` via semantic (vector) search,
 * then load their full body_markdown so the brain answers with the complete
 * content (match_playbooks only returns the short `principio`).
 *
 * Falls back to the 30 most recent playbooks if the embedding lookup returns
 * nothing — OpenAI timeout, RPC error, or no playbook has an embedding yet — so
 * the brain never answers against an empty knowledge base.
 */
async function fetchRelevantPlaybooks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  question: string
): Promise<{ title: string; body_markdown: string | null }[]> {
  const similar = await findSimilarPlaybooks(question, 0.3, 12);

  if (similar.length > 0) {
    const ids = similar.map((s) => s.id);
    const { data } = await supabase
      .from("playbooks")
      .select("id, title, body_markdown")
      .in("id", ids);

    if (data && data.length > 0) {
      // Preserve the similarity ranking returned by the RPC.
      const byId = new Map(data.map((p) => [p.id, p]));
      return ids
        .map((id) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({ title: p.title, body_markdown: p.body_markdown }));
    }
  }

  // Fallback: recent playbooks (previous behavior).
  const { data } = await supabase
    .from("playbooks")
    .select("title, body_markdown")
    .limit(30);
  return data ?? [];
}

// Persona compartilhada do cérebro (askBrain + sendChatMessage).
const BRAIN_PERSONA =
  "Você é o Segundo Cérebro do Pedro Rabelo. Você sabe TUDO que está na base de conhecimento dele. " +
  "Responda como se fosse a memória e inteligência do Pedro — use os playbooks, histórias e referências " +
  "para dar respostas completas e contextualizadas. Se não souber algo, diga que ainda não tem essa " +
  "informação na base. As histórias estão listadas só com título e resumo — se precisar do conteúdo " +
  "completo de uma, diga qual. Responda sempre em português brasileiro, de forma direta e útil.";

/**
 * Monta o contexto do cérebro em DOIS blocos de system para prompt caching
 * efetivo (compartilhado por askBrain e sendChatMessage — antes o bloco era
 * duplicado verbatim nos dois):
 * - `stable`: identidade + histórias (título/resumo) + referências + regras —
 *   igual entre mensagens. Recebe cache_control e dá cache HIT (~0.1x do
 *   preço de input) a partir da 2ª mensagem em 5 minutos.
 * - `dynamic`: playbooks do RAG, que mudam a cada pergunta. Fica FORA do
 *   cache — antes, dentro do bloco único cacheado, invalidava o prefixo todo
 *   e cada mensagem pagava cache WRITE (+25%) sem nunca ler.
 * Histórias entram só com título + resumo (~80-90% menos tokens que os 30
 * body_markdown completos que eram despejados sem filtro).
 */
export async function buildBrainContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  question: string
): Promise<{ stable: string; dynamic: string }> {
  const [identity, playbooks, stories, recentRefs, rulesRes] =
    await Promise.all([
      supabase.from("identity").select("*").limit(1).single(),
      fetchRelevantPlaybooks(supabase, question),
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

  const stableParts: string[] = [];

  if (identity.data) {
    stableParts.push(
      `## Identidade do Pedro\n${JSON.stringify(identity.data, null, 2)}`
    );
  }

  if (stories.data && stories.data.length > 0) {
    const storyText = stories.data
      .map((s) => {
        const resumo =
          s.summary || (s.body_markdown || "").slice(0, 200) || "(sem resumo)";
        const tags = (s.tags || []).length
          ? ` [${(s.tags || []).join(", ")}]`
          : "";
        return `- **${s.title}**: ${resumo}${tags}`;
      })
      .join("\n");
    stableParts.push(
      `## Histórias (${stories.data.length} — título e resumo)\n${storyText}`
    );
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
    stableParts.push(
      `## Referências Recentes (${recentRefs.data.length})\n${refText}`
    );
  }

  if (rulesRes.data && rulesRes.data.length > 0) {
    const rulesText = rulesRes.data
      .map(
        (r: { rule_text: string; context?: string | null }) =>
          `- ${r.rule_text}${r.context ? ` (${r.context})` : ""}`
      )
      .join("\n");
    stableParts.push(
      `## Regras de Decisao do Pedro (SIGA SEMPRE)\n${rulesText}`
    );
  }

  let dynamic = "";
  if (playbooks.length > 0) {
    const playbookText = playbooks
      .map((p) => `### ${p.title}\n${p.body_markdown || "(sem conteúdo)"}`)
      .join("\n\n");
    dynamic = `## Playbooks relevantes para esta pergunta (${playbooks.length})\n${playbookText}`;
  }

  return { stable: stableParts.join("\n\n---\n\n"), dynamic };
}

/**
 * System em 2 blocos: o estável leva o cache_control (breakpoint no FIM da
 * porção compartilhada); o bloco RAG dinâmico vem DEPOIS, sem cache.
 */
export function buildBrainSystem(stable: string, dynamic: string) {
  return [
    {
      type: "text" as const,
      text: `${BRAIN_PERSONA}\n\n=== BASE DE CONHECIMENTO ===\n\n${stable}`,
      cache_control: { type: "ephemeral" as const },
    },
    ...(dynamic ? [{ type: "text" as const, text: dynamic }] : []),
  ];
}
