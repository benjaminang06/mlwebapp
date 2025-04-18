from datetime import timedelta
from django.utils import timezone
from api.models import Match, ScrimGroup, Team

class MatchService:
    """
    Service layer for handling business logic related to Matches.
    """
    
    def assign_scrim_group_for_match(self, match: Match):
        """
        Assigns a match to a ScrimGroup. Finds the most recent match between
        the same two teams. If it occurred less than 6 hours ago, assigns the
        new match to the same ScrimGroup. Otherwise, creates a new ScrimGroup.
        """
        if not match or not match.blue_side_team or not match.red_side_team or not match.match_date:
            # Cannot proceed without essential match details
            # Consider logging a warning or raising an error
            return 

        six_hours_ago = match.match_date - timedelta(hours=6)

        # Find the most recent previous match between the same teams
        # Exclude the current match instance itself if it's already saved
        previous_match = Match.objects.filter(
            blue_side_team=match.blue_side_team,
            red_side_team=match.red_side_team,
            match_date__lt=match.match_date,
            match_date__gte=six_hours_ago
        ).order_by('-match_date').first()

        if previous_match and previous_match.scrim_group:
            # Assign to the existing ScrimGroup
            match.scrim_group = previous_match.scrim_group
        else:
            # Create a new ScrimGroup
            group_name = f"{match.blue_side_team.team_name} vs {match.red_side_team.team_name} - {match.match_date.strftime('%Y-%m-%d')}"
            
            # Check if a group with this name and date *might* already exist 
            # This handles cases where multiple matches starting a new group happen close together
            # before the first one's transaction completes fully. A more robust solution might
            # involve database constraints or locking if high concurrency is expected.
            new_group, created = ScrimGroup.objects.get_or_create(
                scrim_group_name=group_name,
                start_date=match.match_date.date(), # Use the date part for start_date
                defaults={'notes': f"Auto-created group for matches starting around {match.match_date}"}
            )
            match.scrim_group = new_group

        # Save the match again to persist the scrim_group assignment
        # Note: This save happens *after* the initial save in perform_create
        match.save(update_fields=['scrim_group']) 
        
        return match # Return the updated match instance 