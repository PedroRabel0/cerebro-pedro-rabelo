export const revalidate = 30;

import { getSnapshots } from "./actions";
import VoiceTimeline from "./VoiceTimeline";
import { AudioLines } from "lucide-react";

export default async function EvolucaoVozPage() {
  const snapshots = await getSnapshots();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20">
            <AudioLines className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Evolução da Voz
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Acompanhe como sua identidade evolui ao longo do tempo.
            </p>
          </div>
        </div>
      </div>

      <VoiceTimeline initialSnapshots={snapshots} />
    </div>
  );
}
