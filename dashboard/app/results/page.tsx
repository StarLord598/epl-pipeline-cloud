"use client";

import { useEffect, useState, useMemo } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";

interface Match {
  match_id: number;
  matchday: number;
  match_date: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  winner: string;
  home_result?: string;
  away_result?: string;
}

const resultClass = (r: string | undefined) =>
  r === "W" ? "text-green-400 font-bold" : r === "L" ? "text-red-400" : "text-gray-400";

export default function ResultsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<number | "all">("all");

  useEffect(() => {
    fetch("/api/results?limit=380")
      .then((r) => r.json())
      .then((data) => {
        setMatches(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const rounds = useMemo(() => {
    const set = new Set(matches.map((m) => m.matchday));
    return Array.from(set).sort((a, b) => a - b);
  }, [matches]);

  const filtered = selectedRound === "all"
    ? matches
    : matches.filter((m) => m.matchday === selectedRound);

  // Group by matchday
  const byRound = filtered.reduce((acc, m) => {
    const k = m.matchday;
    if (!acc[k]) acc[k] = [];
    acc[k].push(m);
    return acc;
  }, {} as Record<number, Match[]>);

  const sortedRounds = Object.keys(byRound)
    .map(Number)
    .sort((a, b) => b - a);  // most recent first

  if (loading) return <div className="text-gray-400 p-8">Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📅</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Match Results</h1>
            <p className="text-gray-400 text-sm">
              Premier League · {matches.length} matches · Live from Pipeline
            </p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Incremental Model"
          source="Gold: mart_recent_results (incremental) → stg_live_matches"
          explanation="dbt incremental materialization — only processes new matches since last run using WHERE ingested_at > (SELECT MAX(ingested_at) FROM this). Avoids full table rebuilds on each pipeline run. Idempotent and efficient for append-heavy match data."
        />
      </div>

      {/* Round filter */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => setSelectedRound("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedRound === "all" ? "bg-[#00ff85] text-black" : "glass text-gray-400 hover:text-white"
          }`}
        >
          All
        </button>
        {rounds.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRound(r)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedRound === r ? "bg-[#00ff85] text-black" : "glass text-gray-400 hover:text-white"
            }`}
          >
            GW{r}
          </button>
        ))}
      </div>

      {/* Results by round */}
      <div className="space-y-6">
        {sortedRounds.map((round) => (
          <div key={round} className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-white/10 bg-white/5">
              <h2 className="text-sm font-semibold text-gray-300">Gameweek {round}</h2>
            </div>
            <div className="divide-y divide-white/5">
              {byRound[round]
                .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
                .map((m) => (
                <div key={m.match_id} className="flex items-center px-4 py-3 card-hover">
                  {/* Date */}
                  <span className="text-xs text-gray-500 w-20 hidden sm:block">
                    {m.match_date
                      ? new Date(m.match_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "—"}
                  </span>

                  {/* Home team */}
                  <div className="flex items-center justify-end gap-2 flex-1">
                    <span className={`text-sm font-medium ${m.winner === "HOME_TEAM" ? "text-white" : "text-gray-400"}`}>
                      {m.home_team_name}
                    </span>
                    <span className={`text-xs ${resultClass(m.home_result)}`}>
                      {m.home_result}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="mx-4 text-center min-w-[60px]">
                    <span className="text-lg font-bold text-white tabular-nums">
                      {m.home_score} – {m.away_score}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-xs ${resultClass(m.away_result)}`}>
                      {m.away_result}
                    </span>
                    <span className={`text-sm font-medium ${m.winner === "AWAY_TEAM" ? "text-white" : "text-gray-400"}`}>
                      {m.away_team_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
