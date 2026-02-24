-- EPL Standings derived from match results
-- Aggregates all home/away results per team

with all_results as (
    -- Home results
    select
        home_team_id as team_id,
        home_team_name as team_name,
        home_score as gf,
        away_score as ga,
        case
            when home_score > away_score then 3
            when home_score = away_score then 1
            else 0
        end as pts,
        case when home_score > away_score then 1 else 0 end as won,
        case when home_score = away_score then 1 else 0 end as drawn,
        case when home_score < away_score then 1 else 0 end as lost
    from {{ ref('stg_matches') }}
    where home_score is not null

    union all

    -- Away results
    select
        away_team_id as team_id,
        away_team_name as team_name,
        away_score as gf,
        home_score as ga,
        case
            when away_score > home_score then 3
            when away_score = home_score then 1
            else 0
        end as pts,
        case when away_score > home_score then 1 else 0 end as won,
        case when away_score = home_score then 1 else 0 end as drawn,
        case when away_score < home_score then 1 else 0 end as lost
    from {{ ref('stg_matches') }}
    where away_score is not null
)

select
    team_id,
    team_name,
    count(*) as played,
    sum(won) as won,
    sum(drawn) as drawn,
    sum(lost) as lost,
    sum(pts) as points,
    sum(gf) as goals_for,
    sum(ga) as goals_against,
    sum(gf) - sum(ga) as goal_difference
from all_results
group by team_id, team_name
order by points desc, goal_difference desc, goals_for desc
