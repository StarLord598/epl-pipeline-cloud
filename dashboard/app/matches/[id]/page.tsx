import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { MatchResult, MatchEvent } from "@/lib/data";
import TeamBadge from "@/components/TeamBadge";

export const dynamic = "force-dynamic";

async function getMatch(id: string): Promise<MatchResult | null> {
  const filePath = path.join(process.cwd(), "public", "data", "matches.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const matches: MatchResult[] = JSON.parse(raw);
  return matches.find((m) => m.match_id.toString() === id) || null;
}

async function getMatchEvents(id: string): Promise<MatchEvent[]> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "match_events", `${id}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const KEY_EVENT_TYPES = ["Shot", "Goal", "Card", "Substitution", "Foul Committed"];

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const match = await getMatch(params.id);
  const events = await getMatchEvents(params.id);

  // Key events (goals, cards, subs) for timeline
  const keyEvents = events.filter((e) =>
    KEY_EVENT_TYPES.includes(e.event_type) ||
    (e.event_type === "Shot" && e.outcome === "Goal")
  ).slice(0, 50);

  const goals = events.filter((e) => e.event_type === "Shot" && e.outcome === "Goal");
  const shots = events.filter((e) => e.event_type === "Shot");
  const passes = events.filter((e) => e.event_type === "Pass");

  // Team stats from events
  const homeTeamName = match?.home_team_name || "";
  const awayTeamName = match?.away_team_name || "";

  const homeShotsOn = shots.filter((e) => e.team_name === homeTeamName).length;
  const awayShotsOn = shots.filter((e) => e.team_name === awayTeamName).length;
  const homePasses = passes.filter((e) => e.team_name === homeTeamName).length;
  const awayPasses = passes.filter((e) => e.team_name === awayTeamName).length;

  if (!match) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-xl">Match not found</p>
        <Link href="/results" className="text-[#00ff85] mt-4 inline-block">← Back to Results</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/results" className="text-gray-400 hover:text-[#00ff85] text-sm transition-colors">
          ← Results
        </Link>
      </div>

      {/* Match header card */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="text-center mb-4">
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            Matchday {match.matchday} · {formatDate(match.match_date)}
          </span>
        </div>

        <div className="flex items-center justify-center gap-6">
          {/* Home team */}
          <div className="flex flex-col items-center gap-2 flex-1 text-right">
            <TeamBadge teamName={match.home_team_name} size="lg" />
            <span className="font-bold text-white text-lg">{match.home_team_name}</span>
            <span className={`text-sm font-medium ${
              match.home_result === "W" ? "text-green-400" :
              match.home_result === "D" ? "text-gray-400" : "text-red-400"
            }`}>
              {match.home_result === "W" ? "Win" : match.home_result === "D" ? "Draw" : "Loss"}
            </span>
          </div>

          {/* Score */}
          <div className="text-center">
            <div className="flex items-center gap-3">
              <span className="text-6xl font-black text-white">{match.home_score}</span>
              <span className="text-2xl text-gray-500">–</span>
              <span className="text-6xl font-black text-white">{match.away_score}</span>
            </div>
            <div className="text-gray-400 text-xs mt-1">Full Time</div>
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadge teamName={match.away_team_name} size="lg" />
            <span className="font-bold text-white text-lg">{match.away_team_name}</span>
            <span className={`text-sm font-medium ${
              match.away_result === "W" ? "text-green-400" :
              match.away_result === "D" ? "text-gray-400" : "text-red-400"
            }`}>
              {match.away_result === "W" ? "Win" : match.away_result === "D" ? "Draw" : "Loss"}
            </span>
          </div>
        </div>

        {/* Goal scorers */}
        {goals.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-3 justify-center">
            {goals.map((g, i) => (
              <span key={i} className="text-sm text-gray-300">
                ⚽ {g.player_name} <span className="text-gray-500">{g.minute}min</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Match stats */}
        {events.length > 0 && (
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">Match Stats</h2>
            <div className="space-y-3">
              <StatBar label="Shots" home={homeShotsOn} away={awayShotsOn} />
              <StatBar label="Passes" home={homePasses} away={awayPasses} />
              <StatBar label="Goals" home={match.home_score ?? 0} away={match.away_score ?? 0} />
            </div>
            {events.length > 0 && (
              <p className="text-gray-500 text-xs mt-4 text-center">
                Based on {events.length.toLocaleString()} tracked events
              </p>
            )}
          </div>
        )}

        {/* Events timeline */}
        {events.length > 0 && (
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
              Key Events Timeline
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {keyEvents.slice(0, 30).map((e, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 text-xs w-8 text-right flex-shrink-0">
                    {e.minute}&apos;
                  </span>
                  <span className="text-base">
                    {e.event_type === "Shot" && e.outcome === "Goal" ? "⚽" :
                     e.event_type === "Shot" ? "🎯" :
                     e.event_type === "Foul Committed" ? "🟨" : "↔️"}
                  </span>
                  <div>
                    <span className="text-white">{e.player_name || "—"}</span>
                    <span className="text-gray-500 text-xs ml-1">({e.team_name?.split(" ")[0]})</span>
                    {e.event_type === "Shot" && e.outcome !== "Goal" && (
                      <span className="text-gray-500 text-xs ml-1">— {e.outcome}</span>
                    )}
                  </div>
                </div>
              ))}
              {keyEvents.length === 0 && (
                <p className="text-gray-500 text-sm">No detailed event data for this match</p>
              )}
            </div>
          </div>
        )}

        {/* No events fallback */}
        {events.length === 0 && (
          <div className="glass rounded-xl p-6 text-center lg:col-span-2">
            <span className="text-4xl block mb-3">📊</span>
            <p className="text-gray-300 font-medium">Match Detail Available</p>
            <p className="text-gray-500 text-sm mt-1">
              Detailed event data is available for Arsenal 2003-04 Invincibles matches.
            </p>
            <Link
              href="/results"
              className="inline-block mt-4 text-[#00ff85] text-sm hover:underline"
            >
              View all results →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away || 1;
  const homePct = Math.round((home / total) * 100);
  const awayPct = 100 - homePct;

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span className="font-medium text-white">{home}</span>
        <span>{label}</span>
        <span className="font-medium text-white">{away}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-700">
        <div className="bg-blue-500 rounded-l-full" style={{ width: `${homePct}%` }} />
        <div className="bg-red-500 rounded-r-full" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  );
}
