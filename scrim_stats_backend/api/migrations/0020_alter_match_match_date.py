# Generated by Django 4.2.19 on 2025-04-16 00:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0019_remove_match_banned_heroes_remove_match_draft_notes_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="match",
            name="match_date",
            field=models.DateTimeField(
                help_text="The date and time when the match occurred"
            ),
        ),
    ]
