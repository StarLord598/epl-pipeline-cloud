import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

/**
 * GET /api/standings/history?team=Arsenal
 * SCD2 position history — pure implementation
 * Only returns rows where position changed (each row = one version)
 * Query params:
 *   - team: filter by team name (optional)
 *   - current_only: if "true", only return current active versions
 *   - matchday: find which version was active at a given matchday (point-in-time query)
 */
export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "scd2_standings.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "SCD2 data not available" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const { searchParams } = new URL(request.url);

    const team = searchParams.get("team");
    if (team) {
      const teamVal = team.slice(0, 100);
      data = data.filter((r) => r.team_name.toLowerCase() === teamVal.toLowerCase());
    }

    // Point-in-time query: find which version was active at a specific matchday
    const matchday = searchParams.get("matchday");
    if (matchday) {
      const mdVal = parseInt(matchday, 10);
      if (!isNaN(mdVal)) {
        const clamped = Math.max(1, Math.min(mdVal, 38));
        data = data.filter((r) => r.valid_from_matchday <= clamped && r.valid_to_matchday >= clamped);
      }
    }

    const currentOnly = searchParams.get("current_only");
    if (currentOnly === "true") {
      data = data.filter((r) => r.is_current);
    }

    return NextResponse.json({
      count: data.length,
      data,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[/api/standings/history]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
