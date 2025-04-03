from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Team, Player, PlayerAlias, ScrimGroup, Match, PlayerMatchStat, FileUpload, PlayerTeamHistory, TeamManagerRole, Hero
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
        source='primary_team',
        write_only=True,
        required=False
    )
    aliases = PlayerAliasSerializer(many=True, read_only=True)
    team_history = PlayerTeamHistorySerializer(many=True, read_only=True)
    
    class Meta:
        model = Player
        fields = [
            'player_id', 'primary_team', 'team_id', 'current_ign', 'primary_role',
            'profile_image_url', 'aliases', 'team_history', 'created_at', 'updated_at'
        ]
        read_only_fields = ['player_id', 'created_at', 'updated_at']
    
    def get_primary_team(self, obj):
        primary_team = obj.primary_team
        if primary_team:
            return TeamSerializer(primary_team).data
        return None
    
    def create(self, validated_data):
        """Create a new player instance"""
        # Extract team if provided
        team = None
        if 'primary_team' in validated_data:
            team = validated_data.pop('primary_team')
        
        # Create the player
        player = Player.objects.create(**validated_data)
        
        # Add the team relationship if provided
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
        required=True
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
    
    class Meta:
        model = PlayerMatchStat
        fields = [
            'stats_id', 'match', 'player_details', 'player_id', 'role_played',
            'hero_played', 'kills', 'deaths', 'assists', 'computed_kda',
            'damage_dealt', 'damage_taken', 'turret_damage',
            'teamfight_participation', 'gold_earned', 'player_notes',
            'is_our_team', 'created_at', 'updated_at'
        ]
        read_only_fields = ['stats_id', 'created_at', 'updated_at']
    
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
            'end_date', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['scrim_group_id', 'created_at', 'updated_at']

class MatchSerializer(serializers.ModelSerializer):
    """
    Serializer for match data, with options to include nested player stats,
    file uploads, and team details.
    """
    scrim_group_details = ScrimGroupSerializer(source='scrim_group', read_only=True)
    scrim_group_id = serializers.PrimaryKeyRelatedField(
        queryset=ScrimGroup.objects.all(),
        source='scrim_group',
        write_only=True
    )
    submitted_by_details = UserSerializer(source='submitted_by', read_only=True)
    
    our_team_details = TeamSerializer(source='our_team', read_only=True)
    our_team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(),
        source='our_team',
        write_only=True
    )
    
    opponent_team_details = TeamSerializer(source='opponent_team', read_only=True)
    opponent_team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(),
        source='opponent_team',
        write_only=True
    )
    
    player_stats = PlayerMatchStatSerializer(many=True, read_only=True)
    files = FileUploadSerializer(many=True, read_only=True)
    
    class Meta:
        model = Match
        fields = [
            'match_id', 'scrim_group_details', 'scrim_group_id', 
            'submitted_by_details', 'match_date',
            'our_team_details', 'our_team_id',
            'opponent_team_details', 'opponent_team_id',
            'scrim_type', 'match_outcome', 'score_details',
            'general_notes', 'game_number', 'team_side',
            'player_stats', 'files', 'created_at', 'updated_at',
            'match_duration'
        ]
        read_only_fields = [
            'match_id', 'score_details', 'created_at', 'updated_at'
        ]
    
    def validate_opponent_team_id(self, value):
        """Ensure the selected opponent is not managed by the current user"""
        user = self.context['request'].user
        if value.is_managed_by(user):
            raise serializers.ValidationError("Opponent team cannot be one you manage")
        return value
    
    def validate(self, data):
        """Ensure our_team and opponent_team are different teams"""
        our_team = data.get('our_team')
        opponent_team = data.get('opponent_team')
        
        if our_team and opponent_team and our_team.team_id == opponent_team.team_id:
            raise serializers.ValidationError("Your team and opponent team cannot be the same")
        
        return data
    
    def create(self, validated_data):
        """Create a new match instance"""
        # Extract the User from the request context
        user = self.context['request'].user
        validated_data['submitted_by'] = user
        
        return Match.objects.create(**validated_data)

# New serializers for the new models
class TeamManagerRoleSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = TeamManagerRole
        fields = ['id', 'team', 'user', 'user_details', 'role']
        read_only_fields = ['id'] 