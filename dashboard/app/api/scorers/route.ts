import { NextResponse } from "next/server";
import { getTopScorers } from "@/lib/local";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(request: Request) {
  const url  = new URL(request.url);
  const raw  = parseInt(url.searchParams.get("limit") ?? "20", 10);

  if (isNaN(raw)) {
    return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
  }
  const limit = Math.max(1, Math.min(raw, 100));

  try {
    const data = await getTopScorers(limit);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[/api/scorers]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Failed to fetch top scorers" }, { status: 500 });
  }
}
