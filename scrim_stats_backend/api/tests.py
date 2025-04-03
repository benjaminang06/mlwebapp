from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIRequestFactory # Use APITestCase for API tests
from django.contrib.auth.models import User
import logging

# Import models and utilities from the 'api' app
from .models import Team, Player
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
        # Note: We need to import Response from DRF, but APITestCase handles responses well
        # For this specific utility test, let's check the status code if it's a response-like object
        # Since safe_get_object_or_404 returns a DRF Response object:
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

    def setUp(self):
        """Set up initial data for tests in this class."""
        # Create a test user (needed if endpoints require authentication)
        self.user = User.objects.create_user(username='testuser', password='password123', email='test@example.com')
        # Log the user in using the test client for subsequent requests
        self.client.login(username='testuser', password='password123')

        # Define the URL for the team list/create endpoint
        # Make sure you have named your URL pattern 'team-list-create' in api/urls.py
        try:
            self.teams_url = reverse('team-list-create')
        except Exception as e:
            logger.error(f"Failed to reverse URL 'team-list-create'. Make sure it's defined in api/urls.py. Error: {e}")
            self.teams_url = '/api/teams/' # Fallback if reverse fails

        # (Optional) Create some initial data if needed for GET tests, e.g.
        # self.team1 = Team.objects.create(team_name='Initial Team', team_abbreviation='IT', team_category='Pro')

        logger.info(f"Setup complete for TeamAPITests. Using URL: {self.teams_url}")

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
        data = {
            # 'team_name': 'Missing Name', # Intentionally missing
            'team_abbreviation': 'MN',
            'team_category': 'Academy'
        }
        response = self.client.post(self.teams_url, data, format='json')

        # Assertions
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, f"Expected 400, got {response.status_code}. Response: {response.data}")
        self.assertEqual(Team.objects.count(), 0) # Ensure no team was created
        self.assertIn('team_name', response.data) # Check error message exists for the field

    def test_list_teams_authenticated(self):
        """
        Ensure authenticated users can list teams.
        """
        # Create a team first
        Team.objects.create(team_name='Team One', team_abbreviation='T1', team_category='Pro')
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
        # Log out the default test user
        self.client.logout()
        response = self.client.get(self.teams_url, format='json')

        # Assertions (expecting 401 or 403 depending on auth setup)
        # In your settings, DEFAULT_PERMISSION_CLASSES is IsAuthenticated, so expect 401
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- TODO: Add more tests ---
    # - Test getting a specific team (retrieve)
    # - Test updating a team (update)
    # - Test deleting a team (destroy)
    # - Test permission checks (e.g., can only managers update?)
    # - Test validation edge cases (e.g., invalid category, duplicate name)


# --- Placeholder for other test classes ---

# class PlayerAPITests(APITestCase):
#     # TODO: Add tests for Player endpoints
#     pass

# class MatchAPITests(APITestCase):
#     # TODO: Add tests for Match endpoints
#     pass

# Add more test classes for other models/endpoints as needed
