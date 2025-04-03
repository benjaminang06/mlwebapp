from django.db import migrations
from django.db.models import Q

def populate_hero_data(apps, schema_editor):
    """
    Populate hero foreign keys in PlayerMatchStat and DraftInfo
    by looking up existing hero names in the Hero model.
    """
    Hero = apps.get_model('api', 'Hero')
    PlayerMatchStat = apps.get_model('api', 'PlayerMatchStat')
    DraftInfo = apps.get_model('api', 'DraftInfo')
    
    # Create a lookup of existing heroes by name
    heroes_by_name = {hero.name.lower(): hero for hero in Hero.objects.all()}
    
    # Process PlayerMatchStat records
    stats_updated = 0
    stats_missing = 0
    
    for stat in PlayerMatchStat.objects.all():
        # Check if the hero_played value is likely a string and not already a FK
        if stat.hero_played_id is None and hasattr(stat, 'hero_played') and isinstance(stat.hero_played, str) and stat.hero_played:
            # Try to find the hero by name (case-insensitive)
            hero_name = stat.hero_played.lower()
            if hero_name in heroes_by_name:
                stat.hero_played = heroes_by_name[hero_name]
                stat.save(update_fields=['hero_played'])
                stats_updated += 1
            else:
                # Create missing hero if not found
                new_hero = Hero.objects.create(
                    name=stat.hero_played,
                    role="Unknown"
                )
                heroes_by_name[stat.hero_played.lower()] = new_hero
                stat.hero_played = new_hero
                stat.save(update_fields=['hero_played'])
                stats_missing += 1
    
    print(f"Updated {stats_updated} PlayerMatchStat records with hero references")
    print(f"Created {stats_missing} new heroes for PlayerMatchStat records")
    
    # Process DraftInfo records
    drafts_updated = 0
    drafts_missing = 0
    
    for draft in DraftInfo.objects.all():
        # Check if the hero value is likely a string and not already a FK
        if draft.hero_id is None and hasattr(draft, 'hero') and isinstance(draft.hero, str) and draft.hero:
            # Try to find the hero by name (case-insensitive)
            hero_name = draft.hero.lower()
            if hero_name in heroes_by_name:
                draft.hero = heroes_by_name[hero_name]
                draft.save(update_fields=['hero'])
                drafts_updated += 1
            else:
                # Create missing hero if not found
                new_hero = Hero.objects.create(
                    name=draft.hero,
                    role="Unknown"
                )
                heroes_by_name[draft.hero.lower()] = new_hero
                draft.hero = new_hero
                draft.save(update_fields=['hero'])
                drafts_missing += 1
    
    print(f"Updated {drafts_updated} DraftInfo records with hero references")
    print(f"Created {drafts_missing} new heroes for DraftInfo records")

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_rename_api_draftin_team_id_fc828d_idx_api_draftin_team_id_369373_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(
            populate_hero_data,
            migrations.RunPython.noop
        ),
    ] 