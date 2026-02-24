-- mart_league_table: Gold layer EPL League Table for dashboard
-- BigQuery-compatible: uses safe_divide, round, standard BigQuery SQL

select
    row_number() over (
        order by s.points desc, s.goal_difference desc, s.goals_for desc
    ) as position,
    s.team_id,
    s.team_name,
    s.played,
    s.won,
    s.drawn,
    s.lost,
    s.points,
    s.goals_for,
    s.goals_against,
    s.goal_difference,

    -- Calculated metrics (portable across BigQuery + DuckDB)
    round({{ safe_divide('s.points', 's.played * 3') }} * 100, 1) as points_pct,
    round({{ safe_divide('s.won', 's.played') }} * 100, 1) as win_rate,
    round({{ safe_divide('s.goals_for', 's.played') }}, 2) as goals_per_game,
    round({{ safe_divide('s.goals_against', 's.played') }}, 2) as goals_conceded_per_game,

    -- Qualification zones
    case
        when row_number() over (order by s.points desc, s.goal_difference desc, s.goals_for desc) <= 4
            then 'champions_league'
        when row_number() over (order by s.points desc, s.goal_difference desc, s.goals_for desc) = 5
            then 'europa_league'
        when row_number() over (order by s.points desc, s.goal_difference desc, s.goals_for desc) = 6
            then 'conference_league'
        when row_number() over (order by s.points desc, s.goal_difference desc, s.goals_for desc) >= 18
            then 'relegation'
        else 'midtable'
    end as qualification_zone

from {{ ref('stg_standings') }} as s
order by s.points desc, s.goal_difference desc, s.goals_for desc
