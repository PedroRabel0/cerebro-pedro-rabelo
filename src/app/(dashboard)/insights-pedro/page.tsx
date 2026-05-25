export const dynamic = "force-dynamic";

import { getCaptures, getActivityLog } from "./actions";
import Tabs from "./Tabs";

export default async function InsightsPedroPage() {
  const [captures, activityLog] = await Promise.all([
    getCaptures(),
    getActivityLog(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          Insights Pedro
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Capturas de conversas e propostas geradas pela IA.
        </p>
      </div>

      <Tabs captures={captures} activityLog={activityLog} />
    </div>
  );
}
