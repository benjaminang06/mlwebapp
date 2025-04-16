from django.db.models import Sum, Count, Avg, F, Q, ExpressionWrapper, FloatField
from datetime import timedelta
from api.models import Match, PlayerMatchStat, ScrimGroup

class MatchStatsService:
    """
    Service for handling match statistics and calculations.
    This class contains the business logic previously in the Match model.
    """
    
    @staticmethod
    def calculate_score_details(match, save=True):
        """
        Calculate score details based on player statistics.
        Returns the calculated score_details dictionary.
        
        Args:
            match: The Match object to calculate scores for
            save: Whether to save the calculated results to the match
        """
        # Get all player stats for this match
        stats = match.player_stats.all()
        
        # Initialize score details
        score_details = {
            "final_score": {"our_team": 0, "opponent_team": 0},
            "team_totals": {
                "our_team": {
                    "kills": 0, "deaths": 0, "assists": 0, 
                    "damage_dealt": 0, "gold_earned": 0,
                    "turret_damage": 0, "damage_taken": 0
                },
                "opponent_team": {
                    "kills": 0, "deaths": 0, "assists": 0,
                    "damage_dealt": 0, "gold_earned": 0,
                    "turret_damage": 0, "damage_taken": 0
                }
            }
        }
        
        # Calculate totals from player stats
        for stat in stats:
            # Determine if this is our team based on the match relationship
            is_our_team = (stat.team.team_id == match.our_team.team_id)
            team_key = "our_team" if is_our_team else "opponent_team"
            
            # Add to kills total (which becomes the score)
            score_details["final_score"][team_key] += stat.kills
            
            # Add to team totals
            team_totals = score_details["team_totals"][team_key]
            team_totals["kills"] += stat.kills
            team_totals["deaths"] += stat.deaths
            team_totals["assists"] += stat.assists
            
            # Add other stats if they exist
            if stat.damage_dealt is not None:
                team_totals["damage_dealt"] += stat.damage_dealt
            if stat.gold_earned is not None:
                team_totals["gold_earned"] += stat.gold_earned
            if stat.turret_damage is not None:
                team_totals["turret_damage"] += stat.turret_damage
            if stat.damage_taken is not None:
                team_totals["damage_taken"] += stat.damage_taken
        
        # Save the updated score details
        if save:
            match.score_details = score_details
            match.save(update_fields=['score_details'])
        
        return score_details
    
    @staticmethod
    def determine_outcome(match, our_team_score, opponent_team_score):
        """
        Determine the match outcome based on scores.
        
        Args:
            match: The Match object to update
            our_team_score: Our team's score
            opponent_team_score: Opponent team's score
            
        Returns:
            The determined outcome ('VICTORY' or 'DEFEAT')
        """
        if our_team_score > opponent_team_score:
            return 'VICTORY'
        else:
            return 'DEFEAT'
    
    @staticmethod
    def get_team_stats(match, team):
        """
        Get aggregated statistics for a team in a match.
        
        Args:
            match: The Match object
            team: The Team object
            
        Returns:
            Dictionary of aggregated team statistics
        """
        # Calculate KDA expression
        kda_expr = ExpressionWrapper(
            (F('kills') + F('assists')) / F('deaths'),
            output_field=FloatField()
        )
        
        # Get all player stats for this team in this match
        team_stats = match.player_stats.filter(team=team)
        
        # Aggregate statistics
        aggregates = team_stats.aggregate(
            total_kills=Sum('kills'),
            total_deaths=Sum('deaths'),
            total_assists=Sum('assists'),
            total_damage_dealt=Sum('damage_dealt'),
            total_gold_earned=Sum('gold_earned'),
            total_turret_damage=Sum('turret_damage'),
            total_damage_taken=Sum('damage_taken'),
            avg_kda=Avg(kda_expr)
        )
        
        return aggregates

    @staticmethod
    def get_or_create_scrim_group(our_team, opponent_team, match_datetime, scrim_type):
        """
        Find an existing Scrim Group for these teams based on the match timestamp.
        Uses an 8-hour window centered on the provided match_datetime.
        
        Args:
            our_team: The Team object for our team
            opponent_team: The Team object for the opponent team
            match_datetime: The datetime of the match
            scrim_type: The type of scrim (SCRIMMAGE, TOURNAMENT, RANKED)
            
        Returns:
            A ScrimGroup object, either existing or newly created
        """
        # Look for matches within 8 hours (4 hours before or 4 hours after)
        time_window_start = match_datetime - timedelta(hours=4)
        time_window_end = match_datetime + timedelta(hours=4)
        
        # Find existing matches between these teams in the time window
        # Using the user-provided match datetime, not the current time
        existing_matches = Match.objects.filter(
            our_team=our_team,
            opponent_team=opponent_team,
            scrim_type=scrim_type,
            match_date__range=(time_window_start.date(), time_window_end.date())
        ).order_by('match_date')
        
        # If matches exist, use the first match's scrim group
        for match in existing_matches:
            if match.scrim_group:
                return match.scrim_group
        
        # Create a new Scrim Group if none found
        group_name = f"{our_team.team_name} vs {opponent_team.team_name} - {match_datetime.strftime('%Y-%m-%d')} - {scrim_type}"
        return ScrimGroup.objects.create(
            scrim_group_name=group_name,
            start_date=match_datetime.date()
        )
    
    @staticmethod
    def suggest_game_number(our_team, opponent_team, match_datetime, scrim_type):
        """
        Suggest the next game number based on existing matches within the 8-hour window.
        
        Args:
            our_team: The Team object for our team
            opponent_team: The Team object for the opponent team
            match_datetime: The datetime of the match
            scrim_type: The type of scrim (SCRIMMAGE, TOURNAMENT, RANKED)
            
        Returns:
            An integer suggesting the next game number
        """
        # Look for matches within 8 hours (4 hours before or 4 hours after)
        time_window_start = match_datetime - timedelta(hours=4)
        time_window_end = match_datetime + timedelta(hours=4)
        
        # Find existing matches between these teams in the time window
        existing_matches = Match.objects.filter(
            our_team=our_team,
            opponent_team=opponent_team,
            scrim_type=scrim_type,
            match_date__range=(time_window_start.date(), time_window_end.date())
        )
        
        # If no matches found, suggest game number 1
        if not existing_matches.exists():
            return 1
            
        # Otherwise, suggest the highest game number + 1
        highest_game_number = existing_matches.order_by('-game_number').first().game_number
        return highest_game_number + 1
    
    @staticmethod
    def process_match_save(match):
        """
        Process operations needed after a match is saved.
        This should be called in the view after a match is created or updated.
        
        Args:
            match: The Match object that was saved
        """
        # Calculate score details if not already calculated
        if match.player_stats.exists() and not match.score_details:
            MatchStatsService.calculate_score_details(match)
            
        # Calculate awards
        from services.award_services import AwardService
        AwardService.assign_match_awards(match)
    
    @staticmethod
    def get_match_summary(match_id):
        """
        Get a comprehensive summary of a match including team stats and player performance.
        
        Args:
            match_id: The ID of the match to summarize
            
        Returns:
            Dictionary containing match summary data
        """
        try:
            match = Match.objects.get(match_id=match_id)
        except Match.DoesNotExist:
            return {'error': 'Match not found'}
            
        # Ensure score details are calculated
        if not match.score_details:
            MatchStatsService.calculate_score_details(match)
            
        # Get team stats
        our_team_stats = MatchStatsService.get_team_stats(match, match.our_team)
        opponent_team_stats = MatchStatsService.get_team_stats(match, match.opponent_team)
        
        # Get all player stats with related player data
        player_stats = PlayerMatchStat.objects.filter(match=match).select_related('player', 'hero_played')
        
        # Get MVP and other awards
        from services.award_services import AwardService
        awards = match.awards.all().select_related('player')
        
        return {
            'match': match,
            'our_team_stats': our_team_stats,
            'opponent_team_stats': opponent_team_stats,
            'player_stats': player_stats,
            'awards': awards,
            'score_details': match.score_details
        }
