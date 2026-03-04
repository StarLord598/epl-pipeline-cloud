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
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || "https://dr81mm57l8sab.cloudfront.net";
    // Try CloudFront API first, then fall back to static JSON
    fetch(`${API_BASE}/standings`)
      .then((r) => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then((apiData) => {
        const standings = apiData?.data?.standings ?? apiData?.standings ?? [];
        const total = standings.find((s: { type: string }) => s.type === "TOTAL") ?? standings[0];
        if (!total?.table?.length) throw new Error("empty");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformed: TeamStanding[] = total.table.map((t: any) => {
          const played = t.playedGames ?? 0;
          const won = t.won ?? 0;
          const gf = t.goalsFor ?? 0;
          const ga = t.goalsAgainst ?? 0;
          const pts = t.points ?? 0;
          return {
            position: t.position,
            team_id: t.team?.id ?? t.position,
            team_name: (t.team?.shortName ?? t.team?.name ?? "").replace(/ FC$/, "").replace(/^AFC /, ""),
            tla: t.team?.tla ?? "",
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
        setTeams(transformed);
      })
      .catch(() => {
        // Fallback to static JSON
        fetch("/data/live_standings.json")
          .then((r) => { if (!r.ok) throw new Error("no live data"); return r.json(); })
          .then((data: TeamStanding[]) => {
            if (!Array.isArray(data) || data.length === 0) throw new Error("empty");
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
      });
  }, []);

  // Set default selection from actual loaded team names
  useEffect(() => {
    if (teams.length > 0 && selected.length === 0) {
      const defaults = ["Man City", "Arsenal", "Liverpool"]
        .map((n) => teams.find((t) => t.team_name.includes(n))?.team_name)
        .filter(Boolean) as string[];
      setSelected(defaults.length > 0 ? defaults : [teams[0].team_name]);
    }
  }, [teams, selected.length]);

  const MAX_RADAR_TEAMS = 3;
  // Fixed distinct colors for radar overlay — always distinguishable
  const RADAR_PALETTE = ["#EF0107", "#00C8FF", "#FFD700"]; // red, cyan, gold

  // Get the radar color for a selected team (by selection order)
  const getRadarColor = (teamName: string): string => {
    const idx = selected.indexOf(teamName);
    if (idx >= 0 && idx < RADAR_PALETTE.length) return RADAR_PALETTE[idx];
    return TEAM_COLORS[teamName]?.primary || "#6b7280";
  };

  const toggleTeam = (name: string) => {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((t) => t !== name)
        : prev.length < MAX_RADAR_TEAMS
        ? [...prev, name]
        : [...prev.slice(1), name] // drop oldest, add new
    );
  };

  // Radar data for all selected teams (up to 3 overlaid)
  const maxValues = teams.reduce((acc, t) => ({
    goals_for: Math.max(acc.goals_for, t.goals_for),
    won: Math.max(acc.won, t.won),
    points: Math.max(acc.points, t.points),
    win_rate: Math.max(acc.win_rate, t.win_rate),
    goals_per_game: Math.max(acc.goals_per_game, t.goals_per_game),
    goals_conceded_per_game: Math.max(acc.goals_conceded_per_game, t.goals_conceded_per_game || 1),
  }), { goals_for: 1, won: 1, points: 1, win_rate: 1, goals_per_game: 1, goals_conceded_per_game: 1 });

  const metrics = ["Goals", "Wins", "Points", "Win Rate", "Goals/G", "Defence"];

  const radarData = metrics.map((metric) => {
    const row: Record<string, string | number> = { metric };
    for (const sel of selected) {
      const td = teams.find((t) => t.team_name === sel);
      if (!td) continue;
      const val =
        metric === "Goals" ? (td.goals_for / maxValues.goals_for) * 100 :
        metric === "Wins" ? (td.won / maxValues.won) * 100 :
        metric === "Points" ? (td.points / maxValues.points) * 100 :
        metric === "Win Rate" ? (td.win_rate / maxValues.win_rate) * 100 :
        metric === "Goals/G" ? (td.goals_per_game / maxValues.goals_per_game) * 100 :
        ((1 - (td.goals_conceded_per_game || 0) / maxValues.goals_conceded_per_game) * 100);
      row[sel] = Math.round(val);
    }
    return row;
  });

  // Bar chart: goals for vs against
  const goalData = teams.map((t) => ({
    name: t.team_name === "Man City" ? "City" : t.team_name === "Man United" ? "Utd" : t.team_name.includes("Wolverhampton") ? "Wolves" : t.team_name.includes("Brighton") ? "Brighton" : t.team_name.includes("Nottingham") ? "Forest" : t.team_name.includes("West Ham") ? "West Ham" : t.team_name.includes("Crystal") ? "Crystal" : t.team_name.split(" ")[0],
    fullName: t.team_name,
    goalsFor: t.goals_for,
    goalsAgainst: t.goals_against,
  }));


  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-2xl">&#128202;</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Season Statistics</h1>
            <p className="text-gray-400 text-sm mt-0.5">2025-26 · Team Performance Analysis</p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Conformed Dimension (Kimball)"
          source="Gold: dim_teams (conformed) + mart_live_league_table (fact) — multi-fact join"
          explanation="Conformed dimension modeling — dim_teams is a shared dimension across all fact tables, classifying teams into tiers (Title Contender, European, Mid-table, Relegation Zone) with stable surrogate keys and descriptive attributes. Radar charts join multiple fact tables through this single conformed dimension, enabling cross-metric comparisons without fan traps. This is the Kimball bus architecture in action. Runs on AWS: S3 → Glue Catalog → Athena multi-table joins."
        />
      </div>

      {/* Team selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {teams.map((t) => {
          const active = selected.includes(t.team_name);
          const color = active ? getRadarColor(t.team_name) : "#6b7280";
          return (
            <button
              key={t.team_id}
              onClick={() => toggleTeam(t.team_name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                active ? "text-white shadow-sm" : "bg-transparent text-gray-500 border-white/[0.06] hover:border-white/[0.15]"
              }`}
              style={active ? { background: `${color}20`, borderColor: color, color } : undefined}
            >
              {(() => {
                const n = t.team_name;
                if (n === "Man City") return "Man City";
                if (n === "Man United") return "Man Utd";
                if (n.startsWith("Manchester")) return n.includes("City") ? "Man City" : "Man Utd";
                if (n.includes("Brighton")) return "Brighton";
                if (n.includes("Wolverhampton") || n.includes("Wolves")) return "Wolves";
                if (n.includes("Nottingham")) return "Nott'm";
                if (n.includes("West Ham")) return "West Ham";
                if (n.includes("Crystal")) return "C. Palace";
                if (n.includes("Bournemouth")) return "B'mouth";
                if (n.includes("Sunderland")) return "Sunderland";
                return n.length > 10 ? n.split(" ")[0] : n;
              })()}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Radar chart */}
        <div className="glass rounded-2xl p-4 sm:p-5">
          <h2 className="text-[11px] text-gray-500 uppercase tracking-wider mb-4 font-medium">
            Team Profile — {selected.join(" vs ")}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#666", fontSize: 11 }} />
              {selected.map((sel) => {
                const radarColor = getRadarColor(sel);
                return (
                  <Radar
                    key={sel}
                    name={sel}
                    dataKey={sel}
                    stroke={radarColor}
                    fill={radarColor}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                );
              })}
            </RadarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-2">
            {selected.map((sel) => {
              const radarColor = getRadarColor(sel);
              return (
                <div key={sel} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: radarColor }} />
                  <span className="text-[11px] text-gray-400">{sel}</span>
                </div>
              );
            })}
          </div>
          <p className="text-gray-600 text-[11px] text-center mt-1">Normalized 0-100 vs league best · Max {MAX_RADAR_TEAMS} teams</p>
        </div>

        {/* Points comparison */}
        <div className="glass rounded-2xl p-4 sm:p-5">
          <h2 className="text-[11px] text-gray-500 uppercase tracking-wider mb-4 font-medium">
            Points Tally — All Teams
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={teams} layout="vertical">
              <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="team_name"
                tick={{ fill: "#888", fontSize: 9 }}
                width={120}
                tickFormatter={(v: string) => v.split(" ").slice(-1)[0]}
              />
              <Tooltip
                contentStyle={{ background: "rgba(13, 17, 23, 0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#fff" }}
                formatter={(v: number | undefined) => [v ?? 0, "Points"]}
              />
              <Bar dataKey="points" fill="#00ff85" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Goals for vs against */}
        <div className="glass rounded-2xl p-4 sm:p-5 lg:col-span-2">
          <h2 className="text-[11px] text-gray-500 uppercase tracking-wider mb-4 font-medium">
            Goals Scored vs Conceded — All Teams
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={goalData}>
              <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} />
              <Tooltip
                labelFormatter={(v, payload) => payload?.[0]?.payload?.fullName || v}
                contentStyle={{ background: "rgba(13, 17, 23, 0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#fff" }}
              />
              <Legend wrapperStyle={{ color: "#666", fontSize: 12 }} />
              <Bar dataKey="goalsFor" name="Goals For" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="goalsAgainst" name="Goals Against" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Season highlights */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 stagger-children">
        {[
          { label: "Total Goals", value: teams.reduce((s, t) => s + t.goals_for, 0), color: "#00ff85" },
          { label: "Total Matches", value: teams.reduce((s, t) => s + t.played, 0) / 2, color: "#fff" },
          { label: "Avg Goals/Game", value: (teams.reduce((s, t) => s + t.goals_for, 0) / (teams.reduce((s, t) => s + t.played, 0) / 2)).toFixed(2), color: "#00c8ff" },
          { label: "Leader", value: teams[0]?.team_name ?? "--", color: "#FFD700" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 text-center glass-hover">
            <div className="text-xl font-black tabular-nums" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-gray-500 text-[11px] mt-1 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
