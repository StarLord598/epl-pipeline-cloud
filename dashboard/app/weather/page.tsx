"use client";

import { useEffect, useState } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";

/* ── static stadium data (coords + names) ── */
const STADIUMS = [
  { team_name: "Arsenal", stadium_name: "Emirates Stadium", lat: 51.5549, lon: -0.1084 },
  { team_name: "Aston Villa", stadium_name: "Villa Park", lat: 52.5092, lon: -1.8847 },
  { team_name: "Bournemouth", stadium_name: "Vitality Stadium", lat: 50.7352, lon: -1.8384 },
  { team_name: "Brentford", stadium_name: "Gtech Community Stadium", lat: 51.4907, lon: -0.2886 },
  { team_name: "Brighton", stadium_name: "Amex Stadium", lat: 50.8616, lon: -0.0834 },
  { team_name: "Chelsea", stadium_name: "Stamford Bridge", lat: 51.4817, lon: -0.191 },
  { team_name: "Crystal Palace", stadium_name: "Selhurst Park", lat: 51.3983, lon: -0.0856 },
  { team_name: "Everton", stadium_name: "Goodison Park", lat: 53.4388, lon: -2.9663 },
  { team_name: "Fulham", stadium_name: "Craven Cottage", lat: 51.475, lon: -0.2217 },
  { team_name: "Ipswich Town", stadium_name: "Portman Road", lat: 52.0545, lon: 1.1447 },
  { team_name: "Leicester City", stadium_name: "King Power Stadium", lat: 52.6203, lon: -1.1421 },
  { team_name: "Liverpool", stadium_name: "Anfield", lat: 53.4308, lon: -2.9609 },
  { team_name: "Manchester City", stadium_name: "Etihad Stadium", lat: 53.4831, lon: -2.2004 },
  { team_name: "Manchester United", stadium_name: "Old Trafford", lat: 53.4631, lon: -2.2913 },
  { team_name: "Newcastle United", stadium_name: "St James' Park", lat: 54.9756, lon: -1.6217 },
  { team_name: "Nottingham Forest", stadium_name: "City Ground", lat: 52.94, lon: -1.1325 },
  { team_name: "Southampton", stadium_name: "St Mary's Stadium", lat: 50.9058, lon: -1.3911 },
  { team_name: "Tottenham", stadium_name: "Tottenham Hotspur Stadium", lat: 51.6042, lon: -0.0662 },
  { team_name: "West Ham", stadium_name: "London Stadium", lat: 51.5387, lon: -0.0166 },
  { team_name: "Wolverhampton", stadium_name: "Molineux Stadium", lat: 52.5903, lon: -2.1306 },
];

interface StadiumWeather {
  team_name: string;
  stadium_name: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_speed_kmh: number | null;
  precipitation_mm: number | null;
  weather_code: number | null;
  weather_description: string | null;
  pitch_condition: string | null;
  temperature_class: string | null;
  fetched_at: string | null;
}

/* ── WMO weather code → description ── */
function weatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 55) return "Drizzle";
  if (code <= 57) return "Freezing drizzle";
  if (code <= 65) return "Rain";
  if (code <= 67) return "Freezing rain";
  if (code <= 75) return "Snow";
  if (code <= 77) return "Snow grains";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown";
}

/* ── derive pitch condition from weather ── */
function derivePitchCondition(code: number, precip: number, temp: number): string {
  if (code >= 95) return "Dangerous (Storm)";
  if (code >= 71 && code <= 86) return "Poor (Snow)";
  if (code >= 61 && code <= 67) return "Poor (Rain)";
  if (code >= 80 && code <= 82) return "Poor (Showers)";
  if (code >= 45 && code <= 48) return "Poor (Fog)";
  if (code >= 51 && code <= 57) return "Moderate (Drizzle)";
  if (precip > 0.5) return "Moderate (Drizzle)";
  if (temp < 2) return "Moderate (Drizzle)";
  if (code <= 1) return "Excellent";
  return "Good";
}

function deriveTemperatureClass(temp: number): string {
  if (temp < 0) return "Freezing";
  if (temp < 5) return "Cold";
  if (temp < 12) return "Cool";
  if (temp < 20) return "Mild";
  if (temp < 28) return "Warm";
  return "Hot";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLiveWeather() {
      try {
        // Build comma-separated lat/lon for Open-Meteo bulk request
        const lats = STADIUMS.map(s => s.lat).join(",");
        const lons = STADIUMS.map(s => s.lon).join(",");
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=Europe/London`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);
        const json = await res.json();

        // Open-Meteo returns an array when multiple coordinates are passed
        const results: StadiumWeather[] = STADIUMS.map((stadium, i) => {
          const current = Array.isArray(json) ? json[i].current : json.current;
          const temp = current.temperature_2m;
          const code = current.weather_code;
          const precip = current.precipitation;
          return {
            team_name: stadium.team_name,
            stadium_name: stadium.stadium_name,
            temperature_c: temp,
            humidity_pct: current.relative_humidity_2m,
            wind_speed_kmh: current.wind_speed_10m,
            precipitation_mm: precip,
            weather_code: code,
            weather_description: weatherDescription(code),
            pitch_condition: derivePitchCondition(code, precip, temp),
            temperature_class: deriveTemperatureClass(temp),
            fetched_at: current.time,
          };
        });

        setData(results);
      } catch (err) {
        console.error("Weather fetch failed:", err);
        setError("Failed to fetch live weather. Trying cached data...");
        // Fall back to static file
        try {
          const res = await fetch("/data/weather.json");
          const d = await res.json();
          setData(d);
        } catch {
          setError("No weather data available.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchLiveWeather();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#00ff85]/30 border-t-[#00ff85] animate-spin" />
          <span className="text-gray-500 text-sm">Fetching live weather data...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-lg">{error || "No weather data available."}</div>
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
                Live weather at all 20 EPL stadiums via Open-Meteo API
              </p>
            </div>
          </div>
          <DataSourceBadge
            pattern="Live API Fetch"
            source="Open-Meteo API → Client-side render"
            explanation="Weather is fetched live from Open-Meteo's free API on each page load — no storage needed. Falls back to cached JSON if the API is unavailable."
          />
          {error && <p className="text-yellow-400 text-sm mt-1">⚠️ {error}</p>}
          {data[0]?.fetched_at && (
            <p className="text-gray-500 text-sm mt-1">
              Live as of: {new Date(data[0].fetched_at).toLocaleString()}
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
                    {stadium.wind_speed_kmh !== null ? `${(stadium.wind_speed_kmh * 0.621371).toFixed(1)} mph` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">🌧️ Precipitation</span>
                  <span className="font-semibold">
                    {stadium.precipitation_mm !== null ? `${(stadium.precipitation_mm * 0.03937).toFixed(2)} in` : "—"}
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
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
