from pathlib import Path
from datetime import timedelta
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY")
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost", cast=Csv())

# ── Application definition ────────────────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "channels",
    "django_celery_beat",
    "django_celery_results",
]

LOCAL_APPS = [
    "apps.core",
    "apps.dashboard",
    "apps.infrastructure",
    "apps.users",
    "apps.syllabus",
    "apps.scheduling",
    "apps.dispatch",
    "apps.maintenance",
    "apps.inventory",
    "apps.compliance",
    "apps.finance",
    "apps.weather",
    "apps.rostering",
    "apps.fstd",
    "apps.navigation",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ── Database ──────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="fto_db"),
        "USER": config("DB_USER", default="fto_user"),
        "PASSWORD": config("DB_PASSWORD", default="fto_dev_password"),
        "HOST": config("DB_HOST", default="db"),
        "PORT": config("DB_PORT", default="5432"),
        "OPTIONS": {"connect_timeout": 10},
    }
}

# ── Auth ──────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── REST Framework ────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.users.authentication.FTOJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.fto_exception_handler",
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=15, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "apps.users.serializers.FTOTokenObtainSerializer",
    # H8: Send refresh token in httpOnly cookie, not in response body
    "AUTH_COOKIE": "fto_refresh",
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_SECURE": not DEBUG,
    "AUTH_COOKIE_SAMESITE": "Lax",
    "AUTH_COOKIE_PATH": "/api/auth/",
}

# ── Channels (WebSocket) ──────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [config("REDIS_URL", default="redis://redis:6379/0")]},
    }
}

# ── Celery ────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = config("REDIS_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = "django-db"
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TIMEZONE = "Asia/Kolkata"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_QUEUES = {
    "default": {},
    "weather": {},
    "notifications": {},
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://localhost:3000",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# ── Static & Media ────────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
X_FRAME_OPTIONS = "DENY"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── DRF Spectacular (OpenAPI) ─────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "Amravati FTO Management API",
    "DESCRIPTION": "DGCA-compliant Flight Training Organisation management platform.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# ── MinIO / S3 Storage ────────────────────────────────────────────────────────
MINIO_ENDPOINT   = config("MINIO_ENDPOINT",   default="minio:9000")
MINIO_ACCESS_KEY = config("MINIO_ROOT_USER",   default="minioadmin")
MINIO_SECRET_KEY = config("MINIO_ROOT_PASSWORD", default="minioadmin123")
MINIO_BUCKET     = config("MINIO_BUCKET_DOCUMENTS", default="fto-documents")
MINIO_USE_SSL    = config("MINIO_USE_SSL", default=False, cast=bool)

# ── External APIs ─────────────────────────────────────────────────────────────
AVIATION_WEATHER_BASE_URL = config("AVIATION_WEATHER_BASE_URL", default="https://aviationweather.gov/api/data/metar")
AAI_NOTAM_API_URL    = config("AAI_NOTAM_API_URL",    default="https://aim.aai.aero/api")
DIGITAL_SKY_API_URL  = config("DIGITAL_SKY_API_URL",  default="https://digitalsky.dgca.gov.in/api")
FCM_SERVER_KEY       = config("FCM_SERVER_KEY",        default="")
GEMINI_API_KEY       = config("GEMINI_API_KEY",         default="")
