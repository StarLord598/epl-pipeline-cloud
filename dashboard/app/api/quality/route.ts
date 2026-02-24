import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

/**
 * GET /api/quality
 * Data quality metrics: test results, freshness, table inventory
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "quality.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Quality data not available" }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("[/api/quality]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
