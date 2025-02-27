from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'teams', views.TeamViewSet)
router.register(r'players', views.PlayerViewSet)
router.register(r'matches', views.MatchViewSet)
router.register(r'scrim-groups', views.ScrimGroupViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('team-roles/', views.TeamRoleManagementView.as_view(), name='team-roles'),
    path('admin/scrim-group/<int:scrim_group_id>/', views.get_scrim_group_admin_data, name='admin_scrim_group_data'),
] 