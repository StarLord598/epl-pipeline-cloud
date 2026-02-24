-- Gold: Stadium weather enriched with team dimension data
-- Adds pitch condition classification and match-day context

with weather as (
    select * from {{ ref('stg_stadium_weather') }}
),

teams as (
    select * from {{ ref('dim_teams') }}
)

select
    w.team_name,
    w.stadium_name,
    w.latitude,
    w.longitude,
    w.temperature_c,
    w.humidity_pct,
    w.wind_speed_kmh,
    w.precipitation_mm,
    w.weather_code,
    w.weather_description,
    -- Pitch condition classification
    t.tier as team_tier,
    -- Temperature comfort classification
    t.position as current_position,
    w.fetched_at,
    case
        when w.weather_code in (0, 1) then 'Excellent'
        when w.weather_code in (2, 3) then 'Good'
        when w.weather_code in (45, 48) then 'Poor (Fog)'
        when w.weather_code between 51 and 57 then 'Moderate (Drizzle)'
        when w.weather_code between 61 and 67 then 'Poor (Rain)'
        when w.weather_code between 71 and 77 then 'Poor (Snow)'
        when w.weather_code between 80 and 86 then 'Poor (Showers)'
        when w.weather_code >= 95 then 'Dangerous (Storm)'
        else 'Unknown'
    end as pitch_condition,
    case
        when w.temperature_c < 0 then 'Freezing'
        when w.temperature_c < 8 then 'Cold'
        when w.temperature_c < 15 then 'Cool'
        when w.temperature_c < 22 then 'Comfortable'
        when w.temperature_c < 30 then 'Warm'
        else 'Hot'
    end as temperature_class
from weather as w
left join teams as t on w.team_name = t.team_name
order by w.team_name
