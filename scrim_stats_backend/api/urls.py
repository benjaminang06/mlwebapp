from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TeamViewSet, PlayerViewSet, MatchViewSet, 
    ScrimGroupViewSet, HeroViewSet, DraftViewSet, 
    DraftBanViewSet, DraftPickViewSet, ApiStatus, ApiRootView,
    ManagedTeamListView,
    RegisterView,
    TeamPlayersView
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'teams', TeamViewSet)
router.register(r'players', PlayerViewSet)
router.register(r'matches', MatchViewSet)
router.register(r'scrim-groups', ScrimGroupViewSet)
router.register(r'heroes', HeroViewSet)
router.register(r'drafts', DraftViewSet)
router.register(r'draft-bans', DraftBanViewSet)
router.register(r'draft-picks', DraftPickViewSet)

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', ApiRootView.as_view(), name='api-root'),
    path('status/', ApiStatus.as_view(), name='api-status'),
    path('teams/managed/', ManagedTeamListView.as_view(), name='managed-team-list'),
    path('register/', RegisterView.as_view(), name='user_register'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('teams/<int:pk>/players/', TeamPlayersView.as_view(), name='team-players'),
    path('', include(router.urls)),
] 