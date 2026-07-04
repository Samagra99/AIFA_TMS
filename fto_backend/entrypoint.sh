#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
while ! nc -z "$DB_HOST" "$DB_PORT"; do
  sleep 0.5
done
echo "PostgreSQL is up."

echo "Creating migration files (makemigration)..."
python manage.py makemigrations \
	core infrastructure users syllabus scheduling \
	dispatch maintenance inventory compliance finance \
	weather rostering \
	--noinput

echo "Applying migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear 2>/dev/null || true

exec "$@"
