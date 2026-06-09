export const dynamic = "force-dynamic";

import { getMetrics, getInstagramHandle } from "./actions";
import AnalyticsDashboard from "./AnalyticsDashboard";
import { BarChart3 } from "lucide-react";

export default async function AnalyticsPage() {
  const [metrics, handle] = await Promise.all([
    getMetrics(),
    getInstagramHandle(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-green/20">
            <BarChart3 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Analytics
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Performance dos seus conteúdos — importação automática do Instagram
            </p>
          </div>
        </div>
      </div>

      <AnalyticsDashboard initialMetrics={metrics} handle={handle} />
    </div>
  );
}
