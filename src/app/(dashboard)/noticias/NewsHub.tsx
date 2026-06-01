"use client";

import { useState, useTransition } from "react";
import {
  getThemes,
  getArticlesByTheme,
  getDigests,
  createTheme,
  toggleTheme,
  deleteTheme,
  fetchAllNews,
  generateDigest,
  generatePedroAngle,
} from "./actions";
import type { NewsTheme, NewsArticle, NewsDigest } from "./actions";
import {
  Download,
  FileText,
  Plus,
  Loader2,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Sparkles,
  X,
  Calendar,
  Tag,
  Lightbulb,
} from "lucide-react";

// ============================================================
// MAIN COMPONENT
// ============================================================

interface NewsHubProps {
  initialThemes: NewsTheme[];
  initialArticles: NewsArticle[];
  initialDigests: NewsDigest[];
}

export default function NewsHub({
  initialThemes,
  initialArticles,
  initialDigests,
}: NewsHubProps) {
  const [themes, setThemes] = useState<NewsTheme[]>(initialThemes);
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles);
  const [digests, setDigests] = useState<NewsDigest[]>(initialDigests);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [showThemeManager, setShowThemeManager] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [expandedDigest, setExpandedDigest] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [fetchingNews, setFetchingNews] = useState(false);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [generatingAngle, setGeneratingAngle] = useState<string | null>(null);

  // Novo tema form
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeKeywords, setNewThemeKeywords] = useState("");

  // Refresh data
  async function refreshData() {
    startTransition(async () => {
      const [t, a, d] = await Promise.all([
        getThemes(),
        getArticlesByTheme(selectedTheme || undefined, 50),
        getDigests(10),
      ]);
      setThemes(t);
      setArticles(a);
      setDigests(d);
    });
  }

  // Filter articles by theme
  async function filterByTheme(themeId: string | null) {
    setSelectedTheme(themeId);
    startTransition(async () => {
      const a = await getArticlesByTheme(themeId || undefined, 50);
      setArticles(a);
    });
  }

  // Fetch all news
  async function handleFetchAll() {
    setFetchingNews(true);
    setFetchResult(null);
    try {
      const result = await fetchAllNews();
      setFetchResult(result.summary);
      await refreshData();
    } catch {
      setFetchResult("Erro ao buscar noticias.");
    } finally {
      setFetchingNews(false);
    }
  }

  // Generate digest
  async function handleGenerateDigest() {
    if (!selectedTheme) {
      setFetchResult("Selecione um tema para gerar o digest.");
      return;
    }
    setGeneratingDigest(true);
    setFetchResult(null);
    try {
      const result = await generateDigest(selectedTheme);
      if ("error" in result) {
        setFetchResult(result.error);
      } else {
        setFetchResult("Digest gerado com sucesso!");
        await refreshData();
      }
    } catch {
      setFetchResult("Erro ao gerar digest.");
    } finally {
      setGeneratingDigest(false);
    }
  }

  // Generate Pedro angle
  async function handleGenerateAngle(articleId: string) {
    setGeneratingAngle(articleId);
    try {
      const result = await generatePedroAngle(articleId);
      if ("error" in result) {
        setFetchResult(result.error);
      } else {
        // Atualizar artigo localmente
        setArticles((prev) =>
          prev.map((a) =>
            a.id === articleId ? { ...a, pedro_angle: result.angle } : a
          )
        );
      }
    } catch {
      setFetchResult("Erro ao gerar angulo.");
    } finally {
      setGeneratingAngle(null);
    }
  }

  // Add theme
  async function handleAddTheme(e: React.FormEvent) {
    e.preventDefault();
    if (!newThemeName.trim()) return;
    const keywords = newThemeKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createTheme(newThemeName.trim(), keywords);
      if ("error" in result) {
        setFetchResult(result.error);
      } else {
        setNewThemeName("");
        setNewThemeKeywords("");
        await refreshData();
      }
    });
  }

  // Toggle theme
  async function handleToggleTheme(id: string, active: boolean) {
    startTransition(async () => {
      await toggleTheme(id, active);
      await refreshData();
    });
  }

  // Delete theme
  async function handleDeleteTheme(id: string) {
    startTransition(async () => {
      await deleteTheme(id);
      if (selectedTheme === id) setSelectedTheme(null);
      await refreshData();
    });
  }

  const activeThemes = themes.filter((t) => t.active);
  const selectedThemeName = themes.find((t) => t.id === selectedTheme)?.name;

  return (
    <div className="space-y-6">
      {/* ======== TOP BAR ======== */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleFetchAll}
          disabled={fetchingNews}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {fetchingNews ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Buscar Noticias Agora
        </button>

        <button
          onClick={handleGenerateDigest}
          disabled={generatingDigest || !selectedTheme}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-card-hover disabled:opacity-50"
        >
          {generatingDigest ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Gerar Digest Semanal
          {selectedThemeName && (
            <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs text-text-muted">
              {selectedThemeName}
            </span>
          )}
        </button>

        <button
          onClick={() => setShowThemeManager(!showThemeManager)}
          className="ml-auto flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-card-hover"
        >
          <Tag className="h-4 w-4" />
          Gerenciar Temas
          {showThemeManager ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* ======== RESULT TOAST ======== */}
      {fetchResult && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary animate-slide-in">
          <span className="flex-1">{fetchResult}</span>
          <button onClick={() => setFetchResult(null)} className="text-text-muted hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ======== THEME PILLS ======== */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => filterByTheme(null)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            !selectedTheme
              ? "bg-accent/15 text-accent"
              : "bg-surface text-text-secondary hover:bg-card-hover"
          }`}
        >
          Todos
        </button>
        {activeThemes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => filterByTheme(theme.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedTheme === theme.id
                ? "bg-accent/15 text-accent"
                : "bg-surface text-text-secondary hover:bg-card-hover"
            }`}
          >
            {theme.name}
          </button>
        ))}
      </div>

      {/* ======== THEME MANAGER (collapsible) ======== */}
      {showThemeManager && (
        <div className="rounded-xl border border-border bg-card p-5 animate-slide-in">
          <h3 className="mb-4 text-sm font-semibold text-text">
            Gerenciar Temas
          </h3>

          {/* Theme list */}
          <div className="mb-4 space-y-2">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5"
              >
                <span className="flex-1 text-sm text-text">{theme.name}</span>
                <span className="text-xs text-text-muted">
                  {(theme.keywords || []).join(", ")}
                </span>
                <button
                  onClick={() => handleToggleTheme(theme.id, !theme.active)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-card-hover"
                  title={theme.active ? "Desativar" : "Ativar"}
                >
                  {theme.active ? (
                    <Eye className="h-4 w-4 text-green" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDeleteTheme(theme.id)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-text-muted hover:text-red hover:bg-card-hover"
                  title="Excluir tema"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {themes.length === 0 && (
              <p className="text-sm text-text-muted">Nenhum tema criado.</p>
            )}
          </div>

          {/* Add theme form */}
          <form onSubmit={handleAddTheme} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              placeholder="Nome do tema"
              className="flex-1 min-w-[150px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={newThemeKeywords}
              onChange={(e) => setNewThemeKeywords(e.target.value)}
              placeholder="Palavras-chave (separadas por virgula)"
              className="flex-2 min-w-[200px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={isPending || !newThemeName.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </form>
        </div>
      )}

      {/* ======== MAIN CONTENT — 2 COLUMNS ======== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* LEFT — ARTICLE FEED */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Artigos {selectedThemeName && `— ${selectedThemeName}`}
          </h2>

          {articles.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <Download className="mx-auto mb-3 h-8 w-8 text-text-muted" />
              <p className="text-sm text-text-secondary">
                Clique em &quot;Buscar Noticias&quot; para importar os ultimos artigos
              </p>
            </div>
          ) : (
            articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                themeName={themes.find((t) => t.id === article.theme_id)?.name}
                onGenerateAngle={handleGenerateAngle}
                isGenerating={generatingAngle === article.id}
              />
            ))
          )}
        </div>

        {/* RIGHT — DIGESTS SIDEBAR */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Digests
          </h2>

          {digests.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <Lightbulb className="mx-auto mb-3 h-8 w-8 text-text-muted" />
              <p className="text-sm text-text-secondary">
                Gere um digest semanal para ver insights cruzados com o Pedro
              </p>
            </div>
          ) : (
            digests.map((digest) => (
              <DigestCard
                key={digest.id}
                digest={digest}
                isExpanded={expandedDigest === digest.id}
                onToggle={() =>
                  setExpandedDigest(
                    expandedDigest === digest.id ? null : digest.id
                  )
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ARTICLE CARD
// ============================================================

function ArticleCard({
  article,
  themeName,
  onGenerateAngle,
  isGenerating,
}: {
  article: NewsArticle;
  themeName?: string;
  onGenerateAngle: (id: string) => void;
  isGenerating: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-hover">
      <div className="flex items-start gap-3">
        {/* Image thumbnail */}
        {article.image_url && (
          <img
            src={article.image_url}
            alt=""
            className="h-20 w-28 flex-shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-1.5 text-sm font-semibold text-text hover:text-accent transition-colors"
          >
            <span className="line-clamp-2">{article.title}</span>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted group-hover:text-accent" />
          </a>

          {/* Meta */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">
              {article.source_name}
            </span>
            {themeName && (
              <span className="rounded-md bg-blue/10 px-2 py-0.5 text-xs font-medium text-blue">
                {themeName}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Calendar className="h-3 w-3" />
              {new Date(article.published_at).toLocaleDateString("pt-BR")}
            </span>
          </div>

          {/* Description */}
          {article.description && (
            <p className="mt-2 text-xs text-text-secondary line-clamp-2">
              {article.description}
            </p>
          )}
        </div>
      </div>

      {/* Pedro Angle */}
      {article.pedro_angle ? (
        <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Angulo do Pedro
          </div>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
            {article.pedro_angle}
          </p>
        </div>
      ) : (
        <button
          onClick={() => onGenerateAngle(article.id)}
          disabled={isGenerating}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-accent disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Gerar Angulo do Pedro
        </button>
      )}
    </div>
  );
}

// ============================================================
// DIGEST CARD
// ============================================================

function DigestCard({
  digest,
  isExpanded,
  onToggle,
}: {
  digest: NewsDigest;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const preview = digest.digest_markdown.slice(0, 200).replace(/[#*]/g, "");

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-hover">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="rounded-md bg-purple/10 px-2 py-0.5 text-xs font-medium text-purple">
            {digest.theme_name}
          </span>
          <p className="mt-1.5 text-xs text-text-muted">
            {digest.period} — {digest.articles_count} artigos
          </p>
        </div>
        <span className="text-xs text-text-muted">
          {new Date(digest.created_at).toLocaleDateString("pt-BR")}
        </span>
      </div>

      {/* Preview or Full content */}
      {isExpanded ? (
        <div className="mt-3 space-y-3">
          <div className="prose prose-invert prose-sm max-w-none text-xs text-text-secondary leading-relaxed whitespace-pre-line">
            {digest.digest_markdown}
          </div>

          {/* Pedro Angles */}
          {digest.pedro_angles &&
            Object.keys(digest.pedro_angles).length > 0 && (
              <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                  Angulos do Pedro
                </h4>
                {Object.entries(digest.pedro_angles).map(([title, angle]) => (
                  <div key={title} className="mb-2 last:mb-0">
                    <p className="text-xs font-medium text-text">{title}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {angle}
                    </p>
                  </div>
                ))}
              </div>
            )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-text-secondary line-clamp-4">
          {preview}...
        </p>
      )}

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-text-muted hover:text-accent transition-colors"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            Recolher
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            Ver digest completo
          </>
        )}
      </button>
    </div>
  );
}
