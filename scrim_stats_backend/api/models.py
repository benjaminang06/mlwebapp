from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError
import json

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
    
    def save(self, *args, **kwargs):
        # Validate team_name is provided and not empty
        if not self.team_name or self.team_name.strip() == '':
            raise ValidationError("Team name is required.")
            
        # Validate team_abbreviation is provided and not empty
        if not self.team_abbreviation or self.team_abbreviation.strip() == '':
            raise ValidationError("Team abbreviation is required.")
            
        # Ensure team abbreviation doesn't exceed max length
        if len(self.team_abbreviation) > 10:
            self.team_abbreviation = self.team_abbreviation[:10]
            
        # Ensure team category is valid - update to match frontend values
        valid_categories = ['COLLEGIATE', 'AMATEUR', 'PRO']
        # Convert to uppercase for case-insensitive comparison
        if self.team_category:
            # If it's in lowercase/capitalized format, convert to uppercase
            if self.team_category in ['Collegiate', 'Amateur', 'Pro']:
                self.team_category = self.team_category.upper()
            # Now validate
            if self.team_category not in valid_categories:
                raise ValidationError(f"Team category must be one of: {', '.join(valid_categories)}")
        
        super().save(*args, **kwargs)
    
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
        role_display = f" ({self.primary_role})" if self.primary_role else ""
        return f"{self.current_ign}{role_display}"
    
    def get_current_team_history(self):
        """Get the player's current team history record (with no left_date)"""
        return self.team_history.filter(left_date=None).first()
    
    def get_awards_count(self, award_type):
        """Count number of awards of a specific type received by this player"""
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
             
        # Set match_outcome based on winning_team and our_team (if present)
        # This is a derived/computed value, not stored separately
        if self.winning_team_id:
            if self.our_team_id:
                # Only set match_outcome from our team's perspective if we have context
                if self.winning_team_id == self.our_team_id:
                    self.match_outcome = 'VICTORY'
                else:
                    self.match_outcome = 'DEFEAT'
            else:
                # If no our_team context, leave match_outcome as null
                # This avoids the confusing situation where match_outcome is set
                # from blue side perspective for external matches
                self.match_outcome = None
        else:
            # No winner specified
            self.match_outcome = None 
            
        # Auto-calculate game number if this is a new match (no ID yet)
        # or if scrim_group was just assigned and game_number is still the default
        if (not self.pk or kwargs.get('update_fields') == ['scrim_group']) and self.scrim_group:
            # For existing match where we're just updating scrim_group, we recalculate game number
            if self.pk and kwargs.get('update_fields') == ['scrim_group']:
                existing_count = Match.objects.filter(scrim_group=self.scrim_group).count()
                self.game_number = existing_count + 1
            # For new match being saved for the first time with a scrim_group
            elif not self.pk and not kwargs.get('update_fields'):
                # We'll calculate after save since the scrim_group might be assigned after initial save
                pass
            
        super().save(*args, **kwargs)
        
        # After saving, update the score_details based on player stats
        self.update_score_details()

    def update_score_details(self):
        """Calculate and update score details based on player kills for each team"""
        # Skip if this is a new match without player stats yet
        if not self.pk:
            return
            
        # Get all player stats for this match
        player_stats = self.player_stats.all()
        if not player_stats:
            return
            
        # Calculate total kills for each team
        blue_side_kills = sum(stat.kills for stat in player_stats if stat.team_id == self.blue_side_team_id)
        red_side_kills = sum(stat.kills for stat in player_stats if stat.team_id == self.red_side_team_id)
        
        # Get team names, ensuring they're not None
        blue_team_name = self.blue_side_team.team_name if self.blue_side_team else 'Blue Team'
        red_team_name = self.red_side_team.team_name if self.red_side_team else 'Red Team'
        
        # Create score details object matching the frontend expected structure (MatchScoreDetails interface)
        score_details = {
            'blue_side_score': blue_side_kills,
            'red_side_score': red_side_kills,
            'blue_side_team_name': blue_team_name,
            'red_side_team_name': red_team_name,
            'score_by': 'kills'  # Indicates how score was calculated
        }
        
        # Update the model's field
        self.score_details = score_details
        
        # Use direct update to avoid recursion and save just the score_details field
        # Use a raw update to ensure the JSON is stored correctly
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE api_match 
                SET score_details = %s 
                WHERE match_id = %s
                """,
                [
                    json.dumps(score_details),
                    self.pk
                ]
            )
        
        # Log the update for debugging purposes
        print(f"Updated match {self.pk} score details: {score_details}")

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
    kda = models.FloatField(null=True, blank=True, help_text="KDA ratio provided by the game (user input)")
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
        return f"{self.player.current_ign} stats for {self.match}"
    
    def is_for_our_team(self):
        """Check if this stat is for our team"""
        return self.team_id == self.match.our_team_id
        
    def is_blue_side(self):
        """Check if this stat is for blue side team"""
        return self.team_id == self.match.blue_side_team_id
    
    def save(self, *args, **kwargs):
        # Set role_played to player's primary role if not specified
        if not self.role_played and self.player.primary_role:
            self.role_played = self.player.primary_role
            
        result = super().save(*args, **kwargs)
        
        # Update match score details after saving player stats
        if self.match:
            self.match.update_score_details()
            
        return result

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
    is_starter = models.BooleanField(default=False, help_text="Indicates if the player is part of the main starting lineup for this team during this period")
    notes = models.TextField(blank=True, null=True)
    
    def __str__(self):
        status = "Starter" if self.is_starter else "Sub"
        return f"{self.player.current_ign} - {self.team.team_name} ({status})"
    
    class Meta:
        ordering = ['-joined_date']
        # Consider adding constraints later if needed, e.g., only 5 starters per team active

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

class MatchEditHistory(models.Model):
    """
    Tracks edit history for matches and player statistics.
    Allows restoring previous versions and audit logging.
    """
    EDIT_TYPE_CHOICES = [
        ('MATCH_METADATA', 'Match Metadata Edit'),
        ('PLAYER_STATS', 'Player Statistics Edit'),
        ('MATCH_RESTORE', 'Match Restore'),
        ('PLAYER_STATS_RESTORE', 'Player Statistics Restore'),
    ]
    
    edit_id = models.AutoField(primary_key=True)
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='edit_history')
    edited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='match_edits')
    previous_values = models.TextField(help_text="JSON string of previous values")
    new_values = models.TextField(help_text="JSON string of new values")
    edit_type = models.CharField(max_length=30, choices=EDIT_TYPE_CHOICES)
    edit_reason = models.TextField(blank=True, null=True)
    related_player_stat_id = models.IntegerField(null=True, blank=True, help_text="ID of the related player stat for player stat edits")
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.edit_type} on {self.match} by {self.edited_by} at {self.created_at}"
    
    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = "Match edit histories"
