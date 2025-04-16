from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from datetime import datetime, timedelta
from api.models import Team, ScrimGroup, Match
from services.match_services import MatchStatsService


class MatchStatsServiceTests(TestCase):
    """Tests for the MatchStatsService methods"""
    
    def setUp(self):
        """Set up test data"""
        # Create a test user for submitted_by
        self.test_user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password123'
        )
        
        # Create test teams
        self.our_team = Team.objects.create(
            team_name="Our Team",
            team_abbreviation="OUR",
            team_category="Collegiate"
        )
        
        self.opponent_team = Team.objects.create(
            team_name="Opponent Team",
            team_abbreviation="OPP",
            team_category="Collegiate"
        )
        
        # Create a test scrim group
        self.scrim_group = ScrimGroup.objects.create(
            scrim_group_name="Test Scrim Group",
            start_date=timezone.now().date()
        )
        
        # Create test matches within the same scrim group
        self.match_date = timezone.now()
        
        # Match 1 - Game 1
        self.match1 = Match.objects.create(
            match_date=self.match_date,
            our_team=self.our_team,
            opponent_team=self.opponent_team,
            scrim_group=self.scrim_group,
            scrim_type="SCRIMMAGE",
            match_outcome="VICTORY",
            team_side="BLUE",
            game_number=1,
            submitted_by=self.test_user
        )
        
        # Match 2 - Game 2 (30 minutes later)
        self.match2 = Match.objects.create(
            match_date=self.match_date + timedelta(minutes=30),
            our_team=self.our_team,
            opponent_team=self.opponent_team,
            scrim_group=self.scrim_group,
            scrim_type="SCRIMMAGE",
            match_outcome="DEFEAT",
            team_side="RED",
            game_number=2,
            submitted_by=self.test_user
        )
    
    def test_get_or_create_scrim_group_existing(self):
        """Test retrieving an existing scrim group for matches within the time window"""
        # Use a time 1 hour after the first match (should be within 8-hour window)
        test_time = self.match_date + timedelta(hours=1)
        
        # Call the service method
        scrim_group = MatchStatsService.get_or_create_scrim_group(
            self.our_team, 
            self.opponent_team, 
            test_time,
            "SCRIMMAGE"
        )
        
        # Assert it found the existing scrim group
        self.assertEqual(scrim_group.scrim_group_id, self.scrim_group.scrim_group_id)
        
    def test_get_or_create_scrim_group_new(self):
        """Test creating a new scrim group for matches outside the time window"""
        # Use a time 10 hours after the first match (outside 8-hour window)
        test_time = self.match_date + timedelta(hours=10)
        
        # Call the service method
        scrim_group = MatchStatsService.get_or_create_scrim_group(
            self.our_team, 
            self.opponent_team, 
            test_time,
            "TOURNAMENT"  # Use a different type to ensure a new group
        )
        
        # Assert it created a new scrim group
        self.assertNotEqual(scrim_group.scrim_group_id, self.scrim_group.scrim_group_id)
        
        # Verify the new group's name follows our naming convention
        expected_name = f"{self.our_team.team_name} vs {self.opponent_team.team_name} - {test_time.strftime('%Y-%m-%d')} - TOURNAMENT"
        self.assertEqual(scrim_group.scrim_group_name, expected_name)
        
    def test_suggest_game_number(self):
        """Test suggesting the next game number based on existing matches"""
        # Use a time 1 hour after the first match
        test_time = self.match_date + timedelta(hours=1)
        
        # Call the service method
        game_number = MatchStatsService.suggest_game_number(
            self.our_team,
            self.opponent_team,
            test_time,
            "SCRIMMAGE"
        )
        
        # Should suggest game 3 since we already have games 1 and 2
        self.assertEqual(game_number, 3)
        
    def test_suggest_game_number_no_matches(self):
        """Test suggesting game number when no previous matches exist"""
        # Use a time 10 hours after (outside window, no matches)
        test_time = self.match_date + timedelta(hours=10)
        
        # Call the service method
        game_number = MatchStatsService.suggest_game_number(
            self.our_team,
            self.opponent_team,
            test_time,
            "TOURNAMENT"  # Different type than our existing SCRIMMAGE matches
        )
        
        # Should suggest game 1 since no matches in this window/type
        self.assertEqual(game_number, 1) 