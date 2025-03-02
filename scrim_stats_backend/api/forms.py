from django import forms
from django.utils import timezone
from django.utils.formats import date_format
from django_select2.forms import ModelSelect2Widget, Select2Widget
from .models import Team, Match, ScrimGroup

class TeamSelect2Widget(ModelSelect2Widget):
    """Custom Select2 widget for Team model with search and create options"""
    search_fields = ['team_name__icontains', 'team_abbreviation__icontains']
    
    def build_attrs(self, base_attrs, extra_attrs=None):
        attrs = super().build_attrs(base_attrs, extra_attrs)
        attrs['data-minimum-input-length'] = 0  # Show all options initially
        attrs['data-placeholder'] = 'Type to search or create a new team'
        attrs['data-allow-clear'] = True
        attrs['data-tags'] = True  # Allow creating new entries
        return attrs

class OurTeamSelect2Widget(TeamSelect2Widget):
    """Widget for selecting only managed teams (is_opponent_only=False)"""
    def get_queryset(self):
        return Team.objects.filter(is_opponent_only=False)

class OpponentTeamSelect2Widget(TeamSelect2Widget):
    """Widget for selecting any team as opponent (including our own teams)"""
    def get_queryset(self):
        return Team.objects.all()

class ScrimGroupAdminForm(forms.ModelForm):
    """Enhanced form for ScrimGroup admin with Select2 widgets for team selection"""
    
    class Meta:
        model = ScrimGroup
        fields = ['scrim_group_name', 'start_date', 'notes']
        widgets = {
            'start_date': forms.DateInput(attrs={'type': 'date'}),
        }
    
    team1 = forms.ModelChoiceField(
        queryset=Team.objects.filter(is_opponent_only=False),
        required=False,
        label="Home Team",
        help_text="Your team",
        widget=OurTeamSelect2Widget(attrs={'data-placeholder': 'Select or create your team'})
    )
    
    team2 = forms.ModelChoiceField(
        queryset=Team.objects.all(),
        required=False,
        label="Opponent Team",
        help_text="The team you're playing against",
        widget=OpponentTeamSelect2Widget(attrs={'data-placeholder': 'Select or create opponent team'})
    )
    
    # Make name field optional - we'll auto-generate it
    scrim_group_name = forms.CharField(
        max_length=200,
        required=False, 
        label="Scrim Group Name (Optional)",
        help_text="Leave blank to auto-generate from date and teams"
    )
    
    def clean(self):
        cleaned_data = super().clean()
        
        # Handle team creation for team1 if it's a string
        team1 = cleaned_data.get('team1')
        if team1 and isinstance(team1, str):
            team_name = team1
            team_abbr = ''.join(word[0].upper() for word in team_name.split()[:3])
            team1 = Team.objects.create(
                team_name=team_name,
                team_abbreviation=team_abbr,
                team_category='Collegiate',
                is_opponent_only=False
            )
            cleaned_data['team1'] = team1
        
        # Handle team creation for team2 if it's a string
        team2 = cleaned_data.get('team2')
        if team2 and isinstance(team2, str):
            team_name = team2
            team_abbr = ''.join(word[0].upper() for word in team_name.split()[:3])
            team2 = Team.objects.create(
                team_name=team_name,
                team_abbreviation=team_abbr,
                team_category='Collegiate',
                is_opponent_only=True
            )
            cleaned_data['team2'] = team2
        
        # Auto-generate scrim_group_name if not provided and both teams exist
        if not cleaned_data.get('scrim_group_name') and team1 and team2 and cleaned_data.get('start_date'):
            start_date = cleaned_data.get('start_date')
            date_str = date_format(start_date, format="m/d/y")
            suggested_name = f"{date_str} {team1.team_abbreviation} VS {team2.team_abbreviation}"
            cleaned_data['scrim_group_name'] = suggested_name
            
        return cleaned_data

class MatchAdminForm(forms.ModelForm):
    """Enhanced form for Match admin with Select2 widgets for team selection"""
    # Add a date-only field
    match_date = forms.DateField(
        required=True,
        widget=forms.DateInput(attrs={'type': 'date'}),
        label="Match Date",
        help_text="The date when the match occurred"
    )
    
    # Formatted duration field
    formatted_duration = forms.CharField(
        required=False,
        max_length=8,
        label="Match Duration",
        help_text="Enter duration in format HH:MM:SS (e.g., 00:16:21)",
        widget=forms.TextInput(attrs={'placeholder': '00:16:21'})
    )
    
    # Add field to indicate if this is an external match (not involving our team)
    is_external_match = forms.BooleanField(
        required=False,
        initial=False,
        label="External Match",
        help_text="Check this if this match doesn't involve your team (e.g., scouting other teams)"
    )
    
    class Meta:
        model = Match
        fields = '__all__'
        widgets = {
            'our_team': OurTeamSelect2Widget(attrs={'data-placeholder': 'Select or create your team'}),
            'opponent_team': OpponentTeamSelect2Widget(attrs={'data-placeholder': 'Select or create opponent team'}),
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Set initial value for the date field
        if self.instance and self.instance.pk and self.instance.match_date:
            self.fields['match_date'].initial = self.instance.match_date
        
        # Set initial value for formatted duration field
        if self.instance and self.instance.pk and self.instance.match_duration:
            total_seconds = self.instance.match_duration.total_seconds()
            hours, remainder = divmod(total_seconds, 3600)
            minutes, seconds = divmod(remainder, 60)
            
            # Format as HH:MM:SS
            self.fields['formatted_duration'].initial = f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"
    
    def clean(self):
        cleaned_data = super().clean()
        
        # Handle team creation if value doesn't match an existing team ID
        our_team = cleaned_data.get('our_team')
        opponent_team = cleaned_data.get('opponent_team')
        
        # If our_team is a string (not an ID), create a new team
        if our_team and isinstance(our_team, str):
            team_name = our_team
            team_abbr = ''.join(word[0].upper() for word in team_name.split()[:3])
            our_team = Team.objects.create(
                team_name=team_name,
                team_abbreviation=team_abbr,
                team_category='Collegiate',
                is_opponent_only=False
            )
            cleaned_data['our_team'] = our_team
        
        # If opponent_team is a string (not an ID), create a new team
        if opponent_team and isinstance(opponent_team, str):
            team_name = opponent_team
            team_abbr = ''.join(word[0].upper() for word in team_name.split()[:3])
            opponent_team = Team.objects.create(
                team_name=team_name,
                team_abbreviation=team_abbr,
                team_category='Collegiate',
                is_opponent_only=True
            )
            cleaned_data['opponent_team'] = opponent_team
        
        return cleaned_data 