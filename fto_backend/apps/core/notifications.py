import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from apps.core.models import Notification, NotificationCategory, NotificationSeverity

logger = logging.getLogger(__name__)

def create_notification(
    title: str,
    message: str,
    category: str = NotificationCategory.FLIGHT_SCHEDULE,
    severity: str = NotificationSeverity.INFO,
    user=None,
    target_role: str = None,
    base=None,
    action_url: str = None
):
    """Persists a notification and dispatches real-time WebSocket alert."""
    try:
        notif = Notification.objects.create(
            user=user,
            target_role=target_role,
            base=base,
            title=title,
            message=message,
            category=category,
            severity=severity,
            action_url=action_url,
        )

        # Broadcast via Django Channels layer
        channel_layer = get_channel_layer()
        if channel_layer:
            payload = {
                "type": "fleet_update",
                "data": {
                    "event_type": "notification",
                    "id": str(notif.id),
                    "title": notif.title,
                    "message": notif.message,
                    "category": notif.category,
                    "severity": notif.severity,
                    "action_url": notif.action_url,
                    "created_at": notif.created_at.isoformat(),
                }
            }
            async_to_sync(channel_layer.group_send)("fleet_status", payload)

        return notif
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        return None
