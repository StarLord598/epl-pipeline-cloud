-- Gold layer: Match results ready for dashboard
-- Includes derived result for home/away teams
-- Incremental: only processes new matches since last run

{{
  config(
    materialized='incremental',
    unique_key='match_id',
    on_schema_change='append_new_columns'
  )
}}

select
    m.match_id,
    m.matchday,
    m.match_date,
    m.home_team_id,
    m.home_team_name,
    m.away_team_id,
    m.away_team_name,
    m.home_score,
    m.away_score,
    m.winner,
    m.match_status,

    -- Home team result
    case
        when m.winner = 'HOME_TEAM' then 'W'
        when m.winner = 'DRAW' then 'D'
        when m.winner = 'AWAY_TEAM' then 'L'
    end as home_result,

    -- Away team result
    case
        when m.winner = 'AWAY_TEAM' then 'W'
        when m.winner = 'DRAW' then 'D'
        when m.winner = 'HOME_TEAM' then 'L'
    end as away_result

from {{ ref('stg_matches') }} as m

{% if is_incremental() %}
    where m.match_id not in (select match_id from {{ this }})
{% endif %}

order by m.match_date desc, m.matchday desc
