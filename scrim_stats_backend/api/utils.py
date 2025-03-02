from django.db.models import Sum, Count, F, Q, Case, When, FloatField, Value
from django.db.models.functions import Coalesce

def get_player_role_stats(player_id=None, role=None):
    """
    Computes role-specific statistics for players on-demand.
    This replaces the PlayerRoleStats model with a dynamic query.
    
    Args:
        player_id: Optional filter for a specific player
        role: Optional filter for a specific role
    
    Returns:
        QuerySet with aggregated stats for the given filters
    """
    from .models import PlayerMatchStat
    
    # Start with base query
    query = PlayerMatchStat.objects.all()
    
    # Apply filters if provided
    if player_id:
        query = query.filter(player_id=player_id)
    if role:
        query = query.filter(role_played=role)
    
    # Group by player and role, then aggregate stats
    stats = query.values('player', 'role_played').annotate(
        matches_played=Count('id'),
        total_kills=Sum('kills'),
        total_deaths=Sum('deaths'),
        total_assists=Sum('assists'),
        average_kda=Coalesce(
            (Sum('kills') + Sum('assists')) / Case(
                When(total_deaths__gt=0, then=F('total_deaths')),
                default=Value(1),
                output_field=FloatField()
            ),
            0.0,
            output_field=FloatField()
        )
    ).order_by('player', 'role_played')
    
    return stats

def get_hero_pairing_stats(team_id=None, hero1=None, hero2=None):
    """
    Computes statistics for hero pairings on-demand.
    This replaces the HeroPairingStats model with a dynamic query.
    
    Args:
        team_id: Optional filter for a specific team
        hero1: Optional filter for a specific hero
        hero2: Optional filter for another specific hero
    
    Returns:
        Dictionary of hero pairings with their stats
    """
    from .models import PlayerMatchStat, Match
    
    # This is more complex as we need to find hero pairs from the same match
    results = {}
    
    # Start with base query for matches
    matches = Match.objects.all()
    if team_id:
        matches = matches.filter(Q(our_team_id=team_id) | Q(opponent_team_id=team_id))
    
    # For each match, find all hero combinations
    for match in matches:
        # Get all player stats for this match
        match_stats = PlayerMatchStat.objects.filter(match=match)
        
        # Filter by team if specified
        if team_id:
            match_stats = match_stats.filter(team_id=team_id)
        
        # Get all heroes played in this match for the specified team
        heroes_played = list(match_stats.values_list('hero_played', flat=True))
        
        # Find all combinations of heroes (pairs)
        for i in range(len(heroes_played)):
            for j in range(i+1, len(heroes_played)):
                # Sort hero names to ensure consistent key
                hero_a, hero_b = sorted([heroes_played[i], heroes_played[j]])
                
                # Skip if we're filtering for specific heroes and they don't match
                if hero1 and hero2:
                    if not ((hero_a == hero1 and hero_b == hero2) or 
                            (hero_a == hero2 and hero_b == hero1)):
                        continue
                elif hero1:
                    if hero1 not in [hero_a, hero_b]:
                        continue
                elif hero2:
                    if hero2 not in [hero_a, hero_b]:
                        continue
                
                # Create key for this hero pairing
                key = f"{hero_a}:{hero_b}"
                
                # Add to or update results
                if key not in results:
                    results[key] = {
                        'hero1': hero_a,
                        'hero2': hero_b,
                        'team_id': team_id,
                        'matches_played': 0,
                        'matches_won': 0,
                        'win_rate': 0.0
                    }
                
                results[key]['matches_played'] += 1
                
                # Check if match was won by this team
                match_won = False
                if team_id:
                    if ((match.our_team_id == team_id and match.match_outcome == 'VICTORY') or
                        (match.opponent_team_id == team_id and match.match_outcome == 'DEFEAT')):
                        match_won = True
                else:
                    # If no team filter, we consider a win for the "our_team"
                    if match.match_outcome == 'VICTORY':
                        match_won = True
                
                if match_won:
                    results[key]['matches_won'] += 1
    
    # Calculate win rates
    for key in results:
        pair = results[key]
        if pair['matches_played'] > 0:
            pair['win_rate'] = pair['matches_won'] / pair['matches_played']
    
    return results 