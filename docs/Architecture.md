# Architecture

## High-Level Components

- React Web Portal
- React Native Offline Dispatch App
- Django REST API
- PostgreSQL
- Redis
- Celery
- Django Channels
- MinIO

## Data Flow

Users -> React/Tablet -> Django API -> PostgreSQL

Background services:
- Celery
- Weather sync
- NOTAM sync
- Notifications
