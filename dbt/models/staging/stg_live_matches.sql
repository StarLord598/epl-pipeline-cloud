-- Silver: Clean live matches from football-data.org
-- Deduplicates by match_id (latest ingest wins), normalizes statuses, filters to EPL

with deduped as (
    select
        *,
        row_number()
            over (partition by match_id order by ingested_at desc)
            as rn
    from {{ source('raw', 'live_matches') }}
    where source = 'football-data.org'
),

cleaned as (
    select
        match_id,
        utc_date,
        minute,
        home_team_name as home_team_raw,
        away_team_name as away_team_raw,
        winner,
        competition,
        season,
        ingested_at,
        case
            when status in ('IN_PLAY', 'LIVE') then 'LIVE'
            when status in ('PAUSED', 'HALFTIME') then 'HALFTIME'
            when status = 'FINISHED' then 'FINISHED'
            when
                status in ('TIMED', 'SCHEDULED', 'Not Started')
                then 'SCHEDULED'
            when status = 'POSTPONED' then 'POSTPONED'
            else status
        end as status,
        regexp_replace(
            regexp_replace(home_team_name, ' FC$', ''), '^AFC ', ''
        ) as home_team,
        regexp_replace(
            regexp_replace(away_team_name, ' FC$', ''), '^AFC ', ''
        ) as away_team,
        coalesce(home_score, 0) as home_score,
        coalesce(away_score, 0) as away_score
    from deduped
    where rn = 1
)

select
    match_id,
    utc_date,
    status,
    minute,
    home_team,
    away_team,
    home_team_raw,
    away_team_raw,
    home_score,
    away_score,
    winner,
    competition,
    season,
    cast(strftime(utc_date, '%W') as integer) as matchday_approx,
    ingested_at
from cleaned
order by utc_date desc
