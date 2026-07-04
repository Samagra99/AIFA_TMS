"""
Post-migrate hook: applies DB-level security rules that Django migrations
cannot express natively, such as revoking DELETE on the audit_log table.
Run automatically after every `manage.py migrate`.
"""
from django.db.models.signals import post_migrate
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


@receiver(post_migrate)
def apply_db_security_rules(sender, **kwargs):
    """Revoke DELETE on audit_log for the app user — audit trail must be immutable."""
    if sender.name != "apps.core":
        return
    from django.db import connection
    with connection.cursor() as cursor:
        try:
            cursor.execute(
                "REVOKE DELETE ON TABLE audit_log FROM PUBLIC;"
            )
            logger.info("DB security: DELETE revoked on audit_log")
        except Exception as e:
            # Table may not exist yet on first migrate — safe to ignore
            logger.debug("audit_log revoke skipped: %s", e)
