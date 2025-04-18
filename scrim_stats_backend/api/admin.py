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
    MatchAward,
    Hero
)
from .forms import MatchAdminForm, ScrimGroupAdminForm  # Import both custom forms
from django.http import HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import path
from django.db import models
from django.contrib import messages
from django.forms import formset_factory, BaseFormSet
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils.safestring import mark_safe
from django.urls import reverse
from django.utils.html import format_html

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
    fields = ('team', 'joined_date', 'left_date', 'is_starter', 'notes')
    autocomplete_fields = ['team']

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

# Register ScrimGroup model with the custom form
@admin.register(ScrimGroup)
class ScrimGroupAdmin(admin.ModelAdmin):
    form = ScrimGroupAdminForm
    list_display = ('scrim_group_name', 'start_date')
    search_fields = ('scrim_group_name',)
    
    # Use fieldsets to visually separate sections
    fieldsets = (
        ('Basic Information', {
            'fields': ('start_date', 'scrim_group_name', 'notes')
        }),
        ('Teams', {
            'fields': ('team1', 'team2'),
            'description': 'Select or create teams for this scrim'
        }),
    )
    
    class Media:
        css = {
            'all': ('https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css',)
        }
        js = (
            'admin/jquery.init.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js',
            'admin/js/scrimgroup_admin.js',
        )

# Let's create an inline opponent team form for the match admin
class OpponentTeamInlineForm(forms.ModelForm):
    class Meta:
        model = Team
        fields = ['team_name', 'team_abbreviation', 'team_category']
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Set the is_opponent_only field to True for any team created here
        self.instance.is_opponent_only = True

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    form = MatchAdminForm  # Use our custom form
    list_display = ('match_id', 'get_blue_team_name', 'get_red_team_name', 'match_date', 'scrim_type', 'game_number', 'get_winning_team_name', 'get_mvp_ign')
    list_filter = ('scrim_type', 'match_date', 'blue_side_team', 'red_side_team', 'our_team')
    search_fields = ('blue_side_team__team_name', 'red_side_team__team_name', 'mvp__current_ign', 'scrim_group__scrim_group_name')
    ordering = ('-match_date',)
    date_hierarchy = 'match_date' # Uncommented now that data is presumed clean
    readonly_fields = ('created_at', 'updated_at', 'match_outcome', 'get_match_awards')

    # If using inline editing for PlayerMatchStat
    # inlines = [PlayerMatchStatInline] # Assuming PlayerMatchStatInline is defined

    # --- RE-ADDING Custom display methods --- 
    def get_blue_team_name(self, obj):
        return obj.blue_side_team.team_name if obj.blue_side_team else 'N/A'
    get_blue_team_name.short_description = 'Blue Side'

    def get_red_team_name(self, obj):
        return obj.red_side_team.team_name if obj.red_side_team else 'N/A'
    get_red_team_name.short_description = 'Red Side'

    def get_winning_team_name(self, obj):
        return obj.winning_team.team_name if obj.winning_team else 'N/A'
    get_winning_team_name.short_description = 'Winner'
    
    def get_mvp_ign(self, obj):
        return obj.mvp.current_ign if obj.mvp else 'N/A'
    get_mvp_ign.short_description = 'MVP'

    def get_match_awards(self, obj):
        """Display all awards for this match in a readable format"""
        if not obj.pk:
            return "Awards will be calculated when the match is saved."
            
        awards = MatchAward.objects.filter(match=obj).select_related('player')
        if not awards.exists():
            return "No awards calculated yet."
            
        html = ['<table style="width:100%"><tr><th>Award</th><th>Player</th><th>Value</th></tr>']
        
        for award in awards:
            formatted_value = f"{award.stat_value:.2f}" if award.stat_value is not None else "N/A"
            award_name = award.get_award_type_display()
            player_name = award.player.current_ign
            
            html.append(f'<tr><td>{award_name}</td><td>{player_name}</td><td>{formatted_value}</td></tr>')
            
        html.append('</table>')
        return mark_safe(''.join(html))
    get_match_awards.short_description = "Match Awards"
    # --- END RE-ADDING --- 
    
    def get_fieldsets(self, request, obj=None):
        """Add the awards section only when editing an existing match"""
        fieldsets = [
            ('Match Details', {
                'fields': ('scrim_group', 'match_date', 'formatted_duration', 'game_number')
            }),
            ('Teams', {
                'fields': ('our_team', 'blue_side_team', 'red_side_team')
            }),
            ('Results', {
                'fields': ('match_outcome', 'scrim_type', 'mvp', 'mvp_loss', 'general_notes')
            })
        ]
        
        # Add awards section for existing matches
        if obj and obj.pk:
            fieldsets.append(
                ('Match Awards', {
                    'fields': (),
                    'classes': ('collapse',),
                    'description': 'Awards calculated based on player statistics'
                })
            )
            
        fieldsets.append(
            ('Metadata', {
                'fields': ('created_at', 'updated_at'),
                'classes': ('collapse',)
            })
        )
        
        return fieldsets
    
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
        Save the match with special handling for duration
        """
        if not change:  # Only set the user when creating a new object
            obj.submitted_by = request.user
        
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
        
        # Handle MVP and MVP Loss fields from the form
        obj.mvp = form.cleaned_data.get('mvp')
        obj.mvp_loss = form.cleaned_data.get('mvp_loss')
        
        # Save the object
        obj.save()
        
        # Assign awards if there are player stats
        if obj.player_stats.exists():
            MatchAward.assign_awards_for_match(obj)
    
    class Media:
        css = {
            'all': ('https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css',)
        }
        js = (
            'admin/jquery.init.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js',
            'admin/js/match_admin.js',
        )

# Add this class for the individual player stat form
class PlayerStatForm(forms.Form):
    player = forms.ModelChoiceField(
        queryset=Player.objects.all(),
        required=False
    )
    hero_played = forms.ModelChoiceField(
        queryset=Hero.objects.all(),
        required=False,
        label="Hero",
        help_text="Select the hero played in this match"
    )
    # Use Player model ROLE_CHOICES, filtering out non-player roles
    role_played = forms.ChoiceField(
        choices=[('', '---------')] + [(role[0], role[1]) for role in Player.ROLE_CHOICES 
                                     if role[0] not in ['FLEX', 'COACH', 'ANALYST']],
        required=False,
        label="Role Played"
    )
    kills = forms.IntegerField(
        min_value=0,
        required=False,
        initial=0
    )
    deaths = forms.IntegerField(
        min_value=0,
        required=False,
        initial=0
    )
    assists = forms.IntegerField(
        min_value=0,
        required=False,
        initial=0
    )
    computed_kda = forms.FloatField(
        min_value=0,
        required=False,
        initial=0,
        help_text="Enter the KDA value from the game"
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
        Validate:
        1. Each player is only entered once
        2. Only one player per team plays each role
        3. Only one player across both teams plays each hero
        """
        if any(self.errors):
            return
        
        players = []
        # Track role assignments by team
        our_team_roles = {}
        opponent_team_roles = {}
        # Track hero assignments across both teams
        heroes_played = {}
        
        for form in self.forms:
            # Skip empty forms
            if not form.cleaned_data or not form.cleaned_data.get('player'):
                continue
                
            player = form.cleaned_data.get('player')
            role = form.cleaned_data.get('role_played')
            hero = form.cleaned_data.get('hero_played')
            is_our_team = form.cleaned_data.get('is_our_team', False)
            
            # Check for duplicate players
            if player in players:
                raise forms.ValidationError(f"Player {player} is listed multiple times.")
            players.append(player)
            
            # Check for duplicate roles within the same team
            if role and role != '':
                if is_our_team:
                    if role in our_team_roles:
                        raise forms.ValidationError(
                            f"Role '{role}' is already assigned to {our_team_roles[role]} on your team."
                        )
                    our_team_roles[role] = player
                else:
                    if role in opponent_team_roles:
                        raise forms.ValidationError(
                            f"Role '{role}' is already assigned to {opponent_team_roles[role]} on the opponent team."
                        )
                    opponent_team_roles[role] = player
            
            # Check for duplicate heroes across both teams
            if hero and hero != '':
                if hero in heroes_played:
                    raise forms.ValidationError(
                        f"Hero '{hero}' is already being played by {heroes_played[hero]}."
                    )
                heroes_played[hero] = player

    def is_empty_form(self, form):
        """
        Check if a form is completely empty
        """
        if not form.cleaned_data:
            return True
        
        # Consider the form empty if no player is selected
        if not form.cleaned_data.get('player'):
            return True
        
        return False

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
        
        # Check for existing stats to prepopulate
        existing_stats = PlayerMatchStat.objects.filter(match=match)
        
        # Create a formset with appropriate number of extra forms
        # We always use 10 forms but make them optional
        PlayerStatFormSet = formset_factory(
            PlayerStatForm, 
            formset=BasePlayerStatFormSet,
            extra=10,
            max_num=10,  # Set max_num to limit the number of forms
            validate_max=True,  # Validate the max_num
            min_num=0,  # No minimum required
            validate_min=False  # Don't validate min
        )
        
        # Get our team and opponent team players
        our_team_players = Player.objects.filter(
            team_history__team=match.our_team,
            team_history__left_date=None
        ).order_by('current_ign')
        
        # Determine the opponent team based on the new structure
        opponent_team_instance = None
        if match.our_team:
            if match.blue_side_team == match.our_team:
                opponent_team_instance = match.red_side_team
            elif match.red_side_team == match.our_team:
                opponent_team_instance = match.blue_side_team
        # If opponent_team_instance is still None here, it means our_team wasn't set,
        # or our_team wasn't blue or red (data inconsistency?). 
        # Handle this case as needed (e.g., raise error, default, or query differently).
        # For now, we'll proceed assuming opponent_team_instance is found if our_team is set.
        
        opponent_team_players = Player.objects.none() # Default to empty queryset
        if opponent_team_instance:
            opponent_team_players = Player.objects.filter(
                team_history__team=opponent_team_instance,
                team_history__left_date=None
            ).order_by('current_ign')
        
        # Create MVP selection form
        class MVPSelectionForm(forms.Form):
            mvp = forms.ModelChoiceField(
                queryset=Player.objects.all(),
                required=False,
                label="MVP of the Match",
                help_text="Select the MVP of the match (from the winning team)"
            )
            
            mvp_loss = forms.ModelChoiceField(
                queryset=Player.objects.all(),
                required=False,
                label="MVP from Losing Team",
                help_text="Select the MVP from the losing team (optional)"
            )
            
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                # Set initial values if match already has MVPs
                if match.mvp:
                    self.fields['mvp'].initial = match.mvp
                if match.mvp_loss:
                    self.fields['mvp_loss'].initial = match.mvp_loss
        
        mvp_form = MVPSelectionForm()
        
        if request.method == 'POST':
            formset = PlayerStatFormSet(request.POST)
            mvp_form = MVPSelectionForm(request.POST)
            
            if formset.is_valid() and mvp_form.is_valid():
                try:
                    with transaction.atomic():
                        # Delete existing stats if any
                        existing_stats.delete()
                        
                        # Save all the new stats
                        stats_saved = 0
                        for form in formset:
                            # Skip empty forms
                            if formset.is_empty_form(form):
                                continue
                            
                            if form.cleaned_data and form.cleaned_data.get('player'):
                                # Determine which team to assign based on is_our_team flag
                                is_our_team = form.cleaned_data.get('is_our_team', False)
                                
                                # Get the opponent team instance using the same logic as above
                                # We need the opponent_team_instance derived earlier
                                # Ensure opponent_team_instance is available in this scope or recalculate
                                calculated_opponent_team = None
                                if match.our_team:
                                    if match.blue_side_team == match.our_team:
                                        calculated_opponent_team = match.red_side_team
                                    elif match.red_side_team == match.our_team:
                                        calculated_opponent_team = match.blue_side_team
                                
                                # Assign team based on the flag and calculated opponent
                                team = match.our_team if is_our_team else calculated_opponent_team
                                
                                # Add a check to ensure team is not None before proceeding
                                if team is None:
                                    # Raise an error or handle appropriately if team cannot be determined
                                    messages.error(request, f"Could not determine team for player {form.cleaned_data.get('player')} - Match context might be inconsistent.")
                                    continue # Skip this stat
                                
                                # Set default values for missing fields, but don't include is_our_team
                                # since it's not a field in the PlayerMatchStat model
                                kills = form.cleaned_data.get('kills', 0)
                                deaths = form.cleaned_data.get('deaths', 0)
                                assists = form.cleaned_data.get('assists', 0)
                                
                                # Use the user-provided computed_kda value instead of calculating it
                                # If not provided, default to 0
                                computed_kda = form.cleaned_data.get('computed_kda', 0)
                                
                                # We need to ensure hero_played is a Hero instance
                                # form.cleaned_data['hero_played'] will already be a Hero instance 
                                # from the ModelChoiceField
                                stats_data = {
                                    'match': match,
                                    'player': form.cleaned_data['player'],
                                    'team': team,  # Set the team correctly
                                    'hero_played': form.cleaned_data.get('hero_played'),  # This is now a Hero instance
                                    'role_played': form.cleaned_data.get('role_played', ''),
                                    'kills': kills,
                                    'deaths': deaths,
                                    'assists': assists,
                                    'computed_kda': computed_kda,  # Use the provided computed_kda
                                    'damage_dealt': form.cleaned_data.get('damage_dealt', 0),
                                    'turret_damage': form.cleaned_data.get('turret_damage', 0),
                                    'damage_taken': form.cleaned_data.get('damage_taken', 0),
                                    'gold_earned': form.cleaned_data.get('gold_earned', 0)
                                    # is_our_team is just used for determining the team, not stored in the model
                                }
                                
                                # Create the player match stat
                                PlayerMatchStat.objects.create(**stats_data)
                                stats_saved += 1
                        
                        # Update MVPs from the form
                        match.mvp = mvp_form.cleaned_data.get('mvp')
                        match.mvp_loss = mvp_form.cleaned_data.get('mvp_loss')
                        match.save()
                        
                        # Update match stats if any stats were saved
                        if stats_saved > 0:
                            # Ensure calculate_score_details and assign_awards_for_match exist and are correct
                            # match.calculate_score_details(save=True)
                            # MatchAward.assign_awards_for_match(match)
                            pass # Placeholder if methods are not ready/verified
                        
                        # Customize message based on number of stats saved
                        if stats_saved == 0:
                            messages.info(request, f"No player stats were submitted for {match}")
                        else:
                            messages.success(request, f"Successfully saved {stats_saved} player stats for {match}")
                        
                    return HttpResponseRedirect("../../")
                except Exception as e:
                    messages.error(request, f"Error saving player stats: {str(e)}")
            else:
                # Display formset errors to help debugging
                for i, form in enumerate(formset):
                    for field, errors in form.errors.items():
                        messages.error(request, f"Form {i+1} - {field}: {', '.join(errors)}")
                if formset.non_form_errors():
                    for error in formset.non_form_errors():
                        messages.error(request, f"Formset Error: {error}")
                # Display MVP form errors
                for field, errors in mvp_form.errors.items():
                    messages.error(request, f"MVP Selection - {field}: {', '.join(errors)}")
        else:
            # Initialize the forms based on existing stats or create new empty forms
            initial_data = []
            
            if existing_stats.exists():
                # Initialize with existing stats
                for stat in existing_stats:
                    initial_data.append({
                        'player': stat.player,
                        'hero_played': stat.hero_played,  # This will now be a Hero instance
                        'role_played': stat.role_played,
                        'kills': stat.kills,
                        'deaths': stat.deaths,
                        'assists': stat.assists,
                        'computed_kda': stat.computed_kda,  # Include the computed_kda from the database
                        'damage_dealt': stat.damage_dealt,
                        'turret_damage': stat.turret_damage,
                        'damage_taken': stat.damage_taken,
                        'gold_earned': stat.gold_earned,
                        'is_our_team': stat.is_for_our_team()
                    })
                
                # Add empty forms to reach exactly 10 total forms
                while len(initial_data) < 10:
                    # Add empty forms with the is_our_team field set correctly
                    if len(initial_data) < 5:
                        initial_data.append({'is_our_team': True})
                    else:
                        initial_data.append({'is_our_team': False})
            else:
                # Initialize 5 forms for our team
                for i in range(5):
                    initial_data.append({'is_our_team': True})
                
                # Initialize 5 forms for opponent team
                for i in range(5):
                    initial_data.append({'is_our_team': False})
            
            formset = PlayerStatFormSet(initial=initial_data)
        
        # Get heroes for autocomplete
        heroes = Hero.objects.all().order_by('name')
        
        context = {
            'title': f'Add Player Stats for {match}',
            'opts': self.model._meta,
            'match': match,
            'formset': formset,
            'mvp_form': mvp_form,
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
    list_display = ('player', 'team', 'joined_date', 'left_date', 'is_starter')
    list_filter = ('team', 'is_starter')
    search_fields = ('player__current_ign',)
    autocomplete_fields = ['player', 'team']
    list_editable = ('is_starter', 'left_date')

# Register TeamManagerRole model
@admin.register(TeamManagerRole)
class TeamManagerRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'team')
    list_filter = ('team',)
    search_fields = ('user__username',)

# Register Hero model with admin
@admin.register(Hero)
class HeroAdmin(admin.ModelAdmin):
    list_display = ('name', 'role', 'released_date')
    search_fields = ('name', 'role')
    list_filter = ('role',)
    ordering = ('name',)

# Register MatchAward model
@admin.register(MatchAward)
class MatchAwardAdmin(admin.ModelAdmin):
    list_display = ('match', 'player', 'award_type', 'stat_value')
    list_filter = ('award_type',)
    search_fields = ('player__current_ign', 'match__scrim_group__scrim_group_name')
    readonly_fields = ('match', 'player', 'award_type', 'stat_value')
