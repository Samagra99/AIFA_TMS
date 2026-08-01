import uuid
from django.db import models
from apps.core.models import TimeStampedModel

class BAEquipment(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    equipment_number = models.CharField(max_length=50, unique=True)
    serial_number = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100, blank=True)
    calibration_date = models.DateField(null=True, blank=True)
    calibration_due_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

class BATestEntry(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    equipment = models.ForeignKey(BAEquipment, null=True, blank=True, on_delete=models.SET_NULL, related_name='tests')
    equipment_number = models.CharField(max_length=50)
    test_serial_number = models.CharField(max_length=100, db_index=True)
    person = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='ba_tests')
    test_time = models.DateTimeField()
    result = models.CharField(max_length=10, choices=[('PASS', 'PASS'), ('FAIL', 'FAIL')], default='PASS')
    alcohol_level = models.DecimalField(max_digits=6, decimal_places=3, default=0.000)
    conducted_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='conducted_ba_tests')
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'ba_test_entries'
        ordering = ['-test_time']
