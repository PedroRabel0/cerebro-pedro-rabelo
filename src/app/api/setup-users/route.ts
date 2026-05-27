import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const USERS = [
  {
    email: "pedro@cerebro.app",
    password: "Pedro2026!",
    name: "Pedro Rabelo",
  },
  {
    email: "henrique@cerebro.app",
    password: "Henri2026!",
    name: "Henrique",
  },
];

export async function GET() {
  const supabase = await createClient();
  const results: { email: string; password: string; status: string }[] = [];

  for (const user of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (error) {
      if (
        error.message.includes("already been registered") ||
        error.message.includes("already exists")
      ) {
        results.push({
          email: user.email,
          password: user.password,
          status: "ja existe",
        });
      } else {
        results.push({
          email: user.email,
          password: user.password,
          status: `erro: ${error.message}`,
        });
      }
    } else {
      results.push({
        email: user.email,
        password: user.password,
        status: "criado com sucesso",
      });
    }
  }

  return NextResponse.json({
    message: "Setup de usuarios concluido",
    usuarios: results,
  });
}
