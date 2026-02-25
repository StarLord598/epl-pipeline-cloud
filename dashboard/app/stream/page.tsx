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
  "Pass": "&#10145;&#65039;",
  "Ball Receipt*": "&#128229;",
  "Carry": "&#127939;",
  "Pressure": "&#128170;",
  "Shot": "&#127919;",
  "Goal Keeper": "&#129348;",
  "Foul Committed": "&#9888;&#65039;",
  "Foul Won": "&#9995;",
  "Duel": "&#9876;&#65039;",
  "Clearance": "&#129462;",
  "Block": "&#128737;&#65039;",
  "Dribble": "&#128168;",
  "Ball Recovery": "&#128260;",
  "Dispossessed": "&#10060;",
  "Interception": "&#9995;",
  "Substitution": "&#128260;",
  "Miscontrol": "&#128171;",
  "Dribbled Past": "&#128548;",
};

function getIcon(eventType: string): string {
  return EVENT_ICONS[eventType] || "&#9898;";
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
        return next.slice(0, 100);
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

  // Top event types for display
  const topStats = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Team names for comparison
  const teamNames = Object.keys(teamStats);

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-2xl">&#128225;</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Streaming Match Replay</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Server-Sent Events · Real-time event streaming · Producer → Consumer
            </p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Event Streaming (SSE)"
          source="StatsBomb Events (129K) → Next.js SSE on ECS Fargate → Client-side real-time consumer"
          explanation="True streaming pattern via Server-Sent Events, hosted on AWS ECS Fargate. A producer replays historical match events over a persistent HTTP connection through CloudFront — the dashboard consumes them in real-time without polling. Same concept as Kafka/Kinesis producer → consumer, but built with SSE for cost-effective serverless demo. Events arrive with real match timing (adjustable speed), demonstrating event-driven architecture on cloud infrastructure."
        />
      </div>

      {/* Controls */}
      <div className="glass rounded-2xl p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
          <div className="flex-1 min-w-[200px] w-full sm:w-auto">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block font-medium">Match</label>
            <select
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
              disabled={streaming}
              className="w-full bg-white/[0.04] text-white rounded-xl px-3 py-2.5 text-sm border border-white/[0.08] focus:border-[#00ff85]/50 focus:outline-none transition-colors"
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
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block font-medium">Speed</label>
            <div className="flex gap-1">
              {[1, 5, 10, 25, 50].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  disabled={streaming}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    speed === s
                      ? "bg-[#00ff85] text-[#0a0a0f] shadow-lg shadow-[#00ff85]/20"
                      : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.06] border border-white/[0.06]"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 sm:pt-5">
            <button
              onClick={startStream}
              disabled={!selectedMatch || streaming}
              className="px-6 py-2.5 rounded-xl font-medium text-sm bg-[#00ff85] text-[#0a0a0f] hover:bg-[#00cc6a] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-[#00ff85]/20 disabled:shadow-none"
            >
              {streaming ? "Streaming..." : "Start"}
            </button>
            <button
              onClick={stopStream}
              disabled={!streaming}
              className="px-4 py-2.5 rounded-xl font-medium text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              Stop
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {progress.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
              <span className="tabular-nums">{progress.current.toLocaleString()} / {progress.total.toLocaleString()} events</span>
              <span className="tabular-nums">{pct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00ff85] to-[#00cc6a] rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Live metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6 stagger-children">
        <div className="glass rounded-xl p-4 text-center glass-hover">
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#00ff85] tabular-nums">{matchTime}</div>
          <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Match Time</div>
        </div>
        <div className="glass rounded-xl p-4 text-center glass-hover">
          <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{progress.current.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Events</div>
        </div>
        <div className="glass rounded-xl p-4 text-center glass-hover">
          <div className="text-2xl sm:text-3xl font-bold text-blue-400 tabular-nums">{eventsPerSecond}</div>
          <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Events/sec</div>
        </div>
        <div className="glass rounded-xl p-4 text-center glass-hover">
          <div className="text-2xl sm:text-3xl font-bold text-yellow-400 tabular-nums">{stats["Shot"] || 0}</div>
          <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Shots</div>
        </div>
        <div className="glass rounded-xl p-4 text-center glass-hover col-span-2 sm:col-span-1">
          <div className="text-2xl sm:text-3xl font-bold text-purple-400 tabular-nums">{stats["Pass"] || 0}</div>
          <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Passes</div>
        </div>
      </div>

      {/* Scoreboard + Possession */}
      {teamNames.length === 2 && (
        <div className="glass rounded-2xl p-4 sm:p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Score */}
            <div>
              <h2 className="text-[11px] font-medium text-gray-500 mb-3 uppercase tracking-wider">Scoreboard</h2>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-sm sm:text-lg font-bold text-white">{teamNames[0]}</div>
                  <div className="text-3xl sm:text-4xl font-black text-[#00ff85] text-glow-green tabular-nums">
                    {goals.filter(g => g.team === teamNames[0]).length}
                  </div>
                </div>
                <div className="text-2xl text-gray-600">--</div>
                <div className="text-center">
                  <div className="text-sm sm:text-lg font-bold text-white">{teamNames[1]}</div>
                  <div className="text-3xl sm:text-4xl font-black text-[#00ff85] text-glow-green tabular-nums">
                    {goals.filter(g => g.team === teamNames[1]).length}
                  </div>
                </div>
              </div>
              {goals.length > 0 && (
                <div className="mt-3 space-y-1">
                  {goals.map((g, i) => (
                    <div key={i} className="text-[11px] text-center text-gray-500">
                      <span className="text-white font-medium">{g.player}</span>
                      <span className="text-gray-600"> ({g.team}) {g.minute}&apos;</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Possession */}
            <div>
              <h2 className="text-[11px] font-medium text-gray-500 mb-3 uppercase tracking-wider">Possession</h2>
              {(() => {
                const t1 = possession[teamNames[0]] || 0;
                const t2 = possession[teamNames[1]] || 0;
                const total = t1 + t2 || 1;
                const pct1 = ((t1 / total) * 100).toFixed(1);
                const pct2 = ((t2 / total) * 100).toFixed(1);
                return (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-blue-400 font-bold tabular-nums">{pct1}%</span>
                      <span className="text-red-400 font-bold tabular-nums">{pct2}%</span>
                    </div>
                    <div className="flex h-5 rounded-full overflow-hidden bg-white/[0.04]">
                      <div
                        className="bg-blue-500/80 transition-all duration-500 flex items-center justify-center"
                        style={{ width: `${pct1}%` }}
                      >
                        {parseFloat(pct1) > 15 && <span className="text-[9px] text-white font-bold">{teamNames[0]}</span>}
                      </div>
                      <div
                        className="bg-red-500/80 transition-all duration-500 flex items-center justify-center"
                        style={{ width: `${pct2}%` }}
                      >
                        {parseFloat(pct2) > 15 && <span className="text-[9px] text-white font-bold">{teamNames[1]}</span>}
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1 tabular-nums">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Event Feed */}
        <div className="lg:col-span-2 glass rounded-2xl p-4 sm:p-5">
          <h2 className="text-[11px] font-medium text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
            Live Event Feed
            {streaming && <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />}
          </h2>
          <div ref={feedRef} className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
            {events.length === 0 ? (
              <p className="text-gray-600 text-sm py-8 text-center">
                {streaming ? "Waiting for events..." : "Select a match and press Start"}
              </p>
            ) : (
              events.map((evt, i) => (
                <div
                  key={`${evt.index}-${i}`}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all ${
                    i === 0 ? "bg-[#00ff85]/[0.06] border border-[#00ff85]/10" : "bg-white/[0.02]"
                  }`}
                >
                  <span className="text-[11px] text-gray-600 font-mono w-12 tabular-nums">
                    {String(evt.minute ?? 0).padStart(2, "0")}:{String(evt.second ?? 0).padStart(2, "0")}
                  </span>
                  <span className="text-base w-6" dangerouslySetInnerHTML={{ __html: getIcon(evt.event_type || "") }} />
                  <span className="text-gray-400 flex-1 text-xs sm:text-sm">
                    <span className="font-medium text-white">{evt.event_type}</span>
                    {evt.player_name && <span className="text-gray-500"> — {evt.player_name}</span>}
                    {evt.team_name && <span className="text-gray-600 hidden sm:inline"> ({evt.team_name})</span>}
                    {evt.outcome && <span className="text-gray-600 text-[10px] ml-1">[{evt.outcome}]</span>}
                  </span>
                  <span className="text-[10px] text-gray-700 tabular-nums">#{evt.index}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stats Panel */}
        <div className="space-y-4">
          {/* Event breakdown */}
          <div className="glass rounded-2xl p-4 sm:p-5">
            <h2 className="text-[11px] font-medium text-gray-500 mb-3 uppercase tracking-wider">Event Breakdown</h2>
            <div className="space-y-2">
              {topStats.map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm" dangerouslySetInnerHTML={{ __html: getIcon(type) }} />
                  <span className="text-xs text-gray-400 flex-1">{type}</span>
                  <span className="text-xs font-mono text-white tabular-nums">{count}</span>
                  <div className="w-16 h-1 bg-white/[0.04] rounded-full overflow-hidden">
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
            <div className="glass rounded-2xl p-4 sm:p-5">
              <h2 className="text-[11px] font-medium text-gray-500 mb-3 uppercase tracking-wider">Team Comparison</h2>
              {["Pass", "Shot", "Duel", "Foul Committed", "Ball Recovery"].map((stat) => {
                const t1 = teamStats[teamNames[0]]?.[stat] || 0;
                const t2 = teamStats[teamNames[1]]?.[stat] || 0;
                const total = t1 + t2 || 1;
                return (
                  <div key={stat} className="mb-3">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-blue-400 tabular-nums">{t1}</span>
                      <span className="text-gray-600">{stat}</span>
                      <span className="text-red-400 tabular-nums">{t2}</span>
                    </div>
                    <div className="flex h-1 rounded-full overflow-hidden bg-white/[0.04]">
                      <div className="bg-blue-500" style={{ width: `${(t1 / total) * 100}%` }} />
                      <div className="bg-red-500" style={{ width: `${(t2 / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between text-[10px] text-gray-600 mt-2">
                <span>{teamNames[0]}</span>
                <span>{teamNames[1]}</span>
              </div>
            </div>
          )}

          {/* Architecture note */}
          <div className="glass rounded-2xl p-4 sm:p-5 border border-white/[0.06]">
            <h2 className="text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-wider">Architecture</h2>
            <div className="text-[11px] text-gray-500 space-y-1 font-mono">
              <p>Producer: Next.js SSE on ECS Fargate</p>
              <p>Transport: EventSource (HTTP/1.1)</p>
              <p>Consumer: React state updates</p>
              <p>Pattern: Event-driven streaming</p>
              <p className="text-gray-600 mt-2">Production equiv: Kafka → Flink → Sink</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
