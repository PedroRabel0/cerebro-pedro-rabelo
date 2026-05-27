import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const USERS = [
  {
    email: "pedro@cerebro.app",
    password: "Pedro2026!",
    name: "Pedro Rabelo",
    role: "pedro",
  },
  {
    email: "henrique@cerebro.app",
    password: "Henri2026!",
    name: "Henrique",
    role: "henrique",
  },
];

export async function GET() {
  const supabase = await createClient();
  const results: { email: string; password: string; status: string }[] = [];

  // Buscar usuarios existentes para poder atualizar metadata
  const { data: existingUsers } = await supabase.auth.admin.listUsers();

  for (const user of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
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
        // Usuario ja existe — atualizar metadata com role
        const existing = existingUsers?.users?.find(
          (u) => u.email === user.email
        );
        if (existing) {
          const { error: updateError } =
            await supabase.auth.admin.updateUserById(existing.id, {
              user_metadata: { name: user.name, role: user.role },
            });
          if (updateError) {
            results.push({
              email: user.email,
              password: user.password,
              status: `ja existe, erro ao atualizar role: ${updateError.message}`,
            });
          } else {
            results.push({
              email: user.email,
              password: user.password,
              status: `ja existe, role atualizado para "${user.role}"`,
            });
          }
        } else {
          results.push({
            email: user.email,
            password: user.password,
            status: "ja existe (nao encontrado na lista para atualizar)",
          });
        }
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
        status: `criado com sucesso, role: "${user.role}"`,
      });
    }
  }

  return NextResponse.json({
    message: "Setup de usuarios concluido",
    usuarios: results,
  });
}
