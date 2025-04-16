from django.db.models import F, Count
from api.models import MatchAward, PlayerMatchStat

class AwardService:
    """
    Service for handling award-related operations.
    This class contains the business logic previously in the MatchAward model.
    """
    
    @staticmethod
    def assign_match_awards(match):
        """Calculate and assign all awards for a match"""
        # Clear existing awards for this match
        MatchAward.objects.filter(match=match).delete()
        
        # Get all player stats for this match
        all_stats = PlayerMatchStat.objects.filter(match=match)
        if not all_stats.exists():
            return  # No stats to calculate awards from
            
        # Get stats separated by team
        winning_team = match.our_team if match.match_outcome == 'VICTORY' else match.opponent_team
        losing_team = match.opponent_team if match.match_outcome == 'VICTORY' else match.our_team
        
        # Assign MVP based on user selection
        if match.mvp:
            # Find the stats for the selected MVP
            mvp_stat = all_stats.filter(player=match.mvp).first()
            if mvp_stat:
                MatchAward.objects.create(
                    match=match,
                    player=match.mvp,
                    award_type='MVP',
                    stat_value=mvp_stat.computed_kda
                )
        
        # Assign MVP Loss based on user selection (if any)
        if match.mvp_loss:
            # Find the stats for the selected MVP Loss
            mvp_loss_stat = all_stats.filter(player=match.mvp_loss).first()
            if mvp_loss_stat:
                MatchAward.objects.create(
                    match=match,
                    player=match.mvp_loss,
                    award_type='MVP_LOSS',
                    stat_value=mvp_loss_stat.computed_kda
                )
        
        # Best KDA across all players
        best_kda_stat = all_stats.order_by('-computed_kda').first()
        MatchAward.objects.create(
            match=match,
            player=best_kda_stat.player,
            award_type='BEST_KDA',
            stat_value=best_kda_stat.computed_kda
        )
        
        # Most kills
        most_kills_stat = all_stats.order_by('-kills').first()
        MatchAward.objects.create(
            match=match,
            player=most_kills_stat.player,
            award_type='MOST_KILLS',
            stat_value=float(most_kills_stat.kills)
        )
        
        # Most assists
        most_assists_stat = all_stats.order_by('-assists').first()
        MatchAward.objects.create(
            match=match,
            player=most_assists_stat.player,
            award_type='MOST_ASSISTS',
            stat_value=float(most_assists_stat.assists)
        )
        
        # Least deaths (minimum 1 death to avoid ties at 0)
        least_deaths_stats = all_stats.filter(deaths__gt=0).order_by('deaths')
        if least_deaths_stats.exists():
            least_deaths_stat = least_deaths_stats.first()
            MatchAward.objects.create(
                match=match,
                player=least_deaths_stat.player,
                award_type='LEAST_DEATHS',
                stat_value=float(least_deaths_stat.deaths)
            )
        
        # Optional stats that might not be recorded in every match
        
        # Most damage dealt
        damage_dealt_stats = all_stats.exclude(damage_dealt__isnull=True).filter(damage_dealt__gt=0)
        if damage_dealt_stats.exists():
            most_damage_stat = damage_dealt_stats.order_by('-damage_dealt').first()
            MatchAward.objects.create(
                match=match,
                player=most_damage_stat.player,
                award_type='MOST_DAMAGE',
                stat_value=float(most_damage_stat.damage_dealt)
            )
        
        # Most gold earned
        gold_stats = all_stats.exclude(gold_earned__isnull=True).filter(gold_earned__gt=0)
        if gold_stats.exists():
            most_gold_stat = gold_stats.order_by('-gold_earned').first()
            MatchAward.objects.create(
                match=match,
                player=most_gold_stat.player,
                award_type='MOST_GOLD',
                stat_value=float(most_gold_stat.gold_earned)
            )
        
        # Most turret damage
        turret_damage_stats = all_stats.exclude(turret_damage__isnull=True).filter(turret_damage__gt=0)
        if turret_damage_stats.exists():
            most_turret_damage_stat = turret_damage_stats.order_by('-turret_damage').first()
            MatchAward.objects.create(
                match=match,
                player=most_turret_damage_stat.player,
                award_type='MOST_TURRET_DAMAGE',
                stat_value=float(most_turret_damage_stat.turret_damage)
            )
        
        # Most damage taken
        damage_taken_stats = all_stats.exclude(damage_taken__isnull=True).filter(damage_taken__gt=0)
        if damage_taken_stats.exists():
            most_damage_taken_stat = damage_taken_stats.order_by('-damage_taken').first()
            MatchAward.objects.create(
                match=match,
                player=most_damage_taken_stat.player,
                award_type='MOST_DAMAGE_TAKEN',
                stat_value=float(most_damage_taken_stat.damage_taken)
            )
    
    @staticmethod
    def get_match_mvp(match):
        """Returns the MVP for a match (most valuable player on winning team)"""
        mvp_award = MatchAward.objects.filter(match=match, award_type='MVP').first()
        return mvp_award.player if mvp_award else None
    
    @staticmethod
    def get_match_mvp_loss(match):
        """Returns the MVP for the losing team"""
        mvp_loss_award = MatchAward.objects.filter(match=match, award_type='MVP_LOSS').first()
        return mvp_loss_award.player if mvp_loss_award else None
    
    @staticmethod
    def player_award_stats(player):
        """Get a summary of all awards a player has received"""
        # This now uses the Player.get_awards_count method to avoid duplicate counting logic
        return {
            award_type: player.get_awards_count(award_type) 
            for award_type, _ in MatchAward.AWARD_TYPE_CHOICES
        }
    
    @staticmethod
    def get_player_awards_by_type(player, award_type):
        """Get all instances of a specific award type for a player"""
        return MatchAward.objects.filter(
            player=player, 
            award_type=award_type
        ).select_related('match')
        
    @staticmethod
    def get_team_awards_summary(team):
        """Get a summary of all awards for players on a team"""
        from django.db.models import Count
        
        # Get awards for all players currently on the team
        return MatchAward.objects.filter(
            player__team_history__team=team,
            player__team_history__left_date=None
        ).values('award_type').annotate(
            count=Count('award_type'),
            players=Count('player', distinct=True)
        ).order_by('-count')
