export const dynamic = "force-dynamic";

import { getPlaybooks, getStories, getThemes } from "./actions";
import Tabs from "./Tabs";

export default async function BaseDeConhecimentoPage() {
  const [playbooks, stories, themes] = await Promise.all([
    getPlaybooks(),
    getStories(),
    getThemes(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          Base de Conhecimento
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Playbooks e histórias organizados por tema.
        </p>
      </div>

      <Tabs playbooks={playbooks} stories={stories} themes={themes} />
    </div>
  );
}
