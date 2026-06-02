export const revalidate = 30;

import { getCalendarEntries, getUnscheduledContents } from "./actions";
import CalendarView from "./CalendarView";
import { CalendarDays } from "lucide-react";

export default async function CalendarioPage() {
  const [entries, unscheduledContents] = await Promise.all([
    getCalendarEntries(),
    getUnscheduledContents(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-blue/20">
            <CalendarDays className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Calendario de Conteudo
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Planeje e organize suas publicacoes em todas as plataformas.
            </p>
          </div>
        </div>
      </div>

      <CalendarView
        initialEntries={entries}
        unscheduledContents={unscheduledContents}
      />
    </div>
  );
}
