from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dispatch', '0010_techlog_briefing_packet_snapshot'),
    ]

    operations = [
        migrations.AddField(
            model_name='techlog',
            name='cc_terminated_early',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='techlog',
            name='cc_termination_reason',
            field=models.CharField(blank=True, choices=[('weather', 'Weather'), ('mechanical', 'Mechanical/Snag'), ('other', 'Other')], max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='techlog',
            name='cc_termination_notes',
            field=models.TextField(blank=True, null=True),
        ),
    ]
