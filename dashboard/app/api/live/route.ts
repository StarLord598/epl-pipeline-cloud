import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "data", "live_matches.json");
  
  if (!fs.existsSync(filePath)) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
    });
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}
