# Amravati FTO Management Platform

## Overview
A DGCA-oriented Flight Training Organization Management Platform supporting 34 aircraft across 3 bases.

## Features
- Smart scheduling with safety rules
- Flight dispatch & digital tech logs
- Student training management
- CAMO & maintenance
- SMS compliance
- Finance & billing

## Architecture
```text
React Web
    |
Django REST API
 |   |   |
PostgreSQL Redis MinIO
    |
 Celery
    |
React Native Tablet
```

## Technology Stack
Backend: Django, DRF, PostgreSQL, Redis, Celery, Channels
Frontend: React, TypeScript, Vite
Mobile: React Native, Expo
Infrastructure: Docker, Nginx, GitHub Actions

## Repository Structure
```
packages/
  backend/
  web/
  mobile/
  shared/
```

## Roadmap
1. Core Dispatch
2. Compliance Engine
3. Multi-base Operations
4. Finance & Analytics
