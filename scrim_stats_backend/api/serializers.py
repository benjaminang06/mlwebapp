from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Team, Player, PlayerAlias, ScrimGroup, Match, PlayerMatchStat, FileUpload, PlayerTeamHistory, TeamManagerRole, Hero, Draft, DraftBan, DraftPick
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password

class UserSerializer(serializers.ModelSerializer):
    """Serializer for the User model, used for authentication and user info"""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password', 'password2']
        read_only_fields = ['id']
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'email': {'required': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
        
    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user

class PlayerAliasSerializer(serializers.ModelSerializer):
    """Serializer for player aliases (previous IGNs)"""
    class Meta:
        model = PlayerAlias
        fields = ['alias_id', 'alias', 'created_at']
        read_only_fields = ['alias_id', 'created_at']

class TeamSerializer(serializers.ModelSerializer):
    """Serializer for team data"""
    managers = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        required=False
    )

    class Meta:
        model = Team
        fields = [
            'team_id', 'team_name', 'team_abbreviation', 
            'team_category', 'managers', 'created_at', 'updated_at'
        ]
        read_only_fields = ['team_id', 'created_at', 'updated_at']

class PlayerTeamHistorySerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.team_name', read_only=True)
    
    class Meta:
        model = PlayerTeamHistory
        fields = ['history_id', 'team', 'team_name', 'joined_date', 'left_date', 'notes']
        read_only_fields = ['history_id']

class PlayerSerializer(serializers.ModelSerializer):
    """Serializer for player data with optional inclusion of aliases"""
    primary_team = serializers.SerializerMethodField()
    team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        help_text="ID of the team to assign the player to initially via PlayerTeamHistory."
    )
    aliases = PlayerAliasSerializer(many=True, read_only=True)
    team_history = PlayerTeamHistorySerializer(many=True, read_only=True)
    
    class Meta:
        model = Player
        fields = [
            'player_id', 'primary_team', 'team_id', 'current_ign', 'primary_role',
            'profile_image_url', 'aliases', 'team_history', 'created_at', 'updated_at'
        ]
        read_only_fields = ['player_id', 'primary_team', 'created_at', 'updated_at']
    
    def get_primary_team(self, obj):
        current_team_history = PlayerTeamHistory.objects.filter(
            player=obj, 
            left_date__isnull=True
        ).order_by('-joined_date').first()

        if current_team_history and current_team_history.team:
            return TeamSerializer(current_team_history.team, context=self.context).data
        return None
    
    def create(self, validated_data):
        """Create a new player instance"""
        team = validated_data.pop('team_id', None)
        
        player = Player.objects.create(**validated_data)
        
        if team:
            PlayerTeamHistory.objects.create(
                player=player,
                team=team,
                joined_date=timezone.now().date()
            )
        
        return player

class FileUploadSerializer(serializers.ModelSerializer):
    """Serializer for file uploads associated with matches"""
    class Meta:
        model = FileUpload
        fields = ['file_id', 'match', 'file_url', 'file_type', 'uploaded_at']
        read_only_fields = ['file_id', 'uploaded_at']

class PlayerMatchStatCreateSerializer(serializers.Serializer):
    """Initial serializer for player stats submission that handles player identification"""
    ign = serializers.CharField(max_length=100)
    role_played = serializers.CharField(max_length=20)
    hero_played = serializers.PrimaryKeyRelatedField(
        queryset=Hero.objects.all(),
        required=True,
        allow_null=False
    )
    kills = serializers.IntegerField()
    deaths = serializers.IntegerField()
    assists = serializers.IntegerField()
    # Other stat fields...
    
    # Player identification fields
    player_id = serializers.IntegerField(required=False)  # Will be null for new players
    is_new_player = serializers.BooleanField(required=False, default=False)
    previous_ign = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        """
        Validates player information and identifies if this is a potentially
        new player or a player who has changed their IGN.
        """
        match = self.context.get('match')
        team = self.context.get('team')
        ign = data.get('ign')
        
        # If player_id is provided, this is a confirmed player
        if 'player_id' in data and data['player_id']:
            try:
                player = Player.objects.get(player_id=data['player_id'])
                data['player'] = player
                return data
            except Player.DoesNotExist:
                raise serializers.ValidationError("Specified player does not exist")
        
        # Otherwise, try to identify the player by IGN for this team
        player = Player.find_by_ign(ign=ign, team=team)
        
        if player:
            # We found a potential match
            data['player'] = player
            data['is_new_player'] = False
        else:
            # No match found, mark as potentially new player
            data['is_new_player'] = True
        
        return data

class PlayerMatchStatSerializer(serializers.ModelSerializer):
    """Serializer for player statistics in a specific match"""
    player_details = PlayerSerializer(source='player', read_only=True)
    player_id = serializers.PrimaryKeyRelatedField(
        queryset=Player.objects.all(),
        source='player',
        write_only=True
    )
    is_our_team = serializers.SerializerMethodField()
    player_ign = serializers.CharField(source='player.current_ign', read_only=True)
    hero_name = serializers.CharField(source='hero_played.name', read_only=True)
    
    class Meta:
        model = PlayerMatchStat
        fields = [
            'stats_id', 'match', 'player_details', 'player_id', 'role_played',
            'hero_played', 'hero_name', 'kills', 'deaths', 'assists', 'computed_kda',
            'damage_dealt', 'damage_taken', 'turret_damage',
            'teamfight_participation', 'gold_earned', 'player_notes',
            'medal', 'is_our_team', 'created_at', 'updated_at'
        ]
        read_only_fields = ['stats_id', 'player_ign', 'hero_name', 'computed_kda', 'created_at', 'updated_at']
    
    def get_is_our_team(self, obj):
        """Use the model's is_for_our_team method"""
        return obj.is_for_our_team()
    
    def validate(self, data):
        """
        Calculate the computed KDA if not provided.
        KDA formula: (Kills + Assists) / Deaths, with special handling for 0 deaths
        """
        if 'computed_kda' not in data:
            kills = data.get('kills', 0)
            deaths = data.get('deaths', 0)
            assists = data.get('assists', 0)
            
            # If deaths is 0, use a high KDA or perhaps kills + assists
            if deaths == 0:
                data['computed_kda'] = float(kills + assists)
            else:
                data['computed_kda'] = float(kills + assists) / deaths
        
        return data
    
    def create(self, validated_data):
        """Create a player match stat record and update match score details"""
        # Create the stat record
        stat = PlayerMatchStat.objects.create(**validated_data)
        
        # Trigger score details recalculation
        match = stat.match
        match.calculate_score_details()
        
        return stat

class ScrimGroupSerializer(serializers.ModelSerializer):
    """Serializer for scrim groups (collections of related matches)"""
    class Meta:
        model = ScrimGroup
        fields = [
            'scrim_group_id', 'scrim_group_name', 'start_date', 
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['scrim_group_id', 'created_at', 'updated_at']

class MatchSerializer(serializers.ModelSerializer):
    """
    Serializer for match data.
    Handles translation from frontend submission (internal/external distinction)
    to the unified backend model (blue_side, red_side, optional our_team).
    """
    # Read-only nested serializers for displaying details
    scrim_group_details = ScrimGroupSerializer(source='scrim_group', read_only=True)
    submitted_by_details = UserSerializer(source='submitted_by', read_only=True)
    blue_side_team_details = TeamSerializer(source='blue_side_team', read_only=True)
    red_side_team_details = TeamSerializer(source='red_side_team', read_only=True)
    our_team_details = TeamSerializer(source='our_team', read_only=True) # Detail for the uploader context team
    winning_team_details = TeamSerializer(source='winning_team', read_only=True)
    mvp_details = PlayerSerializer(source='mvp', read_only=True)
    mvp_loss_details = PlayerSerializer(source='mvp_loss', read_only=True)
    player_stats = PlayerMatchStatSerializer(many=True, read_only=True)
    files = FileUploadSerializer(many=True, read_only=True)
    
    # --- Writeable fields from Frontend --- 
    # These fields mimic the frontend form but are NOT directly saved to the DB model.
    # They are used in the .validate() or .create()/.update() methods for translation.
    is_external_match = serializers.BooleanField(write_only=True, required=True)
    team_side = serializers.ChoiceField(choices=['BLUE', 'RED'], write_only=True, required=False, allow_null=True)
    our_team_id_input = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), write_only=True, required=False, source='our_team' # Temporarily map source for validation
    )
    opponent_team_id_input = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), write_only=True, required=False
    )
    blue_side_team_id_input = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), write_only=True, required=False, source='blue_side_team' # Map source
    )
    red_side_team_id_input = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), write_only=True, required=False, source='red_side_team' # Map source
    )
    # Allow writing standard FKs too
    scrim_group_id = serializers.PrimaryKeyRelatedField(
        queryset=ScrimGroup.objects.all(), source='scrim_group', write_only=True, required=False, allow_null=True
    )
    winning_team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), source='winning_team', write_only=True, required=False, allow_null=True
    )
    mvp_id = serializers.PrimaryKeyRelatedField(
        queryset=Player.objects.all(), source='mvp', write_only=True, required=False, allow_null=True
    )
    mvp_loss_id = serializers.PrimaryKeyRelatedField(
        queryset=Player.objects.all(), source='mvp_loss', write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Match
        fields = [
            # Read-only fields / Details
            'match_id', 'scrim_group_details', 'submitted_by_details',
            'blue_side_team_details', 'red_side_team_details', 'our_team_details',
            'winning_team_details', 'mvp_details', 'mvp_loss_details',
            'player_stats', 'files', 'created_at', 'updated_at',
            'match_outcome', # Read-only, calculated in model save
            
            # Direct Model Fields (Writable)
            'match_date', 'match_duration', 'scrim_type', 
            'general_notes', 'game_number', 
            
            # Writable FKs (standard)
            'scrim_group_id', 'winning_team_id', 'mvp_id', 'mvp_loss_id',
            
            # --- Frontend Input Fields (Write-Only) ---
            'is_external_match', 'team_side', 
            'our_team_id_input', 'opponent_team_id_input',
            'blue_side_team_id_input', 'red_side_team_id_input',
            
            # --- Direct Model FKs (Populated by translation logic) ---
            # These are the actual fields saved, but populated in create/update
            # We list them here so they are included in validated_data if needed
            'blue_side_team', 'red_side_team', 'our_team',
        ]
        read_only_fields = [
            'match_id', 'scrim_group_details', 'submitted_by_details',
            'blue_side_team_details', 'red_side_team_details', 'our_team_details',
            'winning_team_details', 'mvp_details', 'mvp_loss_details',
            'player_stats', 'files', 'created_at', 'updated_at', 'match_outcome',
        ]
        # Hide the direct FKs from automatic write handling if populated manually
        extra_kwargs = {
            'blue_side_team': {'write_only': True, 'required': False},
            'red_side_team': {'write_only': True, 'required': False},
            'our_team': {'write_only': True, 'required': False},
        }
        
    def validate(self, data):
        # Validate based on the frontend input fields
        is_external = data.get('is_external_match')

        if is_external is None:
            # This flag is crucial for translation
            raise serializers.ValidationError({"is_external_match": "This field is required."}) 

        if is_external:
            # External Match Validation
            blue_team = data.get('blue_side_team') # Gets the Team instance via source mapping
            red_team = data.get('red_side_team')
            if not blue_team:
                raise serializers.ValidationError({"blue_side_team_id_input": "Blue side team is required for external matches."})
            if not red_team:
                raise serializers.ValidationError({"red_side_team_id_input": "Red side team is required for external matches."})
            if blue_team == red_team:
                 raise serializers.ValidationError("Blue and Red side teams cannot be the same.")
            # Clear internal match fields if they were somehow submitted
            data.pop('our_team', None)
            data.pop('opponent_team_id_input', None)
            data.pop('team_side', None)
        else:
            # Internal Match Validation
            our_team = data.get('our_team') # Gets the Team instance via source mapping
            opponent_team = data.get('opponent_team_id_input') # This is just the ID
            team_side = data.get('team_side')
            if not our_team:
                raise serializers.ValidationError({"our_team_id_input": "Our team is required for internal matches."})
            if not opponent_team:
                raise serializers.ValidationError({"opponent_team_id_input": "Opponent team is required for internal matches."})
            if not team_side:
                raise serializers.ValidationError({"team_side": "Team side is required for internal matches."})
            if our_team == opponent_team:
                 raise serializers.ValidationError("Our team and Opponent team cannot be the same.")
            # Clear external match fields if they were somehow submitted
            data.pop('blue_side_team', None)
            data.pop('red_side_team', None)
            
        # Basic validation for winning team (if provided)
        winning_team = data.get('winning_team')
        if winning_team:
            blue = data.get('blue_side_team') if is_external else (our_team if team_side == 'BLUE' else opponent_team)
            red = data.get('red_side_team') if is_external else (opponent_team if team_side == 'BLUE' else our_team)
            if winning_team != blue and winning_team != red:
                 raise serializers.ValidationError({"winning_team_id": "Winning team must be one of the participating teams."}) 

        return data

    def _get_managed_teams(self, user):
        if user and user.is_authenticated:
             # Assuming TeamManagerRole model exists and links users to teams they manage
             # Adjust query based on your actual TeamManagerRole model structure
             try:
                 from .models import TeamManagerRole
                 return list(TeamManagerRole.objects.filter(user=user).values_list('team_id', flat=True))
             except ImportError:
                  # Fallback or error if TeamManagerRole is not defined as expected
                  print("Warning: TeamManagerRole model not found, cannot determine managed teams.")
                  return []
        return []

    def create(self, validated_data):
        user = self.context['request'].user
        is_external = validated_data.pop('is_external_match')
        managed_team_ids = self._get_managed_teams(user)

        # Prepare data for the new model structure
        match_data = {
             'submitted_by': user,
             # Copy other direct fields
             'match_date': validated_data.get('match_date'),
             'match_duration': validated_data.get('match_duration'),
             'scrim_type': validated_data.get('scrim_type'),
             'general_notes': validated_data.get('general_notes'),
             'game_number': validated_data.get('game_number'),
             'scrim_group': validated_data.get('scrim_group'),
             'winning_team': validated_data.get('winning_team'),
             'mvp': validated_data.get('mvp'),
             'mvp_loss': validated_data.get('mvp_loss'),
        }

        db_our_team_id = None # Nullable our_team FK
        
        if is_external:
            blue_team = validated_data.get('blue_side_team')
            red_team = validated_data.get('red_side_team')
            match_data['blue_side_team'] = blue_team
            match_data['red_side_team'] = red_team
            
            # Set our_team context if uploader manages one of the teams
            if blue_team and blue_team.team_id in managed_team_ids:
                 db_our_team_id = blue_team.team_id
            elif red_team and red_team.team_id in managed_team_ids:
                 db_our_team_id = red_team.team_id
            # Add logic here if user manages BOTH teams (e.g., default to blue, keep null, etc.)
            # Current logic prioritizes blue side if both are managed.

        else: # Internal Match
            our_team = validated_data.get('our_team')
            opponent_team = data.get('opponent_team_id_input') # This is a Team instance now
            team_side = validated_data.get('team_side')
            
            if team_side == 'BLUE':
                match_data['blue_side_team'] = our_team
                match_data['red_side_team'] = opponent_team 
            else: # team_side == 'RED'
                match_data['blue_side_team'] = opponent_team
                match_data['red_side_team'] = our_team
            
            # Set our_team context (it's guaranteed to be 'our_team' from input)
            db_our_team_id = our_team.team_id
            
        # Assign the determined our_team ID (can be None)
        if db_our_team_id:
             match_data['our_team_id'] = db_our_team_id
        else:
             match_data['our_team'] = None # Explicitly set to None if no context

        # Create the match instance
        # We pass specific fields to create() to avoid issues with write_only/read_only mixups
        instance = Match.objects.create(**match_data)
        return instance

    def update(self, instance, validated_data):
        # Update logic needs similar translation
        user = self.context['request'].user
        is_external = validated_data.pop('is_external_match')
        managed_team_ids = self._get_managed_teams(user)
        
        db_our_team_id = None

        if is_external:
            blue_team = validated_data.get('blue_side_team', instance.blue_side_team) # Use existing if not provided
            red_team = validated_data.get('red_side_team', instance.red_side_team)
            instance.blue_side_team = blue_team
            instance.red_side_team = red_team
            
            if blue_team and blue_team.team_id in managed_team_ids:
                 db_our_team_id = blue_team.team_id
            elif red_team and red_team.team_id in managed_team_ids:
                 db_our_team_id = red_team.team_id

        else: # Internal Match
            our_team = validated_data.get('our_team', instance.our_team) # Get our_team directly
            opponent_team = validated_data.get('opponent_team_id_input') # Opponent might change
            team_side = validated_data.get('team_side') # Side might change

            # If opponent or side not provided, we need to infer based on existing blue/red
            if opponent_team is None or team_side is None:
                 # This case is complex - need to decide how partial updates work.
                 # For simplicity, assume frontend sends all necessary fields for internal updates.
                 # Or raise validation error if trying partial update requiring translation.
                 pass # Or raise error
            else:
                 if team_side == 'BLUE':
                      instance.blue_side_team = our_team
                      instance.red_side_team = opponent_team
                 else:
                      instance.blue_side_team = opponent_team
                      instance.red_side_team = our_team
            
            db_our_team_id = our_team.team_id if our_team else None
        
        # Set the nullable our_team FK
        instance.our_team_id = db_our_team_id

        # Update other fields
        instance.match_date = validated_data.get('match_date', instance.match_date)
        instance.match_duration = validated_data.get('match_duration', instance.match_duration)
        instance.scrim_type = validated_data.get('scrim_type', instance.scrim_type)
        instance.general_notes = validated_data.get('general_notes', instance.general_notes)
        instance.game_number = validated_data.get('game_number', instance.game_number)
        instance.scrim_group = validated_data.get('scrim_group', instance.scrim_group)
        instance.winning_team = validated_data.get('winning_team', instance.winning_team)
        instance.mvp = validated_data.get('mvp', instance.mvp)
        instance.mvp_loss = validated_data.get('mvp_loss', instance.mvp_loss)

        instance.save()
        return instance

class TeamManagerRoleSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = TeamManagerRole
        fields = ['id', 'team', 'user', 'user_details', 'role']
        read_only_fields = ['id']

class HeroSerializer(serializers.ModelSerializer):
    """Serializer for Hero objects"""
    
    class Meta:
        model = Hero
        fields = '__all__'

class DraftBanSerializer(serializers.ModelSerializer):
    """Serializer for DraftBan objects"""
    hero_details = HeroSerializer(source='hero', read_only=True)
    
    class Meta:
        model = DraftBan
        fields = ['id', 'draft', 'hero', 'hero_details', 'team_side', 'ban_order']

class DraftPickSerializer(serializers.ModelSerializer):
    """Serializer for DraftPick objects"""
    hero_details = HeroSerializer(source='hero', read_only=True)
    
    class Meta:
        model = DraftPick
        fields = ['id', 'draft', 'hero', 'hero_details', 'team_side', 'pick_order']

class DraftSerializer(serializers.ModelSerializer):
    """Serializer for Draft objects"""
    bans = DraftBanSerializer(many=True, read_only=True)
    picks = DraftPickSerializer(many=True, read_only=True)
    
    class Meta:
        model = Draft
        fields = ['id', 'match', 'format', 'is_complete', 'notes', 'created_at', 'updated_at', 'bans', 'picks'] 