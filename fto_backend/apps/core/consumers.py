"""WebSocket consumers for real-time AOG alerts and fleet status."""
import json
from channels.generic.websocket import AsyncWebsocketConsumer


class FleetStatusConsumer(AsyncWebsocketConsumer):
    """Broadcasts fleet-wide AOG alerts to all connected dispatchers."""

    async def connect(self):
        await self.channel_layer.group_add("fleet_status", self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("fleet_status", self.channel_name)

    async def fleet_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class BaseConsumer(AsyncWebsocketConsumer):
    """Per-base real-time updates (roster changes, weather alerts)."""

    async def connect(self):
        self.base_id = self.scope["url_route"]["kwargs"]["base_id"]
        self.group_name = f"base_{self.base_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def base_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))
