import Link from "next/link";
import path from "path";
import fs from "fs";
import { getQualificationZone } from "@/lib/data";
import FormBadges from "@/components/FormBadges";
import TeamBadge from "@/components/TeamBadge";
import DataSourceBadge from "@/components/DataSourceBadge";

export const revalidate = 300;

const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  "champions-league":  { label: "Champions League", color: "#00c8ff" },
  "europa-league":     { label: "Europa League",    color: "#f97316" },
  "conference-league": { label: "Conference League", color: "#84cc16" },
  "relegation":        { label: "Relegation",       color: "#ef4444" },
};

function stripFC(name: string): string {
  return name.replace(/ FC$/, "").replace(/^AFC /, "").trim();
}

async function getTable(): Promise<Array<Record<string, unknown>>> {
  // Prefer live standings (current season from football-data.org)
  const livePath = path.join(process.cwd(), "public", "data", "live_standings.json");
  if (fs.existsSync(livePath)) {
    const data = JSON.parse(fs.readFileSync(livePath, "utf-8"));
    if (Array.isArray(data) && data.length > 0) {
      // Enrich with derived stats
      return data.map((t: Record<string, unknown>) => ({
        ...t,
        team_id: t.team_id ?? t.position,
        goal_difference: (t.goal_difference as number) ?? ((t.goals_for as number) - (t.goals_against as number)),
        win_rate: t.win_rate ?? ((t.played as number) > 0 ? Math.round(((t.won as number) / (t.played as number)) * 1000) / 10 : 0),
        points_pct: t.points_pct ?? ((t.played as number) > 0 ? Math.round(((t.points as number) / ((t.played as number) * 3)) * 1000) / 10 : 0),
        goals_per_game: t.goals_per_game ?? ((t.played as number) > 0 ? Math.round(((t.goals_for as number) / (t.played as number)) * 100) / 100 : 0),
        goals_conceded_per_game: t.goals_conceded_per_game ?? ((t.played as number) > 0 ? Math.round(((t.goals_against as number) / (t.played as number)) * 100) / 100 : 0),
      }));
    }
  }
  // Fallback to league_table.json (batch/historical data)
  const fallbackPath = path.join(process.cwd(), "public", "data", "league_table.json");
  if (fs.existsSync(fallbackPath)) {
    return JSON.parse(fs.readFileSync(fallbackPath, "utf-8"));
  }
  return [];
}

export default async function LeagueTablePage() {
  const table = await getTable();

  const topGoalTeam  = [...table].sort((a, b) => (b.goals_for as number) - (a.goals_for as number))[0];
  const bestDefence  = [...table].sort((a, b) => (a.goals_against as number) - (b.goals_against as number))[0];
  const mostWins     = [...table].sort((a, b) => (b.won as number) - (a.won as number))[0];
  const relegated    = table.filter(t => (t.position as number) >= 18).map(t => stripFC(t.team_name as string));
  const maxPlayed    = Math.max(...table.map(t => t.played as number));
  const seasonLabel  = maxPlayed >= 38 ? "Final Standings" : `Matchday ${maxPlayed}`;

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
          pattern="Fact Table"
          source="AWS Lambda (daily_ingest) → S3 Data Lake (Parquet) → Glue Catalog → Athena → API Gateway + CloudFront"
          explanation="Aggregated fact table built on AWS. Lambda ingests from football-data.org API on an EventBridge cron schedule, writes Parquet to S3 data lake (partitioned by date). Glue Data Catalog registers schemas for Athena SQL queries. Data flows through a medallion architecture: Bronze (raw S3) → Silver (deduplicated) → Gold (enriched with win rate, PPG, points %). Served via API Gateway + CloudFront CDN to this Next.js dashboard running on ECS Fargate."
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
                const pos  = team.position as number;
                const zone = (team.qualification_zone as string) || getQualificationZone(pos) || "";
                const zoneClass = zone ? `zone-${zone.replace(/_/g, "-")}` : "";
                const isChampion = pos === 1;
                const displayName = stripFC(team.team_name as string);

                return (
                  <tr
                    key={(team.team_id as number) ?? pos}
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
                    <td className="text-center py-3 px-1.5 sm:px-2 text-gray-400 tabular-nums">{team.played as number}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-green-400 tabular-nums">{team.won as number}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-gray-500 tabular-nums">{team.drawn as number}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-red-400 tabular-nums">{team.lost as number}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-gray-400 tabular-nums hidden sm:table-cell">{team.goals_for as number}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 text-gray-400 tabular-nums hidden sm:table-cell">{team.goals_against as number}</td>
                    <td className="text-center py-3 px-1.5 sm:px-2 tabular-nums">
                      <span className={(team.goal_difference as number) > 0 ? "text-green-400" : (team.goal_difference as number) < 0 ? "text-red-400" : "text-gray-500"}>
                        {(team.goal_difference as number) > 0 ? `+${team.goal_difference}` : team.goal_difference as number}
                      </span>
                    </td>
                    <td className="text-center py-3 px-1.5 sm:px-2">
                      <span className="font-bold text-white text-base tabular-nums">{team.points as number}</span>
                    </td>
                    <td className="text-center py-3 px-2 text-gray-400 hidden md:table-cell tabular-nums">
                      {team.win_rate as number}%
                    </td>
                    <td className="text-center py-3 px-2 hidden lg:table-cell">
                      <FormBadges form={team.form as string | undefined} />
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
          value={stripFC(topGoalTeam?.team_name as string ?? "--")}
          sub={`${topGoalTeam?.goals_for} scored`}
          color="#6CABDD"
        />
        <StatCard
          label="Best Defence"
          value={stripFC(bestDefence?.team_name as string ?? "--")}
          sub={`${bestDefence?.goals_against} conceded`}
          color="#EF0107"
        />
        <StatCard
          label="Most Wins"
          value={stripFC(mostWins?.team_name as string ?? "--")}
          sub={`${mostWins?.won} wins`}
          color="#00ff85"
        />
        <StatCard
          label="Relegated"
          value={relegated.join(" · ")}
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
