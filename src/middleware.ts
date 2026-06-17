import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Nao proteger login, auth callback e rotas de API
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Verificar sessao de autenticacao
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Protecao por role: rotas restritas ao Pedro
  const role = user.user_metadata?.role as string | undefined;
  const pedroOnlyRoutes = [
    "/referencias",
    "/identidade",
    "/configuracoes",
  ];

  if (role === "henrique") {
    const isRestricted = pedroOnlyRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );
    if (isRestricted) {
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://api.apify.com https://gnews.io;");

  return response;
}

export const config = {
  matcher: [
    // Exclui assets estaticos do public/ (imagens) para que sejam servidos
    // publicamente — ex: a foto do Pedro usada nos carrosseis.
    "/((?!_next/static|_next/image|favicon.ico|login|auth|api|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|mjs|js)$).*)",
  ],
};
