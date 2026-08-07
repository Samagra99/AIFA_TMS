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

def calculate_instructor_fdtl(instructor, target_date):
    """
    Computes rolling FDTL windows for the given instructor.
    Considers both scheduled/flown flights in the system and historical logs.
    """
    windows = {'last_24h': 1, 'last_7d': 7, 'last_28d': 28, 'last_90d': 90, 'last_360d': 360}
    results = []
    
    for key, lookback_days in windows.items():
        window_start = target_date - datetime.timedelta(days=lookback_days - 1)
        
        # 1. System Flight records
        agg = Flight.objects.filter(
            Q(instructor=instructor) | Q(secondary_instructor=instructor),
            scheduled_start__date__gte=window_start,
            scheduled_start__date__lte=target_date,
            status__in=[
                FlightStatus.COMPLETED, 
                FlightStatus.SCHEDULED, 
                FlightStatus.CONFIRMED, 
                FlightStatus.DISPATCHED, 
                FlightStatus.AIRBORNE
            ]
        ).annotate(duration=_duration_annotation()).aggregate(
            total=Sum('duration'), flights=Count('id')
        )
        sys_hours = _td_hours(agg['total'])
        sys_count = agg['flights'] or 0

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
