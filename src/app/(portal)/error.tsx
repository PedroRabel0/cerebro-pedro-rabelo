"use client";

import { Brain } from "lucide-react";

/**
 * Error boundary do portal do cliente. Sem esta tela, uma excecao no portal
 * derrubava para a pagina de erro padrao do Next (em ingles, sem marca).
 * Nunca mostra error.message cru — so o digest como codigo de suporte.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <div className="logo-gradient mb-5 flex h-12 w-12 items-center justify-center rounded-2xl">
        <Brain className="h-6 w-6 text-white" />
      </div>
      <h1 className="font-display text-xl font-bold text-text">
        Algo deu errado por aqui
      </h1>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        Nao foi possivel carregar o portal agora. Tente novamente — se o
        problema continuar, avise a equipe do Pedro.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-text-muted">
          Codigo de suporte: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="btn-primary mt-6 rounded-xl px-6 py-2.5 text-sm font-medium text-white"
      >
        Tentar novamente
      </button>
    </div>
  );
}
