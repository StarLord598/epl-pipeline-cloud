import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "data", "weather.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid weather data format" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Weather data not available. Run the weather ingestion pipeline." },
      { status: 404 }
    );
  }
}
