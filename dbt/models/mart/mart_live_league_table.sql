-- Gold: Live league table ready for dashboard consumption
-- Sources from silver stg_live_standings with qualification zones

with standings as (
    select * from {{ ref('stg_live_standings') }}
),

with_zones as (
    select
        position,
        team_name,
        played,
        won,
        drawn,
        lost,
        goals_for,
        goals_against,
        goal_difference,
        points,
        form,
        win_rate,
        points_pct,
        goals_per_game,
        goals_conceded_per_game,
        season,
        -- Qualification zones based on EPL rules
        ingested_at,
        case
            when position <= 4 then 'champions_league'
            when position = 5 then 'europa_league'
            when position = 6 then 'conference_league'
            when position >= 18 then 'relegation'
        end as qualification_zone
    from standings
)

select * from with_zones
order by position
