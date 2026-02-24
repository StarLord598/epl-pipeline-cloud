-- Gold: Live matches ready for dashboard consumption
-- Sources from silver stg_live_matches

select
    match_id,
    utc_date,
    status,
    minute,
    home_team,
    away_team,
    home_score,
    away_score,
    winner,
    competition,
    season,
    matchday_approx as matchday,
    ingested_at
from {{ ref('stg_live_matches') }}
order by utc_date desc
