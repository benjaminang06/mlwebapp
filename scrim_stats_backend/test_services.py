"""
Test script for our refactored service classes.
Run with: python manage.py shell < test_services.py
"""

from api.models import Player, Match
from services.player_services import PlayerService
from services.award_services import AwardService
from services.match_services import MatchStatsService

# Test PlayerService
print("\n--- Testing PlayerService ---")
player = Player.objects.first()
if player:
    print(f"Player: {player.current_ign}")
    
    # Test get_current_team_history
    team_history = player.get_current_team_history()
    print(f"Current team history: {team_history}")
    
    # Test get_player_primary_team
    team = PlayerService.get_player_primary_team(player)
    print(f"Primary team: {team}")
    
    # Test get_awards_count
    mvp_count = player.get_awards_count('MVP')
    print(f"MVP awards: {mvp_count}")
else:
    print("No players found in database")

# Test MatchStatsService
print("\n--- Testing MatchStatsService ---")
match = Match.objects.first()
if match:
    print(f"Match: {match}")
    
    # Test calculate_score_details
    score_details = MatchStatsService.calculate_score_details(match, save=False)
    print(f"Score details: {score_details}")
    
    # Test get_team_stats
    team_stats = MatchStatsService.get_team_stats(match, match.our_team)
    print(f"Team stats: {team_stats}")
else:
    print("No matches found in database")

print("\nAll tests completed.") 