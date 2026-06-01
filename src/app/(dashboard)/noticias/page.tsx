export const dynamic = "force-dynamic";

import { getThemes, getArticlesByTheme, getDigests } from "./actions";
import NewsHub from "./NewsHub";
import { Newspaper } from "lucide-react";

export default async function NoticiasPage() {
  const [themes, articles, digests] = await Promise.all([
    getThemes(),
    getArticlesByTheme(undefined, 50),
    getDigests(10),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue/20 to-accent/20">
            <Newspaper className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Noticias
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Conhecimentos gerais e noticias cruzadas com a visao do Pedro
            </p>
          </div>
        </div>
      </div>

      <NewsHub
        initialThemes={themes}
        initialArticles={articles}
        initialDigests={digests}
      />
    </div>
  );
}
