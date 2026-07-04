from django.apps import AppConfig
class DispatchConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dispatch"
    label = "dispatch"
    def ready(self):
        import apps.dispatch.signals  # noqa
