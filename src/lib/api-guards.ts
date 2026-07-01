import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Le o papel do usuario preferindo app_metadata (fonte de verdade, so o
 * service_role escreve) e caindo para user_metadata por compatibilidade.
 */
function roleOf(user: User): string | undefined {
  return (user.app_metadata?.role ?? user.user_metadata?.role) as
    | string
    | undefined;
}

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
 * Exige um usuario autenticado (sessao Supabase valida). Use no inicio de
 * server actions sensiveis para ter autorizacao server-side de verdade — em vez
 * de depender SO do middleware (ponto unico de falha). Lanca se nao houver sessao.
 */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado.");
  return user;
}

/**
 * Exige que o usuario seja o admin (Pedro). Fecha a escalada de privilegio em
 * que o operador Henrique poderia chamar acoes Pedro-only diretamente (hoje so
 * bloqueado na UI/middleware). Lanca se nao for admin.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (roleOf(user) !== "pedro")
    throw new Error("Acao restrita ao administrador.");
  return user;
}

/**
 * Exige que o usuario seja da EQUIPE (Pedro ou Henrique) — bloqueia clientes do
 * portal. Use em acoes da Consultoria/admin que um cliente autenticado NAO pode
 * chamar (server actions sao POST publicos; nao confie so no middleware).
 */
export async function requireStaff() {
  const user = await requireUser();
  const role = roleOf(user);
  if (role !== "pedro" && role !== "henrique")
    throw new Error("Acao restrita a equipe.");
  return user;
}

/**
 * Exige que o usuario seja um cliente do portal e retorna a empresa vinculada.
 * Server actions do portal DEVEM chamar isto no topo — nao confie no middleware.
 * Lanca se nao for cliente ou se nao houver empresa vinculada.
 */
export async function requireClient(): Promise<{
  user: User;
  companyId: string;
}> {
  const user = await requireUser();
  if (roleOf(user) !== "cliente")
    throw new Error("Acesso restrito ao cliente.");
  const db = await createClient();
  const { data } = await db
    .from("consulting_client_users")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Cliente sem empresa vinculada.");
  return { user, companyId: data.company_id as string };
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
