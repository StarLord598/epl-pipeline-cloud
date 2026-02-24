import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams?tier=TITLE%20CONTENDER
 * Team dimension data with tier classification
 * Query params:
 *   - tier: filter by tier (optional)
 *   - team: filter by team name (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "dim_teams.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Teams data not available" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const { searchParams } = new URL(request.url);

    const tier = searchParams.get("tier");
    if (tier) {
      data = data.filter((r) => r.tier === tier.toUpperCase());
    }

    const team = searchParams.get("team");
    if (team) {
      data = data.filter((r) => r.team_name.toLowerCase() === team.toLowerCase());
    }

    return NextResponse.json({
      count: data.length,
      data,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[/api/teams]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
