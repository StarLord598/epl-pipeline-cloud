-- Dimension: Teams (Kimball-style)
-- Slowly changing attributes tracked via SCD2 standings

with current_standings as (
    select * from {{ ref('mart_live_league_table') }}
),

season_stats as (
    select
        team_name,
        count(*) as total_matches,
        sum(case when result = 'W' then 1 else 0 end) as total_wins,
        sum(case when result = 'L' then 1 else 0 end) as total_losses,
        sum(gf) as total_goals_scored,
        sum(ga) as total_goals_conceded,
        max(last_5_form) as current_form
    from {{ ref('mart_rolling_form') }}
    where
        recency_rank
        <= (select max(matchday) from {{ ref('mart_rolling_form') }})
    group by team_name
)

select
    cs.team_name,
    cs.position,
    cs.points,
    cs.played,
    cs.won,
    cs.drawn,
    cs.lost,
    cs.goals_for,
    cs.goals_against,
    cs.goal_difference,
    cs.qualification_zone,
    cs.win_rate,
    cs.goals_per_game,
    cs.goals_conceded_per_game,
    ss.current_form,
    -- Categorization
    case
        when cs.position <= 4 then 'TITLE CONTENDER'
        when cs.position <= 7 then 'EUROPEAN HOPEFUL'
        when cs.position <= 14 then 'MID-TABLE'
        when cs.position <= 17 then 'RELEGATION BATTLE'
        else 'RELEGATION ZONE'
    end as tier
from current_standings as cs
left join season_stats as ss on cs.team_name = ss.team_name
order by cs.position
