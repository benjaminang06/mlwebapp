from api.models import Hero, DraftPick, DraftBan, PlayerMatchStat
from django.db.models import Count, Q

class HeroService:
    """
    Service for handling hero-related operations such as:
    - Fetching heroes by criteria
    - Computing hero statistics
    - Finding hero pairing information
    """
    
    @staticmethod
    def get_all_heroes():
        """
        Get all heroes ordered by name.
        
        Returns:
            QuerySet of Hero objects
        """
        return Hero.objects.all().order_by('name')
    
    @staticmethod
    def get_hero_by_name(name):
        """
        Get a hero by its name.
        
        Args:
            name: The name of the hero to find
            
        Returns:
            Hero object or None if not found
        """
        return Hero.objects.filter(name__iexact=name).first()
    
    @staticmethod
    def get_hero_by_id(hero_id):
        """
        Get a hero by its ID.
        
        Args:
            hero_id: The ID of the hero to find
            
        Returns:
            Hero object or None if not found
        """
        try:
            return Hero.objects.get(id=hero_id)
        except Hero.DoesNotExist:
            return None
    
    @staticmethod
    def get_popular_heroes(limit=10):
        """
        Get heroes ordered by pick count.
        
        Args:
            limit: Number of heroes to return, or None for all heroes
            
        Returns:
            List of heroes ordered by popularity
        """
        query = Hero.objects.annotate(
            pick_count=Count('hero_player_stats')
        ).order_by('-pick_count')
        
        if limit is not None:
            query = query[:limit]
            
        return query
    
    @staticmethod
    def get_most_banned_heroes(limit=10):
        """
        Get heroes ordered by ban count.
        
        Args:
            limit: Number of heroes to return, or None for all heroes
            
        Returns:
            List of heroes ordered by ban count
        """
        query = Hero.objects.annotate(
            ban_count=Count('draft_bans')
        ).order_by('-ban_count')
        
        if limit is not None:
            query = query[:limit]
            
        return query
    
    @staticmethod
    def get_hero_statistics():
        """
        Get comprehensive statistics for all heroes.
        
        Returns:
            List of dictionaries with hero statistics
        """
        heroes = Hero.objects.all()
        hero_stats = []
        
        for hero in heroes:
            # Get pick stats
            picks = PlayerMatchStat.objects.filter(hero_played=hero)
            pick_count = picks.count()
            
            if pick_count > 0:
                # Calculate win rate
                wins = picks.filter(
                    Q(team=models.F('match__winning_team'))
                ).count()
                win_rate = (wins / pick_count) * 100 if pick_count > 0 else 0
                
                # Calculate average KDA and other stats
                avg_kills = picks.aggregate(avg=models.Avg('kills'))['avg'] or 0
                avg_deaths = picks.aggregate(avg=models.Avg('deaths'))['avg'] or 0
                avg_assists = picks.aggregate(avg=models.Avg('assists'))['avg'] or 0
                
                # Calculate ban count
                ban_count = DraftBan.objects.filter(hero=hero).count()
                
                hero_stats.append({
                    'hero': hero,
                    'pick_count': pick_count,
                    'ban_count': ban_count,
                    'win_rate': round(win_rate, 2),
                    'avg_kills': round(avg_kills, 2),
                    'avg_deaths': round(avg_deaths, 2),
                    'avg_assists': round(avg_assists, 2),
                })
        
        # Sort by pick count and then win rate
        hero_stats.sort(key=lambda x: (x['pick_count'], x['win_rate']), reverse=True)
        return hero_stats
    
    @staticmethod
    def get_hero_pairings(hero_id, limit=5):
        """
        Find heroes that pair well with a specific hero.
        Based on win rate when played together on the same team.
        
        Args:
            hero_id: The ID of the hero to find pairings for
            limit: Number of pairings to return, or None for all pairings
            
        Returns:
            List of hero pairing statistics
        """
        try:
            hero = Hero.objects.get(id=hero_id)
        except Hero.DoesNotExist:
            return []
            
        # Find matches where this hero was played
        matches_with_hero = PlayerMatchStat.objects.filter(
            hero_played=hero
        ).values_list('match_id', 'team_id')
        
        if not matches_with_hero:
            return []
            
        pairings = {}
        
        # For each match the hero was in, find other heroes on the same team
        for match_id, team_id in matches_with_hero:
            # Find other heroes on the same team in this match
            teammate_heroes = PlayerMatchStat.objects.filter(
                match_id=match_id,
                team_id=team_id
            ).exclude(
                hero_played=hero
            ).values_list('hero_played_id', flat=True)
            
            # Get match result
            match_won = PlayerMatchStat.objects.filter(
                match_id=match_id,
                team_id=team_id,
                team__id=models.F('match__winning_team')
            ).exists()
            
            # Update pairing stats
            for teammate_hero_id in teammate_heroes:
                if teammate_hero_id not in pairings:
                    pairings[teammate_hero_id] = {
                        'matches': 0,
                        'wins': 0,
                    }
                
                pairings[teammate_hero_id]['matches'] += 1
                if match_won:
                    pairings[teammate_hero_id]['wins'] += 1
        
        # Calculate win rates and prepare results
        pairing_stats = []
        for paired_hero_id, stats in pairings.items():
            if stats['matches'] >= 3:  # Minimum threshold for meaningful data
                try:
                    paired_hero = Hero.objects.get(id=paired_hero_id)
                    win_rate = (stats['wins'] / stats['matches']) * 100
                    
                    pairing_stats.append({
                        'hero': paired_hero,
                        'matches': stats['matches'],
                        'wins': stats['wins'],
                        'win_rate': round(win_rate, 2)
                    })
                except Hero.DoesNotExist:
                    # Skip if hero doesn't exist
                    pass
        
        # Sort by win rate
        pairing_stats.sort(key=lambda x: x['win_rate'], reverse=True)
        
        # Apply limit if specified
        if limit is not None:
            pairing_stats = pairing_stats[:limit]
            
        return pairing_stats 