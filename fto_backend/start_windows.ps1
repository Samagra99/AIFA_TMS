# Amravati FTO Backend — Windows Quick Start
# Run this script from the fto_backend directory in PowerShell

Write-Host "`n=== FTO Backend Quick Start ===" -ForegroundColor Cyan

# Check Docker is running
if (-not (docker info 2>$null)) {
    Write-Host "ERROR: Docker Desktop is not running. Start it and try again." -ForegroundColor Red
    exit 1
}

# Copy .env if it doesn't exist
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example. Edit it to set a strong DJANGO_SECRET_KEY." -ForegroundColor Yellow
}

Write-Host "`nStep 1: Building and starting services..." -ForegroundColor Green
docker compose up --build -d

Write-Host "`nWaiting 10 seconds for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "`nStep 2: Creating database migrations..." -ForegroundColor Green
docker compose exec api python manage.py makemigrations

Write-Host "`nStep 3: Applying migrations (creates all tables)..." -ForegroundColor Green
docker compose exec api python manage.py migrate

Write-Host "`nStep 4: Seeding initial data..." -ForegroundColor Green
docker compose exec api python manage.py seed_data

Write-Host "`n=== Setup complete! ===" -ForegroundColor Cyan
Write-Host "Swagger UI : http://localhost:8000/api/docs/"
Write-Host "Django Admin: http://localhost:8000/admin/"
Write-Host "MinIO Console: http://localhost:9001/"
Write-Host "Login: admin@fto.aero / Admin@1234"
