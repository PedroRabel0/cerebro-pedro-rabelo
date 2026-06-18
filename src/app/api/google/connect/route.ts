import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-guards";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/google/callback`;
  return NextResponse.redirect(getGoogleAuthUrl(redirectUri, user.id));
}
