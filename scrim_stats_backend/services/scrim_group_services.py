from django.utils import timezone
from api.models import ScrimGroup, Match

class ScrimGroupService:
    """
    Service for handling scrim group operations such as creating groups,
    finding groups, and adding matches to groups.
    """
    
    @staticmethod
    def create_scrim_group(name, start_date=None, notes=None):
        """
        Create a new scrim group.
        
        Args:
            name: The name of the scrim group
            start_date: The start date of the scrim group (defaults to today)
            notes: Optional notes about the scrim group
            
        Returns:
            The created ScrimGroup instance
        """
        if start_date is None:
            start_date = timezone.now().date()
            
        return ScrimGroup.objects.create(
            scrim_group_name=name,
            start_date=start_date,
            notes=notes
        )
        
    @staticmethod
    def find_or_create_scrim_group(teams, match_date, scrim_type, max_hour_window=8):
        """
        Find an existing scrim group that matches the criteria or create a new one.
        
        Args:
            teams: List of teams participating in the scrim
            match_date: Date of the match
            scrim_type: Type of the match (SCRIMMAGE, TOURNAMENT, etc.)
            max_hour_window: Maximum hours to consider for grouping matches
            
        Returns:
            A ScrimGroup instance
        """
        date_start = match_date - timezone.timedelta(hours=max_hour_window)
        date_end = match_date + timezone.timedelta(hours=max_hour_window)
        
        # Find scrim groups with matches involving the same teams on the same day
        # and with the same scrim type
        team_ids = [team.team_id for team in teams if team]
        
        # Look for matches within time window involving same teams
        matches_in_window = Match.objects.filter(
            match_date__range=(date_start, date_end),
            scrim_type=scrim_type
        ).filter(
            blue_side_team_id__in=team_ids
        ).filter(
            red_side_team_id__in=team_ids
        ).exclude(
            scrim_group=None
        ).order_by('-match_date')
        
        # If we found matches in existing scrim groups, use the most recent one
        if matches_in_window.exists():
            return matches_in_window.first().scrim_group
            
        # Otherwise create a new group
        team_names = []
        for team in teams:
            if team:
                name = team.team_abbreviation or team.team_name
                if name:
                    team_names.append(name)
        
        if len(team_names) >= 2:
            group_name = f"{team_names[0]} vs {team_names[1]} {scrim_type.capitalize()} ({match_date.strftime('%Y-%m-%d')})"
        else:
            group_name = f"{scrim_type.capitalize()} Group ({match_date.strftime('%Y-%m-%d')})"
            
        notes = f"Automatically created for {scrim_type.lower()} matches on {match_date.strftime('%Y-%m-%d')}"
        
        return ScrimGroupService.create_scrim_group(
            name=group_name,
            start_date=match_date.date(),
            notes=notes
        )
    
    @staticmethod
    def get_matches_in_group(scrim_group):
        """
        Get all matches in a scrim group, ordered by game number.
        
        Args:
            scrim_group: The ScrimGroup instance
            
        Returns:
            QuerySet of Match objects
        """
        return Match.objects.filter(scrim_group=scrim_group).order_by('game_number')
    
    @staticmethod
    def get_scrim_group_stats(scrim_group):
        """
        Get statistics for a scrim group.
        
        Args:
            scrim_group: The ScrimGroup instance
            
        Returns:
            Dictionary with statistics
        """
        matches = ScrimGroupService.get_matches_in_group(scrim_group)
        teams = {}
        
        # Collect team stats
        for match in matches:
            blue_team = match.blue_side_team
            red_team = match.red_side_team
            winning_team = match.winning_team
            
            # Initialize team stats if not seen before
            for team in [blue_team, red_team]:
                if team and team.team_id not in teams:
                    teams[team.team_id] = {
                        'team': team,
                        'wins': 0,
                        'losses': 0,
                        'matches': 0,
                        'blue_side_matches': 0,
                        'red_side_matches': 0,
                    }
            
            # Update match counts
            if blue_team:
                teams[blue_team.team_id]['matches'] += 1
                teams[blue_team.team_id]['blue_side_matches'] += 1
                
            if red_team:
                teams[red_team.team_id]['matches'] += 1
                teams[red_team.team_id]['red_side_matches'] += 1
                
            # Update win/loss stats
            if winning_team:
                # Winner gets a win
                if winning_team.team_id in teams:
                    teams[winning_team.team_id]['wins'] += 1
                
                # Other team gets a loss
                if blue_team and red_team:
                    losing_team_id = red_team.team_id if winning_team.team_id == blue_team.team_id else blue_team.team_id
                    if losing_team_id in teams:
                        teams[losing_team_id]['losses'] += 1
                        
        # Calculate win rates and sort by wins
        team_stats = []
        for team_data in teams.values():
            if team_data['matches'] > 0:
                team_data['win_rate'] = team_data['wins'] / team_data['matches']
            else:
                team_data['win_rate'] = 0
            team_stats.append(team_data)
            
        team_stats.sort(key=lambda x: (x['win_rate'], x['wins']), reverse=True)
        
        return {
            'match_count': matches.count(),
            'team_stats': team_stats,
            'start_date': scrim_group.start_date,
            'scrim_type': matches.first().scrim_type if matches.exists() else None
        } 