# Generated by Django 4.2.19 on 2025-04-05 09:20

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0017_add_mvp_fields_to_match"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="banned_heroes",
            field=models.JSONField(
                blank=True,
                help_text="JSON array of banned heroes with format: [{hero_id: 1, team_side: 'BLUE', ban_order: 1}, ...]",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="match",
            name="draft_notes",
            field=models.TextField(
                blank=True,
                help_text="Notes about the draft phase (ban/pick strategies, etc.)",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="playermatchstat",
            name="draft_pick_order",
            field=models.IntegerField(
                blank=True,
                help_text="Order in which this hero was picked during the draft phase (1-10)",
                null=True,
            ),
        ),
    ]
