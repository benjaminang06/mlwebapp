from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError

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

    # These methods will be replaced by direct calls to the service classes
    # from views or other appropriate places
    
    def create_alias_from_current_ign(self):
        """Create an alias from the current IGN before changing it"""
        if self.current_ign:
            PlayerAlias.objects.create(
                player=self,
                alias=self.current_ign
            )
        return self
    
    def get_current_team_history(self):
        """Get the player's current team history entry (with no left_date)"""
        return self.team_history.filter(left_date=None).first()

    def get_awards_count(self, award_type):
        """Get count of a specific award type for this player"""
        return self.awards.filter(award_type=award_type).count()

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
    Stores participating teams consistently using blue_side_team and red_side_team.
    The 'our_team' field provides context based on the uploader.
    """
    match_id = models.AutoField(primary_key=True)
    scrim_group = models.ForeignKey(ScrimGroup, on_delete=models.CASCADE, related_name='matches', null=True, blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)

    match_date = models.DateTimeField(help_text="The date and time when the match occurred")

    # 'Our Team' perspective (nullable) - context based on uploader
    our_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        related_name='our_perspective_matches', # Changed related_name for clarity
        null=True, # Make nullable
        blank=True,
        help_text="The participating team managed by the user submitting the data (if any)"
    )
    
    # Blue/Red teams - Now always used and non-nullable
    blue_side_team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE, # Use CASCADE - if a team is deleted, matches involving it might be irrelevant?
        related_name='blue_side_matches',
        null=False, # Make non-nullable
        blank=False,
        help_text="The team playing on the blue side"
    )
    red_side_team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE, # Use CASCADE
        related_name='red_side_matches',
        null=False, # Make non-nullable
        blank=False,
        help_text="The team playing on the red side"
    )

    match_duration = models.DurationField(
        null=True,
        blank=True,
        help_text="Duration of the match (HH:MM:SS)"
    )

    SCRIM_TYPE_CHOICES = [
        ('SCRIMMAGE', 'Scrimmage'),
        ('TOURNAMENT', 'Tournament'),
        ('RANKED', 'Ranked')
    ]
    scrim_type = models.CharField(
        max_length=50,
        choices=SCRIM_TYPE_CHOICES,
    )

    MATCH_OUTCOME_CHOICES = [
        ('VICTORY', 'Victory'),
        ('DEFEAT', 'Defeat')
    ]
    match_outcome = models.CharField(
        max_length=10,
        choices=MATCH_OUTCOME_CHOICES,
        null=True,
        blank=True
    )

    mvp = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL,
        related_name='mvp_matches',
        null=True,
        blank=True,
        help_text="Most Valuable Player for this match"
    )

    mvp_loss = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL,
        related_name='mvp_loss_matches',
        null=True,
        blank=True,
        help_text="Most Valuable Player from the losing team (optional)"
    )

    winning_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        related_name='won_matches',
        null=True,
        blank=True,
        help_text="The team that won the match"
    )

    score_details = models.JSONField(blank=True, null=True)
    general_notes = models.TextField(blank=True, null=True)
    game_number = models.IntegerField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        # Update string representation if needed
        blue_name = self.blue_side_team.team_abbreviation if self.blue_side_team else 'N/A'
        red_name = self.red_side_team.team_abbreviation if self.red_side_team else 'N/A'
        scrim_group_name = self.scrim_group.scrim_group_name if self.scrim_group else 'Standalone'
        return f"{scrim_group_name} - Game {self.game_number} ({blue_name} vs {red_name})"

    def save(self, *args, **kwargs):
        # Add validation or derivation logic here if needed before saving
        # For example, ensuring blue_side_team != red_side_team
        if self.blue_side_team_id == self.red_side_team_id:
             raise ValidationError("Blue side team and Red side team cannot be the same.")
             
        # Determine outcome based on winning team
        if self.winning_team_id:
            if self.winning_team_id == self.blue_side_team_id:
                # Logic to determine if 'our_team' context applies and won
                if self.our_team_id == self.blue_side_team_id:
                    self.match_outcome = 'VICTORY'
                elif self.our_team_id == self.red_side_team_id:
                     self.match_outcome = 'DEFEAT'
                else: # No 'our_team' context or our_team was not playing
                     self.match_outcome = None # Or potentially determine based on Blue/Red win?
            elif self.winning_team_id == self.red_side_team_id:
                if self.our_team_id == self.red_side_team_id:
                    self.match_outcome = 'VICTORY'
                elif self.our_team_id == self.blue_side_team_id:
                    self.match_outcome = 'DEFEAT'
                else:
                     self.match_outcome = None
            else:
                 # Winning team is neither blue nor red? Should not happen.
                 self.match_outcome = None
        else:
            self.match_outcome = None # No winner specified
            
        super().save(*args, **kwargs)

    def get_mvp(self):
        """Returns the manually selected MVP for this match."""
        return self.mvp
    
    def get_mvp_loss(self):
        """Returns the manually selected MVP for the losing team (if any)."""
        return self.mvp_loss

# Add Draft-related models
class Draft(models.Model):
    """
    Represents the complete draft for a match including bans and picks.
    Optional - not all matches require draft tracking.
    """
    match = models.OneToOneField(Match, on_delete=models.CASCADE, related_name='draft')
    format = models.CharField(
        max_length=20, 
        choices=[('6_BANS', '6 Bans (3 per team)'), ('10_BANS', '10 Bans (5 per team)')],
        default='6_BANS'
    )
    is_complete = models.BooleanField(default=False, help_text="Whether the draft has been fully completed")
    notes = models.TextField(blank=True, null=True, help_text="Draft strategy notes")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Draft for {self.match}"

class DraftBan(models.Model):
    """
    Represents a single hero ban in a draft.
    """
    # Define side choices here now
    SIDE_CHOICES = [
        ('BLUE', 'Blue Side'),
        ('RED', 'Red Side')
    ]
    
    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name='bans')
    hero = models.ForeignKey('Hero', on_delete=models.CASCADE, related_name='draft_bans')
    team_side = models.CharField(
        max_length=10, 
        choices=SIDE_CHOICES  # Use local choices
    )
    ban_order = models.IntegerField(help_text="Order in which ban occurred (1-5)")
    
    class Meta:
        ordering = ['team_side', 'ban_order']
        unique_together = ['draft', 'team_side', 'ban_order']
        
    def __str__(self):
        return f"{self.hero.name} banned by {self.get_team_side_display()} (#{self.ban_order})" # Use get_display()

class DraftPick(models.Model):
    """
    Represents a single hero pick in a draft.
    """
    # Define side choices here now
    SIDE_CHOICES = [
        ('BLUE', 'Blue Side'),
        ('RED', 'Red Side')
    ]
    
    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name='picks')
    hero = models.ForeignKey('Hero', on_delete=models.CASCADE, related_name='draft_picks')
    team_side = models.CharField(
        max_length=10, 
        choices=SIDE_CHOICES  # Use local choices
    )
    pick_order = models.IntegerField(help_text="Order in which pick occurred (1-5)")
    
    class Meta:
        ordering = ['team_side', 'pick_order']
        unique_together = ['draft', 'team_side', 'pick_order']
        
    def __str__(self):
        return f"{self.hero.name} picked by {self.get_team_side_display()} (#{self.pick_order})" # Use get_display()

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
    hero_played = models.ForeignKey(
        'Hero', 
        on_delete=models.SET_NULL,
        null=True, 
        blank=True,
        related_name='hero_player_stats',
        help_text="The hero played by the player in this match"
    )
    kills = models.IntegerField()
    deaths = models.IntegerField()
    assists = models.IntegerField()
    computed_kda = models.FloatField(null=True, blank=True, help_text="(K+A)/D ratio, calculated on save") # Allow null
    damage_dealt = models.IntegerField(blank=True, null=True)
    damage_taken = models.IntegerField(blank=True, null=True)
    turret_damage = models.IntegerField(blank=True, null=True)
    teamfight_participation = models.FloatField(blank=True, null=True)  # Percentage
    gold_earned = models.IntegerField(blank=True, null=True)
    player_notes = models.TextField(blank=True, null=True)
    
    MEDAL_CHOICES = [
        ('GOLD', 'Gold'),
        ('SILVER', 'Silver'),
        ('BRONZE', 'Bronze'),
    ]
    medal = models.CharField(
        max_length=10,
        choices=MEDAL_CHOICES,
        null=True,
        blank=True,
        help_text="Medal awarded for performance (Gold, Silver, Bronze)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.player.current_ign} - {self.match}"

    def is_for_our_team(self):
        """
        Determine if this stat belongs to 'our team' based on the match relationship.
        This replaces the static is_our_team field.
        """
        # Check if match and our_team exist before accessing team_id
        if self.match and self.match.our_team:
             return self.team_id == self.match.our_team_id
        return False # Default if context cannot be determined

    def save(self, *args, **kwargs):
        # Calculate KDA
        if self.deaths > 0:
            self.computed_kda = (self.kills + self.assists) / self.deaths
        elif self.kills > 0 or self.assists > 0:
             # Handle division by zero - infinite KDA or just K+A?
             # Let's represent perfect KDA with a high number or just K+A
             self.computed_kda = float(self.kills + self.assists) # Or set a specific large number like 999?
        else:
            self.computed_kda = 0.0 # 0/0 KDA is 0
            
        # Set role_played to player's primary role if not specified
        if self.player and not self.role_played:
            self.role_played = self.player.primary_role
            
        # Basic validation - complex validation will be moved to service layer
        # (Validation logic removed for brevity, assume it exists)
                
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

class Hero(models.Model):
    """Represents playable heroes/champions in the game"""
    name = models.CharField(max_length=100, unique=True)
    role = models.CharField(max_length=50, blank=True)
    released_date = models.DateField(null=True, blank=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']
