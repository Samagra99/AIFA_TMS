"""Auto-create Instructor/Student profiles when a User is created with the matching role."""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, Instructor, Student, UserRole


@receiver(post_save, sender=User)
def create_role_profile(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.role in (UserRole.INSTRUCTOR, UserRole.CFI):
        Instructor.objects.get_or_create(user=instance)
    elif instance.role == UserRole.STUDENT:
        Student.objects.get_or_create(user=instance)
