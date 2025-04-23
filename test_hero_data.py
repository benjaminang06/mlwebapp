#!/usr/bin/env python
"""
This script checks if the database has hero data for player match statistics.
"""
import os
import sys
import django

# Add the project directory to sys.path
sys.path.insert(0, os.path.abspath('.'))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scrim_stats_backend.scrim_stats_backend.settings')
django.setup()

# Now we can import Django models
from scrim_stats_backend.api.models import PlayerMatchStat, Team

def check_hero_data(team_id=None):
    """Check if there's hero data in the PlayerMatchStat table"""
    print(f"Checking hero data for {'team ' + str(team_id) if team_id else 'all teams'}")
    
    # Query to find all PlayerMatchStat entries with hero data
    query = PlayerMatchStat.objects.filter(hero_played__isnull=False)
    
    # If team_id is provided, filter by team
    if team_id:
        query = query.filter(team_id=team_id)
    
    # Count the results
    hero_data_count = query.count()
    total_count = PlayerMatchStat.objects.all().count()
    
    print(f"Found {hero_data_count} out of {total_count} PlayerMatchStat records with hero data")
    
    # If there are records with hero data, print some details
    if hero_data_count > 0:
        print("\nSample records with hero data:")
        for i, stat in enumerate(query[:5]):  # Show first 5 records
            print(f"Record {i+1}:")
            print(f"  Match ID: {stat.match_id}")
            print(f"  Player ID: {stat.player_id}")
            print(f"  Hero: {stat.hero_played}")
            print(f"  Hero name: {getattr(stat, 'hero_name', 'N/A')}")
        
        # Count heroes by frequency
        hero_counts = {}
        for stat in query:
            hero_id = stat.hero_played_id if hasattr(stat, 'hero_played_id') else stat.hero_played.id
            hero_name = getattr(stat, 'hero_name', f"Hero {hero_id}")
            
            if hero_id not in hero_counts:
                hero_counts[hero_id] = {'name': hero_name, 'count': 0}
            
            hero_counts[hero_id]['count'] += 1
        
        print("\nHero pick frequency:")
        for hero_id, data in sorted(hero_counts.items(), key=lambda x: x[1]['count'], reverse=True):
            print(f"  {data['name']} (ID: {hero_id}): {data['count']} picks")
    else:
        print("\nNo PlayerMatchStat records with hero data found.")
        print("This is why the hero pick frequency chart isn't showing up in team statistics.")
        print("\nTo fix this issue:")
        print("1. Make sure you're recording hero data when creating matches")
        print("2. Update existing matches to include hero information")
        
        # Inspect the model structure
        print("\nInspecting PlayerMatchStat model structure:")
        for field in PlayerMatchStat._meta.fields:
            if 'hero' in field.name.lower():
                print(f"  Field: {field.name}, Type: {field.get_internal_type()}")

if __name__ == "__main__":
    # Get team ID from command line argument if provided
    team_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    check_hero_data(team_id) 