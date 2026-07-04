from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name  = "apps.core"
    label = "core"

    def ready(self):
        import apps.core.post_migrate  # noqa — registers post_migrate signal
