from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('infrastructure', '0004_aircrafttype_cruise_speed_knots_and_more'),
        ('navigation', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='aircraft',
            name='away_at_airport',
            field=models.ForeignKey(
                blank=True,
                help_text='Current airport location if away from FTO bases',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='navigation.airport'
            ),
        ),
    ]
