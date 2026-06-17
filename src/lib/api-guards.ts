import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cron auth: exige SOMENTE o segredo compartilhado. A Vercel injeta
 * `Authorization: Bearer $CRON_SECRET` automaticamente nas invocacoes de cron
 * quando CRON_SECRET esta definido no projeto. NAO confiar no header
 * `x-vercel-cron`, que pode ser forjado por qualquer requisicao externa.
 * Fail-closed: sem CRON_SECRET configurado, nega.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Retorna o usuario autenticado a partir dos cookies de sessao do Supabase
 * (client SSR ligado a cookies, ANON key — honra a sessao). Use em rotas /api,
 * que sao EXCLUIDAS do middleware de auth e por isso precisam checar sessao.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Rate limiter leve em memoria (por instancia quente). NAO e robusto entre
 * instancias serverless — e um quebra-molas para uma app de poucos usuarios.
 * Para limite forte/distribuido, migrar para @upstash/ratelimit + KV (Fase 2).
 * Retorna true se a requisicao esta dentro do limite.
 */
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
