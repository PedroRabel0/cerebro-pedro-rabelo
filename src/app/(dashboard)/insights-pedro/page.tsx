export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { getCaptures, getActivityLog } from "./actions";
import Tabs from "./Tabs";
import { Lightbulb } from "lucide-react";

export default async function InsightsPedroPage() {
  const [captures, activityLog] = await Promise.all([
    getCaptures(),
    getActivityLog(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-red/20">
            <Lightbulb className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Insights Pedro
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Capturas de conversas e propostas geradas pela IA.
            </p>
          </div>
        </div>
      </div>

      <Tabs captures={captures} activityLog={activityLog} />
    </div>
  );
}
