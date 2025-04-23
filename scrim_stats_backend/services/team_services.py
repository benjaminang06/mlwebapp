from django.utils import timezone
from django.db.models import Q

from api.models import Team, Player, PlayerTeamHistory, TeamManagerRole


class TeamService:
    """
    Service for handling team-related business logic.
    """
    
    @staticmethod
    def get_managed_teams(user):
        """
        Get teams managed by a user.
        
        Args:
            user: The User object to find managed teams for
            
        Returns:
            QuerySet of teams managed by the user
        """
        if user.is_staff:
            # Staff can see all teams
            return Team.objects.all()
        else:
            # Regular users only see teams they manage
            return Team.objects.filter(managers=user)
    
    @staticmethod
    def add_player_to_team(team, ign, primary_role=None):
        """
        Add a new player to a team.
        Creates the Player record if needed and links them to the team.
        
        Args:
            team: The Team object to add player to
            ign: In-game name for the player
            primary_role: Optional role for the player
            
        Returns:
            Tuple of (player, created) where created is a boolean
            indicating if the player is newly created
        """
        if not ign:
            raise ValueError("In-Game Name (IGN) is required")
        
        # Create the new player
        player = Player.objects.create(
            current_ign=ign,
            primary_role=primary_role  # Will be null if not provided
        )
        
        # Determine if the new player should be a starter for the given role
        make_starter = False
        if primary_role:  # Only consider for starter if role is provided
            has_existing_starter = PlayerTeamHistory.objects.filter(
                team=team,
                left_date=None,  # Ensure the history record is active
                is_starter=True,
                player__primary_role=primary_role  # Check the role on the linked player
            ).exists()
            make_starter = not has_existing_starter  # Make starter if no existing starter for this role
        
        # Link the player to this team via history
        team_history = PlayerTeamHistory.objects.create(
            player=player,
            team=team,
            joined_date=timezone.now().date(),
            is_starter=make_starter  # Set starter status based on check
        )
        
        return player, True
    
    @staticmethod
    def get_team_players(team):
        """
        Get current players for a team.
        
        Args:
            team: The Team object to get players for
            
        Returns:
            QuerySet of players currently on the team
        """
        return Player.objects.filter(
            team_history__team=team,
            team_history__left_date=None
        ).distinct().order_by('-team_history__is_starter', 'current_ign')
    
    @staticmethod
    def check_team_manager_permission(user, team, required_roles=None):
        """
        Check if a user has management permission for a team.
        
        Args:
            user: The User object to check
            team: The Team object to check permissions for
            required_roles: Optional list of roles that are required
            
        Returns:
            Boolean indicating if the user has the required permissions
        """
        if user.is_staff:
            return True
            
        if required_roles is None:
            required_roles = ['head_coach', 'assistant', 'analyst']
            
        return TeamManagerRole.objects.filter(
            user=user,
            team=team,
            role__in=required_roles
        ).exists()
    
    @staticmethod
    def get_team_statistics(team):
        """
        Get aggregated statistics for a team including match history.
        
        Args:
            team: The Team object to get statistics for
            
        Returns:
            Dictionary of team statistics
        """
        from api.models import Match
        
        # Find all matches where this team participated (either as blue or red side team)
        matches = Match.objects.filter(
            Q(blue_side_team=team) | Q(red_side_team=team)
        ).select_related('winning_team')
        
        # Calculate wins/losses based on the winning_team field
        wins = matches.filter(winning_team=team).count()
        
        # Losses are matches where:
        # 1. This team participated
        # 2. There is a winning team (not null)
        # 3. The winning team is not this team
        losses = matches.exclude(winning_team=team).filter(winning_team__isnull=False).count()
        
        # Draws are matches where there's no winner
        draws = matches.filter(winning_team__isnull=True).count()
        
        total_matches = matches.count()
        
        # Calculate additional statistics
        return {
            'total_matches': total_matches,
            'wins': wins,
            'losses': losses,
            'draws': draws,
            'win_rate': (wins / total_matches) * 100 if total_matches > 0 else 0,
            'blue_side_matches': matches.filter(blue_side_team=team).count(),
            'red_side_matches': matches.filter(red_side_team=team).count(),
        } 