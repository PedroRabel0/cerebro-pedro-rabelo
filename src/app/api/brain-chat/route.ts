export const dynamic = "force-dynamic";

import { requireStaff, rateLimit } from "@/lib/api-guards";
import { createClient } from "@/lib/supabase/server";
import { getClient, logCost } from "@/lib/ai/client";
import { buildBrainContext, buildBrainSystem } from "@/lib/ai/brain-context";
import { log } from "@/lib/logger";

/**
 * Chat do cerebro com STREAMING. Substitui o caminho bloqueante do
 * sendChatMessage (server action): antes o usuario esperava 10-30s num
 * spinner e, se estourasse o timeout, perdia a resposta inteira. Agora o
 * texto chega token a token e um corte no meio preserva o parcial.
 *
 * Fluxo: auth (requireStaff) -> rate limit -> salva a pergunta -> contexto
 * RAG em 2 blocos (estavel cacheado + playbooks dinamicos) -> stream da
 * Anthropic repassado como text/plain -> ao final, persiste a resposta e
 * atualiza titulo/updated_at do chat.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireStaff();
  } catch {
    return new Response("Nao autorizado.", { status: 401 });
  }
  if (!rateLimit(`brain:${user.id}`, 20, 60_000)) {
    return new Response("Muitas mensagens em sequencia — aguarde um minuto.", {
      status: 429,
    });
  }

  const body = (await request.json().catch(() => null)) as {
    chatId?: string;
    question?: string;
  } | null;
  const chatId = body?.chatId;
  const question = body?.question?.trim();
  if (!chatId || !question) {
    return new Response("Pergunta vazia.", { status: 400 });
  }

  const supabase = await createClient();

  // 1. Salva a mensagem do usuario
  await supabase
    .from("brain_messages")
    .insert({ chat_id: chatId, role: "user", content: question });

  // 2. Historico recente da conversa
  const { data: previousMessages } = await supabase
    .from("brain_messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(10);
  const history = (previousMessages ?? []).reverse();

  // 3. Contexto RAG (bloco estavel cacheado + playbooks da pergunta)
  const { stable, dynamic: dynamicBlock } = await buildBrainContext(
    supabase,
    question
  );

  const client = getClient();
  const messages = history.map((m) => ({
    role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));

  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: buildBrainSystem(stable, dynamicBlock),
    messages,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await anthropicStream.finalMessage();
        logCost(
          "claude-sonnet-4-6",
          final.usage.input_tokens,
          final.usage.output_tokens
        );
      } catch (err) {
        log.error("[BrainChat stream] " + String(err));
        if (!full) {
          controller.enqueue(
            encoder.encode(
              "Desculpa, tive um problema para responder. Tenta de novo."
            )
          );
        }
        // com parcial: o texto ja entregue e preservado e persistido abaixo
      } finally {
        try {
          if (full) {
            await supabase
              .from("brain_messages")
              .insert({ chat_id: chatId, role: "brain", content: full });

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
          }
        } catch (persistErr) {
          log.error("[BrainChat persist] " + String(persistErr));
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // desliga buffering de proxy — os tokens chegam na hora
      "X-Accel-Buffering": "no",
    },
  });
}
