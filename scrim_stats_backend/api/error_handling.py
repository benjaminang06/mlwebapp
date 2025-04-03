"""
Error handling and request validation utilities for the API.
Provides consistent error responses and input validation.
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db.utils import IntegrityError
from django.core.exceptions import ValidationError
from functools import wraps

# Get an instance of a logger
logger = logging.getLogger('api')

def custom_exception_handler(exc, context):
    """
    Custom exception handler for REST framework that logs errors
    and provides more consistent error responses.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # If unexpected error occurs (not handled by DRF's exception handler)
    if response is None:
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        
        # Handle specific types of exceptions
        if isinstance(exc, IntegrityError):
            data = {
                'error': 'Database integrity error occurred',
                'detail': str(exc)
            }
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        
        if isinstance(exc, ValidationError):
            data = {
                'error': 'Validation error occurred',
                'detail': str(exc)
            }
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        
        # Generic error for other types of exceptions
        return Response(
            {'error': 'An unexpected error occurred'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # For handled exceptions, add more structure to the response
    if isinstance(response.data, dict):
        if 'detail' in response.data:
            response.data = {
                'error': str(response.data['detail']),
                'status_code': response.status_code
            }
    
    # Log the error
    logger.error(f"API error: {response.data}", exc_info=True)
    
    return response

def validate_required_fields(required_fields):
    """
    Decorator for API views to validate that required fields are present in request data.
    
    Usage:
    @validate_required_fields(['field1', 'field2'])
    def post(self, request):
        # This will only execute if all required fields are present
        ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            missing_fields = []
            
            for field in required_fields:
                if field not in request.data:
                    missing_fields.append(field)
            
            if missing_fields:
                logger.warning(f"Missing required fields: {', '.join(missing_fields)}")
                return Response(
                    {
                        'error': 'Missing required fields',
                        'missing_fields': missing_fields
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return func(self, request, *args, **kwargs)
        return wrapper
    return decorator

def safe_get_object_or_404(model_class, error_message=None, **kwargs):
    """
    Utility function to safely get an object or return a 404 response.
    Logs the error and provides a consistent error message.
    
    Usage:
    team = safe_get_object_or_404(Team, team_id=team_id)
    if isinstance(team, Response):
        return team  # This is an error response
    # Use team object
    """
    try:
        return model_class.objects.get(**kwargs)
    except model_class.DoesNotExist:
        model_name = model_class.__name__
        field_info = ', '.join([f"{k}={v}" for k, v in kwargs.items()])
        
        # Log the error
        logger.warning(f"{model_name} not found with {field_info}")
        
        # Prepare error message
        if error_message is None:
            error_message = f"{model_name} not found"
        
        # Return error response
        error_response = {
            'error': error_message,
            'detail': f"No {model_name} found with {field_info}"
        }
        
        return Response(error_response, status=status.HTTP_404_NOT_FOUND) 