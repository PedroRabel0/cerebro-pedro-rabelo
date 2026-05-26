"use client";

import { useState } from "react";
import { X } from "lucide-react";

function diffLines(
  oldText: string,
  newText: string
): { type: "same" | "added" | "removed"; text: string }[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: { type: "same" | "added" | "removed"; text: string }[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);

  // Simple line-by-line comparison
  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length) {
      if (oldLines[oi] === newLines[ni]) {
        result.push({ type: "same", text: oldLines[oi] });
        oi++;
        ni++;
      } else {
        // Check if old line appears later in new (it was added before)
        const newIdx = newLines.indexOf(oldLines[oi], ni);
        const oldIdx = oldLines.indexOf(newLines[ni], oi);

        if (newIdx !== -1 && (oldIdx === -1 || newIdx - ni <= oldIdx - oi)) {
          // Lines were added in new
          while (ni < newIdx) {
            result.push({ type: "added", text: newLines[ni] });
            ni++;
          }
        } else if (oldIdx !== -1) {
          // Lines were removed from old
          while (oi < oldIdx) {
            result.push({ type: "removed", text: oldLines[oi] });
            oi++;
          }
        } else {
          // Line changed
          result.push({ type: "removed", text: oldLines[oi] });
          result.push({ type: "added", text: newLines[ni] });
          oi++;
          ni++;
        }
      }
    } else if (oi < oldLines.length) {
      result.push({ type: "removed", text: oldLines[oi] });
      oi++;
    } else {
      result.push({ type: "added", text: newLines[ni] });
      ni++;
    }
  }

  return result;
}

function extractText(version: Record<string, unknown> | null): string {
  if (!version) return "";
  // Try common field names for the version content
  if (typeof version.body_markdown === "string") return version.body_markdown;
  if (typeof version.content === "string") return version.content;
  if (typeof version.text === "string") return version.text;
  // Fallback: JSON stringify
  return JSON.stringify(version, null, 2);
}

export default function DiffView({
  versionCurrent,
  versionPrevious,
  onClose,
}: {
  versionCurrent: Record<string, unknown> | null;
  versionPrevious: Record<string, unknown> | null;
  onClose: () => void;
}) {
  const oldText = extractText(versionPrevious);
  const newText = extractText(versionCurrent);
  const lines = diffLines(oldText, newText);

  const addedCount = lines.filter((l) => l.type === "added").length;
  const removedCount = lines.filter((l) => l.type === "removed").length;

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-text-secondary">
            Alteracoes
          </span>
          <span className="font-mono text-[10px] text-green">+{addedCount}</span>
          <span className="font-mono text-[10px] text-red">-{removedCount}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-text-muted transition hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-lg bg-card p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.type === "added"
                ? "bg-green/10 text-green"
                : line.type === "removed"
                  ? "bg-red/10 text-red line-through"
                  : "text-text-muted"
            }
          >
            <span className="mr-2 inline-block w-4 select-none text-right text-text-muted/50">
              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            </span>
            {line.text || " "}
          </div>
        ))}
        {lines.length === 0 && (
          <p className="text-center text-text-muted">Sem alteracoes detectadas.</p>
        )}
      </div>
    </div>
  );
}
