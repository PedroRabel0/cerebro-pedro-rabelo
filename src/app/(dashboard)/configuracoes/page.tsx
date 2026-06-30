export const dynamic = "force-dynamic";

import {
  getMonthlyCosts,
  getCurrentMonthCost,
  getCostsByProvider,
} from "./actions";
import CostDashboard from "./CostDashboard";
import { Settings } from "lucide-react";

export const metadata = {
  title: "Configurações — Segundo Cérebro",
};

export default async function ConfiguracoesPage() {
  const [monthlyCosts, currentMonthCost, providerCosts] = await Promise.all([
    getMonthlyCosts(),
    getCurrentMonthCost(),
    getCostsByProvider(),
  ]);

  return (
    <div>
      <header className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
          <Settings className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Configurações</h1>
          <p className="text-sm text-text-muted">
            Painel de custos e consumo de APIs
          </p>
        </div>
      </header>

      <CostDashboard
        currentMonthCost={currentMonthCost}
        monthlyCosts={monthlyCosts}
        providerCosts={providerCosts}
      />
    </div>
  );
}
