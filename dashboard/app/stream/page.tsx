"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";

interface MatchInfo {
  match_id: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  event_count: number;
}

interface StreamEvent {
  type: string;
  index?: number;
  total?: number;
  total_events?: number;
  event_type?: string;
  team_name?: string;
  player_name?: string;
  minute?: number;
  second?: number;
  sub_type?: string;
  outcome?: string;
  location_x?: number | null;
  location_y?: number | null;
  period?: number;
}

const EVENT_ICONS: Record<string, string> = {
  "Pass": "➡️",
  "Ball Receipt*": "📥",
  "Carry": "🏃",
  "Pressure": "💪",
  "Shot": "🎯",
  "Goal Keeper": "🧤",
  "Foul Committed": "⚠️",
  "Foul Won": "🤚",
  "Duel": "⚔️",
  "Clearance": "🦶",
  "Block": "🛡️",
  "Dribble": "💨",
  "Ball Recovery": "🔄",
  "Dispossessed": "❌",
  "Interception": "✋",
  "Substitution": "🔄",
  "Miscontrol": "💫",
  "Dribbled Past": "😤",
};

function getIcon(eventType: string): string {
  return EVENT_ICONS[eventType] || "⚪";
}

export default function StreamPage() {
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [speed, setSpeed] = useState(10);
  const [streaming, setStreaming] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [teamStats, setTeamStats] = useState<Record<string, Record<string, number>>>({});
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [matchTime, setMatchTime] = useState("00:00");
  const [eventsPerSecond, setEventsPerSecond] = useState(0);
  const [goals, setGoals] = useState<Array<{ minute: number; second: number; player: string; team: string }>>([]);
  const [possession, setPossession] = useState<Record<string, number>>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const epsCounterRef = useRef(0);
  const epsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load match index
  useEffect(() => {
    fetch("/data/stream_events.json")
      .then((r) => r.json())
      .then((d) => {
        if (d._index) setMatches(d._index);
      })
      .catch(() => {});
  }, []);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (epsIntervalRef.current) {
      clearInterval(epsIntervalRef.current);
      epsIntervalRef.current = null;
    }
    setStreaming(false);
  }, []);

  const startStream = useCallback(() => {
    if (!selectedMatch) return;
    stopStream();
    setEvents([]);
    setStats({});
    setTeamStats({});
    setGoals([]);
    setPossession({});
    setProgress({ current: 0, total: 0 });
    setMatchTime("00:00");
    setEventsPerSecond(0);
    epsCounterRef.current = 0;

    const es = new EventSource(`/api/stream?match_id=${selectedMatch}&speed=${speed}`);
    eventSourceRef.current = es;
    setStreaming(true);

    // EPS counter
    epsIntervalRef.current = setInterval(() => {
      setEventsPerSecond(epsCounterRef.current);
      epsCounterRef.current = 0;
    }, 1000);

    es.onmessage = (e) => {
      const data: StreamEvent = JSON.parse(e.data);

      if (data.type === "meta") {
        setProgress((p) => ({ ...p, total: data.total_events || 0 }));
        return;
      }

      if (data.type === "end") {
        stopStream();
        return;
      }

      epsCounterRef.current++;

      setEvents((prev) => {
        const next = [data, ...prev];
        return next.slice(0, 100); // Keep last 100 in feed
      });

      setProgress((p) => ({ ...p, current: data.index || 0 }));

      if (data.minute !== undefined && data.second !== undefined) {
        const m = String(data.minute).padStart(2, "0");
        const s = String(data.second).padStart(2, "0");
        setMatchTime(`${m}:${s}`);
      }

      // Update stats
      if (data.event_type) {
        setStats((prev) => ({
          ...prev,
          [data.event_type!]: (prev[data.event_type!] || 0) + 1,
        }));

        // Track goals
        if (data.event_type === "Shot" && data.outcome === "Goal") {
          setGoals((prev) => [...prev, {
            minute: data.minute ?? 0,
            second: data.second ?? 0,
            player: data.player_name ?? "Unknown",
            team: data.team_name ?? "Unknown",
          }]);
        }
      }

      // Track possession (ball-touch events)
      if (data.team_name && ["Pass", "Carry", "Ball Receipt*", "Dribble", "Shot"].includes(data.event_type || "")) {
        setPossession((prev) => ({
          ...prev,
          [data.team_name!]: (prev[data.team_name!] || 0) + 1,
        }));
      }

      // Update team stats
      if (data.team_name && data.event_type) {
        setTeamStats((prev) => {
          const team = data.team_name!;
          const existing = prev[team] || {};
          return {
            ...prev,
            [team]: { ...existing, [data.event_type!]: (existing[data.event_type!] || 0) + 1 },
          };
        });
      }
    };

    es.onerror = () => stopStream();
  }, [selectedMatch, speed, stopStream]);

  // Cleanup on unmount
  useEffect(() => () => stopStream(), [stopStream]);

  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  // Match info available for future use: matches.find(m => String(m.match_id) === selectedMatch)

  // Top event types for display
  const topStats = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Team names for comparison
  const teamNames = Object.keys(teamStats);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📡</span>
            <div>
              <h1 className="text-2xl font-bold text-white">Streaming Match Replay</h1>
              <p className="text-gray-400 text-sm">
                Server-Sent Events · Real-time event streaming · Producer → Consumer pattern
              </p>
            </div>
          </div>
          <DataSourceBadge
            pattern="Event Streaming (SSE)"
            source="StatsBomb Events (129K) → SSE Producer → Dashboard Consumer"
            explanation="True streaming pattern via Server-Sent Events. A producer replays historical match events over a persistent HTTP connection — the dashboard consumes them in real-time without polling. Same concept as Kafka producer → consumer, but built with SSE for local demo. Events arrive with real match timing (adjustable speed), demonstrating event-driven architecture."
          />
        </div>

        {/* Controls */}
        <div className="glass rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Match</label>
              <select
                value={selectedMatch}
                onChange={(e) => setSelectedMatch(e.target.value)}
                disabled={streaming}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-[#00ff85] focus:outline-none"
              >
                <option value="">Select a match...</option>
                {matches.map((m) => (
                  <option key={m.match_id} value={m.match_id}>
                    {m.home_team} {m.home_score}-{m.away_score} {m.away_team} ({m.event_count.toLocaleString()} events)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Speed</label>
              <div className="flex gap-1">
                {[1, 5, 10, 25, 50].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    disabled={streaming}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                      speed === s ? "bg-[#00ff85] text-[#38003c]" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={startStream}
                disabled={!selectedMatch || streaming}
                className="px-6 py-2 rounded-lg font-medium text-sm bg-[#00ff85] text-[#38003c] hover:bg-[#00cc6a] disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                {streaming ? "Streaming..." : "▶ Start"}
              </button>
              <button
                onClick={stopStream}
                disabled={!streaming}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                ■ Stop
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {progress.total > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} events</span>
                <span>{pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00ff85] rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-3xl font-mono font-bold text-[#00ff85]">{matchTime}</div>
            <div className="text-xs text-gray-400 mt-1">Match Time</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-white">{progress.current.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Events Received</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">{eventsPerSecond}</div>
            <div className="text-xs text-gray-400 mt-1">Events/sec</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">{stats["Shot"] || 0}</div>
            <div className="text-xs text-gray-400 mt-1">Shots</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-purple-400">{stats["Pass"] || 0}</div>
            <div className="text-xs text-gray-400 mt-1">Passes</div>
          </div>
        </div>

        {/* Scoreboard + Possession */}
        {teamNames.length === 2 && (
          <div className="glass rounded-xl p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Live Score */}
              <div>
                <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">⚽ Scoreboard</h2>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{teamNames[0]}</div>
                    <div className="text-4xl font-black text-[#00ff85]">
                      {goals.filter(g => g.team === teamNames[0]).length}
                    </div>
                  </div>
                  <div className="text-2xl text-gray-500">—</div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{teamNames[1]}</div>
                    <div className="text-4xl font-black text-[#00ff85]">
                      {goals.filter(g => g.team === teamNames[1]).length}
                    </div>
                  </div>
                </div>
                {goals.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {goals.map((g, i) => (
                      <div key={i} className="text-xs text-center text-gray-400">
                        ⚽ <span className="text-white font-medium">{g.player}</span>
                        <span className="text-gray-500"> ({g.team}) {g.minute}&apos;</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Possession */}
              <div>
                <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">📊 Possession</h2>
                {(() => {
                  const t1 = possession[teamNames[0]] || 0;
                  const t2 = possession[teamNames[1]] || 0;
                  const total = t1 + t2 || 1;
                  const pct1 = ((t1 / total) * 100).toFixed(1);
                  const pct2 = ((t2 / total) * 100).toFixed(1);
                  return (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-blue-400 font-bold">{pct1}%</span>
                        <span className="text-red-400 font-bold">{pct2}%</span>
                      </div>
                      <div className="flex h-6 rounded-full overflow-hidden bg-gray-800">
                        <div
                          className="bg-blue-500 transition-all duration-500 flex items-center justify-center"
                          style={{ width: `${pct1}%` }}
                        >
                          {parseFloat(pct1) > 15 && <span className="text-[10px] text-white font-bold">{teamNames[0]}</span>}
                        </div>
                        <div
                          className="bg-red-500 transition-all duration-500 flex items-center justify-center"
                          style={{ width: `${pct2}%` }}
                        >
                          {parseFloat(pct2) > 15 && <span className="text-[10px] text-white font-bold">{teamNames[1]}</span>}
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{t1.toLocaleString()} touches</span>
                        <span>{t2.toLocaleString()} touches</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Event Feed */}
          <div className="lg:col-span-2 glass rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Live Event Feed
              {streaming && <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />}
            </h2>
            <div ref={feedRef} className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
              {events.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">
                  {streaming ? "Waiting for events..." : "Select a match and press Start"}
                </p>
              ) : (
                events.map((evt, i) => (
                  <div
                    key={`${evt.index}-${i}`}
                    className={`flex items-center gap-3 px-3 py-1.5 rounded text-sm transition-all ${
                      i === 0 ? "bg-[#00ff85]/10 border border-[#00ff85]/20" : "bg-gray-900/50"
                    }`}
                  >
                    <span className="text-xs text-gray-500 font-mono w-12">
                      {String(evt.minute ?? 0).padStart(2, "0")}:{String(evt.second ?? 0).padStart(2, "0")}
                    </span>
                    <span className="text-base w-6">{getIcon(evt.event_type || "")}</span>
                    <span className="text-gray-300 flex-1">
                      <span className="font-medium text-white">{evt.event_type}</span>
                      {evt.player_name && <span className="text-gray-400"> — {evt.player_name}</span>}
                      {evt.team_name && <span className="text-gray-500"> ({evt.team_name})</span>}
                      {evt.outcome && <span className="text-gray-500 text-xs ml-1">[{evt.outcome}]</span>}
                    </span>
                    <span className="text-xs text-gray-600">#{evt.index}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats Panel */}
          <div className="space-y-4">
            {/* Event breakdown */}
            <div className="glass rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Event Breakdown</h2>
              <div className="space-y-2">
                {topStats.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-6 text-center">{getIcon(type)}</span>
                    <span className="text-sm text-gray-300 flex-1">{type}</span>
                    <span className="text-sm font-mono text-white">{count}</span>
                    <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00ff85] rounded-full"
                        style={{ width: `${(count / (topStats[0]?.[1] || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team comparison */}
            {teamNames.length === 2 && (
              <div className="glass rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Team Comparison</h2>
                {["Pass", "Shot", "Duel", "Foul Committed", "Ball Recovery"].map((stat) => {
                  const t1 = teamStats[teamNames[0]]?.[stat] || 0;
                  const t2 = teamStats[teamNames[1]]?.[stat] || 0;
                  const total = t1 + t2 || 1;
                  return (
                    <div key={stat} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-blue-400">{t1}</span>
                        <span className="text-gray-500">{stat}</span>
                        <span className="text-red-400">{t2}</span>
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800">
                        <div className="bg-blue-500" style={{ width: `${(t1 / total) * 100}%` }} />
                        <div className="bg-red-500" style={{ width: `${(t2 / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{teamNames[0]}</span>
                  <span>{teamNames[1]}</span>
                </div>
              </div>
            )}

            {/* Architecture note */}
            <div className="glass rounded-xl p-4 border border-gray-700/50">
              <h2 className="text-sm font-semibold text-gray-300 mb-2">🏗️ Architecture</h2>
              <div className="text-xs text-gray-400 space-y-1 font-mono">
                <p>Producer: Next.js SSE endpoint</p>
                <p>Transport: EventSource (HTTP/1.1)</p>
                <p>Consumer: React state updates</p>
                <p>Pattern: Event-driven streaming</p>
                <p className="text-gray-500 mt-2">Production equiv: Kafka → Flink → Sink</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
