"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Conta criada! Verifique seu email para confirmar.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/base-de-conhecimento");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-ink">
            Segundo Cérebro
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
            do Pedro
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block font-mono text-xs uppercase tracking-wider text-ink-soft"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-rule bg-paper-dark px-3 py-2 text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-mono text-xs uppercase tracking-wider text-ink-soft"
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
              className="mt-1 block w-full rounded border border-rule bg-paper-dark px-3 py-2 text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-accent">{error}</p>
          )}
          {message && (
            <p className="text-sm text-green">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-accent px-4 py-2 font-mono text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "Carregando..."
              : isSignUp
              ? "Criar conta"
              : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
            setMessage("");
          }}
          className="mt-4 w-full text-center text-sm text-ink-muted hover:text-ink-soft"
        >
          {isSignUp
            ? "Já tem conta? Faça login"
            : "Não tem conta? Crie uma"}
        </button>
      </div>
    </div>
  );
}
