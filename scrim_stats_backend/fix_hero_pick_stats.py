#!/usr/bin/env python
import os
import sys
import json
import logging
from datetime import datetime

# Add the project directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scrim_stats_backend.settings')
import django
django.setup()

from django.db.models import Q
from api.models import Match, PlayerMatchStat, Team, Player, Hero
from services.statistics_services import StatisticsService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("hero_stats_debug.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def diagnose_hero_data():
    """Diagnose how hero data is stored in PlayerMatchStat records"""
    logger.info("Starting hero data diagnosis")
    
    # Get a sample of PlayerMatchStat records
    stats = PlayerMatchStat.objects.all().order_by('-match__match_date')[:20]
    logger.info(f"Examining {len(stats)} recent player match stats")
    
    for i, stat in enumerate(stats):
        logger.info(f"Stat #{i+1} - Match ID: {stat.match_id}, Player: {stat.player}")
        
        # Check hero_played field
        if stat.hero_played is None:
            logger.info("  hero_played is None")
        else:
            logger.info(f"  hero_played: {stat.hero_played}")
            logger.info(f"  hero_played type: {type(stat.hero_played)}")
            
            # If it's a Hero instance, check attributes
            if isinstance(stat.hero_played, Hero):
                logger.info(f"  hero_played.id: {stat.hero_played.id}")
                logger.info(f"  hero_played.name: {stat.hero_played.name}")
            elif isinstance(stat.hero_played, int):
                logger.info(f"  hero_played is an integer (ID): {stat.hero_played}")
                # Try to look up the hero
                try:
                    hero = Hero.objects.get(id=stat.hero_played)
                    logger.info(f"  Looked up hero name: {hero.name}")
                except Hero.DoesNotExist:
                    logger.warning(f"  No hero found with ID {stat.hero_played}")
            else:
                logger.warning(f"  hero_played is an unexpected type: {type(stat.hero_played)}")
        
        # Check if there's a hero_played_id directly
        if hasattr(stat, 'hero_played_id'):
            logger.info(f"  hero_played_id: {stat.hero_played_id}")
        else:
            logger.info("  No hero_played_id attribute found")
            
        # Check accessing as dict/attribute
        try:
            hero_id = getattr(stat, 'hero_played_id', None)
            logger.info(f"  Access via getattr hero_played_id: {hero_id}")
        except Exception as e:
            logger.error(f"  Error accessing hero_played_id via getattr: {str(e)}")
            
        try:
            hero_id = getattr(stat.hero_played, 'id', None) if stat.hero_played else None
            logger.info(f"  Access via hero_played.id: {hero_id}")
        except Exception as e:
            logger.error(f"  Error accessing hero_played.id: {str(e)}")

def test_team_statistics(team_id):
    """Test hero pick frequency calculation for a team"""
    logger.info(f"Testing team statistics for team ID: {team_id}")
    
    # Get team info
    try:
        team = Team.objects.get(pk=team_id)
        logger.info(f"Found team: {team.team_name}")
    except Team.DoesNotExist:
        logger.error(f"Team with ID {team_id} not found")
        return
        
    # Calculate statistics
    statistics = StatisticsService.calculate_team_statistics(team_id)
    
    if not statistics:
        logger.error("Failed to calculate team statistics")
        return
        
    # Check hero pick frequency
    hero_picks = statistics.get('hero_pick_frequency', [])
    logger.info(f"Hero pick frequency: {len(hero_picks)} heroes found")
    
    for hero in hero_picks:
        logger.info(f"Hero: {hero['hero_name']}, Picks: {hero['picks']}, Wins: {hero['wins']}, Winrate: {hero['winrate']:.1f}%")
    
    # Also test direct calculation
    blue_side_matches = Match.objects.filter(blue_side_team_id=team_id)
    red_side_matches = Match.objects.filter(red_side_team_id=team_id)
    matches = (blue_side_matches | red_side_matches)
    
    player_stats = PlayerMatchStat.objects.filter(team_id=team_id, match__in=matches)
    logger.info(f"Found {player_stats.count()} player stats for team {team_id}")
    
    # Test calculating hero pick frequency directly
    hero_pick_counts = {}
    
    for stat in player_stats:
        hero = stat.hero_played
        if hero:
            if isinstance(hero, Hero):
                hero_id = hero.id
                hero_name = hero.name
            else:
                hero_id = getattr(hero, 'id', hero)
                hero_name = getattr(hero, 'name', f"Hero {hero_id}")
                
            if hero_id not in hero_pick_counts:
                hero_pick_counts[hero_id] = {
                    'hero_id': hero_id,
                    'hero_name': hero_name,
                    'picks': 0,
                    'wins': 0
                }
            
            hero_pick_counts[hero_id]['picks'] += 1
            
            # Check if this was a win
            match = stat.match
            if match and match.winning_team_id == team_id:
                hero_pick_counts[hero_id]['wins'] += 1
    
    logger.info(f"Direct calculation found {len(hero_pick_counts)} different heroes")
    
    for hero_data in sorted(hero_pick_counts.values(), key=lambda x: x['picks'], reverse=True):
        picks = hero_data['picks']
        wins = hero_data['wins']
        winrate = (wins / picks) * 100 if picks > 0 else 0
        logger.info(f"Direct: {hero_data['hero_name']}, Picks: {picks}, Wins: {wins}, Winrate: {winrate:.1f}%")

def patch_hero_pick_frequency_calculation():
    """Patch the hero pick frequency calculation in StatisticsService"""
    # This is just for showing what changes would be needed
    logger.info("Patching hero pick frequency calculation in StatisticsService")
    
    logger.info("""
    # Replace the hero pick frequency block in StatisticsService.calculate_team_statistics with:
    
    # Hero pick frequency
    hero_pick_frequency = []
    try:
        hero_pick_counts = {}
        
        # Collect all hero picks from player match stats
        for stat in player_stats:
            if stat.hero_played:
                # Handle different formats of hero_played
                if isinstance(stat.hero_played, Hero):
                    hero_id = stat.hero_played.id
                    hero_name = stat.hero_played.name
                elif isinstance(stat.hero_played, int):
                    hero_id = stat.hero_played
                    hero_name = stat.hero_name or f"Hero {hero_id}"
                else:
                    # Try to extract id and name
                    try:
                        hero_id = getattr(stat.hero_played, 'id', stat.hero_played)
                        hero_name = getattr(stat.hero_played, 'name', stat.hero_name or f"Hero {hero_id}")
                    except:
                        logger.warning(f"Could not extract hero data from {stat.hero_played}")
                        continue
                
                if hero_id not in hero_pick_counts:
                    hero_pick_counts[hero_id] = {
                        'hero_id': hero_id,
                        'hero_name': hero_name,
                        'picks': 0,
                        'wins': 0
                    }
                
                hero_pick_counts[hero_id]['picks'] += 1
                
                # Check if this was a win
                match = stat.match
                if match and match.winning_team_id == team_id:
                    hero_pick_counts[hero_id]['wins'] += 1
        
        # Convert to the expected format and calculate winrates
        for hero_data in hero_pick_counts.values():
            picks = hero_data['picks']
            wins = hero_data['wins']
            hero_pick_frequency.append({
                'hero_id': hero_data['hero_id'],
                'hero_name': hero_data['hero_name'],
                'picks': picks,
                'wins': wins,
                'winrate': (wins / picks) * 100 if picks > 0 else 0
            })
        
        # Sort by pick count and limit to top 10
        hero_pick_frequency.sort(key=lambda x: x['picks'], reverse=True)
        hero_pick_frequency = hero_pick_frequency[:10]
        
        logger.info(f"Found {len(hero_pick_frequency)} heroes played by team")
    except Exception as e:
        logger.error(f"Error calculating hero pick frequency: {str(e)}")
        logger.error(traceback.format_exc())
        # Ensure we at least have an empty list
        hero_pick_frequency = []
    """)

if __name__ == "__main__":
    logger.info("====== Starting Hero Pick Stats Diagnosis ======")
    
    # First diagnose how hero data is stored
    diagnose_hero_data()
    
    # Find a team with matches to test
    teams = Team.objects.all()
    for team in teams:
        blue_matches = Match.objects.filter(blue_side_team=team).count()
        red_matches = Match.objects.filter(red_side_team=team).count()
        total = blue_matches + red_matches
        
        if total > 0:
            logger.info(f"Team {team.team_name} (ID: {team.team_id}) has {total} matches")
            test_team_statistics(team.team_id)
            break
    
    # Show patch instructions
    patch_hero_pick_frequency_calculation()
    
    logger.info("====== Hero Pick Stats Diagnosis Complete ======") 