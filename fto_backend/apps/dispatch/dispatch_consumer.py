"""
WebSocket consumer for the React Native tablet dispatch app.

Tablet connects to: ws://<host>/ws/dispatch/?token=<jwt>

Broadcasts:
  - AOG alerts  → type: "aog_alert"  (matches what tablet app expects)
  - Flight updates → type: "flight_update"

The token is validated on connect so the tablet can authenticate
without needing session cookies (JWT-only auth for the apron tablet).
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class DispatchConsumer(AsyncWebsocketConsumer):
    """
    One WebSocket connection per tablet.
    All tablets join the global 'dispatch' group AND a base-specific group
    so broadcasts can be targeted.
    """

    async def connect(self):
        # Validate JWT from query string
        user = await self._get_user_from_token()
        if not user:
            logger.warning("DispatchConsumer: rejected unauthenticated connection")
            await self.close(code=4001)
            return

        self.user     = user
        self.base_id  = str(user.home_base_id) if user.home_base_id else None

        # Join global dispatch group (receives all AOG alerts)
        await self.channel_layer.group_add("dispatch", self.channel_name)

        # Join base-specific group (receives alerts for this base only)
        if self.base_id:
            await self.channel_layer.group_add(
                f"dispatch_base_{self.base_id}", self.channel_name
            )

        await self.accept()
        logger.info("Tablet connected: %s @ base %s", user.email, self.base_id)

        # Send a welcome ping so tablet knows it's live
        await self.send(text_data=json.dumps({
            "type":    "connected",
            "user":    user.get_full_name(),
            "base_id": self.base_id,
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("dispatch", self.channel_name)
        if self.base_id:
            await self.channel_layer.group_discard(
                f"dispatch_base_{self.base_id}", self.channel_name
            )

    async def receive(self, text_data=None, bytes_data=None):
        """Handle ping frames from the tablet to keep connection alive."""
        if text_data:
            try:
                msg = json.loads(text_data)
                if msg.get("type") == "ping":
                    await self.send(text_data=json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass

    # ── Group message handlers ─────────────────────────────────────────────────

    async def aog_alert(self, event):
        """
        Receives from signal:  channel_layer.group_send("dispatch", {...})
        Forwards to tablet as: { type: "aog_alert", ... }
        Tablet app routes on event["type"] == "aog_alert"
        """
        await self.send(text_data=json.dumps({
            "type":                   "aog_alert",
            "aircraft_registration":  event["aircraft_registration"],
            "snag_description":       event["snag_description"],
            "affected_flight_ids":    event["affected_flight_ids"],
            "created_at":             event["created_at"],
            "aircraft_id":            event.get("aircraft_id", ""),
            "base_id":                event.get("base_id", ""),
        }))

    async def flight_update(self, event):
        """Forwards flight status changes (confirmed, cancelled, etc.) to tablet."""
        await self.send(text_data=json.dumps({
            "type":      "flight_update",
            "flight_id": event["flight_id"],
            "status":    event["status"],
            "aircraft_registration": event.get("aircraft_registration", ""),
        }))

    async def weather_update(self, event):
        """Forwards fresh METAR data when Celery weather task runs."""
        await self.send(text_data=json.dumps({
            "type":    "weather_update",
            "weather": event["weather"],
        }))

    # ── JWT validation ─────────────────────────────────────────────────────────
    @database_sync_to_async
    def _get_user_from_token(self):
        try:
            from rest_framework_simplejwt.tokens import UntypedToken
            from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
            from django.contrib.auth import get_user_model
            from urllib.parse import parse_qs

            query_string = self.scope.get("query_string", b"").decode()
            params       = parse_qs(query_string)
            token_list   = params.get("token", [])

            if not token_list:
                return None

            raw_token = token_list[0]
            UntypedToken(raw_token)   # validates signature + expiry

            import jwt
            from django.conf import settings
            payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=["HS256"])
            User    = get_user_model()
            return User.objects.select_related("home_base").get(id=payload["user_id"])

        except Exception as exc:
            logger.debug("DispatchConsumer auth failed: %s", exc)
            return None
