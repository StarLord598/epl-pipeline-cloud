# EPL Analytics Pipeline — API Reference

Base URL: `http://localhost:3000/api`

All endpoints return JSON. Responses include `Cache-Control` headers for client-side caching.

---

## League Table

### `GET /api/league-table`

Returns the current 2025-26 EPL standings.

**Response:** Array of 20 team objects, ordered by position.

```json
[
  {
    "position": 1,
    "team_name": "Arsenal",
    "played": 27,
    "won": 19,
    "drawn": 3,
    "lost": 5,
    "goals_for": 52,
    "goals_against": 24,
    "goal_difference": 28,
    "points": 60,
    "form": "W,W,D,W,D",
    "qualification_zone": "champions_league"
  }
]
```

---

## Standings History (SCD2)

### `GET /api/standings/history`

Returns SCD Type 2 position history — pure versioned implementation. Only contains rows where a team's position **changed**. Consecutive matchdays at the same position are collapsed into a single row with `valid_from`/`valid_to` boundaries.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `team` | string | Filter by team name (case-insensitive) |
| `matchday` | integer | Point-in-time query — returns which version was active at that matchday |
| `current_only` | boolean | If `true`, only return the current active version per team |

**Examples:**
```bash
# Arsenal's full version history
GET /api/standings/history?team=Arsenal

# What position was every team in on matchday 15?
GET /api/standings/history?matchday=15

# Current standings (latest active version per team)
GET /api/standings/history?current_only=true
```

**Response:**
```json
{
  "count": 5,
  "data": [
    {
      "team_name": "Arsenal",
      "position": 6,
      "valid_from_matchday": 1,
      "valid_to_matchday": 1,
      "valid_from_date": "2025-08-16",
      "valid_to_date": "2025-08-16",
      "points": 3,
      "played": 1,
      "matchdays_held": 1,
      "prev_position": null,
      "movement": "NEW",
      "is_current": false
    },
    {
      "team_name": "Arsenal",
      "position": 1,
      "valid_from_matchday": 7,
      "valid_to_matchday": 31,
      "valid_from_date": "2025-10-04",
      "valid_to_date": "2026-02-22",
      "points": 61,
      "played": 22,
      "matchdays_held": 25,
      "prev_position": 2,
      "movement": "UP",
      "is_current": true
    }
  ]
}
```

---

## Points Race

### `GET /api/race`

Returns cumulative points per team per matchday — designed for line chart visualization.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `teams` | string | Comma-separated team names |
| `from` | integer | Start matchday |
| `to` | integer | End matchday |

**Example:**
```bash
GET /api/race?teams=Arsenal,Chelsea&from=1&to=15
```

**Response:**
```json
{
  "count": 30,
  "data": [
    {
      "team_name": "Arsenal",
      "matchday": 1,
      "matchday_points": 3,
      "cumulative_points": 3
    }
  ]
}
```

---

## Rolling Form

### `GET /api/form`

Returns rolling 5-game form data with momentum classification.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `team` | string | Filter by team name |
| `momentum` | string | Filter by tier: `HOT`, `STEADY`, `COOLING`, `COLD` |

**Momentum Tiers:**
| Tier | PPG Range | Meaning |
|------|-----------|---------|
| HOT | ≥ 2.2 | Title/European form |
| STEADY | ≥ 1.5 | Solid mid-table pace |
| COOLING | ≥ 0.8 | Dropping results |
| COLD | < 0.8 | Relegation form |

**Example:**
```bash
GET /api/form?momentum=HOT
```

**Response:**
```json
{
  "count": 5,
  "data": [
    {
      "team_name": "Manchester City",
      "matchday": 27,
      "last_5_form": "WDWWW",
      "rolling_5_ppg": 2.6,
      "rolling_5_goals_scored": 2.4,
      "rolling_5_goals_conceded": 0.8,
      "current_momentum": "HOT"
    }
  ]
}
```

---

## Teams Dimension

### `GET /api/teams`

Returns the team dimension with tier classification and season metrics.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `team` | string | Filter by team name |
| `tier` | string | Filter by tier: `TITLE CONTENDER`, `EUROPEAN HOPEFUL`, `MID-TABLE`, `RELEGATION BATTLE`, `RELEGATION ZONE` |

**Example:**
```bash
GET /api/teams?tier=TITLE+CONTENDER
```

---

## Data Quality

### `GET /api/quality`

Returns pipeline health metrics: test results, freshness SLAs, and table inventory.

**Response:**
```json
{
  "generated_at": "2026-02-23T19:07:42Z",
  "summary": {
    "total_tables": 32,
    "bronze_tables": 6,
    "silver_tables": 17,
    "gold_tables": 9,
    "total_rows": 135420
  },
  "tests": {
    "total": 29,
    "passed": 29,
    "failed": 0,
    "warned": 0
  },
  "freshness": [
    {
      "table": "raw.live_matches",
      "last_updated": "2026-02-23T18:45:00",
      "sla_hours": 1
    }
  ]
}
```

---

## Live Matches

### `GET /api/live`

Returns current live/recent match data (yesterday through 2 days ahead).

---

## Match History

### `GET /api/matches`

Returns full match results.

---

## Top Scorers

### `GET /api/scorers`

Returns top scorers with goals, assists, and per-game metrics.

---

## Stadium Weather

### `GET /api/weather`

Returns current weather conditions at all 20 EPL stadiums.

**Response fields:** `team_name`, `stadium_name`, `latitude`, `longitude`, `temperature_c`, `humidity_pct`, `wind_speed_kmh`, `precipitation_mm`, `weather_code`, `weather_description`, `pitch_condition`, `temperature_class`, `team_tier`, `current_position`, `fetched_at`

**Data source:** Open-Meteo API (free, no key required). Weather codes follow WMO standard.

---

## Streaming Match Replay

### `GET /api/stream` (Server-Sent Events)

Streams historical match events in real-time via SSE. Connect with `EventSource` — events are pushed with real match timing, adjustable by speed multiplier.

**Query params:**
- `match_id` (required) — Match ID from the stream events index
- `speed` (optional, default 10) — Playback speed multiplier (1-100). 1x = real-time, 50x = ~2 min for a full match

**SSE event types:**
- `meta` — Initial payload with `total_events` count
- `event` — Match event with `event_type`, `team_name`, `player_name`, `minute`, `second`, `location_x/y`, `outcome`
- `end` — Stream complete

**Example:**
```javascript
const es = new EventSource("/api/stream?match_id=3749358&speed=25");
es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === "event") {
    console.log(`${data.minute}' ${data.event_type} — ${data.player_name}`);
  }
};
```

**Dashboard features:** Live scoreboard (goal detection), real-time possession bar (ball-touch events), event feed, team comparison stats, events/sec throughput meter.

**Architecture pattern:** Producer (Next.js SSE endpoint) → Transport (EventSource/HTTP) → Consumer (React state). Production equivalent: Kafka producer → topic → Flink/Spark consumer → sink.
