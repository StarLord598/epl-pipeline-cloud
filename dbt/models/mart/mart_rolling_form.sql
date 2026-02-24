-- Gold: Rolling form — last 5 match results, rolling avg, momentum
-- Enables: "Hot & Cold" teams panel on dashboard

with match_results as (
    select distinct on (match_id)
        match_id,
        cast(json_extract_string(raw_json, '$.matchday') as integer)
            as matchday,
        home_score,
        away_score,
        utc_date,
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

team_matches as (
    select
        matchday,
        utc_date,
        home_team as team,
        home_score as gf,
        away_score as ga,
        case
            when home_score > away_score then 'W' when
                home_score = away_score
                then 'D'
            else 'L'
        end as result,
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
        utc_date,
        away_team as team,
        away_score as gf,
        home_score as ga,
        case
            when away_score > home_score then 'W' when
                away_score = home_score
                then 'D'
            else 'L'
        end as result,
        case
            when away_score > home_score then 3 when
                away_score = home_score
                then 1
            else 0
        end as pts
    from match_results
),

with_rolling as (
    select
        team as team_name,
        matchday,
        result,
        pts,
        gf,
        ga,
        -- Rolling 5-game averages
        avg(pts * 1.0)
            over (
                partition by team
                order by matchday rows between 4 preceding and current row
            )
            as rolling_5_ppg,
        avg(gf * 1.0)
            over (
                partition by team
                order by matchday rows between 4 preceding and current row
            )
            as rolling_5_gf,
        avg(ga * 1.0)
            over (
                partition by team
                order by matchday rows between 4 preceding and current row
            )
            as rolling_5_ga,
        -- Last 5 form string
        string_agg(result, '')
            over (
                partition by team
                order by matchday rows between 4 preceding and current row
            )
            as last_5_form,
        -- Count of matches for windowing
        row_number()
            over (partition by team order by matchday desc)
            as recency_rank
    from team_matches
)

select
    team_name,
    matchday,
    result,
    pts,
    gf,
    ga,
    last_5_form,
    recency_rank,
    round(rolling_5_ppg, 2) as rolling_5_ppg,
    round(rolling_5_gf, 2) as rolling_5_goals_scored,
    -- Momentum: compare last 5 PPG to season average
    round(rolling_5_ga, 2) as rolling_5_goals_conceded,
    case
        when recency_rank <= 5
            then
                case
                    when rolling_5_ppg >= 2.2 then 'HOT'
                    when rolling_5_ppg >= 1.5 then 'STEADY'
                    when rolling_5_ppg >= 0.8 then 'COOLING'
                    else 'COLD'
                end
    end as current_momentum
from with_rolling
order by team_name, matchday
