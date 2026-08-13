from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('weather', '0004_remove_weathercache_sunrise_time_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='notamcache',
            name='source',
            field=models.CharField(default='auto_fetch', max_length=20),
        ),
    ]
