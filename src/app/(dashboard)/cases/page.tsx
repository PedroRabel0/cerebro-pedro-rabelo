export const dynamic = "force-dynamic";

import { Building2 } from "lucide-react";
import { getCases } from "./actions";
import type { CaseCard } from "./actions";
import CaseList from "./CaseList";

export default async function CasesPage() {
  let cases: CaseCard[] = [];
  let migrationMissing = false;
  try {
    cases = await getCases();
  } catch {
    // Tabelas ainda nao existem — a migracao supabase-migration-company-cases.sql
    // precisa rodar no SQL Editor. A pagina avisa em vez de quebrar.
    migrationMissing = true;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-red/10">
            <Building2 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Cases de Empresas
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Fotos reais + a analise do Pedro em formato de carrossel
            </p>
          </div>
        </div>
      </div>

      <CaseList initialCases={cases} migrationMissing={migrationMissing} />
    </div>
  );
}
