import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client PADRAO do servidor: ligado a SESSAO do usuario (anon key + cookies),
 * HONRANDO RLS — defesa em profundidade real.
 *
 * - Equipe (pedro/henrique): acesso total via policy `staff_full`
 *   (is_staff() le o role do JWT app_metadata — ver
 *   supabase-migration-portal-cliente.sql, secao 7).
 * - Cliente do portal: so enxerga o que as policies `client_*` permitem.
 * - Sem sessao (cron, rota admin): NADA — use createAdminClient().
 *
 * Antes, este client usava SERVICE_ROLE_KEY por padrao: o RLS era
 * neutralizado no app inteiro e a unica defesa era o guard manual em cada
 * action.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Render de Server Component nao pode escrever cookies — o
            // middleware cuida do refresh da sessao nesse caso.
          }
        },
      },
    }
  );
}

/**
 * Client ADMIN (service_role — BYPASSA RLS). Uso restrito e explicito:
 * - crons e rotas administrativas (sem sessao de usuario);
 * - auth.admin (criar/excluir usuarios, redefinir senha);
 * - Storage (as policies do schema `storage` nao cobrem authenticated);
 * - tokens do Google Calendar (policy own_tokens e por usuario, mas o app
 *   compartilha a conexao do Pedro com a equipe);
 * - portal do cliente: as tabelas que ele le sao staff-only DE PROPOSITO
 *   (contract_value/notes/transcripts nunca chegam ao cliente por query
 *   direta) — o acesso e mediado por requireClient() + service_role.
 */
export async function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
