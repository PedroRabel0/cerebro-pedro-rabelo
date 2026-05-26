"use client";

import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-red/30 bg-card p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-red/10">
          <AlertTriangle className="h-7 w-7 text-red" />
        </div>

        <h2 className="text-xl font-semibold text-text">Algo deu errado</h2>

        <p className="text-sm text-text-muted">{error.message}</p>

        <button
          onClick={reset}
          className="mt-2 inline-flex items-center rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
