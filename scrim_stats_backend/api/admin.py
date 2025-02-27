from django.contrib import admin
from django import forms
from django.utils import timezone
from django.utils.formats import date_format
from .models import (
    Team, 
    Player, 
    PlayerAlias, 
    ScrimGroup, 
    Match, 
    PlayerMatchStat, 
    FileUpload, 
    PlayerTeamHistory,
    TeamManagerRole,
    HeroPairingStats,
    PlayerRoleStats,
    Hero
)
from django.http import HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import path
from django.db import models
from django.contrib import messages
from django.forms import formset_factory, BaseFormSet
from django.db import transaction
from django.http import HttpResponseRedirect

# Register Team model
@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('team_name', 'team_abbreviation', 'team_category', 'is_opponent_only')
    search_fields = ('team_name', 'team_abbreviation')
    list_filter = ('team_category', 'is_opponent_only')
    
    fieldsets = (
        (None, {
            'fields': ('team_name', 'team_abbreviation', 'team_category', 'is_opponent_only')
        }),
        ('Management', {
            'fields': ('managers',),
            'classes': ('collapse',),
            'description': 'Only needed for teams you manage (not opponents)'
        }),
    )

# Define inline for PlayerTeamHistory
class PlayerTeamHistoryInline(admin.TabularInline):
    model = PlayerTeamHistory
    extra = 1
    fields = ('team', 'joined_date', 'left_date')

# Custom Player form with current team field
class PlayerAdminForm(forms.ModelForm):
    current_team = forms.ModelChoiceField(
        queryset=Team.objects.all(),
        required=False,
        label="Current Team",
        help_text="Select the player's current team"
    )
    
    class Meta:
        model = Player
        fields = '__all__'
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Set initial value if instance exists
        if self.instance and self.instance.pk:
            current_history = PlayerTeamHistory.objects.filter(
                player=self.instance, 
                left_date=None
            ).first()
            if current_history:
                self.fields['current_team'].initial = current_history.team

# Register Player model with proper team handling
@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    form = PlayerAdminForm
    list_display = ('current_ign', 'primary_role', 'get_current_team')
    search_fields = ('current_ign',)
    list_filter = ('primary_role', 'team_history__team')
    inlines = [PlayerTeamHistoryInline]
    
    def get_current_team(self, obj):
        """Return the player's current team (if any)"""
        current_membership = PlayerTeamHistory.objects.filter(
            player=obj, 
            left_date=None
        ).first()
        return current_membership.team.team_name if current_membership else "No Current Team"
    get_current_team.short_description = 'Current Team'
    
    def save_related(self, request, form, formsets, change):
        """
        Override save_related to handle the current_team field.
        This method is called after the player is saved but before m2m relationships are saved.
        """
        super().save_related(request, form, formsets, change)
        
        # Get the player instance and selected team
        player = form.instance
        current_team = form.cleaned_data.get('current_team')
        
        if current_team:
            # Check if player already has an active membership with this team
            existing = PlayerTeamHistory.objects.filter(
                player=player,
                team=current_team,
                left_date=None
            ).exists()
            
            if not existing:
                # Close any existing open team memberships
                PlayerTeamHistory.objects.filter(
                    player=player,
                    left_date=None
                ).update(left_date=timezone.now().date())
                
                # Create a new membership
                PlayerTeamHistory.objects.create(
                    player=player,
                    team=current_team,
                    joined_date=timezone.now().date()
                )

# Register PlayerAlias model
@admin.register(PlayerAlias)
class PlayerAliasAdmin(admin.ModelAdmin):
    list_display = ('player', 'alias')
    search_fields = ('alias', 'player__current_ign')

# Modify the ScrimGroupAdminForm
class ScrimGroupAdminForm(forms.ModelForm):
    team1 = forms.ModelChoiceField(
        queryset=Team.objects.all(),
        required=False,
        label="Home Team",
        help_text="Your team"
    )
    
    team2 = forms.ModelChoiceField(
        queryset=Team.objects.all(),
        required=False,
        label="Opponent Team",
        help_text="The team you're playing against"
    )
    
    # Add the create new opponent option
    create_new_opponent = forms.BooleanField(
        required=False,
        initial=False,
        label="Create new opponent team",
        help_text="Check this to create a new opponent team"
    )
    
    # Fields for the new opponent team
    new_opponent_name = forms.CharField(
        required=False, 
        max_length=100,
        label="New opponent name"
    )
    new_opponent_abbreviation = forms.CharField(
        required=False, 
        max_length=10,
        label="New opponent abbreviation"
    )
    new_opponent_category = forms.ChoiceField(
        required=False,
        choices=[
            ('Collegiate', 'Collegiate'),
            ('Amateur', 'Amateur'),
            ('Professional', 'Professional')
        ],
        label="Team category"
    )
    
    # Make name field optional - we'll auto-generate it
    scrim_group_name = forms.CharField(
        max_length=200,
        required=False, 
        label="Scrim Group Name (Optional)",
        help_text="Leave blank to auto-generate from date and teams"
    )
    
    class Meta:
        model = ScrimGroup
        fields = ['scrim_group_name', 'start_date', 'notes']
        
    def clean(self):
        cleaned_data = super().clean()
        
        # Validate new opponent fields if creating a new team
        create_new = cleaned_data.get('create_new_opponent')
        if create_new:
            name = cleaned_data.get('new_opponent_name')
            abbr = cleaned_data.get('new_opponent_abbreviation')
            
            if not name:
                self.add_error('new_opponent_name', 'Required when creating a new team')
            if not abbr:
                self.add_error('new_opponent_abbreviation', 'Required when creating a new team')
        
        # Always generate a name based on teams and date, unless manually overridden
        team1 = cleaned_data.get('team1')
        team2 = cleaned_data.get('team2')
        start_date = cleaned_data.get('start_date')
        
        # We'll handle team2 creation in the admin's save_related method
        # Here we just validate basic fields
        
        if not cleaned_data.get('scrim_group_name') and team1 and team2 and start_date:
            date_str = date_format(start_date, format="m/d/y")
            suggested_name = f"{date_str} {team1.team_abbreviation} VS {team2.team_abbreviation}"
            cleaned_data['scrim_group_name'] = suggested_name
            
        return cleaned_data

# Register ScrimGroup model with the custom form
@admin.register(ScrimGroup)
class ScrimGroupAdmin(admin.ModelAdmin):
    form = ScrimGroupAdminForm
    list_display = ('scrim_group_name', 'start_date')
    search_fields = ('scrim_group_name',)
    
    # Use fieldsets to visually separate sections
    fieldsets = (
        ('Scrim Details', {
            'fields': ('start_date', 'team1'),
            'description': 'Select the date and your team for this scrim'
        }),
        ('Opponent Team', {
            'fields': ('team2', 'create_new_opponent'),
            'description': 'Select an existing opponent or create a new one'
        }),
        ('New Opponent Details', {
            'fields': ('new_opponent_name', 'new_opponent_abbreviation', 'new_opponent_category'),
            'classes': ('collapse',),
            'description': 'Fill these fields if creating a new opponent team'
        }),
        ('Additional Information', {
            'fields': ('scrim_group_name', 'notes'),
            'description': 'The name will be auto-generated, but you can override it if needed'
        }),
    )
    
    def save_form(self, request, form, change):
        """Handle new opponent team creation"""
        # Save the form as usual
        instance = super().save_form(request, form, change)
        
        # If creating a new opponent team
        if form.cleaned_data.get('create_new_opponent'):
            # Create the new team
            new_team = Team.objects.create(
                team_name=form.cleaned_data['new_opponent_name'],
                team_abbreviation=form.cleaned_data['new_opponent_abbreviation'],
                team_category=form.cleaned_data['new_opponent_category'],
                is_opponent_only=True
            )
            
            # We'll use this team when building the scrim name
            form.cleaned_data['team2'] = new_team
            
            # Regenerate the scrim name if needed
            if not instance.scrim_group_name and form.cleaned_data.get('team1') and form.cleaned_data.get('start_date'):
                team1 = form.cleaned_data['team1']
                start_date = form.cleaned_data['start_date']
                date_str = date_format(start_date, format="m/d/y")
                instance.scrim_group_name = f"{date_str} {team1.team_abbreviation} VS {new_team.team_abbreviation}"
        
        return instance
    
    class Media:
        js = ('admin/js/scrimgroup_admin.js',)

# Let's create an inline opponent team form for the match admin
class OpponentTeamInlineForm(forms.ModelForm):
    class Meta:
        model = Team
        fields = ['team_name', 'team_abbreviation', 'team_category']
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Set the is_opponent_only field to True for any team created here
        self.instance.is_opponent_only = True

# Enhanced Match form with support for external matches
class MatchAdminForm(forms.ModelForm):
    # Add a date-only field
    match_date = forms.DateField(
        required=True,
        widget=admin.widgets.AdminDateWidget(),
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
    
    # Fields for team 1 (if external match)
    create_new_team1 = forms.BooleanField(
        required=False,
        initial=False,
        label="Create new team 1",
        help_text="Check this to create a new team"
    )
    
    new_team1_name = forms.CharField(
        required=False, 
        max_length=100,
        label="New team name"
    )
    
    new_team1_abbreviation = forms.CharField(
        required=False, 
        max_length=10,
        label="New team abbreviation"
    )
    
    new_team1_category = forms.ChoiceField(
        required=False,
        choices=[
            ('Collegiate', 'Collegiate'),
            ('Amateur', 'Amateur'),
            ('Professional', 'Professional')
        ],
        label="Team category"
    )
    
    # Keep existing opponent team fields
    create_new_opponent = forms.BooleanField(
        required=False,
        initial=False,
        label="Create new opponent team",
        help_text="Check this to create a new opponent team"
    )
    
    # Other existing fields...
    
    class Meta:
        model = Match
        fields = '__all__'
        
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
        
        # Auto-populate from scrim_group
        # ...
        
        # Check if it's an external match
        is_external = cleaned_data.get('is_external_match')
        
        if is_external:
            # If external match, validate team1 setup
            if cleaned_data.get('create_new_team1'):
                if not cleaned_data.get('new_team1_name'):
                    self.add_error('new_team1_name', 'Required when creating a new team')
                if not cleaned_data.get('new_team1_abbreviation'):
                    self.add_error('new_team1_abbreviation', 'Required when creating a new team')
            elif not cleaned_data.get('our_team'):
                self.add_error('our_team', 'You must select Team 1 or create a new one')
        
        # Rest of validation...
        
        return cleaned_data

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    form = MatchAdminForm
    list_display = ('match_date', 'get_team1', 'get_team2', 'match_outcome', 'scrim_type', 'get_duration', 'is_external_match')
    search_fields = ('our_team__team_name', 'opponent_team__team_name')
    list_filter = ('match_outcome', 'scrim_type', 'our_team', 'match_date', 'is_external_match')
    date_hierarchy = 'match_date'
    
    def get_fields(self, request, obj=None):
        """
        Dynamically determine which fields to include based on whether
        we're adding a new match or editing an existing one
        """
        # Base fields that are always included
        base_fields = [
            'scrim_group', 'match_date', 'is_external_match', 'our_team', 'opponent_team',
            'scrim_type', 'match_outcome', 'team_side', 'general_notes', 'formatted_duration',
        ]
        
        # Only include custom team creation fields when adding, not editing
        if obj is None:  # Adding a new match
            team_creation_fields = [
                'create_new_team1', 'new_team1_name', 'new_team1_abbreviation', 'new_team1_category',
                'create_new_opponent', 'new_opponent_name', 'new_opponent_abbreviation', 'new_opponent_category'
            ]
            return base_fields + team_creation_fields
        
        # For editing, just return the base fields
        return base_fields
    
    def get_fieldsets(self, request, obj=None):
        """Dynamically adjust fieldsets based on whether it's an external match"""
        common_fieldsets = [
            ('Match Details', {
                'fields': ('scrim_group', 'match_date', 'is_external_match')
            }),
            ('Match Outcome', {
                'fields': ('scrim_type', 'match_outcome', 'team_side', 'general_notes')
            }),
            ('Duration', {
                'fields': ('formatted_duration',),
                'description': 'Enter the total duration of this match in format HH:MM:SS'
            }),
        ]
        
        # Add team-specific fieldsets
        if obj is None:  # Adding a new match
            if request.GET.get('is_external_match') == 'true':
                team_fieldsets = [
                    ('Team 1', {
                        'fields': ('our_team', 'create_new_team1', 'new_team1_name', 'new_team1_abbreviation', 'new_team1_category')
                    }),
                    ('Team 2', {
                        'fields': ('opponent_team', 'create_new_opponent', 'new_opponent_name', 'new_opponent_abbreviation', 'new_opponent_category')
                    }),
                ]
            else:
                team_fieldsets = [
                    ('Teams', {
                        'fields': ('our_team', 'opponent_team'),
                        'description': 'Select your team and opponent team'
                    }),
                    ('Create New Opponent', {
                        'classes': ('collapse',),
                        'fields': ('create_new_opponent', 'new_opponent_name', 'new_opponent_abbreviation', 'new_opponent_category')
                    }),
                ]
        else:  # Editing an existing match - simpler fieldsets
            team_fieldsets = [
                ('Teams', {
                    'fields': ('our_team', 'opponent_team'),
                    'description': 'Match teams'
                }),
            ]
        
        # Combine and return the fieldsets
        return common_fieldsets[:1] + team_fieldsets + common_fieldsets[1:]
    
    def get_team1(self, obj):
        """Get team 1 with indication if it's our team"""
        return f"{obj.our_team.team_name}" + (" (Our Team)" if not getattr(obj, 'is_external_match', False) else "")
    get_team1.short_description = "Team 1"
    
    def get_team2(self, obj):
        """Get team 2"""
        return obj.opponent_team.team_name
    get_team2.short_description = "Team 2"
    
    def get_duration(self, obj):
        """Format duration as HH:MM:SS"""
        if not obj.match_duration:
            return "-"
        total_seconds = obj.match_duration.total_seconds()
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"
    get_duration.short_description = "Duration"
    
    def save_model(self, request, obj, form, change):
        """
        Save the match with special handling for team creation and duration
        """
        if not change:  # Only set the user when creating a new object
            obj.submitted_by = request.user
        
        # Handle team1 creation if needed
        if form.cleaned_data.get('is_external_match') and form.cleaned_data.get('create_new_team1'):
            team1 = Team.objects.create(
                team_name=form.cleaned_data['new_team1_name'],
                team_abbreviation=form.cleaned_data['new_team1_abbreviation'],
                team_category=form.cleaned_data['new_team1_category'],
                is_opponent_only=True
            )
            obj.our_team = team1
        
        # Handle opponent team creation if needed
        if form.cleaned_data.get('create_new_opponent'):
            team2 = Team.objects.create(
                team_name=form.cleaned_data['new_opponent_name'],
                team_abbreviation=form.cleaned_data['new_opponent_abbreviation'],
                team_category=form.cleaned_data['new_opponent_category'],
                is_opponent_only=True
            )
            obj.opponent_team = team2
        
        # Handle the formatted duration
        formatted_duration = form.cleaned_data.get('formatted_duration')
        if formatted_duration:
            import re
            import datetime
            
            # Parse the formatted duration
            duration_pattern = re.compile(r'^(\d{2}):(\d{2}):(\d{2})$')
            match = duration_pattern.match(formatted_duration)
            
            if match:
                hours, minutes, seconds = map(int, match.groups())
                obj.match_duration = datetime.timedelta(
                    hours=hours,
                    minutes=minutes,
                    seconds=seconds
                )
        
        # Save the object
        obj.save()
    
    class Media:
        js = ('admin/js/match_admin.js',)

# Add this class for the individual player stat form
class PlayerStatForm(forms.Form):
    player = forms.ModelChoiceField(
        queryset=Player.objects.all(),
        required=True
    )
    hero_played = forms.CharField(
        max_length=100,
        required=True
    )
    hero = forms.ModelChoiceField(
        queryset=Hero.objects.all(),
        required=False,
        label="Select Hero (Optional)",
        help_text="Choose from existing heroes or type a name above"
    )
    kills = forms.IntegerField(
        min_value=0,
        required=True,
        initial=0
    )
    deaths = forms.IntegerField(
        min_value=0,
        required=True,
        initial=0
    )
    assists = forms.IntegerField(
        min_value=0,
        required=True,
        initial=0
    )
    damage_dealt = forms.IntegerField(
        required=False,
        min_value=0,
        initial=0
    )
    turret_damage = forms.IntegerField(
        required=False,
        min_value=0, 
        initial=0,
        label="Turret Damage"
    )
    damage_taken = forms.IntegerField(
        required=False,
        min_value=0,
        initial=0,
        label="Damage Taken"
    )
    gold_earned = forms.IntegerField(
        required=False,
        min_value=0,
        initial=0
    )
    is_our_team = forms.BooleanField(
        required=False,
        widget=forms.HiddenInput()
    )

# Base formset for validation
class BasePlayerStatFormSet(BaseFormSet):
    def clean(self):
        """
        Validate that at least one player has been entered
        and each player is only entered once
        """
        if any(self.errors):
            return
        
        players = []
        for form in self.forms:
            if form.cleaned_data:
                player = form.cleaned_data.get('player')
                if player in players:
                    raise forms.ValidationError(f"Player {player} is listed multiple times.")
                players.append(player)
                
        if len(players) == 0:
            raise forms.ValidationError("At least one player must be entered.")

# Modify the PlayerMatchStat admin to add the bulk add view
@admin.register(PlayerMatchStat)
class PlayerMatchStatAdmin(admin.ModelAdmin):
    list_display = ('match', 'player', 'hero_played', 'kills', 'deaths', 'assists')
    search_fields = ('player__current_ign', 'hero_played')
    list_filter = ('match__match_outcome',)
    
    # Update this line to use the correct template path
    change_list_template = 'admin/api/playermatchstat/change_list.html'
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('bulk-add/', self.admin_site.admin_view(self.bulk_add_view), name='api_playermatchstat_bulk_add'),
            path('bulk-add/<int:match_id>/', self.admin_site.admin_view(self.bulk_add_stats_view), name='api_playermatchstat_bulk_add_stats'),
        ]
        return custom_urls + urls
    
    def bulk_add_view(self, request):
        """First screen to select the match"""
        # Get matches ordered by recent first
        matches = Match.objects.all().order_by('-match_date')
        
        # Create a form to select a match
        class MatchSelectForm(forms.Form):
            match = forms.ModelChoiceField(
                queryset=matches,
                required=True,
                label="Select Match"
            )
        
        if request.method == 'POST':
            form = MatchSelectForm(request.POST)
            if form.is_valid():
                match_id = form.cleaned_data['match'].match_id
                return HttpResponseRedirect(f'../bulk-add/{match_id}/')
        else:
            form = MatchSelectForm()
        
        context = {
            'title': 'Select Match for Bulk Stats Entry',
            'opts': self.model._meta,
            'form': form,
        }
        return render(request, 'admin/api/playermatchstat/select_match.html', context)
    
    def bulk_add_stats_view(self, request, match_id):
        """Second screen to add all player stats for the selected match"""
        match = get_object_or_404(Match, match_id=match_id)
        
        # Create a formset with 10 forms - 5 for each team
        PlayerStatFormSet = formset_factory(
            PlayerStatForm, 
            formset=BasePlayerStatFormSet,
            extra=10
        )
        
        # Get our team and opponent team players
        our_team_players = Player.objects.filter(
            team_history__team=match.our_team,
            team_history__left_date=None
        ).order_by('current_ign')
        
        opponent_team_players = Player.objects.filter(
            team_history__team=match.opponent_team,
            team_history__left_date=None
        ).order_by('current_ign')
        
        # Check for existing stats to prepopulate
        existing_stats = PlayerMatchStat.objects.filter(match=match)
        
        if request.method == 'POST':
            formset = PlayerStatFormSet(request.POST)
            if formset.is_valid():
                try:
                    with transaction.atomic():
                        # Delete existing stats if any
                        existing_stats.delete()
                        
                        # Save all the new stats
                        for form in formset:
                            if form.cleaned_data:
                                # Only save forms that have data
                                PlayerMatchStat.objects.create(
                                    match=match,
                                    player=form.cleaned_data['player'],
                                    hero_played=form.cleaned_data['hero_played'],
                                    hero=form.cleaned_data.get('hero'),
                                    role_played=form.cleaned_data.get('role_played'),
                                    kills=form.cleaned_data['kills'],
                                    deaths=form.cleaned_data['deaths'],
                                    assists=form.cleaned_data['assists'],
                                    damage_dealt=form.cleaned_data.get('damage_dealt'),
                                    turret_damage=form.cleaned_data.get('turret_damage'),
                                    damage_taken=form.cleaned_data.get('damage_taken'),
                                    gold_earned=form.cleaned_data.get('gold_earned'),
                                    is_our_team=form.cleaned_data['is_our_team']
                                )
                        
                        # Update match stats
                        match.calculate_score_details(save=True)
                        
                    messages.success(request, f"Successfully saved stats for {match}")
                    return HttpResponseRedirect("../../")
                except Exception as e:
                    messages.error(request, f"Error saving player stats: {str(e)}")
        else:
            # Initialize the forms - first 5 for our team, second 5 for opponent
            initial_data = []
            
            # Add forms for existing stats if any
            if existing_stats.exists():
                for stat in existing_stats:
                    initial_data.append({
                        'player': stat.player,
                        'hero_played': stat.hero_played,
                        'role_played': stat.role_played,
                        'kills': stat.kills,
                        'deaths': stat.deaths,
                        'assists': stat.assists,
                        'damage_dealt': stat.damage_dealt,
                        'turret_damage': stat.turret_damage,
                        'damage_taken': stat.damage_taken,
                        'gold_earned': stat.gold_earned,
                        'is_our_team': stat.is_our_team,
                    })
            else:
                # Initialize 5 forms for our team
                for i in range(5):
                    initial_data.append({
                        'player': None,
                        'is_our_team': True
                    })
                
                # Initialize 5 forms for opponent team
                for i in range(5):
                    initial_data.append({
                        'player': None,
                        'is_our_team': False
                    })
            
            formset = PlayerStatFormSet(initial=initial_data)
        
        # Get heroes for autocomplete
        heroes = Hero.objects.all().order_by('name')
        
        context = {
            'title': f'Add Player Stats for {match}',
            'opts': self.model._meta,
            'match': match,
            'formset': formset,
            'our_team_players': our_team_players,
            'opponent_team_players': opponent_team_players,
            'heroes': heroes,  # Add heroes to context
        }
        return render(request, 'admin/api/playermatchstat/bulk_add.html', context)

# Register FileUpload model
@admin.register(FileUpload)
class FileUploadAdmin(admin.ModelAdmin):
    list_display = ('match', 'file_type', 'uploaded_at')
    list_filter = ('file_type',)

# Register PlayerTeamHistory model
@admin.register(PlayerTeamHistory)
class PlayerTeamHistoryAdmin(admin.ModelAdmin):
    list_display = ('player', 'team', 'joined_date', 'left_date')
    list_filter = ('team',)
    search_fields = ('player__current_ign',)

# Register TeamManagerRole model
@admin.register(TeamManagerRole)
class TeamManagerRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'team')
    list_filter = ('team',)
    search_fields = ('user__username',)

# Register HeroPairingStats model
@admin.register(HeroPairingStats)
class HeroPairingStatsAdmin(admin.ModelAdmin):
    list_display = ('hero1', 'hero2', 'team', 'matches_played', 'matches_won')
    list_filter = ('team',)
    search_fields = ('hero1', 'hero2')

# Register PlayerRoleStats model
@admin.register(PlayerRoleStats)
class PlayerRoleStatsAdmin(admin.ModelAdmin):
    list_display = ('player', 'role', 'matches_played')
    list_filter = ('role',)
    search_fields = ('player__current_ign',)

# Register Hero model with admin
@admin.register(Hero)
class HeroAdmin(admin.ModelAdmin):
    list_display = ('name', 'role', 'released_date')
    search_fields = ('name', 'role')
    list_filter = ('role',)
    ordering = ('name',)
