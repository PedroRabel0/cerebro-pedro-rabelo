export const dynamic = "force-dynamic";

import { getProfiles, getKnowledge } from "./actions";
import Tabs from "./Tabs";

export default async function ReferenciasPage() {
  const [profiles, knowledge] = await Promise.all([
    getProfiles(),
    getKnowledge(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          Referências
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Perfis de referência, posts analisados e conhecimento externo.
        </p>
      </div>

      <Tabs profiles={profiles} knowledge={knowledge} />
    </div>
  );
}
