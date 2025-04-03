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
    Hero,
    DraftInfo
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
from django.contrib.auth.models import User
from django.contrib.admin.widgets import FilteredSelectMultiple, AutocompleteSelect
from .widgets import HeroSelectWidget
import logging
from django.db import connections

# Get logger for this file
logger = logging.getLogger('api')

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
    list_display = ('__str__', 'match_date', 'get_team1', 'get_team2', 'match_outcome', 'scrim_type', 'get_duration', 'is_external_match', 'mvp_display', 'mvp_loss_display')
    search_fields = ('our_team__team_name', 'opponent_team__team_name', 'scrim_group__scrim_group_name')
    list_filter = ('match_outcome', 'scrim_type', 'our_team', 'match_date', 'is_external_match', 'team_side')
    date_hierarchy = 'match_date'
    readonly_fields = ('created_at', 'updated_at', 'get_match_awards')
    
    def mvp_display(self, obj):
        mvp = obj.get_mvp()
        if mvp:
            kda = PlayerMatchStat.objects.filter(
                match=obj,
                player=mvp
            ).first().computed_kda
            return f"{mvp.current_ign} (KDA: {kda})"
        return "-"
    mvp_display.short_description = "MVP"
    
    def mvp_loss_display(self, obj):
        mvp_loss = obj.get_mvp_loss()
        if mvp_loss:
            kda = PlayerMatchStat.objects.filter(
                match=obj,
                player=mvp_loss
            ).first().computed_kda
            return f"{mvp_loss.current_ign} (KDA: {kda})"
        return "-"
    mvp_loss_display.short_description = "MVP Loss"
    
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
    
    def get_fieldsets(self, request, obj=None):
        """Add the awards section only when editing an existing match"""
        fieldsets = [
            ('Match Details', {
                'fields': ('scrim_group', 'match_date', 'formatted_duration', 'game_number', 'is_external_match')
            }),
            ('Teams', {
                'fields': ('our_team', 'opponent_team', 'team_side')
            }),
            ('Results', {
                'fields': ('match_outcome', 'scrim_type', 'general_notes')
            })
        ]
        
        # Add awards section for existing matches
        if obj and obj.pk:
            fieldsets.append(
                ('Match Awards', {
                    'fields': ('get_match_awards',),
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
        
        # Save the object
        obj.save()
        
        # Assign awards if there are player stats
        if obj.player_stats.exists():
            MatchAward.assign_match_awards(obj)
    
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

    def changelist_view(self, request, extra_context=None):
        """Override the changelist view to add a button for bulk adding stats"""
        extra_context = extra_context or {}
        extra_context['bulk_add_button'] = True
        extra_context['bulk_add_url'] = reverse('admin:api_match_bulk_add_stats')
        return super().changelist_view(request, extra_context)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('bulk-add-stats/', self.admin_site.admin_view(self.bulk_add_view), name='api_match_bulk_add_stats'),
            path('bulk-add-stats/<int:match_id>/', self.admin_site.admin_view(self.bulk_add_stats_view), name='api_match_bulk_add_stats_for_match'),
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
                return HttpResponseRedirect(f'../bulk-add-stats/{match_id}/')
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
        
        opponent_team_players = Player.objects.filter(
            team_history__team=match.opponent_team,
            team_history__left_date=None
        ).order_by('current_ign')
        
        if request.method == 'POST':
            # Flag to check if the user has confirmed duplicates
            confirmed = 'confirm_duplicates' in request.POST
            
            formset = PlayerStatFormSet(request.POST)
            
            # Check for validation errors related to non-existent heroes
            # We want to collect these specifically to clear them in the template
            invalid_hero_fields = []
            
            # Attempt validation, but catch non-existent hero errors
            is_valid = False
            try:
                is_valid = formset.is_valid()
            except forms.ValidationError as e:
                # If the error is about non-existent heroes, collect the field info
                error_message = str(e)
                if "does not exist in the database" in error_message:
                    # Extract the hero name from the error message for debugging
                    hero_name = error_message.split("'")[1] if "'" in error_message else "unknown"
                    messages.error(request, f"Hero '{hero_name}' does not exist in the database. Please select a valid hero.")
                    
                    # This is a special case - we want to clear these hero fields
                    invalid_hero_fields.append(hero_name)
                else:
                    # For other validation errors, just display them
                    messages.error(request, f"Validation error: {error_message}")
            
            if is_valid:
                # Check for duplicate heroes
                has_duplicate_heroes = formset.has_duplicate_heroes()
                if has_duplicate_heroes and not confirmed:
                    duplicate_heroes = formset.get_duplicate_heroes()
                    context = {
                        'title': f'Confirm Duplicate Heroes for {match}',
                        'subtitle': 'The following heroes appear multiple times in your submission:',
                        'opts': self.model._meta,
                        'match': match,
                        'formset': formset,
                        'duplicate_heroes': duplicate_heroes,
                        'our_team_players': our_team_players,
                        'opponent_team_players': opponent_team_players,
                        'heroes': Hero.objects.all().order_by('name'),
                        'note': 'This could be intentional if this is a special game mode that allows multiple heroes. If this is correct, please confirm below:'
                    }
                    # Show confirmation template
                    return render(request, 'admin/api/playermatchstat/confirm_duplicates.html', context)
                
                # If no issues or user confirmed, proceed with saving
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
                                team = match.our_team if is_our_team else match.opponent_team
                                
                                # Double check hero_played is present to prevent NULL constraint errors
                                hero_played = form.cleaned_data.get('hero_played')
                                if not hero_played:
                                    # Skip records without a hero to prevent NOT NULL constraint errors
                                    messages.warning(request, f"Skipped player {form.cleaned_data.get('player')} - missing hero selection")
                                    continue
                                
                                # Additional debugging for hero_played
                                try:
                                    hero_id = hero_played.id if hero_played else None
                                    hero_name = hero_played.name if hero_played else None
                                    hero_type = type(hero_played).__name__ if hero_played else None
                                    
                                    messages.info(request, f"Debug: Hero for {form.cleaned_data.get('player').current_ign} - "
                                                   f"ID: {hero_id}, Name: {hero_name}, Type: {hero_type}")
                                    
                                    # Ensure we have a proper Hero instance by requerying if needed
                                    if hero_played and not isinstance(hero_played, Hero):
                                        messages.warning(request, f"Converting {hero_name} to proper Hero instance")
                                        try:
                                            # Try to get the hero by ID first if it's a number
                                            if isinstance(hero_played, str) and hero_played.isdigit():
                                                hero_played = Hero.objects.get(id=int(hero_played))
                                            else:
                                                # If it's a string name, try to get by name
                                                hero_played = Hero.objects.get(name=hero_played)
                                        except Hero.DoesNotExist:
                                            messages.error(request, f"Hero not found: {hero_played}")
                                            continue
                                except Exception as debug_error:
                                    messages.error(request, f"Debug error: {str(debug_error)}")
                                
                                # Set default values for missing fields, but don't include is_our_team
                                kills = form.cleaned_data.get('kills', 0)
                                deaths = form.cleaned_data.get('deaths', 0)
                                assists = form.cleaned_data.get('assists', 0)
                                
                                # Use the user-provided computed_kda value instead of calculating it
                                # If not provided, default to 0
                                computed_kda = form.cleaned_data.get('computed_kda', 0)
                                
                                stats_data = {
                                    'match': match,
                                    'player': form.cleaned_data['player'],
                                    'team': team,  # Set the team correctly
                                    'hero_played': hero_played,  # Now verified not None
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
                                
                                try:
                                    # Create the player match stat with more detailed error handling
                                    # Check that hero_played is definitely not None before creating
                                    if not hero_played:
                                        raise ValueError("Hero is required but was None")
                                        
                                    # Create the PlayerMatchStat record directly
                                    player_stat = PlayerMatchStat.objects.create(
                                        match=match,
                                        player=form.cleaned_data['player'],
                                        team=team,
                                        hero_played=hero_played,  # Now just set the foreign key
                                        role_played=form.cleaned_data.get('role_played', ''),
                                        kills=kills,
                                        deaths=deaths,
                                        assists=assists,
                                        computed_kda=computed_kda,
                                        damage_dealt=form.cleaned_data.get('damage_dealt', 0),
                                        turret_damage=form.cleaned_data.get('turret_damage', 0),
                                        damage_taken=form.cleaned_data.get('damage_taken', 0),
                                        gold_earned=form.cleaned_data.get('gold_earned', 0)
                                    )
                                        
                                    stats_saved += 1
                                    
                                    # Double check that the hero was saved correctly
                                    if not player_stat.hero_played:
                                        messages.warning(request, f"Hero was not saved correctly for {form.cleaned_data.get('player').current_ign}")
                                        
                                except Exception as creation_error:
                                    # Add specific error information for debugging
                                    player_name = form.cleaned_data.get('player').current_ign
                                    hero_name = hero_played.name if hero_played else 'None'
                                    error_message = f"Could not create stat for {player_name} with hero {hero_name}: {str(creation_error)}"
                                    messages.error(request, error_message)
                                    
                                    # Additional error context
                                    try:
                                        # Try to directly create a PlayerMatchStat with a direct Hero
                                        if hero_played:
                                            # Get a fresh copy of the hero from the database
                                            hero_from_db = Hero.objects.get(id=hero_played.id)
                                            messages.info(request, f"Attempting alternative approach for {player_name}: Using hero ID {hero_from_db.id}")
                                            
                                            # Create directly with objects.create
                                            PlayerMatchStat.objects.create(
                                                match=match,
                                                player=form.cleaned_data['player'],
                                                team=team,
                                                hero_played=hero_from_db,  # Use fresh Hero instance
                                                role_played=form.cleaned_data.get('role_played', ''),
                                                kills=kills,
                                                deaths=deaths,
                                                assists=assists,
                                                computed_kda=computed_kda,
                                                damage_dealt=form.cleaned_data.get('damage_dealt', 0),
                                                turret_damage=form.cleaned_data.get('turret_damage', 0),
                                                damage_taken=form.cleaned_data.get('damage_taken', 0),
                                                gold_earned=form.cleaned_data.get('gold_earned', 0)
                                            )
                                            
                                            stats_saved += 1
                                            messages.success(request, f"Successfully saved {player_name} with alternative approach")
                                    except Exception as alt_error:
                                        messages.error(request, f"Alternative approach also failed: {str(alt_error)}")
                                    
                                    # Re-raise to abort the transaction if both approaches fail
                                    raise
                        
                        # Update match stats if any stats were saved
                        if stats_saved > 0:
                            match.calculate_score_details(save=True)
                            # Assign awards after calculating score details
                            MatchAward.assign_match_awards(match)
                        
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
        else:
            # Initialize the forms based on existing stats or create new empty forms
            initial_data = []
            
            if existing_stats.exists():
                # Initialize with existing stats
                for stat in existing_stats:
                    initial_data.append({
                        'player': stat.player,
                        'hero_played': stat.hero_played,  # Now passing the Hero instance directly
                        'role_played': stat.role_played,
                        'kills': stat.kills,
                        'deaths': stat.deaths,
                        'assists': stat.assists,
                        'computed_kda': stat.computed_kda,
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
            'our_team_players': our_team_players,
            'opponent_team_players': opponent_team_players,
            'heroes': heroes,  # Add heroes to context
            'existing_stats': existing_stats,  # Pass existing stats to the template
            'use_select2': True,  # Flag to activate Select2 in the template
        }
        return render(request, 'admin/api/playermatchstat/bulk_add.html', context)

# Add this class for the individual player stat form
class PlayerStatForm(forms.Form):
    player = forms.ModelChoiceField(
        queryset=Player.objects.all(),
        required=False
    )
    hero_played = forms.ModelChoiceField(
        queryset=Hero.objects.all().order_by('name'),
        required=False,
        label="Hero"
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
        initial=True,
        widget=forms.HiddenInput(),
        help_text="Is this player on our team?"
    )
    
    class Media:
        css = {
            'all': ('https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css',)
        }
        js = (
            'admin/jquery.init.js',
            'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js',
            'admin/js/select2_init.js',
        )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add Select2 class to dropdowns for better UX
        self.fields['player'].widget.attrs.update({'class': 'select2-field'})
        self.fields['hero_played'].widget.attrs.update({'class': 'select2-field'})
        self.fields['role_played'].widget.attrs.update({'class': 'select2-field'})

    def clean_hero_played(self):
        """
        Ensure hero_played is a proper Hero instance.
        """
        hero = self.cleaned_data.get('hero_played')
        if not hero:
            return None
            
        # If hero is not a Hero instance (should never happen with ModelChoiceField),
        # but just in case convert it
        if not isinstance(hero, Hero):
            try:
                # If it's a numeric string, try by ID
                if isinstance(hero, str) and hero.isdigit():
                    return Hero.objects.get(id=int(hero))
                    
                # Otherwise try by name
                return Hero.objects.get(name=hero)
            except Hero.DoesNotExist:
                raise forms.ValidationError(f"Hero '{hero}' does not exist")
                
        return hero

    def clean(self):
        """
        Additional form-wide validation.
        """
        cleaned_data = super().clean()
        
        # If player and hero are provided, check for other required fields
        if cleaned_data.get('player') and cleaned_data.get('hero_played'):
            # Make sure we have the basic stats
            for field in ['kills', 'deaths', 'assists']:
                if cleaned_data.get(field) is None:
                    self.add_error(field, 'This field is required when player and hero are specified.')
                    
            # If KDA is missing, compute it
            if cleaned_data.get('computed_kda') is None:
                kills = cleaned_data.get('kills', 0) or 0
                deaths = cleaned_data.get('deaths', 0) or 0
                assists = cleaned_data.get('assists', 0) or 0
                
                if deaths == 0:
                    deaths = 1  # Avoid division by zero
                
                computed_kda = (kills + assists) / deaths
                cleaned_data['computed_kda'] = round(computed_kda, 2)
        
        return cleaned_data

# Base formset for validation
class BasePlayerStatFormSet(BaseFormSet):
    def clean(self):
        """
        Validate the formset as a whole.
        Check for duplicate heroes and other constraints.
        """
        if any(self.errors):
            # Don't validate formset if any form has errors
            return
            
        players = []
        heroes = []
        hero_forms = {}  # Map heroes to their forms for error reporting
        stats_by_team = {True: 0, False: 0}  # Count stats by team (our team vs opponent)
        
        # Store duplicate heroes without raising validation errors
        self._duplicate_heroes = []
        
        # First pass - collect data and check for basic errors
        for i, form in enumerate(self.forms):
            if self.is_empty_form(form):
                continue
                
            # Check hero is provided when player is specified
            player = form.cleaned_data.get('player')
            hero = form.cleaned_data.get('hero_played')
            
            if player and not hero:
                form.add_error('hero_played', 'Hero is required when player is specified')
                continue
                
            if hero and not player:
                form.add_error('player', 'Player is required when hero is specified')
                continue
                
            # Skip fully empty forms
            if not player and not hero:
                continue
                
            # Track players and heroes for duplicate checking
            players.append(player)
            if hero:
                # With ModelChoiceField, hero is already a Hero instance
                hero_name = hero.name.lower()
                heroes.append(hero_name)  # Case-insensitive comparison
                hero_forms[hero_name] = i  # Remember which form had this hero
                
            # Count by team
            is_our_team = form.cleaned_data.get('is_our_team', True)
            stats_by_team[is_our_team] += 1
        
        # Check for duplicate heroes - but don't add validation errors, just track them
        duplicate_heroes = [hero for hero in heroes if heroes.count(hero) > 1]
        if duplicate_heroes:
            self._duplicate_heroes = list(set(duplicate_heroes))
        
        # Validate against existing hero database
        # This is no longer needed since ModelChoiceField ensures valid Hero instances
        # but we'll keep a check to make sure we have the right type
        for i, form in enumerate(self.forms):
            if self.is_empty_form(form):
                continue
                
            hero = form.cleaned_data.get('hero_played')
            if hero and not isinstance(hero, Hero):
                # This should never happen with ModelChoiceField, but just in case
                form.add_error('hero_played', f'Invalid hero data. Please select from the dropdown.')
        
        # Check team balance
        if stats_by_team[True] > 0 and stats_by_team[False] > 0:
            if stats_by_team[True] != 5:
                self.forms[0].add_error(None, f'Our team should have exactly 5 players with stats, but has {stats_by_team[True]}.')
            if stats_by_team[False] != 5:
                self.forms[0].add_error(None, f'Opponent team should have exactly 5 players with stats, but has {stats_by_team[False]}.')
    
    def has_duplicate_heroes(self):
        """Check if the formset has duplicate heroes"""
        return hasattr(self, '_duplicate_heroes') and len(self._duplicate_heroes) > 0
    
    def get_duplicate_heroes(self):
        """Get a list of heroes that appear more than once"""
        return self._duplicate_heroes if hasattr(self, '_duplicate_heroes') else []
    
    def is_empty_form(self, form):
        """Check if a form is empty (no data provided)"""
        if not hasattr(form, 'cleaned_data'):
            return True
            
        # Check if basic fields are all empty
        return (
            not form.cleaned_data.get('player') and
            not form.cleaned_data.get('hero_played') and
            form.cleaned_data.get('kills', 0) == 0 and
            form.cleaned_data.get('deaths', 0) == 0 and
            form.cleaned_data.get('assists', 0) == 0
        )

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

# DraftInfo admin for managing draft information
class DraftInfoForm(forms.ModelForm):
    """Form for the DraftInfo model"""
    hero = forms.ModelChoiceField(
        queryset=Hero.objects.all().order_by('name'),
        required=False,
        label="Hero"
    )
    
    class Meta:
        model = DraftInfo
        fields = '__all__'
    
    class Media:
        css = {
            'all': ('https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css',)
        }
        js = (
            'admin/jquery.init.js',
            'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js',
        )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add Select2 class to the hero field
        self.fields['hero'].widget.attrs.update({'class': 'select2-field'})

# Update PlayerMatchStat admin
@admin.register(PlayerMatchStat)
class PlayerMatchStatAdmin(admin.ModelAdmin):
    # Using ForeignKey fields now
    autocomplete_fields = ['player', 'hero_played']
    list_display = ('player', 'match', 'hero_played', 'kills', 'deaths', 'assists', 'computed_kda')
    list_filter = ('match__match_date', 'team')
    search_fields = ('player__current_ign', 'hero_played__name')

# Update DraftInfo admin
@admin.register(DraftInfo)
class DraftInfoAdmin(admin.ModelAdmin):
    # Using ForeignKey fields now
    autocomplete_fields = ['hero', 'player', 'team']
    list_display = ('match', 'team', 'choice_type', 'hero', 'draft_position')
    list_filter = ('choice_type', 'draft_phase', 'team_side')
    search_fields = ('hero__name', 'team__team_name')
