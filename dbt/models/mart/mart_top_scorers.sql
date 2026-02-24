-- mart_top_scorers: Gold layer top scorers with ranking
-- BigQuery-compatible: uses safe_divide, row_number window function

select
    row_number() over (
        order by s.goals desc, s.assists desc
    ) as rank,
    s.player_id,
    s.player_name,
    s.team_name,
    s.goals,
    s.assists,
    s.goal_contributions,
    s.matches_played,
    s.goals_per_game,
    round({{ safe_divide('s.assists', 's.matches_played') }}, 2) as assists_per_game

from {{ ref('stg_top_scorers') }} as s
order by s.goals desc, s.assists desc
limit 30
