"use client";

import { useEffect, useState, useCallback } from "react";
import { getTeamColor, getTeamShort } from "@/lib/data";
import DataSourceBadge from "@/components/DataSourceBadge";

interface LiveMatch {
  match_id: number;
  utc_date: string;
  status: string;
  minute: number | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  competition: string;
  matchday: number;
}

interface Standing {
  position: number;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
}

function getStatusBadge(status: string, minute: number | null, utcDate: string) {
  switch (status) {
    case "IN_PLAY":
    case "LIVE":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          LIVE {minute ? `${minute}'` : ""}
        </span>
      );
    case "PAUSED":
    case "HALFTIME":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold border border-yellow-500/20">
          HT
        </span>
      );
    case "FINISHED":
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/[0.04] text-gray-400 text-xs font-medium border border-white/[0.06]">
          FT
        </span>
      );
    case "TIMED":
    case "SCHEDULED":
    case "Not Started": {
      const kickoff = new Date(utcDate);
      const timeStr = kickoff.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/[0.03] text-gray-500 text-xs font-medium border border-white/[0.06]">
          {timeStr} ET
        </span>
      );
    }
    case "POSTPONED":
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
          PPD
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/[0.03] text-gray-500 text-xs border border-white/[0.06]">
          {status}
        </span>
      );
  }
}

function MatchCard({ match }: { match: LiveMatch }) {
  const isLive = ["IN_PLAY", "LIVE", "PAUSED", "HALFTIME"].includes(match.status);
  const isFinished = match.status === "FINISHED";
  const showScore = isLive || isFinished;

  return (
    <div
      className={`glass rounded-2xl p-5 transition-all duration-300 glass-hover ${
        isLive ? "ring-1 ring-green-500/20 shadow-lg shadow-green-500/[0.05]" : ""
      }`}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-4">
        {getStatusBadge(match.status, match.minute, match.utc_date)}
        {match.matchday > 0 && (
          <span className="text-[11px] text-gray-600">GW {match.matchday}</span>
        )}
      </div>

      {/* Teams + Score */}
      <div className="flex items-center justify-between">
        {/* Home */}
        <div className="flex-1 text-right pr-4">
          <p className="font-bold text-sm" style={{ color: getTeamColor(match.home_team) }}>
            {match.home_team}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">{getTeamShort(match.home_team)}</p>
        </div>

        {/* Score / vs */}
        <div className="text-center min-w-[80px]">
          {showScore ? (
            <div className="flex items-center justify-center gap-2">
              <span className={`text-2xl font-bold tabular-nums ${isLive ? "text-green-400 text-glow-green" : "text-white"}`}>
                {match.home_score ?? 0}
              </span>
              <span className="text-gray-600 text-lg">-</span>
              <span className={`text-2xl font-bold tabular-nums ${isLive ? "text-green-400 text-glow-green" : "text-white"}`}>
                {match.away_score ?? 0}
              </span>
            </div>
          ) : (
            <span className="text-gray-600 font-medium text-lg">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 pl-4">
          <p className="font-bold text-sm" style={{ color: getTeamColor(match.away_team) }}>
            {match.away_team}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">{getTeamShort(match.away_team)}</p>
        </div>
      </div>

      {/* Match date */}
      <div className="mt-3 pt-3 border-t border-white/[0.04] text-center">
        <span className="text-[11px] text-gray-600">
          {new Date(match.utc_date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "America/New_York",
          })}
        </span>
      </div>
    </div>
  );
}

function MiniStandings({ standings }: { standings: Standing[] }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Live Standings</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-600 uppercase tracking-wider border-b border-white/[0.06] text-[10px]">
              <th className="text-left py-2 px-3 w-8">#</th>
              <th className="text-left py-2 px-3">Team</th>
              <th className="text-center py-2 px-2">P</th>
              <th className="text-center py-2 px-2">W</th>
              <th className="text-center py-2 px-2">D</th>
              <th className="text-center py-2 px-2">L</th>
              <th className="text-center py-2 px-2">GD</th>
              <th className="text-center py-2 px-2 text-gray-400">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => {
              const zoneColor =
                team.position <= 4
                  ? "border-l-2 border-l-[#00c8ff]"
                  : team.position === 5
                  ? "border-l-2 border-l-orange-500"
                  : team.position === 6
                  ? "border-l-2 border-l-lime-500"
                  : team.position >= 18
                  ? "border-l-2 border-l-red-500"
                  : "border-l-2 border-l-transparent";

              return (
                <tr key={team.team_name} className={`border-b border-white/[0.03] ${zoneColor}`}>
                  <td className="py-2 px-3 text-gray-500 font-medium tabular-nums">{team.position}</td>
                  <td className="py-2 px-3 text-gray-300 font-medium whitespace-nowrap">{team.team_name}</td>
                  <td className="text-center py-2 px-2 text-gray-500 tabular-nums">{team.played}</td>
                  <td className="text-center py-2 px-2 text-green-400 tabular-nums">{team.won}</td>
                  <td className="text-center py-2 px-2 text-gray-600 tabular-nums">{team.drawn}</td>
                  <td className="text-center py-2 px-2 text-red-400 tabular-nums">{team.lost}</td>
                  <td className="text-center py-2 px-2 tabular-nums">
                    <span className={team.goal_difference > 0 ? "text-green-400" : team.goal_difference < 0 ? "text-red-400" : "text-gray-600"}>
                      {team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}
                    </span>
                  </td>
                  <td className="text-center py-2 px-2 font-bold text-white tabular-nums">{team.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LivePage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [mRes, sRes] = await Promise.all([
        fetch("/data/live_matches.json", { cache: "no-store" }),
        fetch("/data/live_standings.json", { cache: "no-store" }),
      ]);

      if (mRes.ok) {
        const data = await mRes.json();
        setMatches(Array.isArray(data) ? data : []);
      }
      if (sRes.ok) {
        const data = await sRes.json();
        setStandings(Array.isArray(data) ? data : []);
      }

      setLastUpdated(new Date());
    } catch {
      // silently fail — data might not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchData]);

  const hasLive = matches.some((m) =>
    ["IN_PLAY", "LIVE", "PAUSED", "HALFTIME"].includes(m.status)
  );

  // Group matches by date
  const matchesByDate = matches.reduce((acc, m) => {
    const d = new Date(m.utc_date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });
    if (!acc[d]) acc[d] = [];
    acc[d].push(m);
    return acc;
  }, {} as Record<string, LiveMatch[]>);

  // Sort matches within each date by time
  Object.values(matchesByDate).forEach((arr) =>
    arr.sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#00ff85]/30 border-t-[#00ff85] animate-spin" />
          <span className="text-gray-500 text-sm">Loading live data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
            <span className="text-2xl">&#9889;</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Live Matches</h1>
              {hasLive && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-0.5">
              Premier League · {matches.length} matches · {hasLive ? "Matches in progress" : "Next fixtures"}
            </p>
          </div>

          {lastUpdated && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Last updated</p>
              <p className="text-xs text-gray-400 tabular-nums">
                {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET
              </p>
            </div>
          )}
        </div>
        <DataSourceBadge
          pattern="Transaction Fact (CDC Pattern)"
          source="Gold: mart_live_matches → stg_live_matches → raw.live_matches"
          explanation="Transaction fact table with CDC-like ingestion. Each API poll creates a new transaction record (append-only Bronze layer). Silver deduplicates via ROW_NUMBER() PARTITION BY match_id ORDER BY ingested_at DESC — keeping only the latest state per match (Type 1 SCD behavior). Enables both current-state queries and historical audit trail. Runs on AWS: Lambda polls every 15 min via EventBridge → S3 append-only → Athena dedup → Step Functions orchestration."
        />
      </div>

      {matches.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
            <span className="text-3xl">&#9917;</span>
          </div>
          <p className="text-gray-300 text-lg font-medium">No upcoming matches</p>
          <p className="text-gray-500 text-sm mt-2">Check back when matchday approaches</p>
        </div>
      ) : (
        <>
          {Object.entries(matchesByDate).map(([dateStr, dateMatches]) => (
            <div key={dateStr} className="mb-8">
              <h2 className="text-[11px] font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                {dateStr}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dateMatches.map((match) => (
                  <MatchCard key={match.match_id} match={match} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Live standings */}
      {standings.length > 0 && (
        <div className="mt-8">
          <MiniStandings standings={standings} />
        </div>
      )}

      {/* Pipeline status footer */}
      <div className="mt-8 glass rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00ff85]/10 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#00ff85] animate-pulse" />
          </div>
          <div>
            <p className="text-sm text-gray-300">AWS Step Functions Pipeline</p>
            <p className="text-[11px] text-gray-600">Data refreshes every 15 minutes via live_poll_15m DAG</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] text-gray-600">Dashboard auto-refreshes</p>
          <p className="text-xs text-[#00ff85]">every 60 seconds</p>
        </div>
      </div>
    </div>
  );
}
