"use client";

import { useEffect, useLayoutEffect, useState, useMemo, useRef } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";

interface Match {
  match_id: number;
  matchday: number;
  status: string;
  utc_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((matchDay.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function dateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ResultsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || "https://dr81mm57l8sab.cloudfront.net";
    fetch(`${API_BASE}/matches`)
      .then((r) => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then((apiData) => {
        const raw = apiData?.data?.matches ?? apiData?.matches ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformed: Match[] = raw.map((m: any) => ({
          match_id: m.id,
          matchday: m.matchday,
          status: m.status,
          utc_date: m.utcDate,
          home_team: (m.homeTeam?.shortName ?? m.homeTeam?.name ?? "").replace(/ FC$/, ""),
          away_team: (m.awayTeam?.shortName ?? m.awayTeam?.name ?? "").replace(/ FC$/, ""),
          home_score: m.score?.fullTime?.home ?? null,
          away_score: m.score?.fullTime?.away ?? null,
        }));
        setMatches(transformed);
        setLoading(false);
      })
      .catch(() => {
        fetch("/api/results?limit=380")
          .then((r) => r.json())
          .then((data) => { setMatches(Array.isArray(data) ? data : []); setLoading(false); })
          .catch(() => setLoading(false));
      });
  }, []);

  // Group by date (ascending)
  const dateGroups = useMemo(() => {
    const groups: Record<string, { label: string; sortKey: string; matches: Match[] }> = {};
    for (const m of matches) {
      const key = dateKey(m.utc_date);
      if (!groups[key]) {
        groups[key] = { label: formatDate(m.utc_date), sortKey: key, matches: [] };
      }
      groups[key].matches.push(m);
    }
    // Sort matches within each date by time
    for (const g of Object.values(groups)) {
      g.matches.sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime());
    }
    return Object.values(groups).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [matches]);

  // Find today's index (or closest past date) for initial position
  const todayKey = dateKey(new Date().toISOString());
  const currentIdx = useMemo(() => {
    let best = 0;
    for (let i = 0; i < dateGroups.length; i++) {
      if (dateGroups[i].sortKey <= todayKey) best = i;
    }
    return best;
  }, [dateGroups, todayKey]);

  const hasScrolled = useRef(false);

  useLayoutEffect(() => {
    if (!loading && dateGroups.length > 0 && !hasScrolled.current) {
      const el = document.getElementById(`date-${dateGroups[currentIdx]?.sortKey}`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        hasScrolled.current = true;
      }
    }
  }, [loading, dateGroups, currentIdx]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#00ff85]/30 border-t-[#00ff85] animate-spin" />
          <span className="text-gray-500 text-sm">Loading fixtures...</span>
        </div>
      </div>
    );
  }

  const totalFinished = matches.filter((m) => m.status === "FINISHED").length;
  const totalScheduled = matches.filter((m) => m.status !== "FINISHED").length;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="text-2xl">&#128197;</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Fixtures & Results</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Premier League · {totalFinished} played · {totalScheduled} upcoming
            </p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Incremental Fact Table"
          source="Gold: mart_recent_results (incremental) → stg_live_matches → raw.live_matches"
          explanation="Incremental materialization pattern — only processes new match records since last run using WHERE ingested_at > (SELECT MAX(ingested_at) FROM this). Avoids full table rebuilds on each pipeline run. Idempotent and efficient for append-heavy transaction facts. Date-partitioned on S3 so Athena prunes scans to only new partitions. Runs on AWS: Lambda writes date-partitioned Parquet → S3 → Athena incremental queries."
        />
      </div>

      {/* Fixtures by date */}
      <div className="space-y-4">
        {dateGroups.map((group, groupIdx) => {
          const isToday = group.sortKey === todayKey;
          const isPast = group.sortKey < todayKey;
          const isFuture = group.sortKey > todayKey;
          const isCurrent = group.sortKey === dateGroups[currentIdx]?.sortKey;

          // Section dividers
          const prevGroup = groupIdx > 0 ? dateGroups[groupIdx - 1] : null;
          const showUpcomingDivider = isFuture && prevGroup && prevGroup.sortKey <= todayKey;
          const showFirstResultsDivider = groupIdx === 0 && isPast;

          return (
            <div key={group.sortKey}>
              {showFirstResultsDivider && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gray-700/50" />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Results</span>
                  <div className="h-px flex-1 bg-gray-700/50" />
                </div>
              )}
              {showUpcomingDivider && (
                <div className="flex items-center gap-3 my-6">
                  <div className="h-px flex-1 bg-[#00ff85]/20" />
                  <span className="text-[10px] font-semibold text-[#00ff85]/70 uppercase tracking-widest">Upcoming</span>
                  <div className="h-px flex-1 bg-[#00ff85]/20" />
                </div>
              )}
              <div id={`date-${group.sortKey}`} className={`glass rounded-2xl overflow-hidden ${isFuture ? "opacity-80" : ""}`}>
                <div className={`px-4 py-2.5 border-b border-white/[0.06] ${
                  isToday ? "bg-[#00ff85]/[0.08]" :
                  isFuture ? "bg-blue-500/[0.04]" :
                  isCurrent ? "bg-white/[0.03]" :
                  "bg-white/[0.02]"
                }`}>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2">
                    <span className={isToday ? "text-[#00ff85]" : isFuture ? "text-blue-400/70" : "text-gray-400"}>
                      {group.label}
                    </span>
                    {isToday && <span className="text-[#00ff85] text-[10px] font-normal">● Today</span>}
                  </h2>
                </div>
              <div className="divide-y divide-white/[0.04]">
                {group.matches.map((m) => {
                  const isFinished = m.status === "FINISHED";
                  const isLive = ["IN_PLAY", "LIVE", "PAUSED", "HALFTIME"].includes(m.status);
                  const homeWin = isFinished && m.home_score !== null && m.away_score !== null && m.home_score > m.away_score;
                  const awayWin = isFinished && m.home_score !== null && m.away_score !== null && m.away_score > m.home_score;

                  return (
                    <div key={m.match_id} className="flex items-center px-3 sm:px-4 py-3 card-hover">
                      {/* Home team */}
                      <div className="flex items-center justify-end flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate ${homeWin ? "text-white" : "text-gray-400"}`}>
                          {m.home_team}
                        </span>
                      </div>

                      {/* Score or Time */}
                      <div className="mx-3 sm:mx-4 text-center min-w-[64px]">
                        {isFinished ? (
                          <span className="text-base font-bold text-white tabular-nums">
                            {m.home_score} - {m.away_score}
                          </span>
                        ) : isLive ? (
                          <span className="text-base font-bold text-[#00ff85] tabular-nums animate-pulse">
                            {m.home_score ?? 0} - {m.away_score ?? 0}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 font-medium">
                            {formatTime(m.utc_date)}
                          </span>
                        )}
                      </div>

                      {/* Away team */}
                      <div className="flex items-center flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate ${awayWin ? "text-white" : "text-gray-400"}`}>
                          {m.away_team}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
