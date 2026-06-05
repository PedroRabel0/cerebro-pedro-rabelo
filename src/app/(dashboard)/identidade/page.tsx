export const dynamic = "force-dynamic";

import { getIdentity, autoFillIdentity } from "./actions";
import { getRules } from "./rules-actions";
import IdentityForm from "./IdentityForm";
import DecisionRules from "./DecisionRules";
import { Target, Info } from "lucide-react";

export default async function IdentidadePage() {
  const [existingBefore, rules] = await Promise.all([
    getIdentity(),
    getRules(),
  ]);
  const identity = await autoFillIdentity();
  const wasAutoFilled = !existingBefore && !!identity;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-green/20 to-accent/20">
            <Target className="h-5 w-5 text-green" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Identidade
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Branding, voz e tom do Pedro.
            </p>
          </div>
        </div>
      </div>

      {wasAutoFilled && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green/20 bg-green/5 px-5 py-4">
          <Info className="h-5 w-5 shrink-0 text-green" />
          <p className="text-sm text-text-secondary">
            Identidade preenchida automaticamente com base no Personal Brand do Pedro.
          </p>
        </div>
      )}

      <IdentityForm initial={identity} wasAutoFilled={wasAutoFilled} />

      <DecisionRules initialRules={rules} />
    </div>
  );
}
