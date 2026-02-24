-- Gold: SCD Type 2 — League position history (pure implementation)
-- Only creates a new version when a team's position CHANGES
-- Consecutive matchdays at the same position are collapsed into one row
-- Enables: "Arsenal held 1st from GW8 to GW15, then dropped to 2nd on GW16"

with match_results as (
    -- Deduplicate to one record per match (latest ingestion wins)
    select distinct on (match_id)
        match_id,
        cast(json_extract_string(raw_json, '$.matchday') as integer) as matchday,
        home_score,
        away_score,
        cast(utc_date as date) as match_date,
        regexp_replace(regexp_replace(home_team_name, ' FC$', ''), '^AFC ', '') as home_team,
        regexp_replace(regexp_replace(away_team_name, ' FC$', ''), '^AFC ', '') as away_team
    from raw.live_matches
    where
        source = 'football-data.org'
        and status = 'FINISHED'
        and home_score is not null
    order by match_id asc, ingested_at desc
),

-- Expand each match into two team-level rows (home + away)
team_results as (
    select
        matchday,
        home_team as team,
        home_score as gf,
        away_score as ga,
        case when home_score > away_score then 3 when home_score = away_score then 1 else 0 end as pts,
        match_date
    from match_results
    union all
    select
        matchday,
        away_team as team,
        away_score as gf,
        home_score as ga,
        case when away_score > home_score then 3 when away_score = home_score then 1 else 0 end as pts,
        match_date
    from match_results
),

-- Cumulative standings at each matchday (running totals)
cumulative as (
    select
        team,
        matchday,
        sum(pts) over (partition by team order by matchday rows unbounded preceding) as cum_points,
        sum(gf) over (partition by team order by matchday rows unbounded preceding) as cum_gf,
        sum(ga) over (partition by team order by matchday rows unbounded preceding) as cum_ga,
        count(*) over (partition by team order by matchday rows unbounded preceding) as cum_played,
        max(match_date) over (partition by team order by matchday rows unbounded preceding) as matchday_date
    from team_results
),

-- Deduplicate to one row per team per matchday
per_matchday as (
    select
        team as team_name,
        matchday,
        max(cum_points) as points,
        max(cum_gf) as goals_for,
        max(cum_ga) as goals_against,
        max(cum_gf) - max(cum_ga) as goal_difference,
        max(cum_played) as played,
        max(matchday_date) as matchday_date
    from cumulative
    group by team, matchday
),

-- Rank teams at each matchday
ranked as (
    select
        *,
        row_number() over (
            partition by matchday
            order by points desc, goal_difference desc, goals_for desc, team_name asc
        ) as position
    from per_matchday
),

-- Detect position changes using LAG (compare to previous matchday)
with_prev as (
    select
        *,
        lag(position) over (partition by team_name order by matchday) as prev_position
    from ranked
),

-- Assign a version group: increment only when position changes
-- This groups consecutive matchdays at the same position together
versioned as (
    select
        *,
        sum(
            case
                when prev_position is null then 1
                when position != prev_position then 1
                else 0
            end
        ) over (partition by team_name order by matchday rows unbounded preceding) as version_group
    from with_prev
),

-- Collapse each version group into a single SCD2 row
scd2 as (
    select
        team_name,
        position,
        min(matchday) as valid_from_matchday,
        max(matchday) as valid_to_matchday,
        min(matchday_date) as valid_from_date,
        max(matchday_date) as valid_to_date,
        -- Stats at the END of this version period
        max(points) as points,
        max(played) as played,
        max(goals_for) as goals_for,
        max(goals_against) as goals_against,
        max(goal_difference) as goal_difference,
        -- Duration
        max(matchday) - min(matchday) + 1 as matchdays_held
    from versioned
    group by team_name, position, version_group
)

select
    team_name,
    position,
    valid_from_matchday,
    valid_to_matchday,
    valid_from_date,
    valid_to_date,
    points,
    played,
    goals_for,
    goals_against,
    goal_difference,
    matchdays_held,
    -- Movement from previous version
    lag(position) over (partition by team_name order by valid_from_matchday) as prev_position,
    case
        when lag(position) over (partition by team_name order by valid_from_matchday) is null then 'NEW'
        when position < lag(position) over (partition by team_name order by valid_from_matchday) then 'UP'
        when position > lag(position) over (partition by team_name order by valid_from_matchday) then 'DOWN'
        else 'SAME'
    end as movement,
    -- Is this the current active version?
    coalesce(valid_to_matchday = max(valid_to_matchday) over (partition by team_name), false) as is_current

from scd2
order by team_name, valid_from_matchday
