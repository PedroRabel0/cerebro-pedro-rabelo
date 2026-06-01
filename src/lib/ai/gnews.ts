/**
 * GNews API client — busca noticias em portugues.
 * https://gnews.io/api/v4
 */

export interface GNewsArticle {
  title: string;
  description: string;
  url: string;
  source_name: string;
  image_url: string | null;
  published_at: string;
}

interface GNewsApiArticle {
  title: string;
  description: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string; url: string };
}

interface GNewsApiResponse {
  totalArticles: number;
  articles: GNewsApiArticle[];
}

function getApiKey(): string | null {
  return process.env.GNEWS_API_KEY || null;
}

function mapArticle(a: GNewsApiArticle): GNewsArticle {
  return {
    title: a.title,
    description: a.description || "",
    url: a.url,
    source_name: a.source?.name || "Desconhecido",
    image_url: a.image || null,
    published_at: a.publishedAt,
  };
}

/**
 * Busca artigos por query (palavras-chave).
 */
export async function searchNews(
  query: string,
  max = 10
): Promise<GNewsArticle[] | { error: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { error: "GNEWS_API_KEY not configured" };

  try {
    const url = new URL("https://gnews.io/api/v4/search");
    url.searchParams.set("q", query);
    url.searchParams.set("lang", "pt");
    url.searchParams.set("max", String(Math.min(max, 10)));
    url.searchParams.set("apikey", apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      console.error("[GNews] API error:", res.status, text);
      return { error: `GNews API retornou status ${res.status}` };
    }

    const data: GNewsApiResponse = await res.json();
    return (data.articles || []).map(mapArticle);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[GNews] Fetch error:", msg);
    return { error: `Erro ao buscar noticias: ${msg}` };
  }
}

/**
 * Busca top headlines por topico.
 * Topicos validos: general, world, nation, business, technology, entertainment, sports, science, health
 */
export async function topHeadlines(
  topic = "general",
  max = 10
): Promise<GNewsArticle[] | { error: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { error: "GNEWS_API_KEY not configured" };

  try {
    const url = new URL("https://gnews.io/api/v4/top-headlines");
    url.searchParams.set("topic", topic);
    url.searchParams.set("lang", "pt");
    url.searchParams.set("max", String(Math.min(max, 10)));
    url.searchParams.set("apikey", apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      console.error("[GNews] API error:", res.status, text);
      return { error: `GNews API retornou status ${res.status}` };
    }

    const data: GNewsApiResponse = await res.json();
    return (data.articles || []).map(mapArticle);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[GNews] Fetch error:", msg);
    return { error: `Erro ao buscar headlines: ${msg}` };
  }
}
