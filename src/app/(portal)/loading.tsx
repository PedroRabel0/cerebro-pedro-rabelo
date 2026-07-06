import { Brain } from "lucide-react";

/** Loading state do portal (antes: tela branca sem feedback). */
export default function PortalLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
      <div className="logo-gradient animate-float flex h-12 w-12 items-center justify-center rounded-2xl">
        <Brain className="h-6 w-6 text-white" />
      </div>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-text-muted">
        Carregando...
      </p>
    </div>
  );
}
