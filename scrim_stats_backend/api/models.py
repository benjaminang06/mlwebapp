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
    hero = models.ForeignKey('Hero', on_delete=models.SET_NULL, null=True, blank=True, related_name='player_stats')
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

class HeroPairingStats(models.Model):
    """Track statistics for pairs of heroes played together"""
    hero1 = models.CharField(max_length=50)
    hero2 = models.CharField(max_length=50)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='hero_pairings')
    matches_played = models.IntegerField(default=0)
    matches_won = models.IntegerField(default=0)
    
    @property
    def win_rate(self):
        if self.matches_played == 0:
            return 0
        return self.matches_won / self.matches_played
        
    class Meta:
        unique_together = ['hero1', 'hero2', 'team']

class PlayerRoleStats(models.Model):
    """Track player performance in specific roles"""
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='role_stats')
    role = models.CharField(max_length=20)
    matches_played = models.IntegerField(default=0)
    total_kills = models.IntegerField(default=0)
    total_deaths = models.IntegerField(default=0)
    total_assists = models.IntegerField(default=0)
    
    @property
    def average_kda(self):
        if self.matches_played == 0:
            return 0
        return (self.total_kills + self.total_assists) / max(1, self.total_deaths)
        
    class Meta:
        unique_together = ['player', 'role']

class Hero(models.Model):
    """Represents playable heroes/champions in the game"""
    name = models.CharField(max_length=100, unique=True)
    role = models.CharField(max_length=50, blank=True)
    released_date = models.DateField(null=True, blank=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']
