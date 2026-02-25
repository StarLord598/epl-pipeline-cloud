"use client";

import { useState } from "react";
import { Database, ChevronDown, ChevronUp } from "lucide-react";

interface DataSourceBadgeProps {
  pattern: string;
  source: string;
  explanation: string;
}

const PATTERN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Fact Table":           { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/20" },
  "Cumulative Metric":    { bg: "bg-blue-500/10",   text: "text-blue-300",   border: "border-blue-500/20" },
  "Rolling Window":       { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/20" },
  "SCD Type 2":           { bg: "bg-amber-500/10",  text: "text-amber-300",  border: "border-amber-500/20" },
  "SCD Type 1":           { bg: "bg-teal-500/10",   text: "text-teal-300",   border: "border-teal-500/20" },
  "Real-Time Ingestion":  { bg: "bg-green-500/10",  text: "text-green-300",  border: "border-green-500/20" },
  "Incremental Model":    { bg: "bg-cyan-500/10",   text: "text-cyan-300",   border: "border-cyan-500/20" },
  "Star Schema":          { bg: "bg-indigo-500/10", text: "text-indigo-300", border: "border-indigo-500/20" },
  "Streaming Ingestion":  { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/20" },
  "Data Observability":   { bg: "bg-rose-500/10",   text: "text-rose-300",   border: "border-rose-500/20" },
  "Data Lineage":         { bg: "bg-violet-500/10", text: "text-violet-300", border: "border-violet-500/20" },
  "Kimball Dimension":    { bg: "bg-sky-500/10",    text: "text-sky-300",    border: "border-sky-500/20" },
  "Rolling Window + SCD Type 2": { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/20" },
  "Near Real-Time Polling": { bg: "bg-green-500/10", text: "text-green-300", border: "border-green-500/20" },
  "Event Streaming (SSE)": { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/20" },
};

const fallbackColors = { bg: "bg-gray-500/10", text: "text-gray-300", border: "border-gray-500/20" };

export default function DataSourceBadge({ pattern, source, explanation }: DataSourceBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = PATTERN_COLORS[pattern] || fallbackColors;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 hover:brightness-110 ${colors.bg} ${colors.text} ${colors.border}`}
      >
        <Database size={12} />
        <span>{pattern}</span>
        <span className="opacity-40">|</span>
        <span className="opacity-70 hidden sm:inline">{source}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-gray-400 max-w-2xl leading-relaxed animate-fade-in">
          <span className="text-gray-200 font-semibold">Why this pattern: </span>
          {explanation}
        </div>
      )}
    </div>
  );
}
