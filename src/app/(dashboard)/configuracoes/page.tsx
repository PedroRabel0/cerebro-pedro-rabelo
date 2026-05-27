import { getMonthlyCosts, getCurrentMonthCost, getCostsByProvider } from "./actions";
import CostDashboard from "./CostDashboard";

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
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-text">Configurações</h1>
        <p className="mt-1 text-sm text-text-muted">
          Gerencie custos e preferências do sistema
        </p>
      </header>

      <CostDashboard
        currentMonthCost={currentMonthCost}
        monthlyCosts={monthlyCosts}
        providerCosts={providerCosts}
      />
    </div>
  );
}
