// Data fetching utilities — reads from public/data/*.json
// In production this would be API routes calling DuckDB directly.

export interface TeamStanding {
  position: number;
  team_id: number;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  win_rate: number;
  points_pct: number;
  goals_per_game: number;
  goals_conceded_per_game: number;
  form?: string;
}

export interface MatchResult {
  match_id: number;
  matchday: number;
  match_date: string;
  home_team_id: number;
  home_team_name: string;
  away_team_id: number;
  away_team_name: string;
  home_score: number;
  away_score: number;
  winner: string;
  match_status: string;
  home_result?: string;
  away_result?: string;
}

export interface TopScorer {
  rank: number;
  player_id: number;
  player_name: string;
  team_name: string;
  goals: number;
  assists: number;
  goal_contributions: number;
  matches_played: number;
  goals_per_game: number;
  assists_per_game: number;
}

export interface MatchEvent {
  event_id: string;
  match_id: number;
  period: number;
  minute: number;
  second: number;
  event_type: string;
  player_name: string;
  team_name: string;
  position_name: string;
  location_x: number;
  location_y: number;
  outcome: string;
  sub_type: string;
}

export interface TeamPage {
  team_id: number;
  team_name: string;
  standings: TeamStanding;
  form: string;
  matches: MatchResult[];
  scorers: TopScorer[];
}

// EPL Team colors
export const TEAM_COLORS: Record<string, { primary: string; secondary: string; text: string }> = {
  "Manchester City":          { primary: "#6CABDD", secondary: "#1C2C5B", text: "#fff" },
  "Arsenal":                  { primary: "#EF0107", secondary: "#063672", text: "#fff" },
  "Liverpool":                { primary: "#C8102E", secondary: "#F6EB61", text: "#fff" },
  "Aston Villa":              { primary: "#670E36", secondary: "#95BFE5", text: "#fff" },
  "Tottenham Hotspur":        { primary: "#132257", secondary: "#FFFFFF", text: "#fff" },
  "Chelsea":                  { primary: "#034694", secondary: "#DBA111", text: "#fff" },
  "Newcastle United":         { primary: "#241F20", secondary: "#FFFFFF", text: "#fff" },
  "Manchester United":        { primary: "#DA291C", secondary: "#FBE122", text: "#fff" },
  "West Ham United":          { primary: "#7A263A", secondary: "#1BB1E7", text: "#fff" },
  "Brighton & Hove Albion":   { primary: "#0057B8", secondary: "#FFCD00", text: "#fff" },
  "Wolverhampton Wanderers":  { primary: "#FDB913", secondary: "#231F20", text: "#000" },
  "Fulham":                   { primary: "#CC0000", secondary: "#FFFFFF", text: "#fff" },
  "Brentford":                { primary: "#D20000", secondary: "#FFFFFF", text: "#fff" },
  "Crystal Palace":           { primary: "#1B458F", secondary: "#C4122E", text: "#fff" },
  "Nottingham Forest":        { primary: "#DD0000", secondary: "#FFFFFF", text: "#fff" },
  "Everton":                  { primary: "#003399", secondary: "#FFFFFF", text: "#fff" },
  "Burnley":                  { primary: "#6C1D45", secondary: "#99D6EA", text: "#fff" },
  "Bournemouth":              { primary: "#DA291C", secondary: "#000000", text: "#fff" },
  "AFC Bournemouth":          { primary: "#DA291C", secondary: "#000000", text: "#fff" },
  "Sunderland":               { primary: "#EB172B", secondary: "#000000", text: "#fff" },
  "Leeds United":             { primary: "#FFCD00", secondary: "#1D428A", text: "#000" },
};

// Team abbreviations for compact display
export const TEAM_SHORT: Record<string, string> = {
  "Manchester City":          "MCI",
  "Arsenal":                  "ARS",
  "Liverpool":                "LIV",
  "Aston Villa":              "AVL",
  "Tottenham Hotspur":        "TOT",
  "Chelsea":                  "CHE",
  "Newcastle United":         "NEW",
  "Manchester United":        "MUN",
  "West Ham United":          "WHU",
  "Brighton & Hove Albion":   "BHA",
  "Wolverhampton Wanderers":  "WOL",
  "Fulham":                   "FUL",
  "Brentford":                "BRE",
  "Crystal Palace":           "CRY",
  "Nottingham Forest":        "NFO",
  "Everton":                  "EVE",
  "Burnley":                  "BUR",
  "Bournemouth":              "BOU",
  "AFC Bournemouth":          "BOU",
  "Sunderland":               "SUN",
  "Leeds United":             "LEE",
};

/** Strip "FC", "AFC" suffixes for display and lookup */
export function stripFC(name: string): string {
  return name.replace(/ FC$/, "").replace(/^AFC /, "").trim();
}

/** Get team color, trying exact match then stripped name */
export function getTeamColor(name: string): string {
  if (TEAM_COLORS[name]) return TEAM_COLORS[name].primary;
  const stripped = stripFC(name);
  if (TEAM_COLORS[stripped]) return TEAM_COLORS[stripped].primary;
  const key = Object.keys(TEAM_COLORS).find(
    (k) => name.includes(k.split(" ")[0]) || k.includes(name.split(" ")[0])
  );
  return key ? TEAM_COLORS[key].primary : "#888";
}

/** Get team abbreviation, trying exact match then stripped name */
export function getTeamShort(name: string): string {
  if (TEAM_SHORT[name]) return TEAM_SHORT[name];
  const stripped = stripFC(name);
  if (TEAM_SHORT[stripped]) return TEAM_SHORT[stripped];
  return name.slice(0, 3).toUpperCase();
}

// Champions League / Europa spots
export const getQualificationZone = (position: number) => {
  if (position <= 4) return "champions-league";
  if (position === 5) return "europa-league";
  if (position === 6) return "conference-league";
  if (position >= 18) return "relegation";
  return null;
};
