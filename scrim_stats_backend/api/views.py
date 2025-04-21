from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions, filters, generics
from django.db.models import Count, Q, Avg, Sum, Max, Min, F, ExpressionWrapper, FloatField, Case, When, Value, IntegerField
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from .models import Team, Player, Match, PlayerMatchStat, PlayerAlias, PlayerTeamHistory, ScrimGroup, FileUpload, TeamManagerRole, Draft, DraftBan, DraftPick, Hero
from .serializers import TeamSerializer, PlayerSerializer, PlayerAliasSerializer, MatchSerializer, ScrimGroupSerializer, PlayerMatchStatSerializer, FileUploadSerializer, UserSerializer, TeamManagerRoleSerializer, DraftSerializer, DraftBanSerializer, DraftPickSerializer, HeroSerializer
from .permissions import IsTeamManager, IsTeamMember
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.contrib.admin.views.decorators import staff_member_required
from .utils import get_player_role_stats, get_hero_pairing_stats
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from django.contrib.auth import authenticate, login, logout
from services.player_services import PlayerService
from services.match_services import MatchStatsService
from services.match_service import MatchService
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.pagination import PageNumberPagination
from rest_framework import mixins # Import mixins
from django.utils import timezone # Added timezone

# Create your views here.

class PlayerMatchStatViewSet(mixins.CreateModelMixin,
                           viewsets.GenericViewSet):
    """
    API endpoint allowing creation of PlayerMatchStat entries.
    Only implements the 'create' action needed by the frontend form.
    """
    queryset = PlayerMatchStat.objects.all()
    serializer_class = PlayerMatchStatSerializer
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML

class TeamViewSet(viewsets.ModelViewSet):
    """
    API endpoint for teams.
    """
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['team_category']
    search_fields = ['team_name', 'team_abbreviation']
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def get_permissions(self):
        """
        Custom permissions:
        - List/retrieve/create: Any authenticated user
        - Update/delete: Admin users only
        """
        # Allow any authenticated user to create a team
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        # Restrict update/delete to admins
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAdminUser()]
        # Default to IsAuthenticated for list/retrieve etc.
        return super().get_permissions()
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get aggregated statistics for a team"""
        team = self.get_object()
        # TODO: Update this query based on the new Match model structure (blue/red teams)
        # The current filter(team=team) likely won't work anymore.
        matches = Match.objects.filter(Q(blue_side_team=team) | Q(red_side_team=team)) # Tentative fix
        
        # Calculate aggregated statistics
        stats = {
            'total_matches': matches.count(),
            # TODO: Update win/loss logic based on 'winning_team' field
            'wins': matches.filter(winning_team=team).count(), # Tentative fix
            'losses': matches.exclude(winning_team=team).filter(winning_team__isnull=False).count(), # Tentative fix
        }
        # Handle division by zero
        stats['win_rate'] = (stats['wins'] / stats['total_matches']) * 100 if stats['total_matches'] > 0 else 0

        return Response(stats)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_player(self, request, pk=None):
        """
        Adds a new player to the specified team.
        Creates a Player record and a PlayerTeamHistory record linking them.
        Expects {'ign': 'NewPlayerIGN', 'primary_role': 'ROLE'} in request body.
        """
        team = self.get_object()
        ign = request.data.get('ign')
        primary_role = request.data.get('primary_role') # Optional

        if not ign:
            return Response(
                {"error": "In-Game Name (ign) is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Consider adding validation for role if it's required or needs specific values
        # if primary_role and primary_role not in [choice[0] for choice in Player.ROLE_CHOICES]:
        #     return Response(
        #         {"error": f"Invalid primary_role: {primary_role}"}, 
        #         status=status.HTTP_400_BAD_REQUEST
        #     )

        # Check if player with this IGN already exists *anywhere*? 
        # For now, we allow creating potentially duplicate IGNs across different teams or even same team?
        # More robust logic might involve checking existing players first.
        
        try:
            # Create the new player
            new_player = Player.objects.create(
                current_ign=ign,
                primary_role=primary_role # Will be null if not provided
            )
            
            # Determine if the new player should be a starter for the given role
            make_starter = False
            if primary_role: # Only consider for starter if role is provided
                has_existing_starter = PlayerTeamHistory.objects.filter(
                    team=team,
                    left_date=None, # Ensure the history record is active
                    is_starter=True,
                    player__primary_role=primary_role # Check the role on the linked player
                ).exists()
                make_starter = not has_existing_starter # Make starter if no existing starter for this role

            # Link the player to this team via history
            PlayerTeamHistory.objects.create(
                player=new_player,
                team=team,
                joined_date=timezone.now().date(), # Corrected: Use joined_date
                is_starter=make_starter # Set starter status based on check
            )
            
            # Serialize the newly created player data
            serializer = PlayerSerializer(new_player, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Log the exception e
            # Consider more specific error handling/logging
            print(f"Error adding player: {e}") # Example logging
            return Response(
                {"error": f"An error occurred while adding the player: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# Restore original logic for TeamPlayersView (APIView with manual pagination)
class TeamPlayersView(APIView):
    """
    Get a paginated list of current players for a specific team.
    Used for populating player stat rows.
    """
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [JSONRenderer]

    def get(self, request, pk, format=None):
        """
        Return current players for the team specified in the URL (pk).
        Handles pagination manually.
        """
        # --- Start Original Code ---
        team_id = pk # Use pk directly from the URL

        try:
            # Validate that the team exists
            team = Team.objects.get(pk=team_id)
        except Team.DoesNotExist:
            # Return 404 if team doesn't exist
            return Response({"error": f"Team with ID {team_id} not found"}, status=status.HTTP_404_NOT_FOUND)

        # Correct query: Filter players whose team history includes this team
        # and where the membership record has no left_date.
        queryset = Player.objects.filter(
            team_history__team=team,
            team_history__left_date=None
        ).distinct().order_by('-team_history__is_starter', 'current_ign')

        # Apply pagination
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)

        # If paginated, serialize the page and return paginated response
        if page is not None:
            serializer = PlayerSerializer(page, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data)

        # If not paginated, serialize the whole queryset and return.
        serializer = PlayerSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
        # --- End Original Code ---

class PlayerLookupView(APIView):
    """
    Look up a player by IGN, including potential matches from aliases and other teams.
    Used to identify players when submitting stats.
    """
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def get(self, request, format=None):
        ign = request.query_params.get('ign', '')
        team_id = request.query_params.get('team_id')
        
        if not ign:
            return Response({"error": "IGN parameter is required"}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        results = {
            'exact_matches': [],
            'alias_matches': [],
            'other_team_matches': []
        }
        
        # If team_id provided, first check that specific team
        if team_id:
            try:
                team = Team.objects.get(pk=team_id)
                # Find exact matches in the specified team
                team_players = Player.objects.filter(team=team, current_ign=ign)
                if team_players.exists():
                    results['exact_matches'] = [{
                        'player_id': player.player_id,
                        'ign': player.current_ign,
                        'team_id': team.team_id,
                        'team_name': team.team_name,
                        'match_type': 'current_team'
                    } for player in team_players]
            except Team.DoesNotExist:
                pass
        
        # If no exact matches in specified team, look for aliases or players in other teams
        if not results['exact_matches']:
            # Check for alias matches (players who previously used this IGN)
            aliases = PlayerAlias.objects.filter(alias=ign)
            if aliases.exists():
                results['alias_matches'] = [{
                    'player_id': alias.player.player_id,
                    'current_ign': alias.player.current_ign,
                    'previous_ign': alias.alias,
                    'team_id': alias.player.team.team_id,
                    'team_name': alias.player.team.team_name,
                    'match_type': 'alias'
                } for alias in aliases]
            
            # Check for players with this IGN in other teams
            other_players = Player.objects.filter(current_ign=ign)
            if team_id:
                other_players = other_players.exclude(team_id=team_id)
            
            if other_players.exists():
                results['other_team_matches'] = [{
                    'player_id': player.player_id,
                    'ign': player.current_ign,
                    'team_id': player.team.team_id,
                    'team_name': player.team.team_name,
                    'match_type': 'other_team'
                } for player in other_players]
        
        # Also determine if this is a first-time match against this team
        if team_id:
            # Count previous matches against this team
            previous_matches = Match.objects.filter(
                Q(our_team_id=team_id) | Q(opponent_team_id=team_id)
            ).count()
            
            results['is_first_match'] = previous_matches == 0
        
        return Response(results)

class VerifyMatchPlayersView(APIView):
    """Handles player verification and match stat submission"""
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def post(self, request, format=None):
        match_id = request.data.get('match_id')
        team_stats = request.data.get('team_stats', []) # Stats for our team
        opponent_stats = request.data.get('opponent_stats', []) # Stats for opponent
        
        try:
            match = Match.objects.get(pk=match_id)
            our_team = match.our_team
            opponent_team = match.opponent_team
        except Match.DoesNotExist:
            return Response({"error": "Match not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Verify permissions
        if not our_team.is_managed_by(request.user):
            return Response(
                {"error": "You can only submit stats for teams you manage"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Process player verification
        players_to_verify = []
        
        # Process our team's stats - these should be mostly known players
        for stat in team_stats:
            player_action = self._resolve_player(stat, our_team)
            if player_action.get('needs_verification'):
                players_to_verify.append({**player_action, 'for_team': 'our_team'})
        
        # Process opponent team stats - more likely to have new players
        for stat in opponent_stats:
            player_action = self._resolve_player(stat, opponent_team)
            if player_action.get('needs_verification'):
                players_to_verify.append({**player_action, 'for_team': 'opponent_team'})
        
        if players_to_verify:
            # Return players needing verification
            return Response({
                'match_id': match_id,
                'players_to_verify': players_to_verify,
                'needs_verification': True
            })
        else:
            # All players resolved, create stats
            self._create_stats(match, team_stats, opponent_stats)
            return Response({'success': True, 'message': 'All stats recorded'})
    
    def put(self, request, format=None):
        """Handle verified player decisions"""
        match_id = request.data.get('match_id')
        verified_players = request.data.get('verified_players', [])
        team_stats = request.data.get('team_stats', [])
        opponent_stats = request.data.get('opponent_stats', [])
        
        try:
            match = Match.objects.get(pk=match_id)
        except Match.DoesNotExist:
            return Response({"error": "Match not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Process each verification decision
        for player_data in verified_players:
            ign = player_data.get('ign')
            action = player_data.get('action')
            team_id = player_data.get('team_id')
            
            try:
                team = Team.objects.get(pk=team_id)
            except Team.DoesNotExist:
                return Response({"error": f"Team not found: {team_id}"}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            if action == 'create_new':
                # Create brand new player
                player, _ = Player.get_or_create_for_team(
                    ign=ign,
                    team=team,
                    role=player_data.get('role')
                )
                # Update player ID in stats data
                self._update_player_in_stats(player.player_id, ign, team_stats, opponent_stats)
                
            elif action == 'use_existing':
                # Use an existing player (either current or with changed IGN)
                existing_id = player_data.get('existing_player_id')
                player = Player.objects.get(pk=existing_id)
                
                # Check if we need to update the IGN
                if player.current_ign != ign:
                    player.change_ign(ign)
                
                # Update player ID in stats data
                self._update_player_in_stats(player.player_id, ign, team_stats, opponent_stats)
                
            elif action == 'transfer_player':
                # Handle player transfer between teams
                existing_id = player_data.get('existing_player_id')
                player = Player.objects.get(pk=existing_id)
                
                # Transfer player to the new team
                player.transfer_to_team(team)
                
                # Update the IGN if needed
                if player.current_ign != ign:
                    player.change_ign(ign)
                
                # Update player ID in stats data
                self._update_player_in_stats(player.player_id, ign, team_stats, opponent_stats)
        
        # Create all stats now that players are verified
        self._create_stats(match, team_stats, opponent_stats)
        return Response({'success': True, 'message': 'All stats recorded after verification'})
    
    def _resolve_player(self, stat_data, team):
        """
        Resolve player identity for a stat entry.
        Returns action to take - either player is identified or needs verification.
        """
        ign = stat_data.get('ign')
        player_id = stat_data.get('player_id')
        
        # If player_id is provided and valid, player is already identified
        if player_id:
            try:
                player = Player.objects.get(pk=player_id)
                stat_data['resolved_player'] = player
                return {'resolved': True}
            except Player.DoesNotExist:
                # Invalid player_id, need to proceed with identification
                pass
        
        # Try to find by current IGN in this team
        players = Player.objects.filter(team=team, current_ign=ign)
        if players.exists():
            # Found an exact match on the team
            player = players.first()
            stat_data['resolved_player'] = player
            stat_data['player_id'] = player.player_id
            return {'resolved': True}
        
        # No exact match on team, check for aliases or other teams
        aliases = PlayerAlias.objects.filter(alias=ign)
        other_teams = Player.objects.filter(current_ign=ign).exclude(team=team)
        
        if not aliases.exists() and not other_teams.exists():
            # Brand new player, needs verification
            return {
                'needs_verification': True,
                'ign': ign,
                'team_id': team.team_id,
                'possible_actions': ['create_new'],
                'original_stat': stat_data
            }
        
        # Potential matches found, needs verification with options
        possible_actions = ['create_new']
        potential_matches = []
        
        # Add alias matches
        for alias in aliases:
            potential_matches.append({
                'player_id': alias.player.player_id,
                'current_ign': alias.player.current_ign,
                'previous_ign': alias.alias,
                'team_id': alias.player.team.team_id,
                'team_name': alias.player.team.team_name,
                'match_type': 'alias'
            })
            possible_actions.append('use_existing')
        
        # Add players from other teams
        for player in other_teams:
            potential_matches.append({
                'player_id': player.player_id,
                'current_ign': player.current_ign,
                'team_id': player.team.team_id,
                'team_name': player.team.team_name,
                'match_type': 'other_team'
            })
            possible_actions.append('transfer_player')
        
        return {
            'needs_verification': True,
            'ign': ign,
            'team_id': team.team_id,
            'possible_actions': list(set(possible_actions)),  # Remove duplicates
            'potential_matches': potential_matches,
            'original_stat': stat_data
        }
    
    def _update_player_in_stats(self, player_id, ign, team_stats, opponent_stats):
        """Update player_id in the stats data based on IGN"""
        # Check team stats
        for stat in team_stats:
            if stat.get('ign') == ign and not stat.get('player_id'):
                stat['player_id'] = player_id
        
        # Check opponent stats
        for stat in opponent_stats:
            if stat.get('ign') == ign and not stat.get('player_id'):
                stat['player_id'] = player_id
    
    def _create_stats(self, match, team_stats, opponent_stats):
        """Create all player stats once players are verified"""
        # Process our team's stats
        for stat in team_stats:
            player_id = stat.get('player_id')
            if not player_id:
                continue  # Skip entries without player_id
                
            try:
                player = Player.objects.get(pk=player_id)
                
                PlayerMatchStat.objects.create(
                    match=match,
                    player=player,
                    team=match.our_team,
                    role_played=stat.get('role_played'),
                    hero_played=stat.get('hero_played'),
                    kills=stat.get('kills', 0),
                    deaths=stat.get('deaths', 0),
                    assists=stat.get('assists', 0),
                    damage_dealt=stat.get('damage_dealt'),
                    damage_taken=stat.get('damage_taken'),
                    turret_damage=stat.get('turret_damage'),
                    teamfight_participation=stat.get('teamfight_participation'),
                    gold_earned=stat.get('gold_earned'),
                    player_notes=stat.get('player_notes'),
                    computed_kda=stat.get('computed_kda', 0)
                )
            except Player.DoesNotExist:
                # Log error but continue processing other stats
                print(f"Error: Player {player_id} not found")
        
        # Process opponent team's stats
        for stat in opponent_stats:
            player_id = stat.get('player_id')
            if not player_id:
                continue  # Skip entries without player_id
                
            try:
                player = Player.objects.get(pk=player_id)
                
                PlayerMatchStat.objects.create(
                    match=match,
                    player=player,
                    team=match.opponent_team,
                    role_played=stat.get('role_played'),
                    hero_played=stat.get('hero_played'),
                    kills=stat.get('kills', 0),
                    deaths=stat.get('deaths', 0),
                    assists=stat.get('assists', 0),
                    damage_dealt=stat.get('damage_dealt'),
                    damage_taken=stat.get('damage_taken'),
                    turret_damage=stat.get('turret_damage'),
                    teamfight_participation=stat.get('teamfight_participation'),
                    gold_earned=stat.get('gold_earned'),
                    player_notes=stat.get('player_notes'),
                    computed_kda=stat.get('computed_kda', 0)
                )
            except Player.DoesNotExist:
                # Log error but continue processing other stats
                print(f"Error: Player {player_id} not found")
        
        # Process the match with the service layer
        MatchStatsService.process_match_save(match)

class PlayerViewSet(viewsets.ModelViewSet):
    """
    API endpoint for players.
    """
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['primary_role']
    search_fields = ['current_ign', 'aliases__alias']
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsTeamManager()]
        return [permissions.IsAuthenticated()]
    
    @action(detail=True, methods=['post'])
    def change_ign(self, request, pk=None):
        """Change a player's IGN and track the old one as an alias"""
        player = self.get_object()
        new_ign = request.data.get('new_ign')
        
        if not new_ign:
            return Response(
                {"error": "New IGN is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Use the service instead of the direct model method
        PlayerService.change_player_ign(player, new_ign)
        
        return Response(PlayerSerializer(player).data)
    
    @action(detail=True, methods=['get'])
    def match_history(self, request, pk=None):
        """Get match history for a specific player"""
        player = self.get_object()
        player_stats = PlayerMatchStat.objects.filter(player=player).order_by('-match__match_date')
        
        # Optional pagination
        page = self.paginate_queryset(player_stats)
        if page is not None:
            serializer = PlayerMatchStatSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = PlayerMatchStatSerializer(player_stats, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get comprehensive player statistics"""
        player = self.get_object()
        
        # Use the service to get comprehensive stats
        player_stats = PlayerService.get_player_stats(player)
        
        return Response(player_stats)

class ScrimGroupViewSet(viewsets.ModelViewSet):
    """
    API endpoint for scrim groups (series of matches).
    """
    queryset = ScrimGroup.objects.all()
    serializer_class = ScrimGroupSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['scrim_group_name']
    ordering_fields = ['start_date']
    ordering = ['-start_date']  # Default ordering
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def get_queryset(self):
        """Only return scrim groups the user submitted if they're not admin"""
        user = self.request.user
        if user.is_staff:
            return ScrimGroup.objects.all()
        return ScrimGroup.objects.filter(matches__submitted_by=user).distinct()

class MatchViewSet(viewsets.ModelViewSet):
    """
    API endpoint for match data.
    """
    queryset = Match.objects.all().order_by('-match_date')
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['match_outcome', 'scrim_type', 'blue_side_team__team_category', 'red_side_team__team_category', 'our_team__team_category'] # Updated to use current model fields
    search_fields = ['blue_side_team__team_name', 'red_side_team__team_name', 'our_team__team_name', 'scrim_group__scrim_group_name'] # Updated search fields
    ordering_fields = ['match_date']
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML

    def get_queryset(self):
        """
        Optionally restricts the returned matches to those associated with
        teams managed by the currently authenticated user, unless user is admin.
        """
        user = self.request.user
        if user.is_staff: # Admins see all matches
            return Match.objects.all().order_by('-match_date')
        
        # Find teams managed by the user
        managed_team_ids = TeamManagerRole.objects.filter(user=user).values_list('team_id', flat=True)
        
        # Filter matches where any participating team is managed by the user
        queryset = Match.objects.filter(
            Q(blue_side_team_id__in=managed_team_ids) |
            Q(red_side_team_id__in=managed_team_ids) |
            Q(our_team_id__in=managed_team_ids)
        ).select_related('blue_side_team', 'red_side_team', 'our_team', 'scrim_group', 'mvp').order_by('-match_date')
        return queryset

    def perform_create(self, serializer):
        """
        Customize the creation process to set submitted_by and assign ScrimGroup.
        """
        # Set the submitter to the current user
        match_instance = serializer.save(submitted_by=self.request.user)
        
        # Assign the ScrimGroup using the service
        match_service = MatchService()
        match_service.assign_scrim_group_for_match(match_instance)

    @action(detail=False, methods=['get'])
    def suggest_game_number(self, request):
        """
        API endpoint to suggest the next game number based on existing matches
        within 8 hours of the specified date/time.
        """
        from services.match_services import MatchStatsService
        
        # Get parameters from request
        our_team_id = request.query_params.get('our_team_id')
        opponent_team_id = request.query_params.get('opponent_team_id')
        match_date = request.query_params.get('match_date')
        scrim_type = request.query_params.get('scrim_type')
        
        # Validate parameters
        if not all([our_team_id, opponent_team_id, match_date, scrim_type]):
            return Response(
                {"error": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Get team objects
            our_team = Team.objects.get(pk=our_team_id)
            opponent_team = Team.objects.get(pk=opponent_team_id)
            
            # Parse match date
            from django.utils.dateparse import parse_datetime
            match_datetime = parse_datetime(match_date)
            if not match_datetime:
                return Response(
                    {"error": "Invalid date format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Get suggestion
            suggested_game_number = MatchStatsService.suggest_game_number(
                our_team, opponent_team, match_datetime, scrim_type
            )
            
            return Response({
                "suggested_game_number": suggested_game_number
            })
            
        except (Team.DoesNotExist, ValueError) as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
            
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent matches with aggregated statistics"""
        # Get the last 10 matches
        matches = self.get_queryset()[:10]
        
        # Basic stats
        wins = matches.filter(match_outcome='Win').count()
        total = matches.count()
        win_rate = wins / total if total > 0 else 0
        
        response_data = {
            'win_rate': win_rate,
            'record': f"{wins}-{total - wins}",
            'matches': MatchSerializer(matches, many=True).data
        }
        
        return Response(response_data)

class RegisterView(generics.CreateAPIView):
    """
    API endpoint for user registration
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Return user data and token
            return Response({
                "user": UserSerializer(user).data,
                "message": "User created successfully"
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TeamRoleManagementView(APIView):
    """
    API endpoint for managing team roles
    """
    permission_classes = [permissions.IsAuthenticated, IsTeamManager]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def post(self, request):
        """Add a user to a team with a specific role"""
        serializer = TeamManagerRoleSerializer(data=request.data)
        
        if serializer.is_valid():
            # Check if the requesting user has permission to manage this team
            team = serializer.validated_data['team']
            if not TeamManagerRole.objects.filter(
                user=request.user,
                team=team,
                role_level__in=['MANAGER', 'ADMIN']
            ).exists() and not request.user.is_staff:
                return Response(
                    {"error": "You don't have permission to manage roles for this team"},
                    status=status.HTTP_403_FORBIDDEN
                )
                
            # Save the new role
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    def delete(self, request):
        """Remove a user's role from a team"""
        user_id = request.data.get('user')
        team_id = request.data.get('team')
        
        if not user_id or not team_id:
            return Response(
                {"error": "Both user and team must be specified"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if the requesting user has permission to manage this team
        try:
            team = Team.objects.get(pk=team_id)
            if not TeamManagerRole.objects.filter(
                user=request.user,
                team=team,
                role_level__in=['MANAGER', 'ADMIN']
            ).exists() and not request.user.is_staff:
                return Response(
                    {"error": "You don't have permission to manage roles for this team"},
                    status=status.HTTP_403_FORBIDDEN
                )
                
            # Delete the role
            role = TeamManagerRole.objects.filter(user_id=user_id, team_id=team_id)
            if role.exists():
                role.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            else:
                return Response(
                    {"error": "Role not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
                
        except Team.DoesNotExist:
            return Response(
                {"error": "Team not found"},
                status=status.HTTP_404_NOT_FOUND
            )

@staff_member_required
def get_scrim_group_admin_data(request, scrim_group_id):
    """API endpoint to get scrim group data for admin JavaScript"""
    try:
        scrim_group = ScrimGroup.objects.get(pk=scrim_group_id)
        return JsonResponse({
            'start_date': scrim_group.start_date.strftime('%Y-%m-%d'),
        })
    except ScrimGroup.DoesNotExist:
        return JsonResponse({'error': 'Scrim group not found'}, status=404)

class PlayerRoleStatsView(APIView):
    """
    API endpoint for computed player role statistics
    """
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def get(self, request, format=None):
        player_id = request.query_params.get('player_id')
        role = request.query_params.get('role')
        
        # Get computed stats
        stats = get_player_role_stats(player_id, role)
        
        # Convert to list for API response
        stats_list = list(stats)
        
        return Response(stats_list)


class HeroPairingStatsView(APIView):
    """
    API endpoint for computed hero pairing statistics
    """
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def get(self, request, format=None):
        team_id = request.query_params.get('team_id')
        hero1 = request.query_params.get('hero1')
        hero2 = request.query_params.get('hero2')
        
        # Get computed stats
        stats = get_hero_pairing_stats(team_id, hero1, hero2)
        
        # Convert to list for API response
        stats_list = list(stats.values())
        
        return Response(stats_list)

# CSRF Token view for frontend authentication
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_csrf_token(request):
    """
    API endpoint that returns a CSRF token for the frontend
    """
    from django.middleware.csrf import get_token
    
    # Get the CSRF token for the current session
    csrf_token = get_token(request)
    
    return Response({
        'csrfToken': csrf_token
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    A simple endpoint to check if the API is running.
    This endpoint doesn't require authentication.
    """
    return Response({"status": "ok", "message": "API is running"})

class HeroViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Heroes
    """
    queryset = Hero.objects.all().order_by('name')
    serializer_class = HeroSerializer
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class DraftViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Drafts
    """
    queryset = Draft.objects.all()
    serializer_class = DraftSerializer
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    @action(detail=False, methods=['get'], url_path='match/(?P<match_id>[^/.]+)')
    def get_by_match(self, request, match_id=None):
        """Get draft by match ID"""
        try:
            draft = Draft.objects.get(match_id=match_id)
            serializer = self.get_serializer(draft)
            return Response(serializer.data)
        except Draft.DoesNotExist:
            return Response(
                {"detail": "Draft not found for this match"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def create(self, request, *args, **kwargs):
        """
        Create draft with nested bans and picks
        """
        # Extract nested data
        bans_data = request.data.pop('bans', [])
        picks_data = request.data.pop('picks', [])
        
        # Create draft
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        draft = serializer.save()
        
        # Create bans
        for ban_data in bans_data:
            ban_data['draft'] = draft.id
            ban_serializer = DraftBanSerializer(data=ban_data)
            ban_serializer.is_valid(raise_exception=True)
            ban_serializer.save()
            
        # Create picks
        for pick_data in picks_data:
            pick_data['draft'] = draft.id
            pick_serializer = DraftPickSerializer(data=pick_data)
            pick_serializer.is_valid(raise_exception=True)
            pick_serializer.save()
            
        # Return the full draft object with bans and picks
        return Response(self.get_serializer(draft).data, status=status.HTTP_201_CREATED)

class DraftBanViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Draft Bans
    """
    queryset = DraftBan.objects.all()
    serializer_class = DraftBanSerializer
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
class DraftPickViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Draft Picks
    """
    queryset = DraftPick.objects.all()
    serializer_class = DraftPickSerializer
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML

class ApiRootView(APIView):
    """
    The API root view that provides a directory of all available endpoints.
    """
    permission_classes = [permissions.AllowAny]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def get(self, request, format=None):
        """Return a directory of all available API endpoints."""
        host = request.get_host()
        scheme = request.scheme
        base_url = f"{scheme}://{host}"
        
        endpoints = {
            "status": f"{base_url}/api/status/",
            "teams": f"{base_url}/api/teams/",
            "players": f"{base_url}/api/players/",
            "matches": f"{base_url}/api/matches/",
            "scrim_groups": f"{base_url}/api/scrim-groups/",
            "heroes": f"{base_url}/api/heroes/",
            "drafts": f"{base_url}/api/drafts/",
            "draft_bans": f"{base_url}/api/draft-bans/",
            "draft_picks": f"{base_url}/api/draft-picks/",
            "authentication": {
                "token": f"{base_url}/api/token/",
                "token_refresh": f"{base_url}/api/token/refresh/",
                "token_verify": f"{base_url}/api/token/verify/",
            }
        }
        
        return Response({
            "status": "API is running",
            "endpoints": endpoints,
            "documentation": "Documentation not yet available",
            "api_version": "1.0.0"
        })

class ApiStatus(APIView):
    """
    Returns the status of the API.
    """
    permission_classes = [permissions.AllowAny]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    
    def get(self, request, format=None):
        """Return a simple status message."""
        return Response({"status": "ok", "message": "API is running"})

class ManagedTeamListView(generics.ListAPIView):
    """
    API endpoint to list only the teams managed by the current authenticated user.
    Used for populating 'Our Team' dropdowns.
    """
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        This view should return a list of all the teams
        for the currently authenticated user.
        """
        user = self.request.user
        queryset = Team.objects.filter(manager_roles__user=user).distinct()
        return queryset
