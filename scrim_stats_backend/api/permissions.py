from rest_framework import permissions
from .models import TeamManagerRole, Player, Team

class IsTeamManager(permissions.BasePermission):
    """
    Custom permission to only allow team managers to create/edit players and matches.
    Permissions:
    - Safe methods (GET): Any authenticated user
    - Other methods: Users who manage at least one team with appropriate role level
    """
    
    def has_permission(self, request, view):
        # Allow GET requests for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # For POST/PUT/DELETE, check if user is a manager of any team
        if not request.user.is_authenticated:
            return False
            
        # Allow staff users full access
        if request.user.is_staff:
            return True
            
        # Check if user has appropriate role for any team
        return TeamManagerRole.objects.filter(
            user=request.user, 
            role__in=['head_coach', 'assistant', 'analyst']
        ).exists()
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
            
        # Check if user is admin
        if request.user.is_staff:
            return True
            
        # If it's a Player object, check if user manages their team
        if isinstance(obj, Player):
            current_team_history = obj.get_current_team_history()
            if not current_team_history:
                return False
                
            return TeamManagerRole.objects.filter(
                user=request.user,
                team=current_team_history.team,
                role__in=['head_coach', 'assistant', 'analyst']
            ).exists()
            
        # If it's a Team object, check if user is a manager of this team
        if isinstance(obj, Team):
            return TeamManagerRole.objects.filter(
                user=request.user,
                team=obj,
                role__in=['head_coach', 'assistant', 'analyst']
            ).exists()
            
        # Default to False for unknown objects
        return False

class IsTeamMember(permissions.BasePermission):
    """
    Permission to allow team members to view their team's data.
    Permissions:
    - Safe methods (GET): Authenticated users who are members of the team
    - Other methods: Never allowed (read-only permission)
    """
    
    def has_permission(self, request, view):
        # All requests require authentication
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Read-only permissions for authenticated team members
        if not request.user.is_authenticated:
            return False
            
        # Deny non-safe methods
        if request.method not in permissions.SAFE_METHODS:
            return False
            
        # Check if user is a member or manager of this team
        if isinstance(obj, Team):
            return TeamManagerRole.objects.filter(
                user=request.user,
                team=obj
            ).exists()
            
        # For other objects, fall back to IsAuthenticated
        return True 