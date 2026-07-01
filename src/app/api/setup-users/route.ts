import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Credentials from environment variables — NEVER hardcode
const USERS = [
  {
    email: process.env.PEDRO_EMAIL || "pedro@cerebro.app",
    password: process.env.PEDRO_PASSWORD || "",
    name: "Pedro Rabelo",
    role: "pedro",
  },
  {
    email: process.env.HENRIQUE_EMAIL || "henrique@cerebro.app",
    password: process.env.HENRIQUE_PASSWORD || "",
    name: "Henrique",
    role: "henrique",
  },
];

export async function GET(request: Request) {
  // Security: require ADMIN_SECRET in all environments
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate that passwords are configured
  for (const user of USERS) {
    if (!user.password) {
      return NextResponse.json(
        { error: `Password not configured for ${user.email}. Set env vars PEDRO_PASSWORD and HENRIQUE_PASSWORD.` },
        { status: 400 }
      );
    }
  }

  const supabase = await createClient();
  const results: { email: string; status: string }[] = [];

  const { data: existingUsers } = await supabase.auth.admin.listUsers();

  for (const user of USERS) {
    const { error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role },
    });

    if (error) {
      if (
        error.message.includes("already been registered") ||
        error.message.includes("already exists")
      ) {
        const existing = existingUsers?.users?.find(
          (u) => u.email === user.email
        );
        if (existing) {
          const { error: updateError } =
            await supabase.auth.admin.updateUserById(existing.id, {
              user_metadata: { name: user.name, role: user.role },
            });
          results.push({
            email: user.email,
            status: updateError
              ? `ja existe, erro ao atualizar: ${updateError.message}`
              : `ja existe, role atualizado para "${user.role}"`,
          });
        } else {
          results.push({
            email: user.email,
            status: "ja existe",
          });
        }
      } else {
        results.push({
          email: user.email,
          status: `erro: ${error.message}`,
        });
      }
    } else {
      results.push({
        email: user.email,
        status: `criado com sucesso, role: "${user.role}"`,
      });
    }
  }

  return NextResponse.json({
    message: "Setup de usuarios concluido",
    usuarios: results,
  });
}
