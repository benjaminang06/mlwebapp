#!/usr/bin/env python
import os
import sys
import json
import logging

# Add the project directory to sys.path
sys.path.append('/Users/benjaminang/Desktop/Personal Projects/Esports Management App')

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scrim_stats_backend.scrim_stats_backend.settings')
import django
django.setup()

from django.db.models import Sum
from scrim_stats_backend.api.models import Match, PlayerMatchStat, Team, Player, Hero
from scrim_stats_backend.services.statistics_services import StatisticsService

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_hero_pick_frequency(team_id):
    """Test hero pick frequency calculation for a given team ID"""
    logger.info(f"Testing hero pick frequency for team ID: {team_id}")
    
    # Get team info
    try:
        team = Team.objects.get(pk=team_id)
        logger.info(f"Found team: {team.team_name}")
    except Team.DoesNotExist:
        logger.error(f"Team with ID {team_id} not found")
        return {}, []
    
    # Get matches for this team
    blue_side_matches = Match.objects.filter(blue_side_team_id=team_id)
    red_side_matches = Match.objects.filter(red_side_team_id=team_id)
    matches = (blue_side_matches | red_side_matches)
    
    logger.info(f"Found {matches.count()} matches for team")
    
    # Get player stats
    player_stats = PlayerMatchStat.objects.filter(team_id=team_id, match__in=matches)
    logger.info(f"Found {player_stats.count()} player stat records")
    
    # Debug each player stat to check hero_played values
    hero_played_count = 0
    for i, stat in enumerate(player_stats[:10]):  # Check first 10 stats
        has_hero = hasattr(stat, 'hero_played') and stat.hero_played is not None
        if has_hero:
            hero_played_count += 1
        
        logger.info(f"Player stat {i+1}:")
        logger.info(f"  Match ID: {stat.match_id if hasattr(stat, 'match_id') else stat.match.match_id}")
        logger.info(f"  Player ID: {stat.player_id}")
        logger.info(f"  Hero played: {stat.hero_played}")
        logger.info(f"  Hero name: {stat.hero_name if hasattr(stat, 'hero_name') else 'N/A'}")
    
    logger.info(f"Out of 10 sample stats, {hero_played_count} have hero_played set")
    
    # Count hero picks manually
    hero_picks = {}
    for stat in player_stats:
        hero = getattr(stat, 'hero_played', None)
        if hero:
            hero_id = hero.id if hasattr(hero, 'id') else hero
            hero_name = getattr(stat, 'hero_name', 'Unknown Hero')
            if hero_id not in hero_picks:
                hero_picks[hero_id] = {'id': hero_id, 'name': hero_name, 'count': 0}
            hero_picks[hero_id]['count'] += 1
    
    # Print results
    logger.info(f"Found {len(hero_picks)} different heroes played by this team")
    for hero in sorted(hero_picks.values(), key=lambda x: x['count'], reverse=True):
        logger.info(f"Hero {hero['name']} (ID: {hero['id']}) picked {hero['count']} times")
    
    # Now use the StatisticsService to get the official results
    stats = StatisticsService.calculate_team_statistics(team_id)
    
    # Check hero pick frequency in the statistics result
    hero_frequency = stats.get('hero_pick_frequency', [])
    logger.info(f"StatisticsService returned {len(hero_frequency)} heroes")
    
    if hero_frequency:
        for hero in hero_frequency:
            logger.info(f"Service found: {hero['hero_name']} - {hero['picks']} picks, {hero['wins']} wins, {hero['winrate']:.1f}% winrate")
    else:
        logger.warning("No heroes found in the statistics result")
    
    return hero_picks, hero_frequency

if __name__ == "__main__":
    # Get team ID from command line argument
    if len(sys.argv) > 1:
        team_id = int(sys.argv[1])
    else:
        team_id = 1  # Default to team ID 1
    
    manual_picks, service_picks = test_hero_pick_frequency(team_id)
    
    print("\nComparison summary:")
    print(f"Manual count found {len(manual_picks)} heroes")
    print(f"Service returned {len(service_picks)} heroes")
    
    if not service_picks and manual_picks:
        print("\nProblem detected: Manual count found heroes but service returned none")
        print("Possible issues:")
        print("1. The hero_played field might be None in the database")
        print("2. There might be an error in the calculation logic")
        print("3. The hero data might not be correctly formatted")
    elif not manual_picks:
        print("\nNo hero data available in the database")
        print("You need to add matches with hero data to see the hero pick frequency")
        print("\nTo fix this:")
        print("1. Make sure you're recording hero data when creating matches")
        print("2. Update existing matches to include hero information")
        print("3. Check your database schema to ensure hero_played field exists")
    else:
        print("\nSuccess! Both manual and service methods found heroes")
        print("If you're still not seeing hero pick frequency in the UI, check the frontend code") 