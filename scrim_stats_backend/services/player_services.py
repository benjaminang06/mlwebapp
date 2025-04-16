from django.utils import timezone
from api.models import Player, PlayerAlias, PlayerTeamHistory

class PlayerService:
    """
    Service for handling player-related operations such as finding players,
    managing team transfers, and handling aliases.
    """
    
    @staticmethod
    def find_player_by_ign(ign, team=None):
        """
        Find a player by any of their IGNs (current or aliases),
        optionally filtering by team.
        
        Args:
            ign: The in-game name to search for
            team: Optional team to filter by (only return players on this team)
            
        Returns:
            Player instance or None if not found
        """
        # Base query for current IGN
        query = Player.objects
        if team:
            query = query.filter(team_history__team=team, team_history__left_date=None)
        
        # Try to find by current IGN
        player = query.filter(current_ign=ign).first()
        if player:
            return player
        
        # If not found by current IGN, try aliases
        if team:
            alias = PlayerAlias.objects.filter(
                alias=ign, 
                player__team_history__team=team,
                player__team_history__left_date=None
            ).first()
        else:
            alias = PlayerAlias.objects.filter(alias=ign).first()
        
        return alias.player if alias else None
    
    @staticmethod
    def get_or_create_player_for_team(ign, team, role=None):
        """
        Find a player by IGN on a specific team, or create if not found.
        
        Args:
            ign: The in-game name to search for
            team: The team the player belongs to
            role: Optional player role
            
        Returns:
            A tuple (player, created) where created is a boolean
        """
        # Try to find existing player
        player = PlayerService.find_player_by_ign(ign=ign, team=team)
        
        if player:
            return player, False
        
        # Player doesn't exist, create new
        player = Player.objects.create(
            current_ign=ign,
            primary_role=role
        )
        
        # Create initial team history record
        PlayerTeamHistory.objects.create(
            player=player,
            team=team,
            joined_date=timezone.now().date()
        )
        
        return player, True
    
    @staticmethod
    def change_player_ign(player, new_ign):
        """
        Change a player's IGN while preserving history.
        Creates an alias record for the old IGN and updates to the new one.
        
        Args:
            player: The Player object to update
            new_ign: The new in-game name
            
        Returns:
            The updated player
        """
        # Create alias for the old IGN using the model's helper method
        player.create_alias_from_current_ign()
        
        # Update to new IGN
        player.current_ign = new_ign
        player.save(update_fields=['current_ign', 'updated_at'])
        
        return player
    
    @staticmethod
    def transfer_player_to_team(player, new_team, transfer_date=None):
        """
        Transfer a player to a new team, preserving team history.
        
        Args:
            player: The Player object to transfer
            new_team: The Team object the player is transferring to
            transfer_date: Date of transfer (defaults to today)
            
        Returns:
            The updated player
        """
        if transfer_date is None:
            transfer_date = timezone.now().date()
        
        # Close out the current team history record
        current_history = player.get_current_team_history()
        
        # Only process if this is actually a team change
        if current_history and current_history.team != new_team:
            # Close the current history entry
            current_history.left_date = transfer_date
            current_history.save(update_fields=['left_date'])
            
            # Create new history record
            PlayerTeamHistory.objects.create(
                player=player,
                team=new_team,
                joined_date=transfer_date
            )
        elif not current_history:
            # If no current history exists, create a new one
            PlayerTeamHistory.objects.create(
                player=player,
                team=new_team,
                joined_date=transfer_date
            )
        
        return player
    
    @staticmethod
    def get_player_primary_team(player):
        """
        Get the player's current primary team (most recent with no left_date)
        
        Args:
            player: The Player object
            
        Returns:
            Team object or None if player isn't on a team
        """
        current_membership = player.get_current_team_history()
        return current_membership.team if current_membership else None

    @staticmethod
    def get_player_stats(player):
        """
        Get comprehensive player statistics including match performance and awards.
        
        Args:
            player: The Player object
            
        Returns:
            Dictionary of player statistics
        """
        from api.models import MatchAward
        from django.db.models import Avg, Count, Sum
        
        # Get basic stats from matches
        match_stats = player.match_stats.aggregate(
            total_matches=Count('id'),
            avg_kills=Avg('kills'),
            avg_deaths=Avg('deaths'),
            avg_assists=Avg('assists'),
            avg_kda=Avg('computed_kda'),
            total_kills=Sum('kills'),
            total_deaths=Sum('deaths'),
            total_assists=Sum('assists')
        )
        
        # Get award counts
        awards = {
            award_type: player.get_awards_count(award_type)
            for award_type, _ in MatchAward.AWARD_TYPE_CHOICES
        }
        
        # Combine into comprehensive stats
        return {
            'matches': match_stats,
            'awards': awards,
            'teams': {
                'current': PlayerService.get_player_primary_team(player),
                'history': list(player.team_history.all())
            }
        }
