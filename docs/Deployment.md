# Deployment Guide

## Production Deployment

### Prerequisites
- Docker & Docker Compose installed
- `.env` file configured with all required secrets (no defaults — app fails to boot if unset)

### Required Environment Variables
| Variable | Description |
|---|---|
| `DJANGO_SECRET_KEY` | Django secret key (generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) |
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password (no default — **must be set**) |
| `MINIO_ROOT_USER` | MinIO root user (no default — **must be set**) |
| `MINIO_ROOT_PASSWORD` | MinIO root password (no default — **must be set**) |
| `GEMINI_API_KEY` | Google Gemini API key for AI roster generation |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins |

### Steps
1. Clone the repository
2. Create `.env` from `.env.example` and fill in all required values
3. Run with production compose file:
   ```bash
   docker compose -f fto_backend/docker-compose.prod.yml up -d
   ```
4. Run migrations:
   ```bash
   docker compose -f fto_backend/docker-compose.prod.yml exec backend python manage.py migrate
   ```
5. Collect static files:
   ```bash
   docker compose -f fto_backend/docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
   ```
6. Create superuser:
   ```bash
   docker compose -f fto_backend/docker-compose.prod.yml exec backend python manage.py createsuperuser
   ```

### Security Notes
- Production uses `config.settings.production` (DEBUG=False, HSTS enabled, secure cookies)
- Database, Redis, and MinIO ports are NOT published to host — internal network only
- Nginx reverse proxy handles TLS termination and static file serving
- All credentials must be explicitly set via `.env` — no hardcoded defaults in production
