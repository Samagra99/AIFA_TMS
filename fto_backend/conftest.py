"""
pytest configuration for the FTO backend.
Django settings are declared in pytest.ini via DJANGO_SETTINGS_MODULE.
This file only adds project-level fixtures used across multiple test modules.
"""
import pytest


@pytest.fixture(scope="session")
def django_db_setup():
    """Use the default test database defined in settings."""
    pass


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def admin_user(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_superuser(
        email="test-admin@fto.aero",
        password="TestPass@1234",
        first_name="Test",
        last_name="Admin",
    )


@pytest.fixture
def auth_client(api_client, admin_user):
    """APIClient pre-authenticated as the admin user."""
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client
