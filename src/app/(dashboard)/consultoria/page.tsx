export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { Briefcase } from "lucide-react";
import { getConsultoriaData, getDailyDigest, getGoogleStatus } from "./actions";
import ConsultoriaList from "./ConsultoriaList";

export default async function ConsultoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  // Rede de seguranca: se alguma leitura falhar (hipo transitorio no banco,
  // sessao em rotacao, etc.), a pagina DEGRADA em vez de quebrar a tela toda.
  const [{ companies, overview }, digest, googleStatus, sp] = await Promise.all([
    getConsultoriaData().catch((e) => {
      console.error("[Consultoria] getConsultoriaData falhou:", e);
      return {
        companies: [],
        overview: {
          active_companies: 0,
          pending_tasks: 0,
          overdue_tasks: 0,
          mrr: 0,
          overdue_payments: 0,
          renewals_soon: 0,
          cooling_clients: 0,
        },
      };
    }),
    getDailyDigest().catch((e) => {
      console.error("[Consultoria] getDailyDigest falhou:", e);
      return {
        generated_for: new Date().toISOString().slice(0, 10),
        tasks_today: [],
        renewals: [],
        payments: [],
        cooling: [],
        pending_questions: [],
      };
    }),
    getGoogleStatus().catch((e) => {
      console.error("[Consultoria] getGoogleStatus falhou:", e);
      return { connected: false };
    }),
    searchParams,
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-violet/20">
            <Briefcase className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Consultoria
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Seu painel de bastidor — empresas, reuniões, tarefas e mensagens prontas
            </p>
          </div>
        </div>
      </div>

      <ConsultoriaList
        companies={companies}
        overview={overview}
        digest={digest}
        googleConnected={googleStatus.connected}
        googleFlash={sp.google}
      />
    </div>
  );
}
