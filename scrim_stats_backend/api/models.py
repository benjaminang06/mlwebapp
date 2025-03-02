from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Team(models.Model):
    """
    Represents any team (your own teams or opponent teams).
    """
    team_id = models.AutoField(primary_key=True)
    team_name = models.CharField(max_length=100)
    team_abbreviation = models.CharField(max_length=10)
    team_category = models.CharField(max_length=20)  # Collegiate, Amateur, Pro
    managers = models.ManyToManyField(
        User, 
        related_name='managed_teams',
        blank=True  # Make this field optional
    )
    is_opponent_only = models.BooleanField(
        default=False,
        verbose_name="Opponent Team Only",
        help_text="Check this if this team is only used as an opponent and not managed by any users"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.team_name
    
    def is_managed_by(self, user):
        """Check if this team is managed by the given user with appropriate roles"""
        # Check if user has any role for this team
        return self.manager_roles.filter(user=user).exists()

    def is_managed_by_role(self, user, roles=None):
        """Check if user has specific role(s) for this team"""
        if roles is None:
            roles = ['head_coach', 'assistant', 'analyst']  # Default roles with edit permission
        
        return self.manager_roles.filter(user=user, role__in=roles).exists()

class Player(models.Model):
    """
    Represents a player who belongs to a team.
    Players can have multiple aliases (previous in-game names).
    """
    player_id = models.AutoField(primary_key=True)
    teams = models.ManyToManyField(Team, through='PlayerTeamHistory', related_name='players')
    current_ign = models.CharField(max_length=100)  # Current in-game name
    ROLE_CHOICES = [
        ('JUNGLER', 'Jungler'),
        ('MID', 'Mid Laner'),
        ('ROAMER', 'Roamer'), 
        ('EXP', 'Exp Laner'),
        ('GOLD', 'Gold Laner'),
        ('FLEX', 'Flex Player'),
        ('COACH', 'Coach'),
        ('ANALYST', 'Analyst'),
    ]
    primary_role = models.CharField(
        max_length=20, 
        choices=ROLE_CHOICES,
        blank=True, 
        null=True
    )
    profile_image_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.current_ign

    def change_ign(self, new_ign):
        """
        Change a player's IGN while preserving history.
        Creates an alias record for the old IGN and updates to the new one.
        """
        # Create alias for the old IGN
        if self.current_ign:
            PlayerAlias.objects.create(
                player=self,
                alias=self.current_ign
            )
        
        # Update to new IGN
        self.current_ign = new_ign
        self.save()
        
        return self
    
    @classmethod
    def find_by_ign(cls, ign, team=None):
        """
        Find a player by any of their IGNs (current or aliases),
        optionally filtering by team.
        """
        # Base query for current IGN
        query = cls.objects
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

    @classmethod
    def get_or_create_for_team(cls, ign, team, role=None):
        """
        Find a player by IGN on a specific team, or create if not found.
        Returns a tuple (player, created) where created is a boolean.
        """
        player = cls.find_by_ign(ign=ign, team=team)
        
        if player:
            return player, False
        
        # Player doesn't exist, create new
        player = cls.objects.create(
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

    def transfer_to_team(self, new_team, transfer_date=None):
        """
        Transfer this player to a new team, preserving team history.
        
        Args:
            new_team: The Team object the player is transferring to
            transfer_date: Date of transfer (defaults to today)
        """
        if transfer_date is None:
            transfer_date = timezone.now().date()
        
        # Close out the current team history record
        current_history = self.team_history.filter(left_date=None).first()
        if current_history and current_history.team != new_team:
            current_history.left_date = transfer_date
            current_history.save()
        
        # Create new history record only if it's a different team
        if self.team != new_team:
            PlayerTeamHistory.objects.create(
                player=self,
                team=new_team,
                joined_date=transfer_date
            )
            
            # Update the current team
            self.team = new_team
            self.save()
        
        return self

    @property
    def primary_team(self):
        """Get the player's current primary team (most recent with no left_date)"""
        current_membership = self.team_history.filter(left_date=None).first()
        return current_membership.team if current_membership else None
        
    def count_mvps(self):
        """Count the number of times this player has been MVP"""
        return self.awards.filter(award_type='MVP').count()
        
    def count_mvp_losses(self):
        """Count the number of times this player has been MVP of the losing team"""
        return self.awards.filter(award_type='MVP_LOSS').count()
        
    def get_award_stats(self):
        """Get a summary of all awards this player has received"""
        from django.db.models import Count
        
        # Count awards by type
        award_counts = self.awards.values('award_type').annotate(count=Count('award_type'))
        
        # Format into a dictionary
        return {
            item['award_type']: item['count'] for item in award_counts
        }

class PlayerAlias(models.Model):
    """
    Represents previous in-game names (IGNs) used by a player.
    This allows tracking player history even when they change their name.
    """
    alias_id = models.AutoField(primary_key=True)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='aliases')
    alias = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.player.current_ign} - {self.alias}"

class ScrimGroup(models.Model):
    """
    Represents a collection of related matches (e.g., "ADMU vs UST Scrim").
    A scrim group can contain multiple individual match entries.
    """
    scrim_group_id = models.AutoField(primary_key=True)
    scrim_group_name = models.CharField(max_length=200)
    start_date = models.DateField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.scrim_group_name

class Match(models.Model):
    """
    Represents an individual match within a scrim group.
    Contains meta-data about the match and is linked to player statistics.
    """
    match_id = models.AutoField(primary_key=True)
    scrim_group = models.ForeignKey(ScrimGroup, on_delete=models.CASCADE, related_name='matches', null=True, blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Change from DateTimeField to DateField
    match_date = models.DateField(help_text="The date when the match occurred")
    
    # Existing fields
    our_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='home_matches')
    opponent_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='away_matches')
    
    # Add game duration field
    match_duration = models.DurationField(
        null=True, 
        blank=True,
        help_text="Duration of the match (HH:MM:SS)"
    )
    
    # New field to indicate if this is an external match we're just tracking
    is_external_match = models.BooleanField(
        default=False,
        verbose_name="External Match",
        help_text="Whether this match is between external teams (not involving our team)"
    )
    
    # Add choices for scrim_type
    SCRIM_TYPE_CHOICES = [
        ('SCRIMMAGE', 'Scrimmage'),
        ('TOURNAMENT', 'Tournament'),
        ('RANKED', 'Ranked')
    ]
    scrim_type = models.CharField(
        max_length=50, 
        choices=SCRIM_TYPE_CHOICES,
        default='PRACTICE'
    )
    
    # Add choices for match_outcome
    MATCH_OUTCOME_CHOICES = [
        ('VICTORY', 'Victory'),
        ('DEFEAT', 'Defeat')
    ]
    match_outcome = models.CharField(
        max_length=10, 
        choices=MATCH_OUTCOME_CHOICES
    )
    
    score_details = models.JSONField(blank=True, null=True)
    general_notes = models.TextField(blank=True, null=True)
    game_number = models.IntegerField()
    
    # Add choices for team_side
    TEAM_SIDE_CHOICES = [
        ('BLUE', 'Blue Side'),
        ('RED', 'Red Side')
    ]
    team_side = models.CharField(
        max_length=10, 
        choices=TEAM_SIDE_CHOICES
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.scrim_group.scrim_group_name} - Game {self.game_number}"

    def calculate_score_details(self, save=True):
        """
        Calculate and update score_details based on player statistics.
        Returns the calculated score_details dictionary.
        """
        # Get all player stats for this match
        stats = self.player_stats.all()
        
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
            is_our_team = (stat.team.team_id == self.our_team.team_id)
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
            self.score_details = score_details
            self.save(update_fields=['score_details'])
        
        return score_details
    
    def save(self, *args, **kwargs):
        """Override save to ensure match_outcome is consistent with score"""
        # First, call the original save method
        super().save(*args, **kwargs)
        
        # If we have player stats and no score_details yet, calculate them
        if self.player_stats.exists():
            # Only recalculate if we're not already updating from calculate_score_details
            update_fields = kwargs.get('update_fields', None)
            if update_fields is None or 'score_details' not in update_fields:
                self.calculate_score_details()

    def get_mvp(self):
        """Returns the player with the highest KDA on the winning team."""
        # Determine winning team based on match_outcome
        winning_team = self.our_team if self.match_outcome == 'VICTORY' else self.opponent_team
        winning_stats = PlayerMatchStat.objects.filter(
            match=self,
            team=winning_team
        ).order_by('-computed_kda').first()
        
        return winning_stats.player if winning_stats else None
    
    def get_mvp_loss(self):
        """Returns the player with the highest KDA on the losing team."""
        # Determine losing team based on match_outcome
        losing_team = self.opponent_team if self.match_outcome == 'VICTORY' else self.our_team
        losing_stats = PlayerMatchStat.objects.filter(
            match=self,
            team=losing_team
        ).order_by('-computed_kda').first()
        
        return losing_stats.player if losing_stats else None

class PlayerMatchStat(models.Model):
    """
    Represents the performance statistics of a specific player in a specific match.
    Contains KDA, damage stats, and other performance metrics.
    """
    stats_id = models.AutoField(primary_key=True)
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='player_stats')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='match_stats')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='match_stats')
    role_played = models.CharField(max_length=50, blank=True, null=True)
    hero_played = models.CharField(max_length=100)
    kills = models.IntegerField()
    deaths = models.IntegerField()
    assists = models.IntegerField()
    computed_kda = models.FloatField()
    damage_dealt = models.IntegerField(blank=True, null=True)
    damage_taken = models.IntegerField(blank=True, null=True)
    turret_damage = models.IntegerField(blank=True, null=True)
    teamfight_participation = models.FloatField(blank=True, null=True)  # Percentage
    gold_earned = models.IntegerField(blank=True, null=True)
    player_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.player.current_ign} - {self.match}"

    def is_for_our_team(self):
        """
        Determine if this stat belongs to 'our team' based on the match relationship.
        This replaces the static is_our_team field.
        """
        return self.team.team_id == self.match.our_team.team_id

    def save(self, *args, **kwargs):
        # Set role_played to player's primary role if not specified
        if not self.role_played and self.player and self.player.primary_role:
            self.role_played = self.player.primary_role
        super().save(*args, **kwargs)

class FileUpload(models.Model):
    """
    Represents files (screenshots, game data) associated with a match.
    Multiple files can be uploaded for a single match.
    """
    file_id = models.AutoField(primary_key=True)
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='files')
    file_url = models.URLField()
    file_type = models.CharField(max_length=20)  # JPEG, PNG, PDF
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"File for {self.match}"

class PlayerTeamHistory(models.Model):
    """
    Tracks a player's history of team membership.
    Allows tracking stats when players move between teams.
    """
    history_id = models.AutoField(primary_key=True)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='team_history')
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    joined_date = models.DateField()
    left_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.player.current_ign} - {self.team.team_name}"
    
    class Meta:
        ordering = ['-joined_date']

# Add a TeamManager model with roles
class TeamManagerRole(models.Model):
    """Define roles for team managers"""
    ROLE_CHOICES = [
        ('head_coach', 'Head Coach'),
        ('assistant', 'Assistant Coach'),
        ('analyst', 'Analyst'),
        ('viewer', 'Viewer'),
    ]
    
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='manager_roles')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='team_roles')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    
    class Meta:
        unique_together = ['team', 'user']

class MatchAward(models.Model):
    """Tracks awards given to players in matches such as MVP, MVP Loss, etc."""
    AWARD_TYPE_CHOICES = [
        ('MVP', 'Most Valuable Player'),
        ('MVP_LOSS', 'Most Valuable Player (Losing Team)'),
        ('MOST_DAMAGE', 'Highest Damage'),
        ('MOST_GOLD', 'Highest Gold'),
        ('MOST_TURRET_DAMAGE', 'Most Turret Damage'),
        ('MOST_DAMAGE_TAKEN', 'Most Damage Taken'),
        ('BEST_KDA', 'Best KDA Ratio'),
        ('MOST_KILLS', 'Most Kills'),
        ('MOST_ASSISTS', 'Most Assists'),
        ('LEAST_DEATHS', 'Least Deaths'),
    ]
    
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='awards')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='awards')
    award_type = models.CharField(max_length=20, choices=AWARD_TYPE_CHOICES)
    stat_value = models.FloatField(null=True, blank=True, help_text="The relevant stat value (e.g., KDA for MVP)")
    
    class Meta:
        unique_together = ['match', 'award_type']
        
    def __str__(self):
        return f"{self.get_award_type_display()} - {self.player.current_ign} ({self.match})"
    
    @classmethod
    def assign_match_awards(cls, match):
        """Calculate and assign all awards for a match"""
        # Clear existing awards for this match
        cls.objects.filter(match=match).delete()
        
        # Get all player stats for this match
        all_stats = PlayerMatchStat.objects.filter(match=match)
        if not all_stats.exists():
            return  # No stats to calculate awards from
            
        # Get stats separated by team
        winning_team = match.our_team if match.match_outcome == 'VICTORY' else match.opponent_team
        losing_team = match.opponent_team if match.match_outcome == 'VICTORY' else match.our_team
        
        winning_team_stats = all_stats.filter(team=winning_team)
        losing_team_stats = all_stats.filter(team=losing_team)
        
        # Assign MVP (highest KDA on winning team)
        if winning_team_stats.exists():
            mvp_stat = winning_team_stats.order_by('-computed_kda').first()
            cls.objects.create(
                match=match,
                player=mvp_stat.player,
                award_type='MVP',
                stat_value=mvp_stat.computed_kda
            )
        
        # Assign MVP Loss (highest KDA on losing team)
        if losing_team_stats.exists():
            mvp_loss_stat = losing_team_stats.order_by('-computed_kda').first()
            cls.objects.create(
                match=match,
                player=mvp_loss_stat.player,
                award_type='MVP_LOSS',
                stat_value=mvp_loss_stat.computed_kda
            )
        
        # Best KDA across all players
        best_kda_stat = all_stats.order_by('-computed_kda').first()
        cls.objects.create(
            match=match,
            player=best_kda_stat.player,
            award_type='BEST_KDA',
            stat_value=best_kda_stat.computed_kda
        )
        
        # Most kills
        most_kills_stat = all_stats.order_by('-kills').first()
        cls.objects.create(
            match=match,
            player=most_kills_stat.player,
            award_type='MOST_KILLS',
            stat_value=float(most_kills_stat.kills)
        )
        
        # Most assists
        most_assists_stat = all_stats.order_by('-assists').first()
        cls.objects.create(
            match=match,
            player=most_assists_stat.player,
            award_type='MOST_ASSISTS',
            stat_value=float(most_assists_stat.assists)
        )
        
        # Least deaths (minimum 1 death to avoid ties at 0)
        least_deaths_stats = all_stats.filter(deaths__gt=0).order_by('deaths')
        if least_deaths_stats.exists():
            least_deaths_stat = least_deaths_stats.first()
            cls.objects.create(
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
            cls.objects.create(
                match=match,
                player=most_damage_stat.player,
                award_type='MOST_DAMAGE',
                stat_value=float(most_damage_stat.damage_dealt)
            )
        
        # Most gold earned
        gold_stats = all_stats.exclude(gold_earned__isnull=True).filter(gold_earned__gt=0)
        if gold_stats.exists():
            most_gold_stat = gold_stats.order_by('-gold_earned').first()
            cls.objects.create(
                match=match,
                player=most_gold_stat.player,
                award_type='MOST_GOLD',
                stat_value=float(most_gold_stat.gold_earned)
            )
        
        # Most turret damage
        turret_damage_stats = all_stats.exclude(turret_damage__isnull=True).filter(turret_damage__gt=0)
        if turret_damage_stats.exists():
            most_turret_damage_stat = turret_damage_stats.order_by('-turret_damage').first()
            cls.objects.create(
                match=match,
                player=most_turret_damage_stat.player,
                award_type='MOST_TURRET_DAMAGE',
                stat_value=float(most_turret_damage_stat.turret_damage)
            )
        
        # Most damage taken
        damage_taken_stats = all_stats.exclude(damage_taken__isnull=True).filter(damage_taken__gt=0)
        if damage_taken_stats.exists():
            most_damage_taken_stat = damage_taken_stats.order_by('-damage_taken').first()
            cls.objects.create(
                match=match,
                player=most_damage_taken_stat.player,
                award_type='MOST_DAMAGE_TAKEN',
                stat_value=float(most_damage_taken_stat.damage_taken)
            )

class Hero(models.Model):
    """Represents playable heroes/champions in the game"""
    name = models.CharField(max_length=100, unique=True)
    role = models.CharField(max_length=50, blank=True)
    released_date = models.DateField(null=True, blank=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']
