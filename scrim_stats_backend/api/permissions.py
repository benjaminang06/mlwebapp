from rest_framework import permissions
from .models import TeamManagerRole, Player, Team

class IsTeamManager(permissions.BasePermission):
    """
    Custom permission to only allow team managers to create/edit players and matches.
    """
    
    def has_permission(self, request, view):
        # Allow GET requests for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        
        # For POST/PUT/DELETE, check if user is a manager of any team
        if not request.user.is_authenticated:
            return False
            
        return TeamManagerRole.objects.filter(
            user=request.user, 
            role_level__in=['MANAGER', 'COACH', 'ADMIN']
        ).exists() or request.user.is_staff
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
            
        # Check if user is admin
        if request.user.is_staff:
            return True
            
        # If it's a Player object, check if user manages their team
        if isinstance(obj, Player):
            return TeamManagerRole.objects.filter(
                user=request.user,
                team__in=obj.teams.all(),
                role_level__in=['MANAGER', 'COACH', 'ADMIN']
            ).exists()
            
        # If it's a Team object, check if user is a manager of this team
        if isinstance(obj, Team):
            return TeamManagerRole.objects.filter(
                user=request.user,
                team=obj,
                role_level__in=['MANAGER', 'COACH', 'ADMIN']
            ).exists()
            
        return False

class IsTeamMember(permissions.BasePermission):
    """
    Permission to allow team members to view their team's data
    """
    
    def has_object_permission(self, request, view, obj):
        # Read-only permissions for authenticated team members
        if not request.user.is_authenticated:
            return False
            
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