"use client";

import { useState } from "react";
import type { Playbook } from "@/lib/supabase/types";
import {
  getBookQuestions,
  analyzePlaybookCompleteness,
  saveQuestionAnswer,
} from "./actions";
import { BookCheck, HelpCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";

interface BookQuestion {
  question: string;
  type: "example" | "origin" | "counterexample" | "story" | "meaning" | "person";
}

const TYPE_LABELS: Record<string, string> = {
  example: "Exemplo",
  origin: "Origem",
  counterexample: "Contra-exemplo",
  story: "História",
  meaning: "Significado",
  person: "Pessoa",
};

const TYPE_COLORS: Record<string, string> = {
  example: "bg-blue/20 text-blue",
  origin: "bg-purple/20 text-purple",
  counterexample: "bg-red/20 text-red",
  story: "bg-green/20 text-green",
  meaning: "bg-accent/20 text-accent",
  person: "bg-yellow/20 text-yellow",
};

function CompletenessIndicator({
  label,
  value,
}: {
  label: string;
  value: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {value ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-text-muted" />
      )}
      <span
        className={`font-mono text-[11px] ${
          value ? "text-text" : "text-text-muted"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function BookQuestionsPanel({
  playbook,
}: {
  playbook: Playbook;
}) {
  const [questions, setQuestions] = useState<BookQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [completeness, setCompleteness] = useState({
    score: playbook.completeness_score,
    has_example: playbook.has_example,
    has_story: playbook.has_story,
    has_origin: playbook.has_origin,
    has_counterexample: playbook.has_counterexample,
  });

  const isBookReady =
    completeness.has_example &&
    completeness.has_story &&
    completeness.has_origin &&
    completeness.has_counterexample &&
    completeness.score >= 80;

  async function handleGenerateQuestions() {
    setLoading(true);
    try {
      const result = await getBookQuestions(playbook.id);
      setQuestions(result);
    } catch (err) {
      console.error("Failed to generate questions:", err);
    }
    setLoading(false);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const result = await analyzePlaybookCompleteness(playbook.id);
      if (result) {
        setCompleteness({
          score: result.completeness_score,
          has_example: result.has_example,
          has_story: result.has_story,
          has_origin: result.has_origin,
          has_counterexample: result.has_counterexample,
        });
      }
    } catch (err) {
      console.error("Failed to analyze:", err);
    }
    setAnalyzing(false);
  }

  async function handleSaveAnswer(index: number) {
    const answer = answers[index];
    if (!answer?.trim()) return;

    setSavingIndex(index);
    try {
      await saveQuestionAnswer(playbook.id, questions[index].question, answer);
      // Remove the answered question
      setQuestions((prev) => prev.filter((_, i) => i !== index));
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      // Re-fetch completeness
      await handleAnalyze();
    } catch (err) {
      console.error("Failed to save answer:", err);
    }
    setSavingIndex(null);
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface/50 p-4">
      {/* Header with badge */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookCheck className="h-4 w-4 text-purple" />
          <h4 className="font-mono text-xs uppercase tracking-wider text-text-secondary">
            Pronto pro Livro
          </h4>
        </div>
        {isBookReady && (
          <span className="rounded-full bg-green/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-green">
            Pronto pro Livro
          </span>
        )}
      </div>

      {/* Completeness Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] text-text-muted">
            Completude
          </span>
          <span className="font-mono text-xs font-bold text-text">
            {completeness.score}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              completeness.score >= 80
                ? "bg-green"
                : completeness.score >= 50
                ? "bg-blue"
                : "bg-accent"
            }`}
            style={{ width: `${completeness.score}%` }}
          />
        </div>
      </div>

      {/* 4 Boolean indicators */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <CompletenessIndicator label="Exemplo" value={completeness.has_example} />
        <CompletenessIndicator label="História" value={completeness.has_story} />
        <CompletenessIndicator label="Origem" value={completeness.has_origin} />
        <CompletenessIndicator
          label="Contra-exemplo"
          value={completeness.has_counterexample}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="rounded-lg border border-border px-3 py-1.5 font-mono text-[10px] text-text-secondary transition hover:border-border-light hover:text-text disabled:opacity-50"
        >
          {analyzing ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analisando...
            </span>
          ) : (
            "Reanalisar"
          )}
        </button>
        <button
          onClick={handleGenerateQuestions}
          disabled={loading}
          className="rounded-lg bg-accent px-3 py-1.5 font-mono text-[10px] font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Gerando...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Gerar Perguntas pro Livro
            </span>
          )}
        </button>
      </div>

      {/* Questions List */}
      {questions.length > 0 && (
        <div className="mt-4 space-y-3">
          <h5 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Perguntas para aprofundar
          </h5>
          {questions.map((q, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm text-text leading-relaxed">
                  {q.question}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                    TYPE_COLORS[q.type] || "bg-surface text-text-muted"
                  }`}
                >
                  {TYPE_LABELS[q.type] || q.type}
                </span>
              </div>
              <textarea
                value={answers[i] || ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                }
                placeholder="Sua resposta aqui..."
                rows={3}
                className="mb-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              <button
                onClick={() => handleSaveAnswer(i)}
                disabled={!answers[i]?.trim() || savingIndex === i}
                className="rounded-lg bg-green/20 px-3 py-1 font-mono text-[10px] font-bold text-green transition hover:bg-green/30 disabled:opacity-50"
              >
                {savingIndex === i ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  "Salvar Resposta"
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
