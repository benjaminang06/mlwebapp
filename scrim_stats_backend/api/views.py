from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, permissions, filters, status, generics, mixins
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.renderers import JSONRenderer
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.admin.views.decorators import staff_member_required
from django.utils import timezone
from django.http import JsonResponse
from django.db.models import Q, Sum, Count, Avg, Case, When, Value, IntegerField, F
from django.db import transaction
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings
import logging
from collections import defaultdict
import os
import datetime
import traceback

from .models import Team, Player, PlayerAlias, ScrimGroup, Match, PlayerMatchStat, FileUpload, PlayerTeamHistory, TeamManagerRole, MatchAward, Hero, Draft, DraftBan, DraftPick
from .serializers import (
    TeamSerializer, PlayerSerializer, PlayerAliasSerializer, ScrimGroupSerializer, 
    MatchSerializer, PlayerMatchStatSerializer, FileUploadSerializer, 
    UserSerializer, PlayerTeamHistorySerializer, TeamManagerRoleSerializer,
    PlayerMatchStatCreateSerializer, HeroSerializer, DraftSerializer, 
    DraftBanSerializer, DraftPickSerializer
)
from .permissions import IsTeamManager, IsTeamMember
from .utils import get_player_role_stats, get_hero_pairing_stats
from services.player_services import PlayerService
from services.match_services import MatchStatsService
from services.award_services import AwardService
from services.team_services import TeamService
from services.scrim_group_services import ScrimGroupService
from services.hero_services import HeroService
from services.statistics_services import StatisticsService

# Create your views here.

class PlayerMatchStatViewSet(mixins.CreateModelMixin,
                           mixins.ListModelMixin,
                           mixins.RetrieveModelMixin,
                           mixins.UpdateModelMixin,
                           viewsets.GenericViewSet):
    """
    API endpoint for PlayerMatchStat entries.
    Supports:
    - Creating new player match stats
    - Listing player stats with filtering
    - Retrieving individual player stats
    - Updating player stats (PATCH/PUT)
    """
    queryset = PlayerMatchStat.objects.all()
    serializer_class = PlayerMatchStatSerializer
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [JSONRenderer]  # Only use JSON renderer, not HTML
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['match', 'player', 'team']
    ordering_fields = ['stats_id', 'kills', 'deaths', 'assists', 'kda', 'damage_dealt']
    ordering = ['stats_id']
    
    def get_permissions(self):
        """
        Custom permissions:
        - List/retrieve: Any authenticated user
        - Create/update: Team managers only
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsTeamManager()]
        return [permissions.IsAuthenticated()]

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
        
        # Use the TeamService to get comprehensive stats
        stats = TeamService.get_team_stats(team)
        
        return Response(stats)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_player(self, request, pk=None):
        """Add a player to a team via the API"""
        team = self.get_object()
        
        # Check permissions (need to be team manager to add players)
        self.check_object_permissions(request, team)
        
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

        try:
            # Use TeamService to add player to the team
            player, created = TeamService.add_player_to_team(team, ign, primary_role)
            
            # Serialize the newly created player data
            serializer = PlayerSerializer(player, context={'request': request})
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
                # Find exact matches in the specified team using team_history
                team_players = Player.objects.filter(
                    current_ign=ign,
                    team_history__team=team,
                    team_history__left_date=None
                )
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
                results['alias_matches'] = []
                for alias in aliases:
                    # Get the player's current team through team_history
                    current_team = None
                    current_team_history = alias.player.team_history.filter(left_date=None).first()
                    if current_team_history:
                        current_team = current_team_history.team
                    
                    if current_team:
                        results['alias_matches'].append({
                            'player_id': alias.player.player_id,
                            'current_ign': alias.player.current_ign,
                            'previous_ign': alias.alias,
                            'team_id': current_team.team_id,
                            'team_name': current_team.team_name,
                            'match_type': 'alias'
                        })
                    else:
                        # Player has no current team
                        results['alias_matches'].append({
                            'player_id': alias.player.player_id,
                            'current_ign': alias.player.current_ign,
                            'previous_ign': alias.alias,
                            'team_id': None,
                            'team_name': 'No Current Team',
                            'match_type': 'alias'
                        })
            
            # Check for players with this IGN in other teams
            other_players = Player.objects.filter(current_ign=ign)
            if team_id:
                # Exclude players from the specified team
                other_players = other_players.exclude(
                    team_history__team_id=team_id,
                    team_history__left_date=None
                )
            
            if other_players.exists():
                results['other_team_matches'] = []
                for player in other_players:
                    # Get the player's current team through team_history
                    current_team = None
                    current_team_history = player.team_history.filter(left_date=None).first()
                    if current_team_history:
                        current_team = current_team_history.team
                        
                        results['other_team_matches'].append({
                            'player_id': player.player_id,
                            'ign': player.current_ign,
                            'team_id': current_team.team_id,
                            'team_name': current_team.team_name,
                            'match_type': 'other_team'
                        })
        
        # Also determine if this is a first-time match against this team
        if team_id:
            # Check if we need to update this query to use blue_side_team and red_side_team
            # Count previous matches against this team
            previous_matches = Match.objects.filter(
                Q(blue_side_team_id=team_id) | Q(red_side_team_id=team_id)
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
        except Match.DoesNotExist:
            return Response({"error": "Match not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Use the service to verify and process the players
        success, result = MatchStatsService.verify_and_process_match_players(
            match=match,
            team_stats=team_stats,
            opponent_stats=opponent_stats,
            user=request.user
        )
        
        if not success:
            # If the result is a string, it's an error message
            if isinstance(result, str):
                return Response({"error": result}, status=status.HTTP_400_BAD_REQUEST)
            # Otherwise it's a players_to_verify object
            return Response(result, status=status.HTTP_202_ACCEPTED)
            
        # Success, return the stats created
        return Response(result, status=status.HTTP_201_CREATED)
        
    def put(self, request, format=None):
        """
        Handle final verification and stat creation
        after any necessary player verification.
        """
        match_id = request.data.get('match_id')
        verified_players = request.data.get('verified_players', [])
        team_stats = request.data.get('team_stats', [])
        opponent_stats = request.data.get('opponent_stats', [])
        
        # First process the verified players (creates and updates)
        for player_data in verified_players:
            # Create or update players based on verification responses
            action = player_data.get('action')
            if action == 'create_new':
                # Create a new player and update the stats
                from services.player_services import PlayerService
                team_id = player_data.get('team_id')
                try:
                    team = Team.objects.get(pk=team_id)
                    player, created = PlayerService.get_or_create_player_for_team(
                        ign=player_data.get('ign'),
                        team=team,
                        role=player_data.get('role_played')
                    )
                    # Update the player_id in stats
                    self._update_player_in_stats(
                        player.player_id,
                        player_data.get('ign'),
                        team_stats,
                        opponent_stats
                    )
                except Team.DoesNotExist:
                    return Response(
                        {"error": f"Team with ID {team_id} not found"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif action == 'use_existing':
                # Update the player_id in stats
                self._update_player_in_stats(
                    player_data.get('player_id'),
                    player_data.get('ign'),
                    team_stats,
                    opponent_stats
                )
        
        # Then process the match with updated stats
        try:
            match = Match.objects.get(pk=match_id)
        except Match.DoesNotExist:
            return Response({"error": "Match not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Use the service to create the stats
        from services.match_services import MatchStatsService
        try:
            stats_created = MatchStatsService._create_stats(
                match=match,
                team_stats=team_stats,
                opponent_stats=opponent_stats
            )
            return Response({
                "message": "Stats created successfully",
                "stats_created": stats_created
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            # Log the exception
            print(f"Error creating stats: {e}")
            return Response(
                {"error": f"An error occurred while creating stats: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    def _update_player_in_stats(self, player_id, ign, team_stats, opponent_stats):
        """Update player ID in stats arrays based on IGN"""
        # Update team stats
        for stat in team_stats:
            if stat.get('ign') == ign:
                stat['player_id'] = player_id
                stat['is_new_player'] = False
                
        # Update opponent stats
        for stat in opponent_stats:
            if stat.get('ign') == ign:
                stat['player_id'] = player_id
                stat['is_new_player'] = False

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
            
        try:
            # Use the service for all IGN change logic
            updated_player = PlayerService.change_player_ign(player, new_ign)
            return Response(PlayerSerializer(updated_player).data)
        except Exception as e:
            # Handle any errors that might occur
            return Response(
                {"error": f"Failed to change IGN: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
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
    
    def get_permissions(self):
        """
        Custom permissions:
        - List/retrieve: Any authenticated user
        - Create/update/delete: Team managers only
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsTeamManager()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        """Optionally filter by date range"""
        queryset = ScrimGroup.objects.all()
        
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(start_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(start_date__lte=end_date)
            
        return queryset
        
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get statistics for a scrim group"""
        from services.scrim_group_services import ScrimGroupService
        
        scrim_group = self.get_object()
        stats = ScrimGroupService.get_scrim_group_stats(scrim_group)
        
        return Response(stats)
        
    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        """Get all matches in a scrim group"""
        from services.scrim_group_services import ScrimGroupService
        
        scrim_group = self.get_object()
        matches = ScrimGroupService.get_matches_in_group(scrim_group)
        
        # Use pagination
        page = self.paginate_queryset(matches)
        if page is not None:
            serializer = MatchSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
            
        serializer = MatchSerializer(matches, many=True, context={'request': request})
        return Response(serializer.data)

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
    
    def get_permissions(self):
        """
        Custom permissions:
        - List/retrieve: Any authenticated user
        - Create/update/delete: Team managers only
        - Actions like statistics: Any authenticated user
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsTeamManager()]
        return [permissions.IsAuthenticated()]

    def retrieve(self, request, *args, **kwargs):
        """
        Ensure score_details is up-to-date when retrieving a single match
        """
        instance = self.get_object()
        # Update score details before returning the match
        instance.update_score_details()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    def list(self, request, *args, **kwargs):
        """
        Ensure score_details is up-to-date for all matches in the list
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        # Update score details for each match in the queryset
        for match in queryset:
            if match.score_details is None:
                match.update_score_details()
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

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
        # Import required services
        from services.match_services import MatchStatsService
        from services.scrim_group_services import ScrimGroupService
        
        # Set the submitter to the current user
        match_instance = serializer.save(submitted_by=self.request.user)
        
        # Assign the ScrimGroup using the ScrimGroupService
        if match_instance.blue_side_team and match_instance.red_side_team:
            teams = [match_instance.blue_side_team, match_instance.red_side_team]
            scrim_group = ScrimGroupService.find_or_create_scrim_group(
                teams=teams,
                match_date=match_instance.match_date,
                scrim_type=match_instance.scrim_type
            )
            match_instance.scrim_group = scrim_group
            match_instance.save(update_fields=['scrim_group'])
        
        # Process the match after creation
        MatchStatsService.process_match_save(match_instance)

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
        # Get the queryset (already filtered by permissions)
        matches = self.get_queryset()
        
        # Apply pagination
        page = self.paginate_queryset(matches)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            # Basic stats
            wins = sum(1 for match in page if match.match_outcome == 'Win')
            total = len(page)
            win_rate = wins / total if total > 0 else 0
            
            response_data = {
                'win_rate': win_rate,
                'record': f"{wins}-{total - wins}",
                'matches': serializer.data
            }
            
            return self.get_paginated_response(response_data)
        
        # If no pagination requested, limit to last 10 matches
        matches = matches[:10]
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
        
    @action(detail=True, methods=['get'], url_path='player-stats')
    def player_stats(self, request, pk=None):
        """
        Get player match statistics for a specific match.
        Used to populate match detail player stat tables.
        """
        match = self.get_object()
        
        # Get all player stats for this match
        stats = PlayerMatchStat.objects.filter(match=match).select_related('player', 'team', 'hero_played')
        
        # Use pagination if needed
        page = self.paginate_queryset(stats)
        if page is not None:
            serializer = PlayerMatchStatSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
            
        serializer = PlayerMatchStatSerializer(stats, many=True, context={'request': request})
        return Response(serializer.data)
        
    @action(detail=True, methods=['patch'], url_path='update-player-stats/(?P<stat_id>[^/.]+)')
    def update_player_stats(self, request, pk=None, stat_id=None):
        """
        Update player match statistics for a specific match.
        Used for editing player stats directly from the match detail page.
        """
        match = self.get_object()
        
        # Find the player stats to update
        try:
            player_stat = PlayerMatchStat.objects.get(pk=stat_id, match=match)
        except PlayerMatchStat.DoesNotExist:
            return Response(
                {"error": f"PlayerMatchStat with ID {stat_id} not found for this match"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check ownership or permissions
        if not request.user.is_staff:
            team_ids = TeamManagerRole.objects.filter(user=request.user).values_list('team_id', flat=True)
            if player_stat.team_id not in team_ids and match.submitted_by != request.user:
                return Response(
                    {"error": "You don't have permission to update this player's stats"},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Update the player stats using the MatchStatsService
        try:
            updated_stat = MatchStatsService.update_player_stats(
                stat_id, 
                request.data,
                request.user
            )
            serializer = PlayerMatchStatSerializer(updated_stat, context={'request': request})
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

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
                role__in=['head_coach', 'assistant', 'analyst']
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
                role__in=['head_coach', 'assistant', 'analyst']
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
    
    def get_queryset(self):
        """Use HeroService to get all heroes"""
        from services.hero_services import HeroService
        return HeroService.get_all_heroes()
        
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """Get the most popular heroes by pick count"""
        from services.hero_services import HeroService
        
        # If pagination is requested
        if request.query_params.get('paginate', 'false').lower() == 'true':
            # Get all heroes ordered by pick count
            heroes = HeroService.get_popular_heroes(None)  # None for no limit
            
            # Apply pagination
            page = self.paginate_queryset(heroes)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
        
        # Otherwise use the limit parameter
        limit = request.query_params.get('limit', 10)
        try:
            limit = int(limit)
        except ValueError:
            limit = 10
            
        heroes = HeroService.get_popular_heroes(limit)
        serializer = self.get_serializer(heroes, many=True)
        return Response(serializer.data)
        
    @action(detail=False, methods=['get'])
    def banned(self, request):
        """Get the most banned heroes"""
        from services.hero_services import HeroService
        
        # If pagination is requested
        if request.query_params.get('paginate', 'false').lower() == 'true':
            # Get all heroes ordered by ban count
            heroes = HeroService.get_most_banned_heroes(None)  # None for no limit
            
            # Apply pagination
            page = self.paginate_queryset(heroes)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
        
        # Otherwise use the limit parameter
        limit = request.query_params.get('limit', 10)
        try:
            limit = int(limit)
        except ValueError:
            limit = 10
            
        heroes = HeroService.get_most_banned_heroes(limit)
        serializer = self.get_serializer(heroes, many=True)
        return Response(serializer.data)
        
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get comprehensive hero statistics"""
        from services.hero_services import HeroService
        
        # Get hero statistics
        hero_stats = HeroService.get_hero_statistics()
        
        # If pagination is requested
        if request.query_params.get('paginate', 'false').lower() == 'true':
            # Convert to paginated response
            paginator = self.pagination_class()
            paginator.request = request
            paginator.request.query_params = request.query_params.copy()
            
            page = paginator.paginate_queryset(hero_stats, request)
            if page is not None:
                return paginator.get_paginated_response(page)
        
        # Otherwise return all stats
        return Response(hero_stats)
        
    @action(detail=True, methods=['get'])
    def pairings(self, request, pk=None):
        """Get heroes that pair well with this hero"""
        from services.hero_services import HeroService
        
        # If pagination is requested
        if request.query_params.get('paginate', 'false').lower() == 'true':
            # Get all pairings without limit
            pairing_stats = HeroService.get_hero_pairings(pk, None)
            
            # Convert to paginated response
            paginator = self.pagination_class()
            paginator.request = request
            paginator.request.query_params = request.query_params.copy()
            
            page = paginator.paginate_queryset(pairing_stats, request)
            if page is not None:
                return paginator.get_paginated_response(page)
        
        # Otherwise use the limit parameter
        limit = request.query_params.get('limit', 5)
        try:
            limit = int(limit)
        except ValueError:
            limit = 5
            
        pairing_stats = HeroService.get_hero_pairings(pk, limit)
        # Return all pairing stats
        return Response(pairing_stats)

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

class TeamStatisticsView(APIView):
    """
    API endpoint for team statistics
    """
    def get(self, request, team_id):
        """
        Get statistics for a specific team
        """
        try:
            # Convert team_id to int to avoid injection issues
            team_id = int(team_id)
            
            statistics = StatisticsService.calculate_team_statistics(team_id)
            
            if not statistics:
                return Response(
                    {"error": "Team not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
                
            return Response(statistics)
        except ValueError:
            return Response(
                {"error": "Invalid team ID format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            # Log the error
            logger = logging.getLogger(__name__)
            logger.error(f"Error in TeamStatisticsView: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Return a friendly error response
            return Response(
                {
                    "error": "An error occurred while fetching team statistics",
                    "detail": str(e) if settings.DEBUG else "Please try again later"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
