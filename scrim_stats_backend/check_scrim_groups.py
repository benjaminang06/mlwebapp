import os
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scrim_stats_backend.settings')
django.setup()

# Now we can import our models
from api.models import ScrimGroup, Match

# Get all scrim groups and count their matches
print("Scrim Groups in the database:")
print("============================")

total_groups = ScrimGroup.objects.count()
print(f"Total Scrim Groups: {total_groups}")

# Groups with more than one match (actual groups)
groups_with_multiple_matches = 0

for group in ScrimGroup.objects.all():
    match_count = group.matches.count()
    print(f"Group {group.scrim_group_id}: \"{group.scrim_group_name}\"")
    print(f"  Date: {group.start_date}")
    print(f"  Match count: {match_count}")
    
    if match_count > 1:
        groups_with_multiple_matches += 1
        print("  Matches in this group:")
        for match in group.matches.all():
            blue_team = match.blue_side_team.team_name if match.blue_side_team else "Unknown"
            red_team = match.red_side_team.team_name if match.red_side_team else "Unknown"
            print(f"    - Match {match.match_id}: {blue_team} vs {red_team} ({match.match_date})")
    
    print()

print(f"Groups with multiple matches: {groups_with_multiple_matches}")
print(f"Total matches with groups: {Match.objects.filter(scrim_group__isnull=False).count()}")
print(f"Total matches: {Match.objects.count()}") 