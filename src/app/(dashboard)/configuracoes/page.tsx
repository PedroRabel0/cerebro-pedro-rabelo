import { getMonthlyCosts, getCurrentMonthCost } from "./actions";
import CostDashboard from "./CostDashboard";

export const metadata = {
  title: "Configurações — Segundo Cérebro",
};

export default async function ConfiguracoesPage() {
  const [monthlyCosts, currentMonthCost] = await Promise.all([
    getMonthlyCosts(),
    getCurrentMonthCost(),
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
      />
    </div>
  );
}
