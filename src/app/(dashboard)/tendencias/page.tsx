export const dynamic = "force-dynamic";

import { getTrends } from "./actions";
import TrendsPanel from "./TrendsPanel";
import { TrendingUp } from "lucide-react";

export default async function TendenciasPage() {
  const trends = await getTrends();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20">
            <TrendingUp className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Tendencias
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Detecte trends e crie conteudo relevante
            </p>
          </div>
        </div>
      </div>

      <TrendsPanel initialTrends={trends} />
    </div>
  );
}
