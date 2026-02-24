-- Dimension: Matchdays with schedule awareness
-- Enables: matchday-aware DAG scheduling, "next matchday" widget

with matchdays as (
    select distinct on (match_id)
        cast(json_extract_string(raw_json, '$.matchday') as integer)
            as matchday,
        utc_date,
        status,
        match_id
    from raw.live_matches
    where source = 'football-data.org'
    order by match_id asc, ingested_at desc
),

per_matchday as (
    select
        matchday,
        min(utc_date) as first_kickoff,
        max(utc_date) as last_kickoff,
        count(*) as total_matches,
        sum(case when status = 'FINISHED' then 1 else 0 end) as completed,
        sum(case when status in ('TIMED', 'SCHEDULED') then 1 else 0 end)
            as scheduled,
        sum(
            case
                when
                    status in ('IN_PLAY', 'LIVE', 'PAUSED', 'HALFTIME')
                    then 1
                else 0
            end
        ) as live_now
    from matchdays
    group by matchday
)

select
    matchday,
    first_kickoff,
    last_kickoff,
    total_matches,
    completed,
    scheduled,
    live_now,
    cast(first_kickoff as date) as matchday_start_date,
    cast(last_kickoff as date) as matchday_end_date,
    case
        when live_now > 0 then 'LIVE'
        when completed = total_matches then 'COMPLETED'
        when completed > 0 then 'IN_PROGRESS'
        else 'UPCOMING'
    end as matchday_status,
    -- For scheduling: is today within this matchday window?
    coalesce(current_date between cast(first_kickoff as date) - 1 and cast(last_kickoff as date) + 1, false)
        as is_active_window
from per_matchday
order by matchday
