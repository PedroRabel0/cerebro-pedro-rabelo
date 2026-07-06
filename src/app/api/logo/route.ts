export const dynamic = "force-dynamic";

import { getSessionUser } from "@/lib/api-guards";

/**
 * Proxy do LOGO oficial da empresa (case_empresa): busca por dominio num
 * servico publico de logos e serve como same-origin — necessario para o
 * html-to-image conseguir exportar o PNG do slide com o logo embutido
 * (imagem cross-origin quebraria o canvas). Cache de 24h.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Nao autorizado.", { status: 401 });

  const url = new URL(request.url);
  const domain = (url.searchParams.get("domain") || "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "");
  if (!domain || !domain.includes(".") || domain.length > 100) {
    return new Response("Dominio invalido.", { status: 400 });
  }

  try {
    const res = await fetch(`https://logo.clearbit.com/${domain}?size=256`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return new Response("Sem logo.", { status: 404 });

    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Sem logo.", { status: 404 });
  }
}
