export const dynamic = "force-dynamic";

import {
  getFormats,
  getGeneratedContents,
  getPlaybooks,
  getStories,
} from "./actions";
import Tabs from "./Tabs";

export default async function GerarConteudoPage() {
  const [formats, contents, playbooks, stories] = await Promise.all([
    getFormats(),
    getGeneratedContents(),
    getPlaybooks(),
    getStories(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          Gerar Conteúdo
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Crie conteúdos para redes sociais a partir da base de conhecimento.
        </p>
      </div>

      <Tabs
        formats={formats}
        contents={contents}
        playbooks={playbooks}
        stories={stories}
      />
    </div>
  );
}
