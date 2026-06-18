import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-guards";
import { exchangeCodeForTokens, saveGoogleTokens } from "@/lib/google-calendar";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  // CSRF: o state precisa ser o id do usuario que iniciou o fluxo
  if (!code || state !== user.id) {
    return NextResponse.redirect(new URL("/consultoria?google=error", req.url));
  }

  try {
    const redirectUri = `${url.origin}/api/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    await saveGoogleTokens(user.id, user.email ?? null, tokens);
    return NextResponse.redirect(new URL("/consultoria?google=connected", req.url));
  } catch (err) {
    log.error("[Google] callback: " + (err instanceof Error ? err.message : String(err)));
    return NextResponse.redirect(new URL("/consultoria?google=error", req.url));
  }
}
