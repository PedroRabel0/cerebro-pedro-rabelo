export const dynamic = "force-dynamic";

import { getPlaybooks, getStories, getThemes } from "./actions";
import Tabs from "./Tabs";
import { BookOpen } from "lucide-react";

export default async function BaseDeConhecimentoPage() {
  const [playbooks, stories, themes] = await Promise.all([
    getPlaybooks(),
    getStories(),
    getThemes(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple/20 to-blue/20">
            <BookOpen className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Base de Conhecimento
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Playbooks e histórias organizados por tema.
            </p>
          </div>
        </div>
      </div>

      <Tabs playbooks={playbooks} stories={stories} themes={themes} />
    </div>
  );
}
