"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getQualificationZone } from "@/lib/data";
import FormBadges from "@/components/FormBadges";
import TeamBadge from "@/components/TeamBadge";
import DataSourceBadge from "@/components/DataSourceBadge";

const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || "https://dr81mm57l8sab.cloudfront.net";

const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  "champions-league":  { label: "Champions League", color: "#00c8ff" },
  "europa-league":     { label: "Europa League",    color: "#f97316" },
  "conference-league": { label: "Conference League", color: "#84cc16" },
  "relegation":        { label: "Relegation",       color: "#ef4444" },
};

function stripFC(name: string): string {
  return name.replace(/ FC$/, "").replace(/^AFC /, "").trim();
}

interface TeamRow {
  position: number;
  team_id: number;
  team_name: string;
  team_short: string;
  tla: string;
  crest: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string;
  win_rate: number;
  points_pct: number;
  goals_per_game: number;
  goals_conceded_per_game: number;
  qualification_zone?: string;
}

export default function LeagueTablePage() {
  const [table, setTable] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch from CloudFront API, fallback to static JSON
    fetch(`${API_BASE}/standings`)
      .then((r) => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then((apiData) => {
        const standings = apiData?.data?.standings ?? apiData?.standings ?? [];
        const total = standings.find((s: { type: string }) => s.type === "TOTAL") ?? standings[0];
        if (!total?.table?.length) throw new Error("empty");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: TeamRow[] = total.table.map((t: any) => {
          const played = t.playedGames ?? 0;
          const won = t.won ?? 0;
          const gf = t.goalsFor ?? 0;
          const ga = t.goalsAgainst ?? 0;
          const pts = t.points ?? 0;
          return {
            position: t.position,
            team_id: t.team?.id ?? t.position,
            team_name: (t.team?.name ?? "").replace(/ FC$/, "").replace(/^AFC /, "").trim(),
            team_short: t.team?.shortName ?? "",
            tla: t.team?.tla ?? "",
            crest: t.team?.crest ?? "",
            played,
            won,
            drawn: t.draw ?? 0,
            lost: t.lost ?? 0,
            goals_for: gf,
            goals_against: ga,
            goal_difference: t.goalDifference ?? (gf - ga),
            points: pts,
            form: (t.form ?? "").replace(/,/g, " "),
            win_rate: played > 0 ? Math.round((won / played) * 1000) / 10 : 0,
            points_pct: played > 0 ? Math.round((pts / (played * 3)) * 1000) / 10 : 0,
            goals_per_game: played > 0 ? Math.round((gf / played) * 100) / 100 : 0,
            goals_conceded_per_game: played > 0 ? Math.round((ga / played) * 100) / 100 : 0,
          };
        });
        setTable(rows);
        setLoading(false);
      })
      .catch(() => {
        // Fallback to static JSON
        fetch("/data/live_standings.json")
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data) && data.length > 0) {
              setTable(data.map((t: Record<string, unknown>) => ({
                ...t,
                team_id: t.team_id ?? t.position,
                goal_difference: (t.goal_difference as number) ?? ((t.goals_for as number) - (t.goals_against as number)),
                win_rate: t.win_rate ?? ((t.played as number) > 0 ? Math.round(((t.won as number) / (t.played as number)) * 1000) / 10 : 0),
                points_pct: t.points_pct ?? ((t.played as number) > 0 ? Math.round(((t.points as number) / ((t.played as number) * 3)) * 1000) / 10 : 0),
                goals_per_game: t.goals_per_game ?? ((t.played as number) > 0 ? Math.round(((t.goals_for as number) / (t.played as number)) * 100) / 100 : 0),
                goals_conceded_per_game: t.goals_conceded_per_game ?? ((t.played as number) > 0 ? Math.round(((t.goals_against as number) / (t.played as number)) * 100) / 100 : 0),
              })) as TeamRow[]);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
  }, []);

  const topGoalTeam  = [...table].sort((a, b) => b.goals_for - a.goals_for)[0];
  const bestDefence  = [...table].sort((a, b) => a.goals_against - b.goals_against)[0];
  const mostWins     = [...table].sort((a, b) => b.won - a.won)[0];
  const relegated    = table.filter(t => t.position >= 18).map(t => stripFC(t.team_name));
  const maxPlayed    = table.length > 0 ? Math.max(...table.map(t => t.played)) : 0;
  const seasonLabel  = maxPlayed >= 38 ? "Final Standings" : maxPlayed > 0 ? `Matchday ${maxPlayed}` : "Loading...";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#00ff85]/30 border-t-[#00ff85] animate-spin" />
          <span className="text-gray-500 text-sm">Loading standings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-2xl">&#9917;</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Premier League Table</h1>
            <p className="text-gray-400 text-sm mt-0.5">2025-26 Season · {seasonLabel} · Live from Pipeline</p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Fact Table (Kimball)"
          source="Gold: mart_live_league_table → stg_live_standings → raw.live_standings"
          explanation="Aggregated fact table following Kimball methodology. Raw API snapshots land in the Bronze layer (append-only) on S3, are deduplicated in Silver via ROW_NUMBER() OVER (PARTITION BY team_name ORDER BY ingested_at DESC), then enriched in Gold with derived metrics (win rate, PPG, points %). Full medallion architecture: Bronze → Silver → Gold. Runs on AWS: Lambda ingests on EventBridge schedule → S3 data lake (Parquet) → Glue Catalog → Athena SQL → API Gateway + CloudFront → ECS Fargate dashboard."
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-wrap gap-3">
          {Object.entries(ZONE_LABELS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: val.color, boxShadow: `0 0 6px ${val.color}60` }} />
              <span className="text-gray-500">{val.label}</span>
            </div>
          ))}
        </div>

        <Link
          href="/health"
          className="text-xs text-[#00ff85]/80 hover:text-[#00ff85] transition-colors whitespace-nowrap"
        >
          Pipeline Health →
        </Link>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
                <th className="text-left py-3 px-3 sm:px-4 w-8">#</th>
                <th className="text-left py-3 px-3 sm:px-4">Club</th>
                <th className="text-center py-3 px-1.5 sm:px-2">MP</th>
                <th className="text-center py-3 px-1.5 sm:px-2">W</th>
                <th className="text-center py-3 px-1.5 sm:px-2">D</th>
                <th className="text-center py-3 px-1.5 sm:px-2">L</th>
                <th className="text-center py-3 px-1.5 sm:px-2 hidden sm:table-cell">GF</th>
                <th className="text-center py-3 px-1.5 sm:px-2 hidden sm:table-cell">GA</th>
                <th className="text-center py-3 px-1.5 sm:px-2">GD</th>
                <th className="text-center py-3 px-1.5 sm:px-2 font-bold text-gray-300">Pts</th>
                <th className="text-center py-3 px-2 hidden md:table-cell">Win%</th>
                <th className="text-center py-3 px-2 hidden lg:table-cell">Form</th>
              </tr>
            </thead>
            <tbody>
              {table.map((team) => {
                const pos  = team.position;
                const zone = team.qualification_zone || getQualificationZone(pos) || "";
                const zoneClass = zone ? `zone-${zone.replace(/_/g, "-")}` : "";
                const isChampion = pos === 1;
                const displayName = stripFC(team.team_name);

                return (
                  <tr
                    key={team.team_id ?? pos}
                    className={`border-b border-white/[0.04] card-hover ${zoneClass} ${isChampion ? "bg-yellow-500/[0.03]" : ""}`}
                  >
                    <td className="py-3 px-3 sm:px-4">
                      <span className={`font-bold text-sm ${isChampion ? "text-yellow-400 text-glow-green" : "text-gray-500"}`}>
                        {pos}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      <div className="flex items-center gap-2.5">
                        <TeamBadge teamName={displayName} size="sm" />
                        <span className="font-medium text-white text-sm">{displayName}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-gray-400 tabular-nums">{team.played}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-green-400 tabular-nums">{team.won}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-gray-500 tabular-nums">{team.drawn}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-red-400 tabular-nums">{team.lost}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-gray-400 tabular-nums hidden sm:table-cell">{team.goals_for}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-gray-400 tabular-nums hidden sm:table-cell">{team.goals_against}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 tabular-nums">
                      <span className={team.goal_difference > 0 ? "text-green-400" : team.goal_difference < 0 ? "text-red-400" : "text-gray-500"}>
                        {team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}
                      </span>
                    </td>
                    <td className="text-center py-3 px-1.5 sm:px-2">
                      <span className="font-bold text-white text-base tabular-nums">{team.points}</span>
                    </td>
                    <td className="text-center py-3 px-2 text-gray-400 hidden md:table-cell tabular-nums">
                      {team.win_rate}%
                    </td>
                    <td className="text-center py-3 px-2 hidden lg:table-cell">
                      <FormBadges form={team.form} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic stats summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6 stagger-children">
        <StatCard
          label="Most Goals"
          value={stripFC(topGoalTeam?.team_name ?? "--")}
          sub={`${topGoalTeam?.goals_for ?? 0} scored`}
          color="#6CABDD"
        />
        <StatCard
          label="Best Defence"
          value={stripFC(bestDefence?.team_name ?? "--")}
          sub={`${bestDefence?.goals_against ?? 0} conceded`}
          color="#EF0107"
        />
        <StatCard
          label="Most Wins"
          value={stripFC(mostWins?.team_name ?? "--")}
          sub={`${mostWins?.won ?? 0} wins`}
          color="#00ff85"
        />
        <StatCard
          label="Relegated"
          value={relegated.join(" · ") || "--"}
          sub="Bottom 3"
          color="#ef4444"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string | undefined; color: string;
}) {
  return (
    <div className="glass rounded-xl p-4 glass-hover">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="font-bold text-sm truncate" style={{ color }}>{value}</p>
      <p className="text-gray-500 text-xs mt-1">{sub}</p>
    </div>
  );
}
