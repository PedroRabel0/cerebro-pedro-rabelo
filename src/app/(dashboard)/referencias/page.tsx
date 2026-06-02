export const revalidate = 30;

import { getProfiles, getKnowledge, detectWeeklyPatterns } from "./actions";
import Tabs from "./Tabs";
import { Search } from "lucide-react";

export default async function ReferenciasPage() {
  const [profiles, knowledge, patterns] = await Promise.all([
    getProfiles(),
    getKnowledge(),
    detectWeeklyPatterns().catch(() => []),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue/20 to-green/20">
            <Search className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Referências
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Perfis de referência, posts analisados e conhecimento externo.
            </p>
          </div>
        </div>
      </div>

      <Tabs profiles={profiles} knowledge={knowledge} patterns={patterns} />
    </div>
  );
}
