import { createClient } from "@/lib/supabase/server";
import { updatePlaybookEmbedding } from "@/lib/ai/embeddings";
import { NextResponse } from "next/server";
import { isAuthorizedAdmin } from "@/lib/api-guards";

// Gera embeddings para os playbooks que ainda nao tem (embedding IS NULL) —
// necessario para o RAG do chat do cerebro funcionar sobre a base ja existente.
// Idempotente e re-executavel: rode ate `restantes` chegar a 0.
// Protegido por ADMIN_SECRET via header (timing-safe). Uso:
//   curl -H "Authorization: Bearer $ADMIN_SECRET" .../api/backfill-embeddings?limit=50
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cap para caber no budget de 60s da Vercel; processa em lotes.
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("playbooks")
    .select("id, title, estrutura")
    .is("embedding", null)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const alvo = pending ?? [];
  let processados = 0;

  // Sequencial de proposito: respeita o rate limit da OpenAI e o timeout de 15s
  // por chamada definido em embeddings.ts. Playbooks que falharem continuam com
  // embedding NULL e sao pegos numa nova execucao (self-healing).
  for (const pb of alvo) {
    const estrutura = pb.estrutura as { principio?: string } | null;
    const principio = estrutura?.principio || "";
    await updatePlaybookEmbedding(pb.id, pb.title, principio);
    processados++;
  }

  const { count: restantes } = await supabase
    .from("playbooks")
    .select("id", { count: "exact", head: true })
    .is("embedding", null);

  return NextResponse.json({
    message: "Backfill de embeddings executado",
    processados,
    restantes: restantes ?? 0,
    concluido: (restantes ?? 0) === 0,
  });
}
