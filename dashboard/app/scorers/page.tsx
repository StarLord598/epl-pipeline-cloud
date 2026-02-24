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

  if (loading) return <div className="text-gray-400 p-8">Loading…</div>;

  const top3 = scorers.slice(0, 3);

  const chartData = scorers.slice(0, 15).map((s) => ({
    name: s.player_name.split(" ").slice(-1)[0],  // last name only
    fullName: s.player_name,
    goals: s.goals,
    assists: s.assists,
    contributions: s.goal_contributions,
    team: s.team_name,
  }));

  const chartKey = tab === "goals" ? "goals" : tab === "assists" ? "assists" : "contributions";
  const chartLabel = tab === "goals" ? "Goals" : tab === "assists" ? "Assists" : "G+A";

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🥇</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Golden Boot Race</h1>
            <p className="text-gray-400 text-sm">Premier League · Live from Pipeline</p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Star Schema"
          source="Gold: mart_top_scorers → stg_top_scorers → raw.top_scorers"
          explanation="Kimball star schema — mart_top_scorers is a fact table with player metrics (goals, assists, per-game rates). Joins with dim_teams for team context. Enables slice-and-dice analysis by team, position, and contribution type."
        />
      </div>

      {/* Podium */}
      <div className="flex justify-center items-end gap-4 mb-8">
        {[top3[1], top3[0], top3[2]].map((s, i) => {
          if (!s) return null;
          const heights = ["h-28", "h-36", "h-24"];
          const medals  = ["🥈", "🥇", "🥉"];
          const colors  = ["#C0C0C0", "#FFD700", "#CD7F32"];
          return (
            <div key={s.player_id} className="flex flex-col items-center gap-2">
              <span className="text-2xl">{medals[i]}</span>
              <p className="text-white font-bold text-sm text-center leading-tight w-24">
                {s.player_name.split(" ").slice(-1)[0]}
              </p>
              <p className="text-xs text-gray-400 text-center">{s.team_name.split(" ")[0]}</p>
              <div
                className={`w-20 ${heights[i]} rounded-t-lg flex items-center justify-center`}
                style={{ background: `${colors[i]}22`, border: `2px solid ${colors[i]}` }}
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
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t
                ? "bg-[#00ff85] text-black"
                : "glass text-gray-300 hover:text-white"
            }`}
          >
            {t === "goals" ? "Goals" : t === "assists" ? "Assists" : "G+A"}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="glass rounded-xl p-4 mb-8">
        <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">
          Top 15 — {chartLabel}
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "rgba(17,24,39,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value, _name, props) => [
                `${value} ${chartLabel}`,
                props.payload.fullName,
              ]}
              labelFormatter={(label) => chartData.find((d) => d.name === label)?.team ?? label}
            />
            <Bar dataKey={chartKey} radius={[4, 4, 0, 0]}>
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-white/10">
              <th className="text-left py-3 px-4 w-10">#</th>
              <th className="text-left py-3 px-4">Player</th>
              <th className="text-left py-3 px-4 hidden sm:table-cell">Club</th>
              <th className="text-center py-3 px-3">Goals</th>
              <th className="text-center py-3 px-3 hidden sm:table-cell">Assists</th>
              <th className="text-center py-3 px-3 hidden md:table-cell">G+A</th>
              <th className="text-center py-3 px-3 hidden md:table-cell">Apps</th>
              <th className="text-center py-3 px-3 hidden lg:table-cell">G/Game</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((s, i) => (
              <tr key={s.player_id} className="border-b border-white/5 card-hover">
                <td className="py-3 px-4">
                  <span className={`font-bold ${i < 3 ? "text-yellow-400" : "text-gray-400"}`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : s.rank}
                  </span>
                </td>
                <td className="py-3 px-4 font-medium text-white">{s.player_name}</td>
                <td className="py-3 px-4 text-gray-400 hidden sm:table-cell">{s.team_name}</td>
                <td className="text-center py-3 px-3">
                  <span className="font-bold text-[#00ff85] text-base">{s.goals}</span>
                </td>
                <td className="text-center py-3 px-3 text-gray-300 hidden sm:table-cell">{s.assists}</td>
                <td className="text-center py-3 px-3 text-gray-300 hidden md:table-cell">{s.goal_contributions}</td>
                <td className="text-center py-3 px-3 text-gray-400 hidden md:table-cell">{s.matches_played}</td>
                <td className="text-center py-3 px-3 text-gray-400 hidden lg:table-cell">
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
