import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import type { TeamPage } from "@/lib/data";
import { TEAM_COLORS, getQualificationZone } from "@/lib/data";
import TeamBadge from "@/components/TeamBadge";

export const dynamic = "force-dynamic";
import FormBadges from "@/components/FormBadges";

async function getTeam(id: string): Promise<TeamPage | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "teams", `${id}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

export default async function TeamPage({ params }: { params: { id: string } }) {
  const team = await getTeam(params.id);

  if (!team) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-xl">Team not found</p>
        <Link href="/" className="text-[#00ff85] mt-4 inline-block">← Back to Table</Link>
      </div>
    );
  }

  const stripped = team.team_name.replace(/ FC$/, "").replace(/^AFC /, "").trim();
  const colors = TEAM_COLORS[team.team_name] || TEAM_COLORS[stripped] || { primary: "#6b7280", secondary: "#374151", text: "#fff" };
  const s = team.standings;
  const zone = s ? getQualificationZone(s.position) : null;
  const recentMatches = (team.matches || []).slice(0, 10);
  const scorers = team.scorers || [];

  return (
    <div>
      <div className="mb-4">
        <Link href="/" className="text-gray-400 hover:text-[#00ff85] text-sm transition-colors">
          ← League Table
        </Link>
      </div>

      {/* Team header */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${colors.primary}40 0%, ${colors.secondary}20 100%)`, border: `1px solid ${colors.primary}40` }}
      >
        <div className="flex items-center gap-4">
          <TeamBadge teamName={team.team_name} size="lg" />
          <div>
            <h1 className="text-3xl font-black text-white">{team.team_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {s && (
                <span className="text-gray-300 text-sm">
                  #{s.position} · {s.points} pts
                </span>
              )}
              {zone && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  zone === "champions-league" ? "bg-blue-500/20 text-blue-400" :
                  zone === "europa-league" ? "bg-orange-500/20 text-orange-400" :
                  zone === "conference-league" ? "bg-lime-500/20 text-lime-400" :
                  "bg-red-500/20 text-red-400"
                }`}>
                  {zone === "champions-league" ? "Champions League" :
                   zone === "europa-league" ? "Europa League" :
                   zone === "conference-league" ? "Conference League" : "Relegated"}
                </span>
              )}
            </div>
          </div>
          <div className="ml-auto text-right">
            <FormBadges form={team.form ?? undefined} />
            <p className="text-gray-500 text-xs mt-1">Last 5</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {s && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {[
            { label: "Played", value: s.played },
            { label: "Won", value: s.won, color: "text-green-400" },
            { label: "Drawn", value: s.drawn, color: "text-gray-400" },
            { label: "Lost", value: s.lost, color: "text-red-400" },
            { label: "GD", value: s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference,
              color: s.goal_difference >= 0 ? "text-green-400" : "text-red-400" },
            { label: "Points", value: s.points, color: "text-[#00ff85]", big: true },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl p-3 text-center">
              <div className={`text-xl font-black ${stat.color || "text-white"} ${stat.big ? "text-2xl" : ""}`}>
                {stat.value}
              </div>
              <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent matches */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="text-sm text-gray-400 uppercase tracking-wider">Recent Matches</h2>
          </div>
          <div className="divide-y divide-white/5">
            {recentMatches.map((m) => {
              const isHome = m.home_team_id === team.team_id;
              const result = isHome ? m.home_result : m.away_result;
              const opponent = isHome ? m.away_team_name : m.home_team_name;
              const score = isHome
                ? `${m.home_score} – ${m.away_score}`
                : `${m.away_score} – ${m.home_score}`;

              return (
                <Link
                  key={m.match_id}
                  href={`/matches/${m.match_id}`}
                  className="flex items-center justify-between px-4 py-3 card-hover"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                      result === "W" ? "bg-green-500 text-white" :
                      result === "D" ? "bg-gray-500 text-white" :
                      "bg-red-500 text-white"
                    }`}>
                      {result}
                    </span>
                    <span className="text-gray-400 text-xs w-4">{isHome ? "H" : "A"}</span>
                    <TeamBadge teamName={opponent} size="sm" />
                    <span className="text-sm text-gray-300 hidden sm:block">{opponent}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">{score}</div>
                    <div className="text-gray-500 text-xs">{formatDate(m.match_date)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Top scorers */}
        {scorers.length > 0 && (
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="text-sm text-gray-400 uppercase tracking-wider">Top Scorers</h2>
            </div>
            <div className="divide-y divide-white/5">
              {scorers.map((scorer) => (
                <div key={scorer.player_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-white text-sm">{scorer.player_name}</p>
                    <p className="text-gray-500 text-xs">{scorer.matches_played} apps · {scorer.goals_per_game} G/game</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="font-black text-white text-lg">{scorer.goals}</div>
                      <div className="text-gray-500 text-xs">Goals</div>
                    </div>
                    <div className="text-center">
                      <div className="font-black text-gray-300">{scorer.assists}</div>
                      <div className="text-gray-500 text-xs">Assists</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Season summary */}
        {s && (
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">Season Analysis</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Win Rate</span>
                <span className="text-white font-medium">{s.win_rate}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.win_rate}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Points Efficiency</span>
                <span className="text-white font-medium">{s.points_pct}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-[#00ff85] rounded-full" style={{ width: `${s.points_pct}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-white">{s.goals_per_game}</div>
                  <div className="text-gray-500 text-xs">Goals/Game</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-white">{s.goals_conceded_per_game}</div>
                  <div className="text-gray-500 text-xs">Conceded/G</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
