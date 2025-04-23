from django.db.models import Sum, Count, Avg, F, Q, ExpressionWrapper, FloatField
from datetime import timedelta
from django.utils import timezone
from api.models import Match, PlayerMatchStat, ScrimGroup, Team, MatchEditHistory
import json

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
        
        # Skip if no player stats exist
        if not stats:
            return None
        
        # Calculate total kills for each team (blue/red sides)
        blue_side_kills = sum(stat.kills for stat in stats if stat.team_id == match.blue_side_team_id)
        red_side_kills = sum(stat.kills for stat in stats if stat.team_id == match.red_side_team_id)
        
        # Create score details object
        score_details = {
            'blue_side_score': blue_side_kills,
            'red_side_score': red_side_kills,
            'blue_side_team_name': match.blue_side_team.team_name if match.blue_side_team else 'Blue Team',
            'red_side_team_name': match.red_side_team.team_name if match.red_side_team else 'Red Team',
            'score_by': 'kills'  # Indicates how score was calculated
        }
        
        # Save the updated score details
        if save:
            # Use update to avoid recursion/triggering save method
            Match.objects.filter(pk=match.pk).update(score_details=score_details)
        
        return score_details
    
    @staticmethod
    def determine_outcome(match):
        """
        Determine the match outcome based on the winning team.
        
        Args:
            match: The Match object to update
            
        Returns:
            The determined outcome ('VICTORY' or 'DEFEAT')
        """
        if not match.winning_team_id:
            return None
            
        if match.our_team_id:
            if match.winning_team_id == match.our_team_id:
                return 'VICTORY'
            else:
                return 'DEFEAT'
        else:
            # For external matches with no "our team" context, default to
            # blue side perspective
            if match.winning_team_id == match.blue_side_team_id:
                return 'VICTORY'  # Blue side won
            else:
                return 'DEFEAT'  # Red side won
    
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
    def assign_scrim_group_for_match(match: Match):
        """
        Assigns a match to a ScrimGroup. Finds the most recent match between
        the same two teams of the same type (scrimmage, tournament, etc).
        If it occurred less than 6 hours ago, assigns the new match to the same
        ScrimGroup. Otherwise, creates a new ScrimGroup.
        Also updates game_number based on position in the scrim group.
        """
        if not match or not match.blue_side_team or not match.red_side_team or not match.match_date or not match.scrim_type:
            # Cannot proceed without essential match details
            # Consider logging a warning or raising an error
            return 

        six_hours_ago = match.match_date - timedelta(hours=6)

        # Find the most recent previous match between the same teams AND of the same type
        # Exclude the current match instance itself if it's already saved
        previous_match = Match.objects.filter(
            blue_side_team=match.blue_side_team,
            red_side_team=match.red_side_team,
            scrim_type=match.scrim_type,  # Add match type to ensure only matches of same type are grouped
            match_date__lt=match.match_date,
            match_date__gte=six_hours_ago
        ).order_by('-match_date').first()

        if previous_match and previous_match.scrim_group:
            # Assign to the existing ScrimGroup
            match.scrim_group = previous_match.scrim_group
        else:
            # Create a new ScrimGroup with type included in name
            group_name = f"{match.blue_side_team.team_name} vs {match.red_side_team.team_name} - {match.match_date.strftime('%Y-%m-%d')} - {match.scrim_type}"
            
            # Check if a group with this name and date *might* already exist 
            # This handles cases where multiple matches starting a new group happen close together
            # before the first one's transaction completes fully. A more robust solution might
            # involve database constraints or locking if high concurrency is expected.
            new_group, created = ScrimGroup.objects.get_or_create(
                scrim_group_name=group_name,
                start_date=match.match_date.date(), # Use the date part for start_date
                defaults={'notes': f"Auto-created group for {match.scrim_type} matches starting around {match.match_date}"}
            )
            match.scrim_group = new_group

        # Save the match with just the scrim_group field updated
        # This will trigger the game_number recalculation in the Match.save method
        match.save(update_fields=['scrim_group']) 
        
        # Now explicitly calculate game number based on scrim group membership
        if match.scrim_group:
            # Count existing matches in this scrim group
            existing_matches = Match.objects.filter(scrim_group=match.scrim_group).exclude(pk=match.pk)
            # Set game number to be one more than the count of existing matches
            match.game_number = existing_matches.count() + 1
            # Save just the game_number to avoid recursive updates
            Match.objects.filter(pk=match.pk).update(game_number=match.game_number)
            # Update object in memory to reflect the DB change
            match.refresh_from_db(fields=['game_number'])
        
        return match # Return the updated match instance

    @staticmethod
    def process_match_save(match):
        """
        Process a match after it's been saved. Updates score details and MVP selections.
        This should be called in the Match.save() method or from views after a match is created.
        
        Args:
            match: The Match object that was just saved
        """
        # Calculate score details if player stats exist
        if match.pk:  # Only if this is an existing match
            MatchStatsService.calculate_score_details(match)
            
            # Determine outcome based on winning team
            match_outcome = MatchStatsService.determine_outcome(match)
            if match_outcome:
                # Update just the outcome field directly to avoid triggering save again
                Match.objects.filter(pk=match.pk).update(match_outcome=match_outcome)
                # Update object in memory
                match.match_outcome = match_outcome
    
    @staticmethod
    def get_match_summary(match_id):
        """
        Get a comprehensive summary of match data including player stats.
        
        Args:
            match_id: ID of the match to summarize
            
        Returns:
            Dictionary with match details and player statistics
        """
        try:
            match = Match.objects.get(pk=match_id)
        except Match.DoesNotExist:
            return {"error": "Match not found"}
        
        # Get all player stats for this match
        blue_side_stats = match.player_stats.filter(team=match.blue_side_team)
        red_side_stats = match.player_stats.filter(team=match.red_side_team)
        
        # Get team totals
        blue_team_totals = MatchStatsService.get_team_stats(match, match.blue_side_team)
        red_team_totals = MatchStatsService.get_team_stats(match, match.red_side_team)
        
        return {
            "match_id": match.match_id,
            "match_date": match.match_date,
            "match_outcome": match.match_outcome,
            "scrim_type": match.scrim_type,
            "blue_side_team": {
                "team_id": match.blue_side_team.team_id,
                "team_name": match.blue_side_team.team_name,
                "is_winner": match.winning_team_id == match.blue_side_team.team_id if match.winning_team_id else None,
                "totals": blue_team_totals
            },
            "red_side_team": {
                "team_id": match.red_side_team.team_id,
                "team_name": match.red_side_team.team_name,
                "is_winner": match.winning_team_id == match.red_side_team.team_id if match.winning_team_id else None,
                "totals": red_team_totals
            },
            "score": {
                "blue_side": match.score_details.get('blue_side_score') if match.score_details else None,
                "red_side": match.score_details.get('red_side_score') if match.score_details else None,
            },
            "mvp": {
                "player_id": match.mvp.player_id,
                "ign": match.mvp.current_ign,
                "team_id": match.player_stats.get(player=match.mvp).team.team_id if match.mvp else None
            } if match.mvp else None,
            "mvp_loss": {
                "player_id": match.mvp_loss.player_id,
                "ign": match.mvp_loss.current_ign,
                "team_id": match.player_stats.get(player=match.mvp_loss).team.team_id if match.mvp_loss else None
            } if match.mvp_loss else None
        }

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
        
        # Find existing matches between these teams in the time window, regardless of side
        # Using Q objects to handle both possibilities (teams could be on either side)
        
        # Create query conditions for matches between the two teams
        team_conditions = (
            # Option 1: our_team on blue side, opponent on red side
            (Q(blue_side_team=our_team) & Q(red_side_team=opponent_team)) |
            # Option 2: opponent on blue side, our_team on red side
            (Q(blue_side_team=opponent_team) & Q(red_side_team=our_team))
        )
        
        # Find matches within time window with correct teams and scrim type
        existing_matches = Match.objects.filter(
            team_conditions,
            scrim_type=scrim_type,
            match_date__range=(time_window_start, time_window_end)
        )
        
        # If no matches found, suggest game number 1
        if not existing_matches.exists():
            return 1
            
        # Otherwise, suggest the highest game number + 1
        highest_game_number = existing_matches.order_by('-game_number').first().game_number
        return highest_game_number + 1

    @staticmethod
    def verify_and_process_match_players(match, team_stats, opponent_stats, user):
        """
        Verify and process player statistics for a match.
        
        Args:
            match: The Match object to process
            team_stats: The stats for our team
            opponent_stats: The stats for the opponent team
            user: The user performing the action
            
        Returns:
            A tuple of (success, result) where result is processed data or an error message
        """
        # Verify permissions
        if not match.our_team.is_managed_by(user):
            return False, "You can only submit stats for teams you manage"
        
        # Process player verification
        players_to_verify = []
        
        # Process our team's stats - these should be mostly known players
        for stat in team_stats:
            player_action = MatchStatsService._resolve_player(stat, match.our_team)
            if player_action.get('needs_verification'):
                players_to_verify.append({**player_action, 'for_team': 'our_team'})
        
        # Process opponent team stats - more likely to have new players
        for stat in opponent_stats:
            player_action = MatchStatsService._resolve_player(stat, match.opponent_team)
            if player_action.get('needs_verification'):
                players_to_verify.append({**player_action, 'for_team': 'opponent_team'})
        
        # If players need verification, return them
        if players_to_verify:
            return False, {
                'message': 'Some players need verification',
                'players_to_verify': players_to_verify
            }
        
        # Create the stats
        try:
            stats_created = MatchStatsService._create_stats(match, team_stats, opponent_stats)
            return True, {
                'message': 'Stats created successfully',
                'stats_created': stats_created
            }
        except Exception as e:
            return False, f"Error creating stats: {str(e)}"
    
    @staticmethod
    def _resolve_player(stat_data, team):
        """
        Resolve a player based on stat data.
        
        Args:
            stat_data: The stat data for the player
            team: The team the player belongs to
            
        Returns:
            A dictionary with player resolution info
        """
        from services.player_services import PlayerService
        
        ign = stat_data.get('ign')
        player_id = stat_data.get('player_id')
        is_new_player = stat_data.get('is_new_player', False)
        
        # Case 1: Player ID provided & not marked as new
        if player_id and not is_new_player:
            try:
                player = Player.objects.get(pk=player_id)
                return {
                    'action': 'use_existing',
                    'player_id': player.player_id,
                    'ign': player.current_ign,
                    'needs_verification': False
                }
            except Player.DoesNotExist:
                # Player ID is invalid
                pass
        
        # Case 2: No ID, but IGN provided
        if ign:
            # Try to find by IGN
            player = PlayerService.find_player_by_ign(ign=ign, team=team)
            
            if player:
                # Found by IGN
                return {
                    'action': 'use_existing',
                    'player_id': player.player_id,
                    'ign': player.current_ign,
                    'needs_verification': False
                }
        
        # Case 3: Marked as new player
        if is_new_player and ign:
            # Create a new player
            return {
                'action': 'create_new',
                'ign': ign,
                'team_id': team.team_id,
                'role_played': stat_data.get('role_played'),
                'needs_verification': True,
                'verification_type': 'new_player'
            }
        
        # Case 4: No ID, IGN not found
        if ign:
            # Need to create a new player
            return {
                'action': 'create_new',
                'ign': ign,
                'team_id': team.team_id,
                'role_played': stat_data.get('role_played'),
                'needs_verification': True,
                'verification_type': 'ign_not_found'
            }
        
        # Default case: Cannot resolve player
        return {
            'action': 'error',
            'error': 'Cannot resolve player - missing ID and IGN',
            'needs_verification': True,
            'verification_type': 'missing_data'
        }
        
    @staticmethod
    def _create_stats(match, team_stats, opponent_stats):
        """
        Create player match statistics.
        
        Args:
            match: The Match object to create stats for
            team_stats: Stats for our team
            opponent_stats: Stats for the opponent team
            
        Returns:
            Dictionary with counts of stats created
        """
        from services.player_services import PlayerService
        
        stats_created = {
            'our_team': 0,
            'opponent_team': 0
        }
        
        # Process our team stats
        for stat in team_stats:
            player_id = stat.get('player_id')
            ign = stat.get('ign')
            is_new_player = stat.get('is_new_player', False)
            
            # Find or create player
            if is_new_player:
                player, created = PlayerService.get_or_create_player_for_team(
                    ign=ign,
                    team=match.our_team,
                    role=stat.get('role_played')
                )
            else:
                try:
                    player = Player.objects.get(pk=player_id)
                except Player.DoesNotExist:
                    player = PlayerService.find_player_by_ign(ign=ign, team=match.our_team)
                    if not player:
                        player, _ = PlayerService.get_or_create_player_for_team(
                            ign=ign,
                            team=match.our_team,
                            role=stat.get('role_played')
                        )
            
            # Create the player stat
            PlayerMatchStat.objects.create(
                match=match,
                player=player,
                team=match.our_team,
                role_played=stat.get('role_played'),
                hero_played_id=stat.get('hero_played'),
                kills=stat.get('kills', 0),
                deaths=stat.get('deaths', 0),
                assists=stat.get('assists', 0),
                kda=stat.get('kda'),
                damage_dealt=stat.get('damage_dealt'),
                damage_taken=stat.get('damage_taken'),
                turret_damage=stat.get('turret_damage'),
                teamfight_participation=stat.get('teamfight_participation'),
                gold_earned=stat.get('gold_earned'),
                player_notes=stat.get('player_notes'),
                medal=stat.get('medal')
            )
            
            stats_created['our_team'] += 1
        
        # Process opponent team stats
        for stat in opponent_stats:
            player_id = stat.get('player_id')
            ign = stat.get('ign')
            is_new_player = stat.get('is_new_player', False)
            
            # Find or create player
            if is_new_player:
                player, created = PlayerService.get_or_create_player_for_team(
                    ign=ign,
                    team=match.opponent_team,
                    role=stat.get('role_played')
                )
            else:
                try:
                    player = Player.objects.get(pk=player_id)
                except Player.DoesNotExist:
                    player = PlayerService.find_player_by_ign(ign=ign, team=match.opponent_team)
                    if not player:
                        player, _ = PlayerService.get_or_create_player_for_team(
                            ign=ign,
                            team=match.opponent_team,
                            role=stat.get('role_played')
                        )
            
            # Create the player stat
            PlayerMatchStat.objects.create(
                match=match,
                player=player,
                team=match.opponent_team,
                role_played=stat.get('role_played'),
                hero_played_id=stat.get('hero_played'),
                kills=stat.get('kills', 0),
                deaths=stat.get('deaths', 0),
                assists=stat.get('assists', 0),
                kda=stat.get('kda'),
                damage_dealt=stat.get('damage_dealt'),
                damage_taken=stat.get('damage_taken'),
                turret_damage=stat.get('turret_damage'),
                teamfight_participation=stat.get('teamfight_participation'),
                gold_earned=stat.get('gold_earned'),
                player_notes=stat.get('player_notes'),
                medal=stat.get('medal')
            )
            
            stats_created['opponent_team'] += 1
        
        # Update match score details
        match.update_score_details()
        
        return stats_created

    @staticmethod
    def update_match(match_id, match_data, user):
        """
        Update an existing match with provided data.
        Creates an edit history entry to track changes.
        
        Args:
            match_id: ID of the match to update
            match_data: Dictionary of fields to update
            user: User making the edit
            
        Returns:
            Updated Match object
        """
        try:
            # Get the match to update
            match = Match.objects.get(pk=match_id)
            
            # Save previous values for history
            previous_values = {
                'match_date': match.match_date,
                'scrim_type': match.scrim_type,
                'blue_side_team_id': match.blue_side_team_id,
                'red_side_team_id': match.red_side_team_id,
                'winning_team_id': match.winning_team_id,
                'general_notes': match.general_notes,
                'match_duration': match.match_duration,
                'game_number': match.game_number,
            }
            
            # Track which fields are being updated
            updated_fields = []
            
            # Process match_date if provided
            if 'match_date' in match_data:
                match.match_date = match_data['match_date']
                updated_fields.append('match_date')
            
            # Process scrim_type if provided
            if 'scrim_type' in match_data:
                match.scrim_type = match_data['scrim_type']
                updated_fields.append('scrim_type')
            
            # Process team assignments if provided
            if 'blue_side_team' in match_data:
                match.blue_side_team_id = match_data['blue_side_team']
                updated_fields.append('blue_side_team')
            
            if 'red_side_team' in match_data:
                match.red_side_team_id = match_data['red_side_team']
                updated_fields.append('red_side_team')
            
            # Process winning team if provided
            if 'winning_team' in match_data:
                match.winning_team_id = match_data['winning_team']
                updated_fields.append('winning_team')
                # Update match_outcome based on winning_team
                match.match_outcome = MatchStatsService.determine_outcome(match)
                updated_fields.append('match_outcome')
            
            # Process other fields
            if 'general_notes' in match_data:
                match.general_notes = match_data['general_notes']
                updated_fields.append('general_notes')
            
            if 'match_duration' in match_data:
                match.match_duration = match_data['match_duration']
                updated_fields.append('match_duration')
            
            if 'game_number' in match_data:
                match.game_number = match_data['game_number']
                updated_fields.append('game_number')
            
            # Save the updated match
            match.save(update_fields=updated_fields)
            
            # Create edit history entry
            MatchEditHistory.objects.create(
                match=match,
                edited_by=user,
                previous_values=json.dumps(previous_values),
                new_values=json.dumps({field: match_data.get(field) for field in updated_fields}),
                edit_type='MATCH_METADATA',
                edit_reason=match_data.get('edit_reason', 'Match information updated')
            )
            
            # Recalculate score details if necessary
            if 'recalculate_score' in match_data and match_data['recalculate_score']:
                MatchStatsService.calculate_score_details(match)
            
            return match
            
        except Match.DoesNotExist:
            raise ValueError(f"Match with ID {match_id} does not exist")
        except Exception as e:
            raise Exception(f"Error updating match: {str(e)}")
    
    @staticmethod
    def update_player_stats(stats_id, stats_data, user):
        """
        Update player statistics for a match.
        Creates an edit history entry to track changes.
        
        Args:
            stats_id: ID of the PlayerMatchStat to update
            stats_data: Dictionary of fields to update
            user: User making the edit
            
        Returns:
            Updated PlayerMatchStat object
        """
        try:
            # Get the player stats to update
            player_stat = PlayerMatchStat.objects.get(pk=stats_id)
            match = player_stat.match
            
            # Save previous values for history
            previous_values = {
                'kills': player_stat.kills,
                'deaths': player_stat.deaths,
                'assists': player_stat.assists,
                'damage_dealt': player_stat.damage_dealt,
                'damage_taken': player_stat.damage_taken,
                'turret_damage': player_stat.turret_damage,
                'teamfight_participation': player_stat.teamfight_participation,
                'gold_earned': player_stat.gold_earned,
                'player_notes': player_stat.player_notes,
                'role_played': player_stat.role_played,
                'hero_played_id': player_stat.hero_played_id,
                'medal': player_stat.medal,
            }
            
            # Track which fields are being updated
            updated_fields = []
            
            # Process KDA stats
            for field in ['kills', 'deaths', 'assists']:
                if field in stats_data:
                    setattr(player_stat, field, stats_data[field])
                    updated_fields.append(field)
            
            # Process other numeric stats
            for field in ['damage_dealt', 'damage_taken', 'turret_damage', 'teamfight_participation', 'gold_earned']:
                if field in stats_data:
                    setattr(player_stat, field, stats_data[field])
                    updated_fields.append(field)
            
            # Process text fields
            if 'player_notes' in stats_data:
                player_stat.player_notes = stats_data['player_notes']
                updated_fields.append('player_notes')
            
            if 'role_played' in stats_data:
                player_stat.role_played = stats_data['role_played']
                updated_fields.append('role_played')
            
            # Process hero played
            if 'hero_played' in stats_data:
                player_stat.hero_played_id = stats_data['hero_played']
                updated_fields.append('hero_played')
            
            # Process medal
            if 'medal' in stats_data:
                player_stat.medal = stats_data['medal']
                updated_fields.append('medal')
            
            # Save the updated player stats
            player_stat.save(update_fields=updated_fields)
            
            # Create edit history entry
            MatchEditHistory.objects.create(
                match=match,
                edited_by=user,
                previous_values=json.dumps(previous_values),
                new_values=json.dumps({field: stats_data.get(field) for field in updated_fields}),
                edit_type='PLAYER_STATS',
                edit_reason=stats_data.get('edit_reason', 'Player statistics updated'),
                related_player_stat_id=stats_id
            )
            
            # Recalculate match score details
            MatchStatsService.calculate_score_details(match)
            
            return player_stat
            
        except PlayerMatchStat.DoesNotExist:
            raise ValueError(f"Player stat with ID {stats_id} does not exist")
        except Exception as e:
            raise Exception(f"Error updating player stats: {str(e)}")
    
    @staticmethod
    def get_match_edit_history(match_id):
        """
        Get edit history for a match.
        
        Args:
            match_id: ID of the match
            
        Returns:
            QuerySet of MatchEditHistory objects for the match
        """
        return MatchEditHistory.objects.filter(match_id=match_id).order_by('-created_at')
    
    @staticmethod
    def restore_match_version(history_id, user):
        """
        Restore a previous version of a match from edit history.
        
        Args:
            history_id: ID of the history entry to restore
            user: User performing the restore
            
        Returns:
            Updated Match object
        """
        try:
            # Get the history entry
            history = MatchEditHistory.objects.get(pk=history_id)
            match = history.match
            
            # Get the previous values from the history entry
            previous_values = json.loads(history.previous_values)
            
            # If this is a match metadata edit, restore the match fields
            if history.edit_type == 'MATCH_METADATA':
                # Save current values for new history entry
                current_values = {
                    'match_date': match.match_date,
                    'scrim_type': match.scrim_type,
                    'blue_side_team_id': match.blue_side_team_id,
                    'red_side_team_id': match.red_side_team_id,
                    'winning_team_id': match.winning_team_id,
                    'general_notes': match.general_notes,
                    'match_duration': match.match_duration,
                    'game_number': match.game_number,
                }
                
                # Update the match with the previous values
                updated_fields = []
                for field, value in previous_values.items():
                    if hasattr(match, field):
                        setattr(match, field, value)
                        updated_fields.append(field)
                
                # Save the updated match
                match.save(update_fields=updated_fields)
                
                # Create new history entry for the restoration
                MatchEditHistory.objects.create(
                    match=match,
                    edited_by=user,
                    previous_values=json.dumps(current_values),
                    new_values=json.dumps(previous_values),
                    edit_type='MATCH_RESTORE',
                    edit_reason=f"Restored to version from {history.created_at}"
                )
            
            # If this is a player stats edit, restore the player stats
            elif history.edit_type == 'PLAYER_STATS' and history.related_player_stat_id:
                try:
                    # Get the player stats
                    player_stat = PlayerMatchStat.objects.get(pk=history.related_player_stat_id)
                    
                    # Save current values for new history entry
                    current_values = {
                        'kills': player_stat.kills,
                        'deaths': player_stat.deaths,
                        'assists': player_stat.assists,
                        'damage_dealt': player_stat.damage_dealt,
                        'damage_taken': player_stat.damage_taken,
                        'turret_damage': player_stat.turret_damage,
                        'teamfight_participation': player_stat.teamfight_participation,
                        'gold_earned': player_stat.gold_earned,
                        'player_notes': player_stat.player_notes,
                        'role_played': player_stat.role_played,
                        'hero_played_id': player_stat.hero_played_id,
                        'medal': player_stat.medal,
                    }
                    
                    # Update the player stats with the previous values
                    updated_fields = []
                    for field, value in previous_values.items():
                        if hasattr(player_stat, field):
                            setattr(player_stat, field, value)
                            updated_fields.append(field)
                    
                    # Save the updated player stats
                    player_stat.save(update_fields=updated_fields)
                    
                    # Create new history entry for the restoration
                    MatchEditHistory.objects.create(
                        match=match,
                        edited_by=user,
                        previous_values=json.dumps(current_values),
                        new_values=json.dumps(previous_values),
                        edit_type='PLAYER_STATS_RESTORE',
                        edit_reason=f"Restored player stats to version from {history.created_at}",
                        related_player_stat_id=history.related_player_stat_id
                    )
                    
                    # Recalculate match score details
                    MatchStatsService.calculate_score_details(match)
                
                except PlayerMatchStat.DoesNotExist:
                    raise ValueError(f"Player stat with ID {history.related_player_stat_id} does not exist")
            
            return match
            
        except MatchEditHistory.DoesNotExist:
            raise ValueError(f"Edit history with ID {history_id} does not exist")
        except Exception as e:
            raise Exception(f"Error restoring match version: {str(e)}")
