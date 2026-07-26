from .base import *

DEBUG = True
CORS_ALLOW_ALL_ORIGINS = True

# django-debug-toolbar is optional — only active if the package is installed.
# Install it locally with: pip install django-debug-toolbar
# It is NOT installed inside Docker (base requirements only) to keep the image lean.
try:
    import debug_toolbar  # noqa
    INSTALLED_APPS += ["debug_toolbar"]
    MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + list(MIDDLEWARE)
    INTERNAL_IPS = ["127.0.0.1"]
except ImportError:
    pass

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django":       {"handlers": ["console"], "level": "INFO",  "propagate": False},
        "django.db.backends": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps":         {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "celery":       {"handlers": ["console"], "level": "INFO",  "propagate": False},
    },
}
