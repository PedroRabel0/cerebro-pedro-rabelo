export const dynamic = "force-dynamic";

import { getEntries, getEntryByDate } from "./actions";
import Journal from "./Journal";
import { NotebookPen } from "lucide-react";

export default async function DiarioPage() {
  const today = new Date().toISOString().split("T")[0];
  const [entries, todayEntry] = await Promise.all([
    getEntries(30),
    getEntryByDate(today),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-violet/20">
            <NotebookPen className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Diario
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Registro do dia a dia — o contexto humano que alimenta o cerebro
            </p>
          </div>
        </div>
        <div className="mt-4 h-px bg-gradient-to-r from-accent/40 via-violet/20 to-transparent" />
      </div>

      <Journal entries={entries} todayEntry={todayEntry} today={today} />
    </div>
  );
}
