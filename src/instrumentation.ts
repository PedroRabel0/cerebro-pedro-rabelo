import type { Instrumentation } from "next";

/**
 * Error tracking persistente (Vercel Hobby retem logs de runtime por ~1h —
 * qualquer erro que o Pedro reportar "ontem a noite" seria irrecuperavel).
 * O Next chama onRequestError para TODO erro de servidor nao tratado
 * (render, route handler, server action); gravamos numa tabela `error_log`
 * no Supabase para investigar depois.
 *
 * Requer a migracao supabase-migration-error-log.sql. Se a tabela nao
 * existir, degrada para console (nao quebra a request — o erro original
 * ja esta sendo tratado pelo Next).
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const error = err as { digest?: string } & Error;

    const { error: insertError } = await supabase.from("error_log").insert({
      message: (error.message || String(err)).slice(0, 2000),
      digest: error.digest || null,
      stack: (error.stack || "").slice(0, 4000) || null,
      path: request.path,
      method: request.method,
      route_path: context.routePath,
      route_type: context.routeType,
    });
    if (insertError) {
      console.error("[ErrorLog] insert failed:", insertError.message);
    }
  } catch (e) {
    console.error("[ErrorLog] failed to persist error:", e);
  }
};
