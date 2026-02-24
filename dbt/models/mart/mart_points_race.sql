-- Gold: Cumulative points race across matchdays
-- Enables: line chart showing all 20 teams' points accumulation (like a stock chart)

with match_results as (
    select distinct on (match_id)
        match_id,
        cast(json_extract_string(raw_json, '$.matchday') as integer)
            as matchday,
        home_score,
        away_score,
        regexp_replace(
            regexp_replace(home_team_name, ' FC$', ''), '^AFC ', ''
        ) as home_team,
        regexp_replace(
            regexp_replace(away_team_name, ' FC$', ''), '^AFC ', ''
        ) as away_team
    from raw.live_matches
    where
        source = 'football-data.org'
        and status = 'FINISHED'
        and home_score is not null
    order by match_id asc, ingested_at desc
),

team_results as (
    select
        matchday,
        home_team as team,
        case
            when home_score > away_score then 3 when
                home_score = away_score
                then 1
            else 0
        end as pts
    from match_results
    union all
    select
        matchday,
        away_team as team,
        case
            when away_score > home_score then 3 when
                away_score = home_score
                then 1
            else 0
        end as pts
    from match_results
),

per_matchday as (
    select
        team as team_name,
        matchday,
        sum(pts) as matchday_points
    from team_results
    group by team, matchday
),

cumulative as (
    select
        team_name,
        matchday,
        matchday_points,
        sum(matchday_points)
            over (partition by team_name order by matchday)
            as cumulative_points
    from per_matchday
)

select * from cumulative
order by matchday asc, cumulative_points desc
