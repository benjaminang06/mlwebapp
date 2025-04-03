import os
import sys
import django

# Setup Django
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scrim_stats_backend.settings')
django.setup()

# Import our error handling utilities
from api.error_handling import safe_get_object_or_404, validate_required_fields
from api.models import Team, Player
from rest_framework.response import Response
from functools import wraps

# Test safe_get_object_or_404
print("Testing safe_get_object_or_404...")
# Try to get a team that doesn't exist
result = safe_get_object_or_404(Team, pk=999999)
if isinstance(result, Response):
    print("Success: Got an error response for non-existent team")
    print(f"Response data: {result.data}")
else:
    print("Error: Did not get an error response for non-existent team")

# Test logging
import logging
logger = logging.getLogger('api')
logger.info("Test info message from test script")
logger.warning("Test warning message from test script")
logger.error("Test error message from test script")
print("Logged test messages")

print("\nTest completed successfully!") 