import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STADIUMS = [
  { team_name: "Arsenal", lat: 51.5549, lon: -0.1084 },
  { team_name: "Aston Villa", lat: 52.5092, lon: -1.8847 },
  { team_name: "Bournemouth", lat: 50.7352, lon: -1.8384 },
  { team_name: "Brentford", lat: 51.4907, lon: -0.2886 },
  { team_name: "Brighton", lat: 50.8616, lon: -0.0834 },
  { team_name: "Chelsea", lat: 51.4817, lon: -0.191 },
  { team_name: "Crystal Palace", lat: 51.3983, lon: -0.0856 },
  { team_name: "Everton", lat: 53.4388, lon: -2.9663 },
  { team_name: "Fulham", lat: 51.475, lon: -0.2217 },
  { team_name: "Burnley", lat: 53.789, lon: -2.2302 },
  { team_name: "Leeds United", lat: 53.7779, lon: -1.5722 },
  { team_name: "Liverpool", lat: 53.4308, lon: -2.9609 },
  { team_name: "Manchester City", lat: 53.4831, lon: -2.2004 },
  { team_name: "Manchester United", lat: 53.4631, lon: -2.2913 },
  { team_name: "Newcastle United", lat: 54.9756, lon: -1.6217 },
  { team_name: "Nottingham Forest", lat: 52.94, lon: -1.1325 },
  { team_name: "Sunderland AFC", lat: 54.9146, lon: -1.3882 },
  { team_name: "Tottenham", lat: 51.6042, lon: -0.0662 },
  { team_name: "West Ham", lat: 51.5387, lon: -0.0166 },
  { team_name: "Wolverhampton", lat: 52.5903, lon: -2.1306 },
];

export async function GET() {
  try {
    const lats = STADIUMS.map((s) => s.lat).join(",");
    const lons = STADIUMS.map((s) => s.lon).join(",");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=Europe/London`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
    const data = await res.json();

    const results = STADIUMS.map((stadium, i) => {
      const current = Array.isArray(data) ? data[i]?.current : data.current;
      return {
        team_name: stadium.team_name,
        temperature_c: current?.temperature_2m ?? null,
        humidity_pct: current?.relative_humidity_2m ?? null,
        wind_speed_kmh: current?.wind_speed_10m ?? null,
        precipitation_mm: current?.precipitation ?? null,
        weather_code: current?.weather_code ?? null,
        fetched_at: current?.time ?? new Date().toISOString(),
      };
    });

    return NextResponse.json({
      status: "ok",
      fetched_at: new Date().toISOString(),
      count: results.length,
      data: results,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: String(err) },
      { status: 500 }
    );
  }
}
