from django import forms
from django.utils.safestring import mark_safe

class HeroSelectWidget(forms.TextInput):
    """
    A custom widget for selecting heroes with Select2.
    Only allows selection from existing heroes in the database.
    """
    
    class Media:
        css = {
            'all': (
                'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css',
                'https://cdnjs.cloudflare.com/ajax/libs/select2-bootstrap-theme/0.1.0-beta.10/select2-bootstrap.min.css',
            )
        }
        js = (
            'admin/jquery.init.js',
            'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js',
            'js/hero_select.js',
        )
    
    def __init__(self, attrs=None):
        default_attrs = {
            'class': 'hero-select',
            'data-placeholder': 'Select a hero',
            'data-url': '/api/hero-autocomplete/',
            'data-auto-select': 'true'  # Enable auto-selection of first match
        }
        if attrs:
            default_attrs.update(attrs)
        super().__init__(default_attrs)
    
    def render(self, name, value, attrs=None, renderer=None):
        """
        Render the widget with proper Select2 attributes.
        """
        # First render the basic input
        html = super().render(name, value, attrs, renderer)
        
        # Add error container (hidden by default)
        error_container = f'<div id="{attrs.get("id", name)}_error" class="hero-error-message" ' \
                           f'style="display: none; color: #d9534f; font-size: 0.8em; margin-top: 3px;"></div>'
        
        return mark_safe(f'{html}{error_container}')
    
    def value_from_datadict(self, data, files, name):
        """
        Get the hero value from the form data.
        """
        value = super().value_from_datadict(data, files, name)
        
        # Ensure we only get valid string values
        if value and not isinstance(value, str):
            value = str(value)
            
        return value.strip() if value else '' 