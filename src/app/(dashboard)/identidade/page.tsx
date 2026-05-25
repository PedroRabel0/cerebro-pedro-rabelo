export const dynamic = "force-dynamic";

import { getIdentity } from "./actions";
import IdentityForm from "./IdentityForm";

export default async function IdentidadePage() {
  const identity = await getIdentity();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          Identidade
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Branding, voz e tom do Pedro.
        </p>
      </div>

      {!identity && (
        <div className="mb-6 rounded-xl border border-rule bg-paper-dark px-5 py-4 text-sm text-ink-muted">
          Identidade ainda não configurada. Preencha os campos abaixo para
          começar.
        </div>
      )}

      <IdentityForm initial={identity} />
    </div>
  );
}
