from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions, filters
from django.db.models import Count, Q, Avg, Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from .models import Team, Player, Match, PlayerMatchStat, PlayerAlias, PlayerTeamHistory, ScrimGroup, FileUpload, TeamManagerRole, Hero
from .serializers import TeamSerializer, PlayerSerializer, PlayerAliasSerializer, MatchSerializer, ScrimGroupSerializer, PlayerMatchStatSerializer, FileUploadSerializer, UserSerializer, TeamManagerRoleSerializer
from .permissions import IsTeamManager, IsTeamMember
from django.contrib.auth.models import User
from rest_framework import generics
from django.http import JsonResponse
from django.contrib.admin.views.decorators import staff_member_required
from .utils import get_player_role_stats, get_hero_pairing_stats
from .error_handling import validate_required_fields, safe_get_object_or_404
import logging

# Get logger for this file
logger = logging.getLogger('api')

# Create your views here.

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
    
    def get_permissions(self):
        """
        Custom permissions:
        - List/retrieve: Any authenticated user
        - Create/update/delete: Admin users only
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAdminUser()]
        return super().get_permissions()
    
    @action(detail=True, methods=['get'])
    def players(self, request, pk=None):
        """Get all players for a specific team"""
        team = self.get_object()
        players = Player.objects.filter(teams=team)
        serializer = PlayerSerializer(players, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get aggregated statistics for a team"""
        team = self.get_object()
        # Get matches where this team participated
        matches = Match.objects.filter(team=team)
        
        # Calculate aggregated statistics
        stats = {
            'total_matches': matches.count(),
            'wins': matches.filter(match_outcome='Win').count(),
            'losses': matches.filter(match_outcome='Loss').count(),
            'win_rate': matches.filter(match_outcome='Win').count() / matches.count() if matches.count() > 0 else 0,
        }
        
        return Response(stats)

class TeamPlayersView(APIView):
    """
    Get a list of players for a specific team, used for autocomplete/dropdown
    when entering player stats.
    """
    def get(self, request, team_id, format=None):
        # Use our safe_get_object_or_404 utility
        team = safe_get_object_or_404(
            Team, 
            error_message="Team not found",
            pk=team_id
        )
        
        # If team is an error response, return it
        if isinstance(team, Response):
            return team
        
        # Get all current players for this team - updated query
        players = Player.objects.filter(team_history__team=team, team_history__left_date=None)
        
        # Format response with player info
        player_data = [{
            'player_id': player.player_id,
            'ign': player.current_ign,
            'role': player.primary_role,
            'team_id': team.team_id,
            'team_name': team.team_name
        } for player in players]
        
        logger.info(f"Retrieved {len(player_data)} players for team {team.team_name}")
        return Response(player_data)

class PlayerLookupView(APIView):
    """
    Look up a player by IGN, including potential matches from aliases and other teams.
    Used to identify players when submitting stats.
    """
    def get(self, request, format=None):
        ign = request.query_params.get('ign', '')
        team_id = request.query_params.get('team_id')
        
        # Validate required parameters
        if not ign:
            logger.warning("PlayerLookupView called without required 'ign' parameter")
            return Response(
                {
                    "error": "Missing required parameter",
                    "detail": "IGN parameter is required"
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = {
            'exact_matches': [],
            'alias_matches': [],
            'other_team_matches': []
        }
        
        # If team_id provided, first check that specific team
        if team_id:
            # Use our safe_get_object_or_404 utility
            team = safe_get_object_or_404(Team, pk=team_id)
            
            # If team is an error response, continue without it
            if not isinstance(team, Response):
                # Find exact matches in the specified team
                team_players = Player.objects.filter(team_history__team=team, team_history__left_date=None, current_ign=ign)
                if team_players.exists():
                    logger.info(f"Found {team_players.count()} exact matches for IGN '{ign}' in team {team.team_name}")
                    results['exact_matches'] = [{
                        'player_id': player.player_id,
                        'ign': player.current_ign,
                        'team_id': team.team_id,
                        'team_name': team.team_name,
                        'match_type': 'current_team'
                    } for player in team_players]
        
        # If no exact matches in specified team, look for aliases or players in other teams
        if not results['exact_matches']:
            # Check for alias matches (players who previously used this IGN)
            aliases = PlayerAlias.objects.filter(alias=ign)
            if aliases.exists():
                logger.info(f"Found {aliases.count()} alias matches for IGN '{ign}'")
                alias_matches = []
                for alias in aliases:
                    # Get the player's current team if any
                    current_team = alias.player.primary_team
                    if current_team:
                        alias_matches.append({
                            'player_id': alias.player.player_id,
                            'current_ign': alias.player.current_ign,
                            'previous_ign': alias.alias,
                            'team_id': current_team.team_id,
                            'team_name': current_team.team_name,
                            'match_type': 'alias'
                        })
                
                results['alias_matches'] = alias_matches
            
            # Check for players with this IGN in other teams
            other_players_query = Player.objects.filter(current_ign=ign)
            if team_id:
                # Exclude players from the already checked team
                current_team_players = Player.objects.filter(
                    team_history__team_id=team_id,
                    team_history__left_date=None
                ).values_list('player_id', flat=True)
                other_players_query = other_players_query.exclude(player_id__in=current_team_players)
            
            other_players = other_players_query.distinct()
            if other_players.exists():
                logger.info(f"Found {other_players.count()} players with IGN '{ign}' in other teams")
                other_team_matches = []
                for player in other_players:
                    # Get the player's current team if any
                    current_team = player.primary_team
                    if current_team:
                        other_team_matches.append({
                            'player_id': player.player_id,
                            'ign': player.current_ign,
                            'team_id': current_team.team_id,
                            'team_name': current_team.team_name,
                            'match_type': 'other_team'
                        })
                
                results['other_team_matches'] = other_team_matches
        
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
    @validate_required_fields(['match_id'])
    def post(self, request, format=None):
        match_id = request.data.get('match_id')
        team_stats = request.data.get('team_stats', []) # Stats for our team
        opponent_stats = request.data.get('opponent_stats', []) # Stats for opponent
        
        # Use safe_get_object_or_404 utility
        match = safe_get_object_or_404(Match, error_message="Match not found", pk=match_id)
        if isinstance(match, Response):
            return match
            
        our_team = match.our_team
        opponent_team = match.opponent_team
        
        # Verify permissions
        if not our_team.is_managed_by(request.user):
            logger.warning(f"User {request.user.username} attempted to submit stats for team {our_team.team_name} without permission")
            return Response(
                {
                    "error": "Permission denied",
                    "detail": "You can only submit stats for teams you manage"
                }, 
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
        
        # Recalculate match statistics
        match.calculate_score_details()

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
            
        # Use the model method we created earlier
        player.change_ign(new_ign)
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

class ScrimGroupViewSet(viewsets.ModelViewSet):
    """
    API endpoint for scrim groups (series of matches).
    """
    queryset = ScrimGroup.objects.all()
    serializer_class = ScrimGroupSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['scrim_group_name']
    ordering_fields = ['start_date', 'end_date']
    ordering = ['-start_date']  # Default ordering
    
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
    filterset_fields = ['match_outcome', 'scrim_type', 'opponent_category', 'team_side']
    search_fields = ['opponent_team_name']
    ordering_fields = ['match_date']
    
    def get_queryset(self):
        """Filter matches by date range if provided"""
        queryset = super().get_queryset()
        
        # Date range filtering
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        
        if start_date:
            queryset = queryset.filter(match_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(match_date__lte=end_date)
            
        # Only return matches the user submitted if they're not admin
        user = self.request.user
        if not user.is_staff:
            queryset = queryset.filter(submitted_by=user)
            
        return queryset
    
    def perform_create(self, serializer):
        """Set the submitter automatically to the current user"""
        serializer.save(submitted_by=self.request.user)
        
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
    
    def get(self, request, format=None):
        player_id = request.query_params.get('player_id')
        team_id = request.query_params.get('team_id')
        hero = request.query_params.get('hero')
        
        if not (player_id or team_id or hero):
            return Response({"error": "You must provide at least one filter parameter"}, status=status.HTTP_400_BAD_REQUEST)
            
        hero_pairing_stats = get_hero_pairing_stats(player_id, team_id, hero)
        return Response(hero_pairing_stats)

def hero_autocomplete(request):
    """
    Autocomplete view for heroes.
    Returns JSON list of heroes matching the search term.
    """
    term = request.GET.get('term', '')
    heroes = Hero.objects.filter(name__icontains=term).order_by('name')[:15]
    
    results = [
        {
            'id': hero.name,      # Use name as identifier
            'text': hero.name,    # Display only the name (no role)
        }
        for hero in heroes
    ]
    
    return JsonResponse({'results': results})

def hero_validate(request):
    """
    Validation endpoint for hero names.
    Checks if a hero exists in the database and returns a JSON response.
    """
    hero_name = request.GET.get('name', '')
    
    if not hero_name:
        return JsonResponse({'valid': False, 'error': 'No hero name provided'})
    
    valid = Hero.objects.filter(name__iexact=hero_name).exists()
    
    return JsonResponse({
        'valid': valid,
        'name': hero_name
    })
