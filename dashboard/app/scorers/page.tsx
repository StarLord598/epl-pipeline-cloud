"use client";

import { useEffect, useState } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Scorer {
  rank: number;
  player_id: number;
  player_name: string;
  team_name: string;
  goals: number;
  assists: number;
  goal_contributions: number;
  matches_played: number;
  goals_per_game: number;
  assists_per_game: number;
}

const COLORS = [
  "#FFD700", "#C0C0C0", "#CD7F32",
  "#00ff85", "#00c8ff", "#a78bfa",
  "#f97316", "#ec4899", "#34d399",
  "#60a5fa", "#fbbf24", "#e879f9",
];

export default function ScorersPage() {
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"goals" | "assists" | "contributions">("goals");

  useEffect(() => {
    fetch("/api/scorers?limit=20")
      .then((r) => r.json())
      .then((data) => { setScorers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#00ff85]/30 border-t-[#00ff85] animate-spin" />
          <span className="text-gray-500 text-sm">Loading scorers...</span>
        </div>
      </div>
    );
  }

  const top3 = scorers.slice(0, 3);

  const chartData = scorers.slice(0, 15).map((s) => ({
    name: s.player_name.split(" ").slice(-1)[0],
    fullName: s.player_name,
    goals: s.goals,
    assists: s.assists,
    contributions: s.goal_contributions,
    team: s.team_name,
  }));

  const chartKey = tab === "goals" ? "goals" : tab === "assists" ? "assists" : "contributions";
  const chartLabel = tab === "goals" ? "Goals" : tab === "assists" ? "Assists" : "G+A";

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <span className="text-2xl">&#127941;</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Golden Boot Race</h1>
            <p className="text-gray-400 text-sm mt-0.5">Premier League · Live from Pipeline</p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Star Schema"
          source="AWS Lambda → S3 Data Lake (Parquet) → Glue Catalog (schema registry) → Athena SQL joins"
          explanation="Kimball star schema on AWS — Lambda ingests scorer data to S3, Glue Catalog registers table schemas, Athena performs star-schema joins between fact (scorers) and dimension (teams) tables. Player metrics (goals, assists, per-game rates) join with dim_teams via Glue for team context. Data served through API Gateway + CloudFront CDN to the ECS Fargate dashboard."
        />
      </div>

      {/* Podium */}
      <div className="flex justify-center items-end gap-3 sm:gap-6 mb-8">
        {[top3[1], top3[0], top3[2]].map((s, i) => {
          if (!s) return null;
          const heights = ["h-28", "h-36", "h-24"];
          const medals  = ["\u{1F948}", "\u{1F947}", "\u{1F949}"];
          const colors  = ["#C0C0C0", "#FFD700", "#CD7F32"];
          return (
            <div key={s.player_id} className="flex flex-col items-center gap-2">
              <span className="text-2xl">{medals[i]}</span>
              <p className="text-white font-bold text-sm text-center leading-tight w-20 sm:w-24 truncate">
                {s.player_name.split(" ").slice(-1)[0]}
              </p>
              <p className="text-[11px] text-gray-500 text-center truncate max-w-20">{s.team_name.split(" ")[0]}</p>
              <div
                className={`w-16 sm:w-20 ${heights[i]} rounded-t-xl flex items-center justify-center glass`}
                style={{ borderBottom: `3px solid ${colors[i]}`, boxShadow: `0 0 20px ${colors[i]}20` }}
              >
                <span className="font-bold text-2xl" style={{ color: colors[i] }}>
                  {s.goals}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        {(["goals", "assists", "contributions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              tab === t
                ? "bg-[#00ff85] text-[#0a0a0f] shadow-lg shadow-[#00ff85]/20"
                : "glass text-gray-400 hover:text-white"
            }`}
          >
            {t === "goals" ? "Goals" : t === "assists" ? "Assists" : "G+A"}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="glass rounded-2xl p-3 sm:p-5 mb-8">
        <h2 className="text-[11px] font-medium text-gray-500 mb-4 uppercase tracking-wider">
          Top 15 — {chartLabel}
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#666", fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: "#666", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "rgba(13, 17, 23, 0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                color: "#fff",
                backdropFilter: "blur(12px)",
              }}
              formatter={(value, _name, props) => [
                `${value} ${chartLabel}`,
                props.payload.fullName,
              ]}
              labelFormatter={(label) => chartData.find((d) => d.name === label)?.team ?? label}
            />
            <Bar dataKey={chartKey} radius={[6, 6, 0, 0]}>
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full table */}
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left py-3 px-3 sm:px-4 w-10">#</th>
              <th className="text-left py-3 px-3 sm:px-4">Player</th>
              <th className="text-left py-3 px-3 hidden sm:table-cell">Club</th>
              <th className="text-center py-3 px-2 sm:px-3">Goals</th>
              <th className="text-center py-3 px-2 sm:px-3 hidden sm:table-cell">Assists</th>
              <th className="text-center py-3 px-2 sm:px-3 hidden md:table-cell">G+A</th>
              <th className="text-center py-3 px-2 sm:px-3 hidden md:table-cell">Apps</th>
              <th className="text-center py-3 px-2 sm:px-3 hidden lg:table-cell">G/Game</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((s, i) => (
              <tr key={s.player_id} className="border-b border-white/[0.04] card-hover">
                <td className="py-3 px-3 sm:px-4">
                  <span className={`font-bold tabular-nums ${i < 3 ? "text-yellow-400" : "text-gray-500"}`}>
                    {s.rank}
                  </span>
                </td>
                <td className="py-3 px-3 sm:px-4 font-medium text-white">{s.player_name}</td>
                <td className="py-3 px-3 text-gray-500 hidden sm:table-cell">{s.team_name}</td>
                <td className="text-center py-3 px-2 sm:px-3">
                  <span className="font-bold text-[#00ff85] text-base tabular-nums">{s.goals}</span>
                </td>
                <td className="text-center py-3 px-2 sm:px-3 text-gray-400 tabular-nums hidden sm:table-cell">{s.assists}</td>
                <td className="text-center py-3 px-2 sm:px-3 text-gray-400 tabular-nums hidden md:table-cell">{s.goal_contributions}</td>
                <td className="text-center py-3 px-2 sm:px-3 text-gray-500 tabular-nums hidden md:table-cell">{s.matches_played}</td>
                <td className="text-center py-3 px-2 sm:px-3 text-gray-500 tabular-nums hidden lg:table-cell">
                  {typeof s.goals_per_game === "number" ? s.goals_per_game.toFixed(2) : s.goals_per_game}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
