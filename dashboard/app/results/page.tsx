"use client";

import { useEffect, useLayoutEffect, useState, useMemo, useRef } from "react";
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
  r === "W" ? "text-green-400 font-bold" : r === "L" ? "text-red-400" : "text-gray-500";

export default function ResultsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<number | "all">("all");

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || "https://dr81mm57l8sab.cloudfront.net";
    fetch(`${API_BASE}/matches`)
      .then((r) => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then((apiData) => {
        const raw = apiData?.data?.matches ?? apiData?.matches ?? [];
        // Only show finished matches
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformed = raw.filter((m: any) => m.status === "FINISHED").map((m: any) => {
          const hs = m.score?.fullTime?.home ?? 0;
          const as_ = m.score?.fullTime?.away ?? 0;
          const winner = hs > as_ ? "HOME_TEAM" : as_ > hs ? "AWAY_TEAM" : "DRAW";
          return {
            match_id: m.id,
            matchday: m.matchday,
            match_date: m.utcDate,
            home_team_name: (m.homeTeam?.shortName ?? m.homeTeam?.name ?? "").replace(/ FC$/, ""),
            away_team_name: (m.awayTeam?.shortName ?? m.awayTeam?.name ?? "").replace(/ FC$/, ""),
            home_score: hs,
            away_score: as_,
            winner,
            home_result: winner === "HOME_TEAM" ? "W" : winner === "AWAY_TEAM" ? "L" : "D",
            away_result: winner === "AWAY_TEAM" ? "W" : winner === "HOME_TEAM" ? "L" : "D",
          };
        });
        setMatches(transformed);
        setLoading(false);
      })
      .catch(() => {
        // Fallback to local API route
        fetch("/api/results?limit=380")
          .then((r) => r.json())
          .then((data) => { setMatches(Array.isArray(data) ? data : []); setLoading(false); })
          .catch(() => setLoading(false));
      });
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
    .sort((a, b) => a - b);

  // Find the latest matchday with finished matches to auto-scroll to
  const latestPlayedRound = useMemo(() => {
    const played = matches.map((m) => m.matchday);
    return played.length > 0 ? Math.max(...played) : null;
  }, [matches]);

  const hasScrolled = useRef(false);

  useLayoutEffect(() => {
    if (!loading && latestPlayedRound && selectedRound === "all" && !hasScrolled.current) {
      const el = document.getElementById(`gw-${latestPlayedRound}`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        hasScrolled.current = true;
      }
    }
  }, [loading, latestPlayedRound, selectedRound]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#00ff85]/30 border-t-[#00ff85] animate-spin" />
          <span className="text-gray-500 text-sm">Loading results...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="text-2xl">&#128197;</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Match Results</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Premier League · {matches.length} matches · Live from Pipeline
            </p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Incremental Fact Table"
          source="Gold: mart_recent_results (incremental) → stg_live_matches → raw.live_matches"
          explanation="Incremental materialization pattern — only processes new match records since last run using WHERE ingested_at > (SELECT MAX(ingested_at) FROM this). Avoids full table rebuilds on each pipeline run. Idempotent and efficient for append-heavy transaction facts. Date-partitioned on S3 so Athena prunes scans to only new partitions. Runs on AWS: Lambda writes date-partitioned Parquet → S3 → Athena incremental queries."
        />
      </div>

      {/* Round filter */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => setSelectedRound("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            selectedRound === "all"
              ? "bg-[#00ff85] text-[#0a0a0f] shadow-lg shadow-[#00ff85]/20"
              : "glass text-gray-500 hover:text-gray-300"
          }`}
        >
          All
        </button>
        {rounds.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRound(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              selectedRound === r
                ? "bg-[#00ff85] text-[#0a0a0f] shadow-lg shadow-[#00ff85]/20"
                : "glass text-gray-500 hover:text-gray-300"
            }`}
          >
            GW{r}
          </button>
        ))}
      </div>

      {/* Results by round */}
      <div className="space-y-4">
        {sortedRounds.map((round) => (
          <div key={round} id={`gw-${round}`} className="glass rounded-2xl overflow-hidden">
            <div className={`px-4 py-2.5 border-b border-white/[0.06] ${round === latestPlayedRound ? "bg-[#00ff85]/[0.05]" : "bg-white/[0.02]"}`}>
              <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                Gameweek {round}
                {round === latestPlayedRound && <span className="text-[#00ff85] text-[10px] font-normal">● Latest</span>}
              </h2>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {byRound[round]
                .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
                .map((m) => (
                <div key={m.match_id} className="flex items-center px-3 sm:px-4 py-3 card-hover">
                  {/* Date */}
                  <span className="text-[11px] text-gray-600 w-16 hidden sm:block tabular-nums">
                    {m.match_date
                      ? new Date(m.match_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "--"}
                  </span>

                  {/* Home team */}
                  <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                    <span className={`text-sm font-medium truncate ${m.winner === "HOME_TEAM" ? "text-white" : "text-gray-500"}`}>
                      {m.home_team_name}
                    </span>
                    <span className={`text-[10px] ${resultClass(m.home_result)}`}>
                      {m.home_result}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="mx-3 sm:mx-4 text-center min-w-[56px]">
                    <span className="text-base font-bold text-white tabular-nums">
                      {m.home_score} - {m.away_score}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-[10px] ${resultClass(m.away_result)}`}>
                      {m.away_result}
                    </span>
                    <span className={`text-sm font-medium truncate ${m.winner === "AWAY_TEAM" ? "text-white" : "text-gray-500"}`}>
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
