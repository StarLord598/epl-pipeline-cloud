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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">
          HT
        </span>
      );
    case "FINISHED":
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/10 text-gray-300 text-xs font-medium">
          FT
        </span>
      );
    case "TIMED":
    case "SCHEDULED":
    case "Not Started":
      const kickoff = new Date(utcDate);
      const timeStr = kickoff.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-medium">
          {timeStr} ET
        </span>
      );
    case "POSTPONED":
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
          PPD
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-500/20 text-gray-500 text-xs">
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
      className={`glass rounded-xl p-5 transition-all ${
        isLive ? "ring-1 ring-green-500/30 shadow-lg shadow-green-500/5" : ""
      } card-hover`}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-4">
        {getStatusBadge(match.status, match.minute, match.utc_date)}
        {match.matchday > 0 && (
          <span className="text-xs text-gray-500">GW {match.matchday}</span>
        )}
      </div>

      {/* Teams + Score */}
      <div className="flex items-center justify-between">
        {/* Home */}
        <div className="flex-1 text-right pr-4">
          <p
            className="font-bold text-sm"
            style={{ color: getTeamColor(match.home_team) }}
          >
            {match.home_team}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {getTeamShort(match.home_team)}
          </p>
        </div>

        {/* Score / vs */}
        <div className="text-center min-w-[80px]">
          {showScore ? (
            <div className="flex items-center justify-center gap-2">
              <span className={`text-2xl font-bold tabular-nums ${isLive ? "text-green-400" : "text-white"}`}>
                {match.home_score ?? 0}
              </span>
              <span className="text-gray-600 text-lg">-</span>
              <span className={`text-2xl font-bold tabular-nums ${isLive ? "text-green-400" : "text-white"}`}>
                {match.away_score ?? 0}
              </span>
            </div>
          ) : (
            <span className="text-gray-600 font-medium">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 pl-4">
          <p
            className="font-bold text-sm"
            style={{ color: getTeamColor(match.away_team) }}
          >
            {match.away_team}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {getTeamShort(match.away_team)}
          </p>
        </div>
      </div>

      {/* Match date */}
      <div className="mt-3 pt-3 border-t border-white/5 text-center">
        <span className="text-xs text-gray-500">
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
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          📊 Live Standings
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 uppercase tracking-wider border-b border-white/10">
              <th className="text-left py-2 px-3 w-8">#</th>
              <th className="text-left py-2 px-3">Team</th>
              <th className="text-center py-2 px-2">P</th>
              <th className="text-center py-2 px-2">W</th>
              <th className="text-center py-2 px-2">D</th>
              <th className="text-center py-2 px-2">L</th>
              <th className="text-center py-2 px-2">GD</th>
              <th className="text-center py-2 px-2 font-bold text-white">Pts</th>
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
                <tr
                  key={team.team_name}
                  className={`border-b border-white/5 ${zoneColor}`}
                >
                  <td className="py-2 px-3 text-gray-500 font-medium">
                    {team.position}
                  </td>
                  <td className="py-2 px-3 text-gray-200 font-medium whitespace-nowrap">
                    {team.team_name}
                  </td>
                  <td className="text-center py-2 px-2 text-gray-400">
                    {team.played}
                  </td>
                  <td className="text-center py-2 px-2 text-green-400">
                    {team.won}
                  </td>
                  <td className="text-center py-2 px-2 text-gray-500">
                    {team.drawn}
                  </td>
                  <td className="text-center py-2 px-2 text-red-400">
                    {team.lost}
                  </td>
                  <td className="text-center py-2 px-2">
                    <span
                      className={
                        team.goal_difference > 0
                          ? "text-green-400"
                          : team.goal_difference < 0
                          ? "text-red-400"
                          : "text-gray-500"
                      }
                    >
                      {team.goal_difference > 0
                        ? `+${team.goal_difference}`
                        : team.goal_difference}
                    </span>
                  </td>
                  <td className="text-center py-2 px-2 font-bold text-white">
                    {team.points}
                  </td>
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
    arr.sort(
      (a, b) =>
        new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime()
    )
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Loading live data…</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">⚡</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Live Matches</h1>
              {hasLive && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm">
              Premier League · {matches.length} matches ·{" "}
              {hasLive ? "Matches in progress" : "Next fixtures"}
            </p>
            <DataSourceBadge
              pattern="Real-Time Ingestion"
              source="Gold: mart_live_matches → stg_live_matches → raw.live_matches"
              explanation="CDC-like pattern — football-data.org API polled every 15 min on matchdays via Airflow. Each poll appends to Bronze (append-only). Silver deduplicates via ROW_NUMBER() PARTITION BY match_id. ShortCircuitOperator skips non-matchdays to conserve API quota."
            />
          </div>

          {lastUpdated && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Last updated</p>
              <p className="text-xs text-gray-400">
                {lastUpdated.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/New_York",
                })}{" "}
                ET
              </p>
            </div>
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <span className="text-4xl mb-4 block">⚽</span>
          <p className="text-gray-400 text-lg">No upcoming matches</p>
          <p className="text-gray-500 text-sm mt-2">
            Check back when matchday approaches
          </p>
        </div>
      ) : (
        <>
          {/* Match cards grouped by date */}
          {Object.entries(matchesByDate).map(([dateStr, dateMatches]) => (
            <div key={dateStr} className="mb-8">
              <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
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
      <div className="mt-8 glass rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">🔄</span>
          <div>
            <p className="text-sm text-gray-300">Airflow Pipeline</p>
            <p className="text-xs text-gray-500">
              Data refreshes every 15 minutes via live_poll_15m DAG
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Dashboard auto-refreshes</p>
          <p className="text-xs text-[#00ff85]">every 60 seconds</p>
        </div>
      </div>
    </div>
  );
}
