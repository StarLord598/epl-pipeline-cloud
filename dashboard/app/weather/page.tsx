"use client";

import { useEffect, useState } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";

interface StadiumWeather {
  team_name: string;
  stadium_name: string;
  latitude: number;
  longitude: number;
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_speed_kmh: number | null;
  precipitation_mm: number | null;
  weather_code: number | null;
  weather_description: string | null;
  pitch_condition: string | null;
  temperature_class: string | null;
  team_tier: string | null;
  current_position: number | null;
  fetched_at: string | null;
}

function weatherEmoji(code: number | null): string {
  if (code === null) return "❓";
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 86) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

function pitchColor(condition: string | null): string {
  switch (condition) {
    case "Excellent": return "border-green-500 bg-green-500/10";
    case "Good": return "border-emerald-400 bg-emerald-400/10";
    case "Moderate (Drizzle)": return "border-yellow-400 bg-yellow-400/10";
    case "Poor (Fog)": return "border-gray-400 bg-gray-400/10";
    case "Poor (Rain)": return "border-blue-400 bg-blue-400/10";
    case "Poor (Snow)": return "border-white bg-white/10";
    case "Poor (Showers)": return "border-blue-500 bg-blue-500/10";
    case "Dangerous (Storm)": return "border-red-500 bg-red-500/10";
    default: return "border-gray-600 bg-gray-600/10";
  }
}

export default function WeatherPage() {
  const [data, setData] = useState<StadiumWeather[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/weather.json")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#00ff85]/30 border-t-[#00ff85] animate-spin" />
          <span className="text-gray-500 text-sm">Loading weather data...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-lg">No weather data available. Run the weather ingestion pipeline first.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
        <div className="page-header">
          <div className="flex items-center gap-4 mb-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <span className="text-2xl">🌤️</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Stadium Weather</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Real-time weather at all 20 EPL stadiums via Open-Meteo API
              </p>
            </div>
          </div>
          <DataSourceBadge
            pattern="Near Real-Time Polling"
            source="Gold: mart_stadium_weather → stg_stadium_weather → raw.stadium_weather"
            explanation="Micro-batch ingestion — Open-Meteo API polled every 5 min via Airflow DAG for all 20 stadiums. Bronze stores full history (append-only), Silver deduplicates to latest per stadium, Gold enriches with pitch conditions + team dimension. Not true streaming (no persistent connection) — this is scheduled polling, distinct from the SSE pattern on the Stream page."
          />
          {data[0]?.fetched_at && (
            <p className="text-gray-500 text-sm mt-1">
              Last updated: {new Date(data[0].fetched_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-2xl p-4">
            <div className="text-2xl font-bold text-[#00ff85]">
              {data.filter(d => d.pitch_condition === "Excellent" || d.pitch_condition === "Good").length}
            </div>
            <div className="text-gray-400 text-sm">Good Conditions</div>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="text-2xl font-bold text-yellow-400">
              {data.filter(d => d.pitch_condition?.includes("Moderate")).length}
            </div>
            <div className="text-gray-400 text-sm">Moderate</div>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="text-2xl font-bold text-blue-400">
              {data.filter(d => d.pitch_condition?.includes("Poor")).length}
            </div>
            <div className="text-gray-400 text-sm">Poor Conditions</div>
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="text-2xl font-bold text-white">
              {data.length > 0
                ? ((data.reduce((sum, d) => sum + (d.temperature_c ?? 0), 0) / data.length) * 9/5 + 32).toFixed(1)
                : "—"
              }°F
            </div>
            <div className="text-gray-400 text-sm">Avg Temperature</div>
          </div>
        </div>

        {/* Stadium cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.map((stadium) => (
            <div
              key={stadium.team_name}
              className={`rounded-2xl p-4 border glass transition-all hover:scale-[1.02] ${pitchColor(stadium.pitch_condition)}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white">{stadium.team_name}</h3>
                  <p className="text-gray-400 text-xs">{stadium.stadium_name}</p>
                </div>
                <span className="text-3xl">{weatherEmoji(stadium.weather_code)}</span>
              </div>

              {/* Weather details */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">🌡️ Temperature</span>
                  <span className="font-semibold">
                    {stadium.temperature_c !== null ? `${(stadium.temperature_c * 9/5 + 32).toFixed(1)}°F` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">💧 Humidity</span>
                  <span className="font-semibold">
                    {stadium.humidity_pct !== null ? `${stadium.humidity_pct}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">💨 Wind</span>
                  <span className="font-semibold">
                    {stadium.wind_speed_kmh !== null ? `${stadium.wind_speed_kmh.toFixed(1)} km/h` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">🌧️ Precipitation</span>
                  <span className="font-semibold">
                    {stadium.precipitation_mm !== null ? `${stadium.precipitation_mm} mm` : "—"}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  stadium.pitch_condition === "Excellent" ? "bg-green-500/20 text-green-400" :
                  stadium.pitch_condition === "Good" ? "bg-emerald-500/20 text-emerald-400" :
                  stadium.pitch_condition?.includes("Moderate") ? "bg-yellow-500/20 text-yellow-400" :
                  stadium.pitch_condition?.includes("Poor") ? "bg-blue-500/20 text-blue-400" :
                  stadium.pitch_condition?.includes("Dangerous") ? "bg-red-500/20 text-red-400" :
                  "bg-gray-500/20 text-gray-400"
                }`}>
                  {stadium.pitch_condition ?? "Unknown"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300">
                  {stadium.temperature_class ?? "—"}
                </span>
                {stadium.current_position && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                    #{stadium.current_position}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
