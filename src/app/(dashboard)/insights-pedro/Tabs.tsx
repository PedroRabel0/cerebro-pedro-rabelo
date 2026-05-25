"use client";

import { useState } from "react";
import type { Capture, ActivityLogEntry } from "@/lib/supabase/types";
import CaptureList from "./CaptureList";
import ActivityTimeline from "./ActivityTimeline";

type Tab = "capturas" | "timeline";

export default function Tabs({
  captures,
  activityLog,
}: {
  captures: Capture[];
  activityLog: ActivityLogEntry[];
}) {
  const [tab, setTab] = useState<Tab>("capturas");

  return (
    <div>
      <div className="mb-4 flex gap-0 border-b border-rule">
        <button
          onClick={() => setTab("capturas")}
          className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
            tab === "capturas"
              ? "border-accent text-accent"
              : "border-transparent text-ink-muted hover:text-ink-soft"
          }`}
        >
          Capturas
        </button>
        <button
          onClick={() => setTab("timeline")}
          className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
            tab === "timeline"
              ? "border-accent text-accent"
              : "border-transparent text-ink-muted hover:text-ink-soft"
          }`}
        >
          Timeline
        </button>
      </div>

      {tab === "capturas" ? (
        <CaptureList captures={captures} />
      ) : (
        <ActivityTimeline entries={activityLog} />
      )}
    </div>
  );
}
