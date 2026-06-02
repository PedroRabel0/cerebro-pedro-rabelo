export const revalidate = 30;

import { getHooks } from "./actions";
import HooksBank from "./HooksBank";
import { Anchor } from "lucide-react";

export default async function HooksPage() {
  const hooks = await getHooks();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20">
            <Anchor className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Banco de Hooks
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Biblioteca de ganchos categorizados com gerador de IA.
            </p>
          </div>
        </div>
      </div>

      <HooksBank initialHooks={hooks} />
    </div>
  );
}
