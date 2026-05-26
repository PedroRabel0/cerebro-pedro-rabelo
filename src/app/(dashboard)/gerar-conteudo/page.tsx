export const dynamic = "force-dynamic";
export const maxDuration = 60;

import {
  getFormats,
  getGeneratedContents,
  getPlaybooks,
  getStories,
} from "./actions";
import Tabs from "./Tabs";
import { Sparkles } from "lucide-react";

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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Gerar Conteudo
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Descreva o que voce quer e a IA gera o conteudo pronto para postar.
            </p>
          </div>
        </div>
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
