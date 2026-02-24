-- Silver: Clean live standings from football-data.org
-- Deduplicates by team_name (latest ingest wins), normalizes names, validates data

with deduped as (
    select
        *,
        row_number()
            over (partition by team_name order by ingested_at desc)
            as rn
    from {{ source('raw', 'live_standings') }}
    where source = 'football-data.org'
),

cleaned as (
    select
        position,
        team_name as team_name_raw,
        played,
        won,
        draw as drawn,
        lost,
        goals_for,
        goals_against,
        points,
        form,
        season,
        ingested_at,
        regexp_replace(
            regexp_replace(team_name, ' FC$', ''),
            '^AFC ', ''
        ) as team_name,
        coalesce(goal_difference, goals_for - goals_against) as goal_difference
    from deduped
    where rn = 1
)

select
    position,
    team_name,
    team_name_raw,
    played,
    won,
    drawn,
    lost,
    goals_for,
    goals_against,
    goal_difference,
    points,
    form,
    season,
    ingested_at,
    case when played > 0 then round(won * 100.0 / played, 1) else 0 end
        as win_rate,
    case
        when played > 0 then round(points * 100.0 / (played * 3), 1) else 0
    end as points_pct,
    case when played > 0 then round(goals_for * 1.0 / played, 2) else 0 end
        as goals_per_game,
    case
        when played > 0 then round(goals_against * 1.0 / played, 2) else 0
    end as goals_conceded_per_game
from cleaned
order by position
