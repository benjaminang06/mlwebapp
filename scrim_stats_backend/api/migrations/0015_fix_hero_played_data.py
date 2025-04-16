# Generated manually

from django.db import migrations


def clear_invalid_hero_data(apps, schema_editor):
    """
    Set all hero_played values to NULL because they currently contain 
    the literal string 'hero_played' instead of actual hero names,
    which would break the upcoming ForeignKey conversion.
    """
    # Get the historical model
    PlayerMatchStat = apps.get_model('api', 'PlayerMatchStat')
    
    # Use raw SQL to handle potential constraint issues
    db_alias = schema_editor.connection.alias
    schema_editor.execute(
        f"UPDATE api_playermatchstat SET hero_played = NULL WHERE hero_played = 'hero_played'"
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_make_hero_played_nullable'),
    ]

    operations = [
        # Run the function to fix the data
        migrations.RunPython(
            clear_invalid_hero_data,
            # No backwards migration needed since we're just cleaning invalid data
            migrations.RunPython.noop
        ),
    ] 