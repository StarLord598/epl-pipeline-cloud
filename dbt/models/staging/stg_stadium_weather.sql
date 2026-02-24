-- Silver: Deduplicated stadium weather — latest reading per stadium
with ranked as (
    select
        *,
        row_number()
            over (partition by team_name order by fetched_at desc)
            as rn
    from {{ source('raw', 'stadium_weather') }}
)

select
    team_name,
    stadium_name,
    latitude,
    longitude,
    temperature_c,
    humidity_pct,
    wind_speed_kmh,
    precipitation_mm,
    weather_code,
    weather_description,
    fetched_at
from ranked
where rn = 1
