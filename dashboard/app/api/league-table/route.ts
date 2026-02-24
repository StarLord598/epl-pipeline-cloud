import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Prefer live standings (current season)
    const livePath = path.join(process.cwd(), "public", "data", "live_standings.json");
    if (fs.existsSync(livePath)) {
      const data = JSON.parse(fs.readFileSync(livePath, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data, {
          headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
        });
      }
    }

    // Fallback to historical league_table.json
    const fallbackPath = path.join(process.cwd(), "public", "data", "league_table.json");
    if (fs.existsSync(fallbackPath)) {
      const data = JSON.parse(fs.readFileSync(fallbackPath, "utf-8"));
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
      });
    }

    return NextResponse.json([], { status: 200 });
  } catch (error) {
    console.error("[/api/league-table]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to fetch league table" }, { status: 500 });
  }
}
