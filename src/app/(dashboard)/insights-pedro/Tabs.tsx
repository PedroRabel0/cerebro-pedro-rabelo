"use client";

import { useState } from "react";
import type { Capture, ActivityLogEntry } from "@/lib/supabase/types";
import CaptureList from "./CaptureList";
import ActivityTimeline from "./ActivityTimeline";
import { Inbox, Activity } from "lucide-react";

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
      <div className="mb-4 flex gap-1 rounded-2xl bg-surface p-1">
        <button
          onClick={() => setTab("capturas")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
            tab === "capturas"
              ? "bg-card text-accent shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Inbox className="h-3.5 w-3.5" />
          Capturas
        </button>
        <button
          onClick={() => setTab("timeline")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs transition-all ${
            tab === "timeline"
              ? "bg-card text-accent shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
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
