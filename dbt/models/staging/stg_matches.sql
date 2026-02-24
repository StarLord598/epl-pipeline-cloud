-- stg_matches: Cleaned, enriched matches from raw layer
-- BigQuery-compatible: uses SAFE_CAST, CASE, standard SQL

with source as (
    select * from {{ source('raw', 'matches') }}
),

cleaned as (
    select
        match_id,
        competition_id,
        competition_name,
        season_id,
        season_name,
        {% if target.type == 'bigquery' %}
        safe_cast(match_date as date) as match_date,  -- noqa: LT02
        {% else %}
        try_cast(match_date as date) as match_date,  -- noqa: LT02
        {% endif %}
        kick_off,
        home_team_id,
        home_team_name,
        away_team_id,
        away_team_name,
        home_score,
        away_score,
        case
            when home_score > away_score then 'HOME_TEAM'
            when away_score > home_score then 'AWAY_TEAM'
            when home_score = away_score then 'DRAW'
        end as winner,
        match_status,
        matchday,
        ingested_at
    from source
    where
        match_status = 'available'
        and season_id = 2324  -- 2023-24 Premier League season
)

select * from cleaned
