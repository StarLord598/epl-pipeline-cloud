"use client";

import { useEffect, useState } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PointsRow {
  team_name: string;
  matchday: number;
  matchday_points: number;
  cumulative_points: number;
}

// Top 20 EPL team colors
const TEAM_COLORS: Record<string, string> = {
  "Arsenal": "#EF0107",
  "Manchester City": "#6CABDD",
  "Aston Villa": "#95BFE5",
  "Chelsea": "#034694",
  "Manchester United": "#DA291C",
  "Liverpool": "#C8102E",
  "Brentford": "#E30613",
  "Bournemouth": "#DA291C",
  "Everton": "#003399",
  "Fulham": "#CC0000",
  "Newcastle United": "#241F20",
  "Sunderland AFC": "#EB172B",
  "Crystal Palace": "#1B458F",
  "Brighton & Hove Albion": "#0057B8",
  "Leeds United": "#FFCD00",
  "Tottenham Hotspur": "#132257",
  "Nottingham Forest": "#E53233",
  "West Ham United": "#7A263A",
  "Burnley": "#6C1D45",
  "Wolverhampton Wanderers": "#FDB913",
};

export default function RacePage() {
  const [data, setData] = useState<PointsRow[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/data/points_race.json")
      .then((r) => r.json())
      .then((d: PointsRow[]) => {
        setData(d);
        const maxMD = Math.max(...d.map((x) => x.matchday));
        const teams = d
          .filter((r) => r.matchday === maxMD)
          .sort((a, b) => b.cumulative_points - a.cumulative_points)
          .slice(0, 6)
          .map((r) => r.team_name);
        setSelectedTeams(teams);
      });
  }, []);

  const allTeams = Array.from(new Set(data.map((r) => r.team_name)));
  const maxMatchday = data.length > 0 ? Math.max(...data.map((r) => r.matchday)) : 0;

  // Pivot data for Recharts: { matchday: 1, Arsenal: 3, Chelsea: 1, ... }
  const chartData: Record<string, number | string>[] = [];
  const matchdays = Array.from(new Set(data.map((r) => r.matchday))).sort((a, b) => a - b);
  for (const md of matchdays) {
    const row: Record<string, number | string> = { matchday: `GW${md}` };
    for (const team of allTeams) {
      const entry = data.find((r) => r.team_name === team && r.matchday === md);
      if (entry) row[team] = entry.cumulative_points;
    }
    chartData.push(row);
  }

  const activeTeams = showAll ? allTeams : selectedTeams;

  const toggleTeam = (team: string) => {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
    setShowAll(false);
  };

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-2xl">&#128200;</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Points Race</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Cumulative points through {maxMatchday} matchdays · 2025-26 Season
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAll(!showAll)}
            className={`text-xs px-4 py-2 rounded-xl font-medium transition-all duration-200 self-start sm:self-auto ${
              showAll
                ? "bg-[#00ff85] text-[#0a0a0f] shadow-lg shadow-[#00ff85]/20"
                : "glass text-gray-300 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {showAll ? "Top 6" : "All 20"}
          </button>
        </div>
        <DataSourceBadge
          pattern="Cumulative Metric"
          source="AWS Lambda (daily_ingest) → S3 Data Lake → Athena SQL → API Gateway → CloudFront CDN"
          explanation="Running total pattern — Lambda ingests match results to S3 (Parquet), Athena computes cumulative points per team per matchday using SUM() OVER (PARTITION BY team ORDER BY matchday). Orchestrated by AWS Step Functions on an EventBridge daily schedule. Served to the dashboard via API Gateway + CloudFront, running on ECS Fargate."
        />
      </div>

      {/* Chart */}
      <div className="glass rounded-2xl p-3 sm:p-5 mb-6" style={{ height: 460 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="matchday"
              stroke="#333"
              tick={{ fontSize: 11, fill: "#666" }}
              interval={2}
            />
            <YAxis stroke="#333" tick={{ fontSize: 11, fill: "#666" }} />
            <Tooltip
              contentStyle={{
                background: "rgba(13, 17, 23, 0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                fontSize: 12,
                backdropFilter: "blur(12px)",
              }}
            />
            {activeTeams.map((team) => (
              <Line
                key={team}
                type="monotone"
                dataKey={team}
                stroke={TEAM_COLORS[team] || "#888"}
                strokeWidth={selectedTeams.includes(team) ? 2.5 : 1.5}
                dot={false}
                opacity={showAll ? 0.6 : 1}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Team selector */}
      <div className="glass rounded-2xl p-4 sm:p-5">
        <h2 className="text-[11px] text-gray-500 uppercase tracking-wider mb-3 font-medium">Select Teams</h2>
        <div className="flex flex-wrap gap-2">
          {allTeams
            .sort((a, b) => {
              const aP = data.find((r) => r.team_name === a && r.matchday === maxMatchday)?.cumulative_points ?? 0;
              const bP = data.find((r) => r.team_name === b && r.matchday === maxMatchday)?.cumulative_points ?? 0;
              return bP - aP;
            })
            .map((team) => {
              const pts = data.find((r) => r.team_name === team && r.matchday === maxMatchday)?.cumulative_points ?? 0;
              const active = selectedTeams.includes(team);
              return (
                <button
                  key={team}
                  onClick={() => toggleTeam(team)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                    active
                      ? "border-current shadow-sm"
                      : "border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/[0.12]"
                  }`}
                  style={active ? { borderColor: TEAM_COLORS[team], color: TEAM_COLORS[team], background: `${TEAM_COLORS[team]}10` } : {}}
                >
                  {team} ({pts})
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
