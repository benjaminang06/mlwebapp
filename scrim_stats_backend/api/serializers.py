from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Team, Player, PlayerAlias, ScrimGroup, Match, PlayerMatchStat, FileUpload, PlayerTeamHistory, TeamManagerRole, Hero, Draft, DraftBan, DraftPick
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from services.player_services import PlayerService

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
        player = PlayerService.find_player_by_ign(ign=ign, team=team)
        
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
    player = serializers.PrimaryKeyRelatedField(
        queryset=Player.objects.all(),
        write_only=True
    )
    hero_played = serializers.PrimaryKeyRelatedField(
        queryset=Hero.objects.all(),
        write_only=True,
        required=False,
        allow_null=True
    )
    is_our_team = serializers.SerializerMethodField()
    player_ign = serializers.CharField(source='player.current_ign', read_only=True)
    hero_name = serializers.CharField(source='hero_played.name', read_only=True, required=False)
    is_blue_side = serializers.SerializerMethodField()
    
    class Meta:
        model = PlayerMatchStat
        fields = [
            'stats_id', 'match', 'team',
            'player_details',
            'player',
            'player_ign',
            'role_played',
            'hero_played',
            'hero_name',
            'kills', 'deaths', 'assists', 'kda',
            'damage_dealt', 'damage_taken', 'turret_damage',
            'teamfight_participation', 'gold_earned', 'player_notes',
            'medal', 'is_our_team', 'is_blue_side', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'stats_id', 'player_details', 'player_ign', 'hero_name',
            'is_our_team', 'is_blue_side', 'created_at', 'updated_at'
        ]
    
    def get_is_our_team(self, obj):
        """Determine if this player stat is for 'our team'"""
        # Fix method to handle null cases safely
        if not obj.match or not obj.team:
            return False
            
        # If the match has no 'our_team' context, return False
        if not obj.match.our_team:
            return False
            
        # Check if this player's team is the match's 'our_team'
        return obj.team.team_id == obj.match.our_team.team_id
    
    def get_is_blue_side(self, obj):
        """Determine if this player stat is for the blue side team"""
        if not obj.match or not obj.team:
            return False
            
        return obj.team.team_id == obj.match.blue_side_team_id
    
    def validate(self, data):
        """Validate that the player's team matches either blue_side_team or red_side_team of the match"""
        match = data.get('match')
        team = data.get('team')
        
        if match and team:
            # Team must be either blue_side_team or red_side_team
            if team.team_id != match.blue_side_team_id and team.team_id != match.red_side_team_id:
                raise serializers.ValidationError(
                    "Player's team must be either the blue side team or red side team of the match."
                )
        
        # Validate KDA values
        kills = data.get('kills', 0)
        deaths = data.get('deaths', 0)
        assists = data.get('assists', 0)
        
        # Ensure kills, deaths, assists are non-negative
        if kills < 0:
            raise serializers.ValidationError({"kills": "Kills cannot be negative."})
        if deaths < 0:
            raise serializers.ValidationError({"deaths": "Deaths cannot be negative."})
        if assists < 0:
            raise serializers.ValidationError({"assists": "Assists cannot be negative."})
            
        return data
    
    def create(self, validated_data):
        # Let the model handle setting role_played from player.primary_role if needed
        return super().create(validated_data)

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
    
    # --- Writable Fields (aligning with frontend payload & model) ---
    # Use PrimaryKeyRelatedField for FKs the frontend sends as IDs
    blue_side_team = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), required=True # Model requires it
    )
    red_side_team = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), required=True # Model requires it
    )
    our_team = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), required=False, allow_null=True # Model allows null
    )
    winning_team = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), required=False, allow_null=True # Model allows null
    )
    mvp = serializers.PrimaryKeyRelatedField(
        queryset=Player.objects.all(), required=False, allow_null=True
    )
    mvp_loss = serializers.PrimaryKeyRelatedField(
        queryset=Player.objects.all(), required=False, allow_null=True
    )
    scrim_group = serializers.PrimaryKeyRelatedField(
        queryset=ScrimGroup.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Match
        fields = [
            # Read-only fields / Details
            'match_id', 'scrim_group_details', 'submitted_by_details',
            'blue_side_team_details', 'red_side_team_details', 'our_team_details',
            'winning_team_details', 'mvp_details', 'mvp_loss_details',
            'player_stats', 'files', 'created_at', 'updated_at',
            'match_outcome', # Read-only from model
            
            # Direct Model Fields (Writable)
            'match_date', 'match_duration', 'scrim_type', 
            'score_details', 'general_notes', 'game_number', 
            
            # Writable FKs (defined above or handled by name convention)
            'blue_side_team', 'red_side_team', 'our_team',
            'winning_team', 'mvp', 'mvp_loss', 'scrim_group'
        ]
        read_only_fields = [
            'match_id', 'scrim_group_details', 'submitted_by_details',
            'blue_side_team_details', 'red_side_team_details', 'our_team_details',
            'winning_team_details', 'mvp_details', 'mvp_loss_details',
            'player_stats', 'files', 'created_at', 'updated_at', 'match_outcome', 
        ]
        # Hide the direct FKs from automatic write handling if populated manually
        # extra_kwargs = { ... } # Clear this out - no longer needed for translation fields
        
    def create(self, validated_data):
        # Simplified create - assumes validated_data matches model fields
        user = self.context['request'].user
        validated_data['submitted_by'] = user
        # The validated_data should now contain the correct Team/Player instances for FKs
        instance = Match.objects.create(**validated_data)
        # Directly return the instance. The view's create method will handle
        # serializing this saved instance for the response body.
        return instance

    def update(self, instance, validated_data):
        # Update logic needs similar translation
        # Simply update fields present in validated_data
        instance.match_date = validated_data.get('match_date', instance.match_date)
        instance.match_duration = validated_data.get('match_duration', instance.match_duration)
        instance.scrim_type = validated_data.get('scrim_type', instance.scrim_type)
        instance.score_details = validated_data.get('score_details', instance.score_details)
        instance.general_notes = validated_data.get('general_notes', instance.general_notes)
        instance.game_number = validated_data.get('game_number', instance.game_number)
        instance.scrim_group = validated_data.get('scrim_group', instance.scrim_group)
        instance.winning_team = validated_data.get('winning_team', instance.winning_team)
        instance.mvp = validated_data.get('mvp', instance.mvp)
        instance.mvp_loss = validated_data.get('mvp_loss', instance.mvp_loss)
        instance.blue_side_team = validated_data.get('blue_side_team', instance.blue_side_team)
        instance.red_side_team = validated_data.get('red_side_team', instance.red_side_team)
        instance.our_team = validated_data.get('our_team', instance.our_team)

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