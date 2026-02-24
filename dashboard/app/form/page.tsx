"use client";

import { useEffect, useState } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";

interface FormRow {
  team_name: string;
  matchday: number;
  result: string;
  pts: number;
  gf: number;
  ga: number;
  rolling_5_ppg: number;
  rolling_5_goals_scored: number;
  rolling_5_goals_conceded: number;
  last_5_form: string;
  current_momentum: string | null;
  recency_rank: number;
}

interface SCD2Row {
  team_name: string;
  position: number;
  valid_from_matchday: number;
  valid_to_matchday: number;
  valid_from_date: string;
  valid_to_date: string;
  points: number;
  played: number;
  matchdays_held: number;
  prev_position: number | null;
  movement: string;
  is_current: boolean;
}

const MOMENTUM_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  HOT: { bg: "bg-red-500/20", text: "text-red-400", label: "🔥 HOT" },
  STEADY: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "⚡ STEADY" },
  COOLING: { bg: "bg-blue-400/20", text: "text-blue-400", label: "❄️ COOLING" },
  COLD: { bg: "bg-blue-800/20", text: "text-blue-300", label: "🥶 COLD" },
};

function FormBadge({ char }: { char: string }) {
  const colors: Record<string, string> = {
    W: "bg-green-500",
    D: "bg-gray-500",
    L: "bg-red-500",
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold text-white ${colors[char] || "bg-gray-700"}`}>
      {char}
    </span>
  );
}

export default function FormPage() {
  const [form, setForm] = useState<FormRow[]>([]);
  const [scd2, setScd2] = useState<SCD2Row[]>([]);
  const [view, setView] = useState<"momentum" | "positions">("momentum");
  const [selectedTeam, setSelectedTeam] = useState<string>("Arsenal");

  useEffect(() => {
    fetch("/data/rolling_form.json").then((r) => r.json()).then(setForm);
    fetch("/data/scd2_standings.json").then((r) => r.json()).then(setScd2);
  }, []);

  // Group by momentum
  const grouped = {
    HOT: form.filter((r) => r.current_momentum === "HOT"),
    STEADY: form.filter((r) => r.current_momentum === "STEADY"),
    COOLING: form.filter((r) => r.current_momentum === "COOLING"),
    COLD: form.filter((r) => r.current_momentum === "COLD"),
  };

  // SCD2: get unique teams and current team's history
  const teams = Array.from(new Set(scd2.map((r) => r.team_name))).sort();
  const teamHistory = scd2.filter((r) => r.team_name === selectedTeam);
  const currentVersions = scd2.filter((r) => r.is_current).sort((a, b) => a.position - b.position);

  // Biggest movers: compare first version position to current version position
  const movers = currentVersions.map((curr) => {
    const firstVersion = scd2.find((r) => r.team_name === curr.team_name && r.movement === "NEW");
    const startPos = firstVersion?.position ?? curr.position;
    return {
      team: curr.team_name,
      current: curr.position,
      start: startPos,
      change: startPos - curr.position,
      points: curr.points,
      versions: scd2.filter((r) => r.team_name === curr.team_name).length,
    };
  }).sort((a, b) => b.change - a.change);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Form & Momentum</h1>
            <p className="text-gray-400 text-sm">
              Rolling 5-game form · SCD2 position tracking · 2025-26 Season
            </p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Rolling Window + SCD Type 2"
          source="Gold: mart_rolling_form + mart_scd2_standings"
          explanation="Two patterns: (1) Rolling Window — AVG(points) OVER (ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) for 5-game PPG, classifying HOT/STEADY/COOLING/COLD. (2) SCD Type 2 — tracks every position change with valid_from/valid_to for point-in-time queries. Only creates a new version when position changes — consecutive matchdays at the same position collapse into one row."
        />
        <div className="flex gap-2">
          <button
            onClick={() => setView("momentum")}
            className={`text-xs px-3 py-1.5 rounded-lg ${view === "momentum" ? "bg-[#00ff85] text-[#38003c]" : "bg-white/10 text-white"}`}
          >
            Momentum
          </button>
          <button
            onClick={() => setView("positions")}
            className={`text-xs px-3 py-1.5 rounded-lg ${view === "positions" ? "bg-[#00ff85] text-[#38003c]" : "bg-white/10 text-white"}`}
          >
            Position History
          </button>
        </div>
      </div>

      {view === "momentum" ? (
        <div className="space-y-6">
          {(["HOT", "STEADY", "COOLING", "COLD"] as const).map((tier) => {
            const style = MOMENTUM_STYLE[tier];
            const teams = grouped[tier];
            if (teams.length === 0) return null;
            return (
              <div key={tier} className={`glass rounded-xl overflow-hidden`}>
                <div className={`px-4 py-3 border-b border-white/10 ${style.bg}`}>
                  <h2 className={`text-sm font-bold ${style.text}`}>{style.label} — {teams.length} teams</h2>
                </div>
                <div className="divide-y divide-white/5">
                  {teams.map((t) => (
                    <div key={t.team_name} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white w-48">{t.team_name}</span>
                        <div className="flex gap-1">
                          {(t.last_5_form || "").split("").map((c, i) => (
                            <FormBadge key={i} char={c} />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <span className="text-gray-400 text-xs">PPG</span>
                          <p className={`font-bold ${t.rolling_5_ppg >= 2.0 ? "text-green-400" : t.rolling_5_ppg >= 1.0 ? "text-yellow-400" : "text-red-400"}`}>
                            {t.rolling_5_ppg.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 text-xs">GF/GA</span>
                          <p className="text-gray-300">
                            {t.rolling_5_goals_scored.toFixed(1)} / {t.rolling_5_goals_conceded.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Team Selector + Version History */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm text-gray-400 uppercase tracking-wider">
                SCD Type 2 — Position Version History
              </h2>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 border border-white/20"
              >
                {teams.map((t) => (
                  <option key={t} value={t} className="bg-[#1a1a2e]">{t}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              <p className="text-gray-400 text-xs mb-4">
                {selectedTeam} has <span className="text-white font-bold">{teamHistory.length} versions</span> this season
                — position changed {teamHistory.length - 1} times across {teamHistory.length > 0 ? teamHistory[teamHistory.length - 1].valid_to_matchday : 0} matchdays
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase border-b border-white/10">
                    <th className="text-left py-2 px-2">Position</th>
                    <th className="text-left py-2 px-2">From GW</th>
                    <th className="text-left py-2 px-2">To GW</th>
                    <th className="text-center py-2 px-2">Held</th>
                    <th className="text-right py-2 px-2">Points</th>
                    <th className="text-center py-2 px-2">Movement</th>
                    <th className="text-center py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {teamHistory.map((v, i) => (
                    <tr key={i} className={v.is_current ? "bg-[#00ff85]/5" : ""}>
                      <td className="py-2.5 px-2">
                        <span className="text-white font-bold text-lg">#{v.position}</span>
                      </td>
                      <td className="py-2.5 px-2 text-gray-300">GW{v.valid_from_matchday}</td>
                      <td className="py-2.5 px-2 text-gray-300">GW{v.valid_to_matchday}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          v.matchdays_held >= 10 ? "bg-green-500/20 text-green-400" :
                          v.matchdays_held >= 5 ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-white/10 text-gray-400"
                        }`}>
                          {v.matchdays_held} GW{v.matchdays_held !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-300">{v.points}</td>
                      <td className="py-2.5 px-2 text-center">
                        {v.movement === "UP" && <span className="text-green-400 font-bold">▲ {v.prev_position ? v.prev_position - v.position : 0}</span>}
                        {v.movement === "DOWN" && <span className="text-red-400 font-bold">▼ {v.prev_position ? v.position - v.prev_position : 0}</span>}
                        {v.movement === "NEW" && <span className="text-blue-400 text-xs">NEW</span>}
                        {v.movement === "SAME" && <span className="text-gray-500">—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {v.is_current && <span className="text-xs bg-[#00ff85]/20 text-[#00ff85] px-2 py-0.5 rounded-full">CURRENT</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Season Movers Summary */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="text-sm text-gray-400 uppercase tracking-wider">
                Season Movers — Start vs Current Position
              </h2>
            </div>
            <div className="divide-y divide-white/5">
              {movers.map((m) => (
                <div key={m.team} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold w-8 text-right">#{m.current}</span>
                    <span className="font-medium text-white w-48">{m.team}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm">{m.points} pts</span>
                    <span className="text-gray-500 text-xs">started #{m.start}</span>
                    <span className="text-gray-500 text-xs">{m.versions} versions</span>
                    <span className={`font-bold text-sm min-w-[50px] text-right ${
                      m.change > 0 ? "text-green-400" :
                      m.change < 0 ? "text-red-400" : "text-gray-500"
                    }`}>
                      {m.change > 0 ? `▲ ${m.change}` : m.change < 0 ? `▼ ${Math.abs(m.change)}` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
