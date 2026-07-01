"use client";

import { useState, useTransition } from "react";
import {
  Brain,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  createRule,
  updateRule,
  deleteRule,
  generateRulesFromContent,
} from "./rules-actions";
import type { DecisionRule, RuleCategory } from "./rules-actions";

const RULE_CATEGORIES: { value: RuleCategory; label: string }[] = [
  { value: "conteudo", label: "Conteudo" },
  { value: "formato", label: "Formato" },
  { value: "plataforma", label: "Plataforma" },
  { value: "metrica", label: "Metrica" },
  { value: "marca", label: "Marca" },
  { value: "geral", label: "Geral" },
];

interface Props {
  initialRules: DecisionRule[];
}

const CATEGORY_COLORS: Record<string, string> = {
  conteudo: "bg-accent/15 text-accent border-accent/30",
  formato: "bg-purple/15 text-purple border-purple/30",
  plataforma: "bg-blue/15 text-blue border-blue/30",
  metrica: "bg-green/15 text-green border-green/30",
  marca: "bg-orange/15 text-orange border-orange/30",
  geral: "bg-text-muted/15 text-text-secondary border-text-muted/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  conteudo: "Conteudo",
  formato: "Formato",
  plataforma: "Plataforma",
  metrica: "Metrica",
  marca: "Marca",
  geral: "Geral",
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.geral;
  const label = CATEGORY_LABELS[category] || category;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${colors}`}
    >
      {label}
    </span>
  );
}

interface SuggestedRule {
  rule_text: string;
  category: string;
  context: string;
}

export default function DecisionRules({ initialRules }: Props) {
  const [rules, setRules] = useState<DecisionRule[]>(initialRules);
  const [showForm, setShowForm] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [ruleText, setRuleText] = useState("");
  const [category, setCategory] = useState<RuleCategory>("conteudo");
  const [context, setContext] = useState("");

  // Edit form state
  const [editRuleText, setEditRuleText] = useState("");
  const [editCategory, setEditCategory] = useState<RuleCategory>("conteudo");
  const [editContext, setEditContext] = useState("");

  // AI state
  const [aiText, setAiText] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedRule[]>([]);

  const [isPending, startTransition] = useTransition();
  const [isAIPending, startAITransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Group rules by category
  const filteredRules = filter
    ? rules.filter((r) => r.category === filter)
    : rules;

  const grouped = filteredRules.reduce<Record<string, DecisionRule[]>>(
    (acc, rule) => {
      const cat = rule.category || "geral";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(rule);
      return acc;
    },
    {}
  );

  // Category counts for filter pills
  const categoryCounts = rules.reduce<Record<string, number>>((acc, rule) => {
    const cat = rule.category || "geral";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  async function handleCreate() {
    if (!ruleText.trim()) return;
    startTransition(async () => {
      try {
        const newRule = await createRule(
          ruleText.trim(),
          category,
          context.trim() || undefined
        );
        setRules((prev) => [newRule, ...prev]);
        setRuleText("");
        setContext("");
        setCategory("conteudo");
        setShowForm(false);
      } catch (err) {
        // Keep form open on error
      }
    });
  }

  async function handleUpdate(id: string) {
    if (!editRuleText.trim()) return;
    startTransition(async () => {
      try {
        const updated = await updateRule(
          id,
          editRuleText.trim(),
          editCategory,
          editContext.trim() || undefined
        );
        setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
        setEditingId(null);
      } catch (err) {
        // Keep editing on error
      }
    });
  }

  async function handleDelete(id: string) {
    setIsDeleting(id);
    try {
      await deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      // Silently fail
    }
    setIsDeleting(null);
  }

  function startEditing(rule: DecisionRule) {
    setEditingId(rule.id);
    setEditRuleText(rule.rule_text);
    setEditCategory(rule.category as RuleCategory);
    setEditContext(rule.context || "");
  }

  async function handleAIExtract() {
    if (!aiText.trim()) return;
    startAITransition(async () => {
      try {
        const result = await generateRulesFromContent(aiText.trim());
        setSuggestions(result);
      } catch (err) {
        setSuggestions([]);
      }
    });
  }

  async function acceptSuggestion(suggestion: SuggestedRule) {
    startTransition(async () => {
      try {
        const newRule = await createRule(
          suggestion.rule_text,
          suggestion.category,
          suggestion.context || undefined
        );
        setRules((prev) => [newRule, ...prev]);
        setSuggestions((prev) =>
          prev.filter((s) => s.rule_text !== suggestion.rule_text)
        );
      } catch (err) {
        // Silently fail
      }
    });
  }

  function rejectSuggestion(suggestion: SuggestedRule) {
    setSuggestions((prev) =>
      prev.filter((s) => s.rule_text !== suggestion.rule_text)
    );
  }

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red/20 to-accent/20">
            <Brain className="h-5 w-5 text-red" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-text sm:text-2xl">
              Regras de Decisao do Pedro
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              O PORQUE por tras das decisoes — o que faz o conteudo soar como
              Pedro
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            setShowAI(false);
          }}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface transition-colors"
        >
          {showForm ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Adicionar regra
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAI(!showAI);
            setShowForm(false);
          }}
          className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
        >
          {showAI ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Extrair regras de um texto
        </button>
      </div>

      {/* Add Rule Form */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5 animate-fade-in">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
            Nova Regra
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Regra
              </label>
              <textarea
                value={ruleText}
                onChange={(e) => setRuleText(e.target.value)}
                rows={3}
                aria-label="Regra"
                placeholder="Ex: Quando o tema e lideranca, sempre abrir com historia pessoal"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RuleCategory)}
                  aria-label="Categoria"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {RULE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Contexto (porque)
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  aria-label="Contexto (porque)"
                  placeholder="Ex: Porque storytelling conecta mais que teoria"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !ruleText.trim()}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Salvar regra
            </button>
          </div>
        </div>
      )}

      {/* AI Extraction */}
      {showAI && (
        <div className="mb-6 rounded-2xl border border-accent/20 bg-accent/5 p-5 animate-fade-in">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-accent mb-4">
            Extrair Regras com IA
          </h3>
          <p className="mb-3 text-sm text-text-secondary">
            Cole uma transcricao, notas ou texto do Pedro. A IA vai extrair
            regras de decisao automaticamente.
          </p>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            rows={6}
            aria-label="Texto para extrair regras"
            placeholder="Cole aqui a transcricao, notas ou texto para extrair regras..."
            className="mb-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
          />
          <button
            type="button"
            onClick={handleAIExtract}
            disabled={isAIPending || !aiText.trim()}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-accent-hover transition-all disabled:opacity-50"
          >
            {isAIPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extraindo...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Extrair regras
              </>
            )}
          </button>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Regras sugeridas ({suggestions.length})
              </h4>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CategoryBadge category={s.category} />
                    </div>
                    <p className="text-sm text-text">{s.rule_text}</p>
                    {s.context && (
                      <p className="mt-1 text-xs text-text-muted">
                        {s.context}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => acceptSuggestion(s)}
                      disabled={isPending}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-green/30 bg-green/10 text-green hover:bg-green/20 transition-colors disabled:opacity-50"
                      title="Aceitar"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectSuggestion(s)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red/30 bg-red/10 text-red hover:bg-red/20 transition-colors"
                      title="Rejeitar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category Filter Pills */}
      {rules.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              filter === null
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-card text-text-muted hover:bg-surface"
            }`}
          >
            Todas ({rules.length})
          </button>
          {Object.entries(categoryCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(filter === cat ? null : cat)}
                className={`rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  filter === cat
                    ? CATEGORY_COLORS[cat] || CATEGORY_COLORS.geral
                    : "border-border bg-card text-text-muted hover:bg-surface"
                }`}
              >
                {CATEGORY_LABELS[cat] || cat} ({count})
              </button>
            ))}
        </div>
      )}

      {/* Rules List Grouped by Category */}
      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Brain className="mx-auto mb-3 h-8 w-8 text-text-muted" />
          <p className="text-sm text-text-muted">
            Nenhuma regra de decisao ainda. Adicione manualmente ou extraia de um
            texto com IA.
          </p>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-text-muted">
            Nenhuma regra nesta categoria.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, catRules]) => (
              <div key={cat}>
                <div className="mb-3 flex items-center gap-2">
                  <CategoryBadge category={cat} />
                  <span className="font-mono text-[10px] text-text-muted">
                    {catRules.length}{" "}
                    {catRules.length === 1 ? "regra" : "regras"}
                  </span>
                </div>
                <div className="space-y-2">
                  {catRules.map((rule) =>
                    editingId === rule.id ? (
                      /* Edit mode */
                      <div
                        key={rule.id}
                        className="rounded-xl border border-accent/30 bg-card p-4"
                      >
                        <div className="space-y-3">
                          <textarea
                            value={editRuleText}
                            onChange={(e) => setEditRuleText(e.target.value)}
                            rows={2}
                            aria-label="Editar regra"
                            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
                          />
                          <div className="flex gap-3">
                            <select
                              value={editCategory}
                              onChange={(e) =>
                                setEditCategory(
                                  e.target.value as RuleCategory
                                )
                              }
                              aria-label="Categoria"
                              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
                            >
                              {RULE_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={editContext}
                              onChange={(e) => setEditContext(e.target.value)}
                              aria-label="Contexto (porque)"
                              placeholder="Contexto (porque)"
                              className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdate(rule.id)}
                              disabled={isPending}
                              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                            >
                              {isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface transition-colors"
                            >
                              <X className="h-3 w-3" />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <div
                        key={rule.id}
                        className="group rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text">
                              {rule.rule_text}
                            </p>
                            {rule.context && (
                              <p className="mt-1.5 text-xs text-text-muted italic">
                                {rule.context}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startEditing(rule)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(rule.id)}
                              disabled={isDeleting === rule.id}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-red/10 hover:text-red transition-colors disabled:opacity-50"
                              title="Deletar"
                            >
                              {isDeleting === rule.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
