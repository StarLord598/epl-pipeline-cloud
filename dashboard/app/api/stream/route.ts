import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow long-running SSE streams (5 min)

const S3_STREAM_URL =
  process.env.STREAM_EVENTS_URL ||
  "https://epl-pipeline-dashboard-dev-606476260881.s3.us-east-2.amazonaws.com/data/stream_events.json";

interface MatchEvent {
  event_id: string;
  match_id: number;
  index_num: number;
  period: number;
  minute: number;
  second: number;
  event_type: string;
  team_name: string;
  player_name: string;
  position_name: string;
  location_x: number | null;
  location_y: number | null;
  sub_type: string | null;
  outcome: string | null;
}

// Cache the fetched data in-memory for the serverless function lifetime
let cachedEvents: Record<string, MatchEvent[]> | null = null;

async function loadEvents(): Promise<Record<string, MatchEvent[]>> {
  if (cachedEvents) return cachedEvents;
  const res = await fetch(S3_STREAM_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Failed to fetch stream events: ${res.status}`);
  cachedEvents = await res.json();
  return cachedEvents!;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const matchId = url.searchParams.get("match_id");
  const speed = Math.max(1, Math.min(parseInt(url.searchParams.get("speed") ?? "10", 10), 100));

  // If no match_id, return the match index
  if (!matchId) {
    try {
      const allEvents = await loadEvents();
      const index = (allEvents as Record<string, unknown>)["_index"];
      if (index) {
        return NextResponse.json({ _index: index });
      }
      return NextResponse.json({ error: "match_id required" }, { status: 400 });
    } catch {
      return NextResponse.json({ error: "Stream data not available" }, { status: 500 });
    }
  }

  try {
    const allEvents = await loadEvents();
    const events = allEvents[matchId];

    if (!events || events.length === 0) {
      return NextResponse.json({ error: "No events for this match" }, { status: 404 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send match metadata first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", total_events: events.length, match_id: matchId })}\n\n`));

        let prevTime = 0;
        for (let i = 0; i < events.length; i++) {
          const evt = events[i];
          const eventTime = evt.minute * 60 + evt.second;
          const delay = Math.max(0, eventTime - prevTime);
          prevTime = eventTime;

          // Wait proportional to real time, divided by speed
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, (delay * 1000) / speed));
          }

          const payload = {
            type: "event",
            index: i + 1,
            total: events.length,
            ...evt,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }

        // Send end signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "end" })}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return NextResponse.json({ error: "Stream data not available" }, { status: 500 });
  }
}
