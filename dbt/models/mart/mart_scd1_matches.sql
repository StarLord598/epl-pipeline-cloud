-- Gold: SCD Type 1 — Latest state per match with correction tracking
-- Implements upsert pattern: most recent record per match_id wins
-- Tracks mutation history (first_seen, last_updated, update_count, is_correction)

with ranked as (
    select
        *,
        row_number()
            over (partition by match_id order by ingested_at asc)
            as first_rank,
        row_number()
            over (partition by match_id order by ingested_at desc)
            as latest_rank,
        count(*) over (partition by match_id) as total_versions
    from {{ ref('stg_live_matches') }}
),

first_seen as (
    select
        match_id,
        ingested_at as first_seen_at
    from ranked
    where first_rank = 1
),

latest as (
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
        ingested_at as last_updated_at,
        total_versions
    from ranked
    where latest_rank = 1
)

select
    l.match_id,
    l.utc_date,
    l.status,
    l.minute,
    l.home_team,
    l.away_team,
    l.home_score,
    l.away_score,
    l.winner,
    l.competition,
    l.season,
    l.matchday,
    f.first_seen_at,
    l.last_updated_at,
    l.total_versions as update_count,
    coalesce(l.total_versions > 1, false) as is_correction
from latest as l
inner join first_seen as f on l.match_id = f.match_id
order by l.utc_date desc
