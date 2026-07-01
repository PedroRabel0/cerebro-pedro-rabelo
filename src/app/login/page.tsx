"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const role = (user?.app_metadata?.role ?? user?.user_metadata?.role) as
        | string
        | undefined;
      router.push(role === "cliente" ? "/portal" : "/");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 overflow-hidden">
      {/* Ambient orbs */}
      <div className="ambient-orb ambient-orb-accent" />
      <div className="ambient-orb ambient-orb-violet" />

      <div className="relative w-full max-w-sm animate-slide-in">
        <div className="mb-8 text-center">
          <div className="logo-gradient animate-float mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Brain className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-gradient">
            Segundo Cérebro
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-text-muted">
            do Pedro
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card space-y-5 rounded-2xl p-7"
        >
          <div>
            <label
              htmlFor="email"
              className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1.5 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-mono text-[11px] uppercase tracking-wider text-text-secondary"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              className="mt-1.5 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
              <span aria-hidden="true">!</span>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full rounded-xl px-4 py-2.5 font-mono text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Carregando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
