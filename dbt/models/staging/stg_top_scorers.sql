-- stg_top_scorers: Top scorers from raw top_scorers table (2023-24 season)
-- Uses pre-loaded known stats rather than deriving from events
-- BigQuery-compatible

with source as (
    select * from {{ source('raw', 'top_scorers') }}
),

ranked as (
    select
        player_id,
        player_name,
        team_name,
        goals,
        assists,
        goal_contributions,
        matches_played,
        goals_per_game,
        assists_per_game,
        ingested_at,
        ROW_NUMBER() over (
            partition by player_id
            order by ingested_at desc
        ) as rn
    from source
    where player_id is not null
)

select
    player_id,
    player_name,
    team_name,
    goals,
    assists,
    goal_contributions,
    matches_played,
    goals_per_game,
    assists_per_game
from ranked
where rn = 1
order by goals desc, assists desc
