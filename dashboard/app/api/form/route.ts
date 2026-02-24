import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

/**
 * GET /api/form?team=Arsenal&momentum=HOT
 * Rolling 5-game form and momentum data
 * Query params:
 *   - team: filter by team name (optional)
 *   - momentum: filter by momentum tier (HOT|STEADY|COOLING|COLD) (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "rolling_form.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Form data not available" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const { searchParams } = new URL(request.url);

    const team = searchParams.get("team");
    if (team) {
      const teamVal = team.slice(0, 100);
      data = data.filter((r) => r.team_name.toLowerCase() === teamVal.toLowerCase());
    }

    const momentum = searchParams.get("momentum");
    if (momentum) {
      const momentumVal = momentum.slice(0, 20).toUpperCase();
      data = data.filter((r) => r.current_momentum === momentumVal);
    }

    return NextResponse.json({
      count: data.length,
      data,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[/api/form]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
