import datetime
from django.db.models import Sum, Count, Q, F, ExpressionWrapper, DurationField
from apps.scheduling.models import Flight, PriorFlightLog, FlightStatus

FDTL_LIMITS = {
    'last_24h':  8,
    'last_7d':   30,
    'last_28d':  100,
    'last_90d':  270,
    'last_360d': 1000,
}

def _duration_annotation():
    return ExpressionWrapper(
        F('scheduled_end') - F('scheduled_start'),
        output_field=DurationField(),
    )

def _td_hours(td) -> float:
    return (td.total_seconds() / 3600.0) if td else 0.0

def calculate_instructor_fdtl(instructor, target_date, include_scheduled=True):
    """
    Computes rolling FDTL windows for the given instructor.

    include_scheduled=True  → used by scheduling engine: counts both completed AND
                               committed-but-unflown flights (for blocking checks).
    include_scheduled=False → used by dashboard display: counts actual flown hours only.

    Completed flights use the real TechLog.flight_duration_minutes.
    Future/scheduled flights use the scheduled_end - scheduled_start estimate.
    """
    from apps.dispatch.models import TechLog

    windows = {'last_24h': 1, 'last_7d': 7, 'last_28d': 28, 'last_90d': 90, 'last_360d': 360}
    results = []

    for key, lookback_days in windows.items():
        window_start = target_date - datetime.timedelta(days=lookback_days - 1)

        base_qs = Flight.objects.filter(
            Q(instructor=instructor) | Q(secondary_instructor=instructor),
            scheduled_start__date__gte=window_start,
            scheduled_start__date__lte=target_date,
        )

        # Completed flights: use actual TechLog duration
        completed_minutes = TechLog.objects.filter(
            flight__in=base_qs.filter(status=FlightStatus.COMPLETED)
        ).aggregate(total=Sum("flight_duration_minutes"))["total"] or 0
        completed_count = base_qs.filter(status=FlightStatus.COMPLETED).count()

        # In-progress/scheduled flights: use scheduled duration as estimate,
        # EXCEPT for AIRBORNE flights with an off_block_time — use actual elapsed time
        # (fixes the transient blind spot when a flight overruns its scheduled window).
        if include_scheduled:
            import datetime as _dt
            now_utc = datetime.datetime.now(tz=datetime.timezone.utc)

            non_airborne = base_qs.filter(
                status__in=[
                    FlightStatus.SCHEDULED,
                    FlightStatus.CONFIRMED,
                    FlightStatus.DISPATCHED,
                ]
            ).annotate(duration=_duration_annotation()).aggregate(
                total=Sum("duration"), flights=Count("id")
            )
            non_airborne_hours = _td_hours(non_airborne["total"])
            non_airborne_count = non_airborne["flights"] or 0

            # For AIRBORNE flights: use max(scheduled_minutes, actual_elapsed_minutes)
            airborne_flights = base_qs.filter(status=FlightStatus.AIRBORNE).select_related('tech_log')
            airborne_minutes = 0
            airborne_count = 0
            for af in airborne_flights:
                tl = getattr(af, 'tech_log', None)
                if tl and tl.off_block_time:
                    elapsed = int((now_utc - tl.off_block_time).total_seconds() / 60)
                    scheduled = int((af.scheduled_end - af.scheduled_start).total_seconds() / 60) if (af.scheduled_end and af.scheduled_start) else 0
                    airborne_minutes += max(elapsed, scheduled)
                elif af.scheduled_end and af.scheduled_start:
                    airborne_minutes += int((af.scheduled_end - af.scheduled_start).total_seconds() / 60)
                airborne_count += 1

            future_hours = non_airborne_hours + (airborne_minutes / 60.0)
            future_count = non_airborne_count + airborne_count
        else:
            future_hours = 0.0
            future_count = 0

        sys_hours = (completed_minutes / 60.0) + future_hours
        sys_count = completed_count + future_count

        # 2. Historical PriorFlightLog records
        prior_logs = PriorFlightLog.objects.filter(
            user=instructor.user,
            flight_date__gte=window_start,
            flight_date__lte=target_date,
        ).aggregate(
            tot_dual=Sum('dual_minutes'),
            tot_pic=Sum('pic_minutes'),
            tot_cop=Sum('copilot_minutes'),
            cnt=Count('id')
        )
        prior_minutes = (prior_logs['tot_dual'] or 0) + (prior_logs['tot_pic'] or 0) + (prior_logs['tot_cop'] or 0)
        prior_hours = prior_minutes / 60.0
        prior_count = prior_logs['cnt'] or 0

        flown_hours = round(sys_hours + prior_hours, 1)
        flight_count = sys_count + prior_count

        cap = FDTL_LIMITS[key]
        remaining = round(max(0.0, cap - flown_hours), 1)

        results.append({
            'window': key,
            'window_label': {
                'last_24h': 'Last 24 hours', 'last_7d': 'Last 7 days',
                'last_28d': 'Last 28 days', 'last_90d': 'Last 90 days',
                'last_360d': 'Last 360 days',
            }[key],
            'lookback_start': str(window_start),
            'lookback_end': str(target_date),
            'cap_hours': cap,
            'flown_hours': flown_hours,
            'flight_count': flight_count,
            'remaining_hours': remaining,
            'pct_used': round(flown_hours / cap * 100, 1) if cap else 0,
        })

    return results
