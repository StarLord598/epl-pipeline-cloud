"use client";

import { useEffect, useState } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { TeamStanding, TEAM_COLORS } from "@/lib/data";

export default function StatsPage() {
  const [teams, setTeams] = useState<TeamStanding[]>([]);
  const [selected, setSelected] = useState<string[]>(["Manchester City", "Arsenal", "Liverpool"]);

  useEffect(() => {
    // Prefer live standings, fall back to league_table
    fetch("/data/live_standings.json")
      .then((r) => {
        if (!r.ok) throw new Error("no live data");
        return r.json();
      })
      .then((data: TeamStanding[]) => {
        if (!Array.isArray(data) || data.length === 0) throw new Error("empty");
        // Enrich with derived fields if missing
        setTeams(data.map((t) => ({
          ...t,
          team_id: t.team_id ?? t.position,
          team_name: (t.team_name || "").replace(/ FC$/, "").replace(/^AFC /, ""),
          goal_difference: t.goal_difference ?? (t.goals_for - t.goals_against),
          win_rate: t.win_rate ?? (t.played > 0 ? Math.round((t.won / t.played) * 1000) / 10 : 0),
          points_pct: t.points_pct ?? (t.played > 0 ? Math.round((t.points / (t.played * 3)) * 1000) / 10 : 0),
          goals_per_game: t.goals_per_game ?? (t.played > 0 ? Math.round((t.goals_for / t.played) * 100) / 100 : 0),
          goals_conceded_per_game: t.goals_conceded_per_game ?? (t.played > 0 ? Math.round((t.goals_against / t.played) * 100) / 100 : 0),
        })));
      })
      .catch(() => {
        fetch("/data/league_table.json").then((r) => r.json()).then(setTeams);
      });
  }, []);

  const toggleTeam = (name: string) => {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((t) => t !== name)
        : prev.length < 4
        ? [...prev, name]
        : prev
    );
  };

  // Radar data for selected teams (first team selected)
  const teamData = teams.find((t) => t.team_name === selected[0]);
  const maxValues = teams.reduce((acc, t) => ({
    goals_for: Math.max(acc.goals_for, t.goals_for),
    won: Math.max(acc.won, t.won),
    points: Math.max(acc.points, t.points),
    win_rate: Math.max(acc.win_rate, t.win_rate),
    goals_per_game: Math.max(acc.goals_per_game, t.goals_per_game),
  }), { goals_for: 1, won: 1, points: 1, win_rate: 1, goals_per_game: 1 });

  const radarData = teamData ? [
    { metric: "Goals",    value: Math.round((teamData.goals_for / maxValues.goals_for) * 100) },
    { metric: "Wins",     value: Math.round((teamData.won / maxValues.won) * 100) },
    { metric: "Points",   value: Math.round((teamData.points / maxValues.points) * 100) },
    { metric: "Win Rate", value: Math.round((teamData.win_rate / maxValues.win_rate) * 100) },
    { metric: "Goals/G",  value: Math.round((teamData.goals_per_game / maxValues.goals_per_game) * 100) },
    { metric: "Defence",  value: Math.round(((100 - teamData.goals_conceded_per_game * 10) / 100) * 100) },
  ] : [];

  // Bar chart: goals for vs against
  const goalData = teams.map((t) => ({
    name: t.team_name.split(" ")[0],
    fullName: t.team_name,
    goalsFor: t.goals_for,
    goalsAgainst: t.goals_against,
  }));

  const colors = TEAM_COLORS[selected[0]]?.primary || "#00ff85";

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📊</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Season Statistics</h1>
            <p className="text-gray-400 text-sm">2025-26 · Team Performance Analysis</p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Kimball Dimension"
          source="Gold: dim_teams + mart_live_league_table"
          explanation="Kimball dimension modeling — dim_teams classifies all 20 teams into tiers (Title Contender, European, Mid-table, Relegation Zone) with conformed attributes. Radar charts pull from multiple fact tables joined through this shared dimension, enabling cross-metric team comparisons."
        />
      </div>

      {/* Team selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {teams.map((t) => {
          const active = selected.includes(t.team_name);
          const color = TEAM_COLORS[t.team_name]?.primary || "#6b7280";
          return (
            <button
              key={t.team_id}
              onClick={() => toggleTeam(t.team_name)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                active ? "text-white" : "bg-transparent text-gray-400 border-white/10 hover:border-white/30"
              }`}
              style={active ? { background: color, borderColor: color } : undefined}
            >
              {t.team_name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Radar chart */}
        <div className="glass rounded-xl p-4">
          <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
            Team Profile — {selected[0]}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
              />
              <Radar
                name={selected[0]}
                dataKey="value"
                stroke={colors}
                fill={colors}
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
          <p className="text-gray-500 text-xs text-center">Normalized 0-100 vs league best</p>
        </div>

        {/* Points comparison */}
        <div className="glass rounded-xl p-4">
          <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
            Points Tally — All Teams
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={teams} layout="vertical">
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="team_name"
                tick={{ fill: "#e5e7eb", fontSize: 9 }}
                width={120}
                tickFormatter={(v: string) => v.split(" ").slice(-1)[0]}
              />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                formatter={(v: number | undefined) => [v ?? 0, "Points"]}
              />
              <Bar dataKey="points" fill="#00ff85" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Goals for vs against */}
        <div className="glass rounded-xl p-4 lg:col-span-2">
          <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
            Goals Scored vs Conceded — All Teams
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={goalData}>
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip
                labelFormatter={(v, payload) => payload?.[0]?.payload?.fullName || v}
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              />
              <Legend wrapperStyle={{ color: "#9ca3af" }} />
              <Bar dataKey="goalsFor" name="Goals For" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="goalsAgainst" name="Goals Against" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Season highlights */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "⚽", label: "Total Goals", value: teams.reduce((s, t) => s + t.goals_for, 0) },
          { icon: "🎮", label: "Total Matches", value: teams.reduce((s, t) => s + t.played, 0) / 2 },
          { icon: "📈", label: "Avg Goals/Game", value: (teams.reduce((s, t) => s + t.goals_for, 0) / (teams.reduce((s, t) => s + t.played, 0) / 2)).toFixed(2) },
          { icon: "🏆", label: "Leader", value: teams[0]?.team_name ?? "—" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-xl font-black text-white">{stat.value}</div>
            <div className="text-gray-400 text-xs mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
