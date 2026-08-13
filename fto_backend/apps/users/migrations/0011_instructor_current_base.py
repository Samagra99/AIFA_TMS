from django.db import migrations, models
import django.db.models.deletion


def backfill_current_base(apps, schema_editor):
    Instructor = apps.get_model('users', 'Instructor')
    for instructor in Instructor.objects.select_related('user').all():
        if instructor.user and instructor.user.home_base_id:
            instructor.current_base_id = instructor.user.home_base_id
            instructor.save(update_fields=['current_base'])


class Migration(migrations.Migration):

    dependencies = [
        ('infrastructure', '0001_initial'),
        ('users', '0010_alter_user_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='instructor',
            name='current_base',
            field=models.ForeignKey(
                blank=True,
                help_text='Where this instructor is currently operating from, if different from home_base',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='infrastructure.base'
            ),
        ),
        migrations.RunPython(backfill_current_base, reverse_code=migrations.RunPython.noop),
    ]
