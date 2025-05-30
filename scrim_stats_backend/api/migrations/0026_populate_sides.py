# Generated by Django 5.1.5 on 2025-04-16 12:08

from django.db import migrations
from django.db.models import Q

# Function to populate blue_side_team and red_side_team based on old fields
def populate_sides(apps, schema_editor):
    Match = apps.get_model('api', 'Match')
    Team = apps.get_model('api', 'Team')
    db_alias = schema_editor.connection.alias

    # Select matches that haven't been processed yet (likely those from before the model change)
    # We target matches where blue_side_team_id IS NULL as a proxy for old, unprocessed matches
    # Note: This relies on the state *before* migration 0023 runs!
    matches_to_update = Match.objects.using(db_alias).filter(blue_side_team__isnull=True)

    print(f'\nFound {matches_to_update.count()} matches to update sides for.')

    for match in matches_to_update:
        # These fields exist in the state *before* migration 0023 runs
        our_team_id = match.our_team_id
        opponent_team_id = match.opponent_team_id
        team_side = match.team_side # Value like 'BLUE' or 'RED'
        is_external = match.is_external_match # Boolean

        # Skip if essential old data is missing (shouldn't happen ideally)
        if is_external or not our_team_id or not opponent_team_id or not team_side:
             print(f"  Skipping match {match.match_id} due to missing legacy data or being external (already processed?).")
             # We could try to handle external matches too if blue/red were null there, but they shouldn't have been.
             # For now, focus on the non-external ones that caused the NOT NULL failure.
             continue 

        # Determine blue and red based on old team_side
        if team_side == 'BLUE':
            match.blue_side_team_id = our_team_id
            match.red_side_team_id = opponent_team_id
            print(f"  Match {match.match_id}: Side was BLUE. Setting Blue={our_team_id}, Red={opponent_team_id}")
        elif team_side == 'RED':
            match.blue_side_team_id = opponent_team_id
            match.red_side_team_id = our_team_id
            print(f"  Match {match.match_id}: Side was RED. Setting Blue={opponent_team_id}, Red={our_team_id}")
        else:
            # Handle unexpected team_side value if necessary
            print(f"  WARNING: Match {match.match_id} had unexpected team_side '{team_side}'. Sides not updated.")
            continue # Skip saving if side info is bad
            
        # Important: Only save the specific fields we are updating
        match.save(update_fields=['blue_side_team_id', 'red_side_team_id'])

# Optional: Reverse function if needed (might be complex/lossy)
def reverse_populate_sides(apps, schema_editor):
    # Reversing this perfectly is difficult as we lose the 'is_external_match' flag context
    # and the original our_team/opponent_team distinction might be ambiguous
    # For now, we can just print a message or make them nullable again if desired.
    print("\nSkipping reverse operation for populate_sides migration.")
    pass

class Migration(migrations.Migration):

    dependencies = [
        # This migration should run after 0025_add_nullable_sides
        ('api', '0025_add_nullable_sides'),
    ]

    operations = [
        migrations.RunPython(populate_sides, reverse_code=reverse_populate_sides),
    ]
