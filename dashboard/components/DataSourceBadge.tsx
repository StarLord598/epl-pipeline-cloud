"use client";

import { useState } from "react";

interface DataSourceBadgeProps {
  pattern: string;
  source: string;
  explanation: string;
}

const PATTERN_COLORS: Record<string, string> = {
  "Fact Table": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Cumulative Metric": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Rolling Window": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "SCD Type 2": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "SCD Type 1": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Real-Time Ingestion": "bg-green-500/20 text-green-300 border-green-500/30",
  "Incremental Model": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Star Schema": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Streaming Ingestion": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Data Observability": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Data Lineage": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Kimball Dimension": "bg-sky-500/20 text-sky-300 border-sky-500/30",
};

export default function DataSourceBadge({ pattern, source, explanation }: DataSourceBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = PATTERN_COLORS[pattern] || "bg-gray-500/20 text-gray-300 border-gray-500/30";

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80 ${colorClass}`}
      >
        <span>🏗️ {pattern}</span>
        <span className="opacity-60">·</span>
        <span className="opacity-80">{source}</span>
        <span className="opacity-50 ml-1">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="mt-2 p-3 rounded-lg bg-gray-900/80 border border-gray-700/50 text-xs text-gray-300 max-w-2xl leading-relaxed">
          <span className="text-white font-semibold">Why this pattern: </span>
          {explanation}
        </div>
      )}
    </div>
  );
}
