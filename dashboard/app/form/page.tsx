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

const MOMENTUM_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  HOT:     { bg: "bg-red-500/[0.06]",    border: "border-red-500/20",    text: "text-red-400",    label: "HOT" },
  STEADY:  { bg: "bg-yellow-500/[0.06]",  border: "border-yellow-500/20",  text: "text-yellow-400",  label: "STEADY" },
  COOLING: { bg: "bg-blue-400/[0.06]",    border: "border-blue-400/20",    text: "text-blue-400",    label: "COOLING" },
  COLD:    { bg: "bg-blue-800/[0.06]",    border: "border-blue-300/20",    text: "text-blue-300",    label: "COLD" },
};

function FormBadge({ char }: { char: string }) {
  const colors: Record<string, string> = {
    W: "bg-green-500/80 shadow-green-500/20",
    D: "bg-gray-500/60",
    L: "bg-red-500/80 shadow-red-500/20",
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold text-white shadow-sm ${colors[char] || "bg-gray-700"}`}>
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
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-2xl">&#128293;</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Form & Momentum</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Rolling 5-game form · SCD2 position tracking · 2025-26 Season
              </p>
            </div>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              onClick={() => setView("momentum")}
              className={`text-xs px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                view === "momentum"
                  ? "bg-[#00ff85] text-[#0a0a0f] shadow-lg shadow-[#00ff85]/20"
                  : "glass text-gray-300 hover:text-white"
              }`}
            >
              Momentum
            </button>
            <button
              onClick={() => setView("positions")}
              className={`text-xs px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                view === "positions"
                  ? "bg-[#00ff85] text-[#0a0a0f] shadow-lg shadow-[#00ff85]/20"
                  : "glass text-gray-300 hover:text-white"
              }`}
            >
              Position History
            </button>
          </div>
        </div>
        <DataSourceBadge
          pattern="Rolling Window + SCD Type 2"
          source="AWS Lambda → S3 Data Lake (Parquet) → Athena (window functions) → API Gateway + CloudFront"
          explanation="Two advanced analytics patterns running on AWS: (1) Rolling Window — Athena computes AVG(points) OVER (ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) on S3 data for 5-game PPG, classifying HOT/STEADY/COOLING/COLD. (2) SCD Type 2 — tracks every position change with valid_from/valid_to for point-in-time queries. Data ingested by Lambda on EventBridge schedule, stored in S3 data lake, cataloged in Glue, queried via Athena. Dashboard served on ECS Fargate behind CloudFront CDN."
        />
      </div>

      {view === "momentum" ? (
        <div className="space-y-4 stagger-children">
          {(["HOT", "STEADY", "COOLING", "COLD"] as const).map((tier) => {
            const style = MOMENTUM_STYLE[tier];
            const tierTeams = grouped[tier];
            if (tierTeams.length === 0) return null;
            return (
              <div key={tier} className="glass rounded-2xl overflow-hidden">
                <div className={`px-4 py-3 border-b border-white/[0.06] ${style.bg}`}>
                  <h2 className={`text-sm font-bold ${style.text} flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: "currentColor" }} />
                    {style.label} — {tierTeams.length} teams
                  </h2>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {tierTeams.map((t) => (
                    <div key={t.team_name} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 card-hover">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white text-sm w-32 sm:w-48 truncate">{t.team_name}</span>
                        <div className="flex gap-1">
                          {(t.last_5_form || "").split("").map((c, i) => (
                            <FormBadge key={i} char={c} />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <span className="text-gray-500 text-[10px] uppercase tracking-wider">PPG</span>
                          <p className={`font-bold ${t.rolling_5_ppg >= 2.0 ? "text-green-400" : t.rolling_5_ppg >= 1.0 ? "text-yellow-400" : "text-red-400"}`}>
                            {t.rolling_5_ppg.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-500 text-[10px] uppercase tracking-wider">GF/GA</span>
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
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                SCD Type 2 — Position Version History
              </h2>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="bg-white/[0.04] text-white text-sm rounded-lg px-3 py-1.5 border border-white/[0.08] focus:border-[#00ff85]/50 focus:outline-none transition-colors"
              >
                {teams.map((t) => (
                  <option key={t} value={t} className="bg-[#0d1117]">{t}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              <p className="text-gray-400 text-xs mb-4">
                {selectedTeam} has <span className="text-white font-bold">{teamHistory.length} versions</span> this season
                — position changed {teamHistory.length - 1} times across {teamHistory.length > 0 ? teamHistory[teamHistory.length - 1].valid_to_matchday : 0} matchdays
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-[11px] uppercase border-b border-white/[0.06]">
                      <th className="text-left py-2 px-2">Position</th>
                      <th className="text-left py-2 px-2">From GW</th>
                      <th className="text-left py-2 px-2">To GW</th>
                      <th className="text-center py-2 px-2">Held</th>
                      <th className="text-right py-2 px-2">Points</th>
                      <th className="text-center py-2 px-2">Movement</th>
                      <th className="text-center py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {teamHistory.map((v, i) => (
                      <tr key={i} className={v.is_current ? "bg-[#00ff85]/[0.03]" : ""}>
                        <td className="py-2.5 px-2">
                          <span className="text-white font-bold text-lg">#{v.position}</span>
                        </td>
                        <td className="py-2.5 px-2 text-gray-400">GW{v.valid_from_matchday}</td>
                        <td className="py-2.5 px-2 text-gray-400">GW{v.valid_to_matchday}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            v.matchdays_held >= 10 ? "bg-green-500/10 text-green-400" :
                            v.matchdays_held >= 5 ? "bg-yellow-500/10 text-yellow-400" :
                            "bg-white/[0.04] text-gray-500"
                          }`}>
                            {v.matchdays_held} GW{v.matchdays_held !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right text-gray-400">{v.points}</td>
                        <td className="py-2.5 px-2 text-center">
                          {v.movement === "UP" && <span className="text-green-400 font-bold">&#9650; {v.prev_position ? v.prev_position - v.position : 0}</span>}
                          {v.movement === "DOWN" && <span className="text-red-400 font-bold">&#9660; {v.prev_position ? v.position - v.prev_position : 0}</span>}
                          {v.movement === "NEW" && <span className="text-blue-400 text-xs font-medium">NEW</span>}
                          {v.movement === "SAME" && <span className="text-gray-600">--</span>}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {v.is_current && <span className="text-xs bg-[#00ff85]/10 text-[#00ff85] px-2 py-0.5 rounded-full font-medium">CURRENT</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Season Movers Summary */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <h2 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                Season Movers — Start vs Current Position
              </h2>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {movers.map((m) => (
                <div key={m.team} className="px-4 py-3 flex items-center justify-between card-hover">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold w-8 text-right tabular-nums">#{m.current}</span>
                    <span className="font-medium text-white text-sm w-32 sm:w-48 truncate">{m.team}</span>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-sm">
                    <span className="text-gray-400 tabular-nums">{m.points} pts</span>
                    <span className="text-gray-600 text-xs hidden sm:inline">started #{m.start}</span>
                    <span className="text-gray-600 text-xs hidden sm:inline">{m.versions} ver</span>
                    <span className={`font-bold text-sm min-w-[50px] text-right tabular-nums ${
                      m.change > 0 ? "text-green-400" :
                      m.change < 0 ? "text-red-400" : "text-gray-600"
                    }`}>
                      {m.change > 0 ? `+${m.change}` : m.change < 0 ? `${m.change}` : "--"}
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
