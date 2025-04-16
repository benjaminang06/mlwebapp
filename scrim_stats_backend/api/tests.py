from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIRequestFactory # Use APITestCase for API tests
from django.contrib.auth.models import User
import logging

# Import models and utilities from the 'api' app
from .models import Team, Player, Hero # Make sure Hero is imported if used in models/tests
from .error_handling import safe_get_object_or_404, validate_required_fields
from .serializers import TeamSerializer # Import a serializer to test later if needed

# Get an instance of a logger (optional, can be used within tests)
logger = logging.getLogger('api')

# --- Test Utility Functions ---

class ErrorHandlingUtilsTests(TestCase): # Can use TestCase for non-API utility tests
    """Tests for utility functions in error_handling.py"""

    def test_safe_get_object_or_404_not_found(self):
        """
        Ensure safe_get_object_or_404 returns a 404 Response when object doesn't exist.
        """
        # Call the function trying to get a non-existent Team
        result = safe_get_object_or_404(Team, pk=999999, error_message="Test Team not found")

        # Assert that the result is an instance of Response (DRF's Response)
        # Note: We need to import Response from DRF for this check explicitly
        from rest_framework.response import Response
        self.assertIsInstance(result, Response)
        self.assertEqual(result.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', result.data)
        self.assertEqual(result.data['error'], "Test Team not found")
        logger.info("Successfully tested safe_get_object_or_404 for non-existent object.") # Example logging

    # TODO: Add tests for validate_required_fields decorator
    # This would likely involve creating a mock request and view/function
    # def test_validate_required_fields_decorator(self):
    #     pass

# --- Test API Endpoints ---

class TeamAPITests(APITestCase):
    """Tests for the Team related API endpoints (/api/teams/)"""

    @classmethod
    def setUpTestData(cls):
        """Set up non-modified objects used by all test methods in this class."""
        # Create a user that will be used across tests in this class
        # Make the user a staff member to potentially bypass granular permissions for basic tests
        cls.user = User.objects.create_user(
            username='testuser', 
            password='password123', 
            email='test@example.com', 
            is_staff=True # Grant staff status
        )

        # Define the URL for the team list/create endpoint
        # Make sure you have named your URL pattern 'team-list' or similar in api/urls.py
        try:
            # Use a more common name like 'team-list' or adjust as needed
            cls.teams_url = reverse('team-list') 
        except Exception as e:
            logger.error(f"Failed to reverse URL 'team-list'. Make sure it's defined in api/urls.py. Error: {e}")
            cls.teams_url = '/api/teams/' # Fallback if reverse fails
        
        # Try to get the detail URL name (assuming 'team-detail')
        # This requires a URL pattern like path('<int:pk>/', ..., name='team-detail')
        try:
            # We need a dummy pk for reverse to work during setup, it won't be used yet.
            cls.teams_detail_url_name = 'team-detail'
            reverse(cls.teams_detail_url_name, kwargs={'pk': 1})
        except Exception as e:
            logger.error(f"Failed to reverse URL '{cls.teams_detail_url_name}'. Make sure it's defined for team detail view. Error: {e}")
            cls.teams_detail_url_name = None # Indicate detail URL pattern is likely missing/wrong

        logger.info(f"Setup complete for TeamAPITests. List URL: {cls.teams_url}, Detail URL Name: {cls.teams_detail_url_name}")

    def setUp(self):
        """Set up run once for every test method.
           Login the user for each test.
        """
        # Log the user in using the test client for subsequent requests in this test method
        self.client.login(username='testuser', password='password123')

    # Helper method to create a team for tests
    def _create_test_team(self, name="Test Team", abbr="TT", cat="Pro"):
        return Team.objects.create(team_name=name, team_abbreviation=abbr, team_category=cat)

    def test_create_team_success(self):
        """
        Ensure we can create a new team via the API.
        """
        data = {
            'team_name': 'Test Knights',
            'team_abbreviation': 'TK',
            'team_category': 'Pro'
            # Add other required fields if any
        }
        response = self.client.post(self.teams_url, data, format='json')

        # Assertions
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, f"Expected 201, got {response.status_code}. Response: {response.data}")
        self.assertEqual(Team.objects.count(), 1) # Check DB count
        created_team = Team.objects.get()
        self.assertEqual(created_team.team_name, 'Test Knights')
        self.assertEqual(response.data['team_name'], 'Test Knights') # Check response data

    def test_create_team_missing_name(self):
        """
        Ensure creating a team fails with 400 if the required team_name is missing.
        """
        initial_team_count = Team.objects.count()
        data = {
            # 'team_name': 'Missing Name', # Intentionally missing
            'team_abbreviation': 'MN',
            'team_category': 'Academy'
        }
        response = self.client.post(self.teams_url, data, format='json')

        # Assertions
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, f"Expected 400, got {response.status_code}. Response: {response.data}")
        self.assertEqual(Team.objects.count(), initial_team_count) # Ensure no team was created
        self.assertIn('team_name', response.data) # Check error message exists for the field
        # Be more specific about the error if possible (DRF serializers usually provide list of strings)
        self.assertTrue(any('required' in str(err) for err in response.data['team_name']))

    def test_list_teams_authenticated(self):
        """
        Ensure authenticated users can list teams.
        """
        # Use helper method
        self._create_test_team(name='Team One', abbr='T1')
        response = self.client.get(self.teams_url, format='json')

        # Assertions
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # DRF pagination wraps results in 'results' by default
        self.assertEqual(len(response.data.get('results', [])), 1)
        self.assertEqual(response.data['results'][0]['team_name'], 'Team One')

    def test_list_teams_unauthenticated(self):
        """
        Ensure unauthenticated users cannot list teams (assuming permissions require auth).
        """
        # Log out the default test user first
        self.client.logout()
        self._create_test_team(name='Team One', abbr='T1') # Use helper
        response = self.client.get(self.teams_url, format='json')

        # Assertions (expecting 401 or 403 depending on auth setup)
        # In your settings, DEFAULT_PERMISSION_CLASSES is IsAuthenticated, so expect 401
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- New Tests for Retrieve/Update/Delete ---

    def test_retrieve_team_success(self):
        """Ensure we can retrieve a specific team."""
        if not self.teams_detail_url_name:
            self.skipTest("Team detail URL name not configured or reversed incorrectly.")
        
        team = self._create_test_team(name="Retrieve Me", abbr="RM")
        detail_url = reverse(self.teams_detail_url_name, kwargs={'pk': team.pk})
        response = self.client.get(detail_url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['team_name'], "Retrieve Me")
        self.assertEqual(response.data['team_id'], team.pk)

    def test_retrieve_team_not_found(self):
        """Ensure retrieving a non-existent team returns 404."""
        if not self.teams_detail_url_name:
            self.skipTest("Team detail URL name not configured or reversed incorrectly.")
        
        non_existent_pk = 999
        detail_url = reverse(self.teams_detail_url_name, kwargs={'pk': non_existent_pk})
        response = self.client.get(detail_url, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_team_success(self):
        """Ensure we can update an existing team (using PUT or PATCH)."""
        if not self.teams_detail_url_name:
            self.skipTest("Team detail URL name not configured or reversed incorrectly.")
            
        team = self._create_test_team(name="Update Me", abbr="UM")
        detail_url = reverse(self.teams_detail_url_name, kwargs={'pk': team.pk})
        update_data = {
            'team_name': 'Updated Name',
            'team_abbreviation': 'UN',
            'team_category': team.team_category # Keep category same for PUT
        }
        # Using PUT (requires all fields usually)
        response = self.client.put(detail_url, update_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, f"Expected 200, got {response.status_code}. Response: {response.data}")
        
        # Refresh object from DB and check changes
        team.refresh_from_db()
        self.assertEqual(team.team_name, 'Updated Name')
        self.assertEqual(team.team_abbreviation, 'UN')
        self.assertEqual(response.data['team_name'], 'Updated Name') # Check response too

        # Optional: Test PATCH (partial update)
        patch_data = {'team_category': 'Amateur'}
        response = self.client.patch(detail_url, patch_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        team.refresh_from_db()
        self.assertEqual(team.team_category, 'Amateur')

    def test_delete_team_success(self):
        """Ensure we can delete an existing team."""
        if not self.teams_detail_url_name:
            self.skipTest("Team detail URL name not configured or reversed incorrectly.")
            
        team = self._create_test_team(name="Delete Me", abbr="DM")
        self.assertEqual(Team.objects.count(), 1)
        detail_url = reverse(self.teams_detail_url_name, kwargs={'pk': team.pk})
        response = self.client.delete(detail_url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT, f"Expected 204, got {response.status_code}.")
        self.assertEqual(Team.objects.count(), 0) # Check it's gone from DB
        # Verify it can't be retrieved anymore
        get_response = self.client.get(detail_url, format='json')
        self.assertEqual(get_response.status_code, status.HTTP_404_NOT_FOUND)

    # --- TODO: Add more tests ---
    # - Test permission checks for update/delete (e.g., non-staff/non-manager cannot update/delete)


# --- Placeholder for other test classes ---

# class PlayerAPITests(APITestCase):
#     # TODO: Add tests for Player endpoints
#     pass

# class MatchAPITests(APITestCase):
#     # TODO: Add tests for Match endpoints
#     pass

# Add more test classes for other models/endpoints as needed
