import React, { useState, useEffect, useRef } from 'react';
import { Formik, FormikProps } from 'formik';
import { Box, Stepper, Step, StepLabel, Button, Typography, Paper, FormControl, InputLabel, Select, MenuItem, TextField, Alert, Snackbar, Switch, FormControlLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Grid, SelectChangeEvent, RadioGroup, FormControlLabel as MuiFormControlLabel, Radio, Autocomplete } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Match, PlayerMatchStat, ScrimGroup, MatchFormData } from '../../types/match.types';
import { Player } from '../../types/player.types';
import { Team } from '../../types/team.types';
import { api } from '../../services/api.service';
import { useAuth } from '../../context/AuthContext';
import AuthStatus from '../common/AuthStatus';
import DraftForm from './DraftForm';
import { draftService } from '../../services/draftService';
import { Hero } from '../../types/hero.types';
import BoxScoreInput from './BoxScoreInput';
import { formatDuration } from '../../utils/matchUtils';
import { initialMatchValues, matchValidationSchema } from '../../config/matchForm.config';
import { getId } from '../../utils/formUtils';
import MatchDetailsStep from './MatchDetailsStep';
import ReviewStep from './ReviewStep';
import { suggestGameNumber } from '../../services/match.service';

// --- NEW: Define a key for session storage ---
const FORM_STATE_KEY = 'matchUploadFormState';
// --- END NEW ---

// --- NEW: Define interface for saved state ---
interface SavedFormState {
    values: MatchFormData;
    activeStep: number;
    includeDraftInfo: boolean | null;
}
// --- END NEW ---

const steps = ['Match Details', 'Player Stats', 'Review'];

export const getEmptyPlayerStat = (isOurTeam: boolean): Partial<PlayerMatchStat> => ({
  is_our_team: isOurTeam,
  player_id: undefined,
  ign: '',
  hero_played: null,
  role_played: '',
    kills: 0,
    deaths: 0,
    assists: 0,
  damage_dealt: undefined,
  damage_taken: undefined,
  turret_damage: undefined,
  gold_earned: undefined,
  player_notes: '',
  kda: null,
  medal: null,
});

/**
 * Match payload type for API submission
 */
interface MatchPayload {
  match_date: string | null;
  scrim_type: string;
  game_number: number;
  match_duration: string | null;
  general_notes: string | null;
  mvp: number | null;
  mvp_loss: number | null;
  blue_side_team: number | null;
  red_side_team: number | null;
  our_team: number | null;
  winning_team: number | null;
  score_details?: Record<string, unknown> | null;
  scrim_group?: number | null;
}

/**
 * Player stat payload type for API submission
 */
interface PlayerStatPayload {
  match: number;
  player: number;
  team: number;
  role_played: string | null;
  hero_played: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number | null;
  medal: string | null;
  damage_dealt: number | null;
  damage_taken: number | null;
  turret_damage: number | null;
  gold_earned: number | null;
  player_notes: string | null;
  teamfight_participation: number | null;
}

const MatchUploadForm: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [managedTeams, setManagedTeams] = useState<Team[]>([]);
  const [connectionAlert, setConnectionAlert] = useState<{show: boolean, message: string, severity: 'error' | 'success' | 'info' | 'warning'}>({ show: false, message: '', severity: 'info' });
  const { isAuthenticated } = useAuth();
  const [availableHeroes, setAvailableHeroes] = useState<Hero[]>([]);
  
  const [includeDraftInfo, setIncludeDraftInfo] = useState<boolean | null>(null);

  const [newOpponentDialogOpen, setNewOpponentDialogOpen] = useState(false);
  const [newTeam1DialogOpen, setNewTeam1DialogOpen] = useState(false);
  const [newTeam2DialogOpen, setNewTeam2DialogOpen] = useState(false);

  // --- NEW: State to hold loaded initial values ---
  const [loadedInitialValues, setLoadedInitialValues] = useState<MatchFormData | null>(null);
  const [isLoadingInitialValues, setIsLoadingInitialValues] = useState(true);
  // --- END NEW ---
  
  // Add specific loading states for different API operations
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingHeroes, setIsLoadingHeroes] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isUpdatingGameNumber, setIsUpdatingGameNumber] = useState(false);

  const formikRef = useRef<FormikProps<MatchFormData> | null>(null);

  useEffect(() => {
    // --- UPDATED: Load initial values, active step, AND includeDraftInfo from sessionStorage ---
    try {
      const savedStateString = sessionStorage.getItem(FORM_STATE_KEY);
      if (savedStateString) {
        const savedState: SavedFormState = JSON.parse(savedStateString);
        // Basic validation/check if it looks like our saved state structure
        if (savedState && typeof savedState === 'object' && 
            savedState.values && 'match_datetime' in savedState.values && 
            typeof savedState.activeStep === 'number' &&
            (savedState.includeDraftInfo === null || typeof savedState.includeDraftInfo === 'boolean')
        ) {
           console.log("Loaded form state from sessionStorage:", savedState);
           // Merge with defaults to ensure all keys exist, prioritizing saved state
           setLoadedInitialValues({ ...initialMatchValues, ...savedState.values });
           setActiveStep(savedState.activeStep); // Set loaded step
           setIncludeDraftInfo(savedState.includeDraftInfo); // <<<< SET LOADED DRAFT INFO FLAG
        } else {
            console.warn("Invalid data found in sessionStorage, using defaults.");
            setLoadedInitialValues(initialMatchValues);
            setActiveStep(0); // Default step
            setIncludeDraftInfo(null); // Default draft info flag
        }
      } else {
        console.log("No saved form state found, using defaults.");
        setLoadedInitialValues(initialMatchValues);
        setActiveStep(0); // Default step
        setIncludeDraftInfo(null); // Default draft info flag
      }
    } catch (error) {
        console.error("Error reading or parsing sessionStorage:", error);
        setLoadedInitialValues(initialMatchValues);
        setActiveStep(0); // Default step on error
        setIncludeDraftInfo(null); // Default draft info flag on error
    } finally {
        setIsLoadingInitialValues(false);
    }
    // --- END UPDATE ---

    const fetchHeroes = async () => {
      setIsLoadingHeroes(true);
      try {
        const heroes: Hero[] = await draftService.getHeroes();
        setAvailableHeroes(heroes);
      } catch (error) {
        console.error('Error fetching heroes:', error);
        setConnectionAlert({ show: true, message: 'Failed to load hero list.', severity: 'warning' });
      } finally {
        setIsLoadingHeroes(false);
      }
    };
    fetchHeroes();
  }, []);
  
  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoadingTeams(true);
      try {
        const results = await Promise.allSettled([
          api.get<{ count: number, next: string | null, previous: string | null, results: Team[] }>('/api/teams/'),
          api.get<{ count: number, next: string | null, previous: string | null, results: Team[] }>('/api/teams/managed/')
        ]);

        let allTeams: Team[] = [];
        let managed: Team[] = [];
        let fetchError = false;

        if (results[0].status === 'fulfilled') {
            allTeams = results[0].value.data.results || [];
        } else {
            console.error('Error fetching all teams:', results[0].reason);
            fetchError = true;
        }

        if (results[1].status === 'fulfilled') {
            managed = results[1].value.data.results || [];
        } else {
            console.error('Error fetching managed teams:', results[1].reason);
            fetchError = true;
        }
        
        setTeams(allTeams); 
        setManagedTeams(managed);

        if (fetchError) {
            setConnectionAlert({ show: true, message: 'Failed to load some team data. Functionality may be limited.', severity: 'warning' });
        }
        
      } catch (error) {
        console.error('Generic error fetching teams:', error);
        setConnectionAlert({ show: true, message: 'Failed to load essential team data. Please check connection and refresh.', severity: 'error' });
      } finally {
        setIsLoadingTeams(false);
      }
    };
    
    if (isAuthenticated) {
      fetchTeams();
    } else {
        setConnectionAlert({ show: true, message: 'Please log in to manage matches.', severity: 'info' });
    }
  }, [isAuthenticated]);

  const handleNext = () => {
    if (activeStep === 0 && includeDraftInfo === null) {
      setConnectionAlert({ show: true, message: 'Please choose whether to include draft information before proceeding.', severity: 'warning' });
      return;
    }
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleAddNewTeam = async (teamData: Partial<Team>, formik: FormikProps<MatchFormData>, teamType: 'opponent' | 'team1' | 'team2') => {
    setConnectionAlert({ show: false, message: '', severity: 'info' });
    setIsCreatingTeam(true);
    try {
      const response = await api.post<Team>('/api/teams/', {
        team_name: teamData.team_name,
        team_abbreviation: teamData.team_abbreviation,
        team_category: teamData.team_category,
        is_opponent_only: teamType === 'opponent'
      });
      
      const newTeam = response.data;
      
      setTeams(prevTeams => [...prevTeams, newTeam]);
      
      const newTeamIdStr = String(newTeam.team_id);
      if (teamType === 'opponent') {
        formik.setFieldValue('opponent_team', newTeamIdStr);
        formik.setFieldValue('is_new_opponent', false);
        setNewOpponentDialogOpen(false);
      } else if (teamType === 'team1') {
        formik.setFieldValue('team_1', newTeamIdStr);
        formik.setFieldValue('team_1_new', false);
        setNewTeam1DialogOpen(false);
      } else if (teamType === 'team2') {
        formik.setFieldValue('team_2', newTeamIdStr);
        formik.setFieldValue('team_2_new', false);
        setNewTeam2DialogOpen(false);
      }
      
      formik.setFieldValue(`${teamType}_name`, '');
      formik.setFieldValue(`${teamType}_abbreviation`, '');
      formik.setFieldValue(`${teamType}_category`, '');

      setConnectionAlert({ show: true, message: `Team '${newTeam.team_name}' created successfully!`, severity: 'success' });
      
    } catch (error: any) {
      console.error('Error creating team:', error);
       let errorMsg = 'Failed to create team. Please try again.';
        if (error.response && error.response.data) {
            const errors = error.response.data;
             if (typeof errors === 'object') {
                errorMsg = Object.entries(errors)
                    .map(([key, value]) => {
                        if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
                        if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
                        return `${key}: ${value}`;
                    }).join('; ');
            } else if (typeof errors === 'string') {
                errorMsg = errors;
            }
        }
      setConnectionAlert({ show: true, message: `Team creation failed: ${errorMsg}`, severity: 'error' });
    } finally {
      setIsCreatingTeam(false);
    }
  };
  
  const getTeamName = (teamId: string | undefined): string => {
    if (!teamId) return 'N/A';
    const team = teams.find(t => String(t.team_id) === String(teamId));
    return team ? `${team.team_name} (${team.team_abbreviation})` : 'Unknown Team';
  };

  // Helper to get Hero Name (used by ReviewStep)
  const getHeroName = (heroValue: Hero | Partial<Hero> | string | null | undefined): string => {
    if (!heroValue) return '-';
    if (typeof heroValue === 'string') return heroValue;
    if (typeof heroValue === 'number') return `Hero ID ${heroValue}`; // Fallback
    if (typeof heroValue === 'object' && heroValue !== null && 'name' in heroValue) {
      return heroValue.name || 'Unknown Hero';
    }
    return 'Invalid Hero Data';
  };

  // Helper to navigate steps (used by ReviewStep)
  const navigateToStep = (stepIndex: number) => {
    setActiveStep(stepIndex);
  };

  const handleSubmit = async (values: MatchFormData) => {
    setIsSubmitting(true);
    setConnectionAlert({ show: false, message: '', severity: 'info' });

    const getHeroId = (heroValue: Hero | Partial<Hero> | string | null | undefined): number | undefined => {
        if (typeof heroValue === 'object' && heroValue !== null && heroValue.hero_id) {
            return heroValue.hero_id;
        }
        const id = parseInt(String(heroValue), 10); 
        return !isNaN(id) ? id : undefined;
    };

    const durationString = formatDuration(values.match_duration_hours, values.match_duration_minutes, values.match_duration_seconds);

    // --- UPDATED: Construct payload with ONLY expected backend fields --- 
    let blueTeamIdSubmit: number | null = null;
    let redTeamIdSubmit: number | null = null;
    let ourTeamIdSubmit: number | null = null;
    let winningTeamIdSubmit: number | null = null;

    if (values.is_external_match) {
        blueTeamIdSubmit = getId(values.team_1) ?? null;
        redTeamIdSubmit = getId(values.team_2) ?? null;
        winningTeamIdSubmit = getId(values._temp_winning_team_id) ?? null;
        // Our team ID is null in external matches unless explicitly managed
        // Backend should handle this, but we can set it to null explicitly if needed
        const blueIsManaged = managedTeams.some(t => String(t.team_id) === values.team_1);
        const redIsManaged = managedTeams.some(t => String(t.team_id) === values.team_2);
        if (blueIsManaged && !redIsManaged) ourTeamIdSubmit = blueTeamIdSubmit;
        else if (redIsManaged && !blueIsManaged) ourTeamIdSubmit = redTeamIdSubmit;
        // else if both managed, 'our_team' might be ambiguous, default to null or let backend decide
        else ourTeamIdSubmit = null; 

    } else {
        const ourTeamIdSelected = getId(values.our_team);
        const opponentTeamIdSelected = getId(values.opponent_team);
        ourTeamIdSubmit = ourTeamIdSelected ?? null; // This IS our team

        if (values.team_side === 'BLUE') {
            blueTeamIdSubmit = ourTeamIdSelected ?? null;
            redTeamIdSubmit = opponentTeamIdSelected ?? null;
        } else { // Assumes RED side
            blueTeamIdSubmit = opponentTeamIdSelected ?? null;
            redTeamIdSubmit = ourTeamIdSelected ?? null;
        }
        
        // Determine winning team based on match result relative to 'our_team'
        const winnerId = values.match_result === 'VICTORY' ? ourTeamIdSelected : 
                         values.match_result === 'DEFEAT' ? opponentTeamIdSelected : 
                         null; // Handle cases like DRAW or null result
        winningTeamIdSubmit = winnerId === undefined ? null : winnerId;
    }
    
    // Construct the final payload with only the necessary fields
    const finalPayload: MatchPayload = {
      match_date: values.match_datetime ? new Date(values.match_datetime).toISOString() : null,
      scrim_type: values.scrim_type,
      game_number: values.game_number,
      match_duration: durationString !== '00:00:00' ? durationString : null,
      general_notes: values.general_notes || null,
      mvp: getId(values.mvp_player_id) ?? null,
      mvp_loss: getId(values.mvp_loss_player_id) ?? null,
      blue_side_team: blueTeamIdSubmit,
      red_side_team: redTeamIdSubmit,
      our_team: ourTeamIdSubmit, // Explicitly set our_team based on logic above
      winning_team: winningTeamIdSubmit,
      // score_details: null, // Explicitly null if not used, or construct if needed
      // scrim_group: null, // Explicitly null if not used
      // match_outcome: is derived on backend based on winning_team and our_team
    };
    // --- END UPDATE ---

    console.log("DEBUG: Calculated blueTeamIdSubmit:", blueTeamIdSubmit);
    console.log("DEBUG: Calculated redTeamIdSubmit:", redTeamIdSubmit);
    console.log("DEBUG: values.team_players:", JSON.stringify(values.team_players));
    console.log("DEBUG: values.enemy_players:", JSON.stringify(values.enemy_players));

    console.log("Prepared match data for API:", finalPayload);

    try {
      // --- UPDATED: Use finalPayload --- 
      const matchResponse = await api.post<{match_id: number, message: string}>('/api/matches/', finalPayload); 
      // --- END UPDATE ---
      const createdMatch = matchResponse.data;
      const matchId = createdMatch.match_id;
      console.log("Match created:", createdMatch); // Contains only match_id and message
      setConnectionAlert({ show: true, message: `Match (ID: ${matchId}) created successfully.`, severity: 'success' });

      // --- UPDATED: Use blueTeamIdSubmit and redTeamIdSubmit for team_id --- 
      const blueSideStats = values.team_players.map((p) => ({ ...p, is_blue_side: true, team_id: blueTeamIdSubmit }));
      const redSideStats = values.enemy_players.map((p) => ({ ...p, is_blue_side: false, team_id: redTeamIdSubmit }));
      const allPlayerStatsInput = [...blueSideStats, ...redSideStats];

      console.log("DEBUG: allPlayerStatsInput before filter:", JSON.stringify(allPlayerStatsInput)); // Log before filter

      const playerStatPromises = allPlayerStatsInput
          // Filter should now work correctly as team_id is populated
          // FIX: Check hero_played object directly for its id
          .filter(stat => 
              getId(stat.player_id) && 
              (typeof stat.hero_played === 'object' && stat.hero_played !== null && typeof stat.hero_played.id === 'number') && 
              stat.team_id
          ) 
          .map(async (stat) => {
            const playerId = getId(stat.player_id)!;
            // FIX: Get heroId directly from the object
            const heroId = (typeof stat.hero_played === 'object' && stat.hero_played !== null) ? stat.hero_played.id : undefined;
            const teamId = stat.team_id!; // Now correctly populated

            // Ensure heroId was found before proceeding
            if (heroId === undefined) {
              console.error("Could not determine hero ID for stat:", stat);
              return Promise.reject("Invalid hero data"); // Skip this stat
            }

            // Ensure payload keys match PlayerMatchStatSerializer writeable fields/model fields
            const playerStatPayload: PlayerStatPayload = {
              match: matchId, // FIX: Use the correct matchId from the created match
              player: playerId, // Serializer expects 'player', maps to player_id
              team: teamId,
              role_played: stat.role_played || null,
              hero_played: heroId,
              kills: stat.kills ?? 0,
              deaths: stat.deaths ?? 0,
              assists: stat.assists ?? 0,
              kda: stat.kda ?? null,
              medal: stat.medal || null,
              damage_dealt: stat.damage_dealt ?? null,
              damage_taken: stat.damage_taken ?? null,
              turret_damage: stat.turret_damage ?? null,
              gold_earned: stat.gold_earned ?? null,
              player_notes: stat.player_notes || null,
              teamfight_participation: stat.teamfight_participation ?? null // Added field
            };
            console.log("Submitting player stat:", playerStatPayload);
            // Endpoint should now exist
            return api.post<PlayerMatchStat>('/api/player-stats/', playerStatPayload);
    });

    if (playerStatPromises.length > 0) {
        const statResults = await Promise.allSettled(playerStatPromises);
    console.log("Player stat submission results:", statResults);
        const failedStats = statResults.filter(r => r.status === 'rejected');
        if (failedStats.length > 0) {
            setConnectionAlert({ show: true, message: `Failed to submit ${failedStats.length} player stats.`, severity: 'warning' });
        } else {
             setConnectionAlert({ show: true, message: 'All player stats submitted successfully.', severity: 'success' });
        }
    } else {
         setConnectionAlert({ show: true, message: 'No player stats to submit.', severity: 'success' });
    }
    
    setTimeout(() => {
    navigate('/matches'); 
    }, 1500);

    console.log("Match submitted successfully, clearing saved state.");
    sessionStorage.removeItem(FORM_STATE_KEY); // Clear saved state
    setActiveStep(0); // Reset to first step for potential new entry

  } catch (err: any) {
    console.error("Error submitting match:", err);
    let apiError = 'Failed to submit match data.';
    if (err.response && err.response.data) {
      const errors = err.response.data;
      if (typeof errors === 'object') {
        apiError = Object.entries(errors).map(([key, value]) => {
            if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
            if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
            return `${key}: ${value}`;
        }).join('; ');
      } else if (typeof errors === 'string') { 
          apiError = errors; 
      }
    }
    setConnectionAlert({ show: true, message: `Submission failed: ${apiError}`, severity: 'error' });
  } finally {
    setIsSubmitting(false);
  }
};

  const renderStepContent = (step: number, formikProps: FormikProps<MatchFormData>) => {
    const { values, setFieldValue } = formikProps;
    
    switch (step) {
      case 0:
        return (
            <MatchDetailsStep 
                formik={formikProps} 
                teams={teams} 
                managedTeams={managedTeams}
                getTeamName={getTeamName}
                handleAddNewTeam={(teamData, teamType) => handleAddNewTeam(teamData, formikProps, teamType)}
                newOpponentDialogOpen={newOpponentDialogOpen}
                setNewOpponentDialogOpen={setNewOpponentDialogOpen}
                newTeam1DialogOpen={newTeam1DialogOpen}
                setNewTeam1DialogOpen={setNewTeam1DialogOpen}
                newTeam2DialogOpen={newTeam2DialogOpen}
                setNewTeam2DialogOpen={setNewTeam2DialogOpen}
                includeDraftInfo={includeDraftInfo}
                setIncludeDraftInfo={setIncludeDraftInfo}
            />
        );
      case 1:
        // Determine team labels based on match type
        let blueTeamLabel = "Blue Side";
        let redTeamLabel = "Red Side";

        if (values.is_external_match) {
            const blueName = getTeamName(values.team_1); const redName = getTeamName(values.team_2);
            if (blueName !== 'N/A' && blueName !== 'Unknown Team') blueTeamLabel = blueName;
            if (redName !== 'N/A' && redName !== 'Unknown Team') redTeamLabel = redName;
        } else {
            const ourName = getTeamName(values.our_team); const oppName = getTeamName(values.opponent_team);
            if (values.team_side === 'BLUE') {
                if (ourName !== 'N/A' && ourName !== 'Unknown Team') blueTeamLabel = `${ourName} (Our Team)`; else blueTeamLabel = "Our Team (Blue)";
                if (oppName !== 'N/A' && oppName !== 'Unknown Team') redTeamLabel = `${oppName} (Opponent)`; else redTeamLabel = "Opponent (Red)";
            } else if (values.team_side === 'RED') {
                if (oppName !== 'N/A' && oppName !== 'Unknown Team') blueTeamLabel = `${oppName} (Opponent)`; else blueTeamLabel = "Opponent (Blue)";
                if (ourName !== 'N/A' && ourName !== 'Unknown Team') redTeamLabel = `${ourName} (Our Team)`; else redTeamLabel = "Our Team (Red)";
            }
        }

        return (
          <BoxScoreInput
            formik={formikProps}
            availableHeroes={availableHeroes}
            team1Label={blueTeamLabel}
            team2Label={redTeamLabel}
            includeDraftInfo={includeDraftInfo ?? false}
          />
        );
      case 2:
        return (
            <ReviewStep 
                values={values} 
                getTeamName={getTeamName} 
                getHeroName={getHeroName} 
                includeDraftInfo={includeDraftInfo}
                navigateToStep={navigateToStep} 
                onBack={handleBack} 
                onSubmit={formikProps.submitForm}
            />
        );
      default: return <Typography>Unknown Step</Typography>;
    }
  };

  // --- Helper function to save form state including active step and draft flag ---
  const saveFormState = (values: MatchFormData, step: number, draftFlag: boolean | null) => {
    try {
      // Make a simpler copy to avoid circular references
      const simplifiedValues = JSON.parse(JSON.stringify({
        ...values,
        // Clear out complex objects that might cause issues
        players: [] // Don't need to store the full players list
      }));
      
      const stateToSave: SavedFormState = { 
        values: simplifiedValues, 
        activeStep: step, 
        includeDraftInfo: draftFlag 
      };
      
      sessionStorage.setItem(FORM_STATE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Error saving form state to sessionStorage:", error);
      
      // Only show alerts outside of development
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isDevelopment) {
        alert('There was an issue saving your form progress. Please complete the form in one session.');
      }
    }
  };

  // --- UPDATED: FormikPersistence component now also depends on active step and includeDraftInfo ---
  const FormikPersistence = (props: { 
      formik: FormikProps<MatchFormData>; 
      currentStep: number; 
      draftFlag: boolean | null;
  }) => {
    const { values } = props.formik;
    const { currentStep, draftFlag } = props; // Get step and draft flag

    useEffect(() => {
        saveFormState(values, currentStep, draftFlag);
    }, [values, currentStep, draftFlag]);

    return null; // This component doesn't render anything itself
  };
  // --- END UPDATE ---

  // Function to update game number automatically
  const updateGameNumber = async (values: MatchFormData) => {
    if (!values.our_team || !values.match_datetime || !values.scrim_type) {
      return;
    }
    
    setIsUpdatingGameNumber(true);
    try {
      // Get the opponent team ID based on the match type
      let opponentTeamId: number | undefined;
      
      if (values.is_external_match) {
        // For external matches, our_team might not be defined
        opponentTeamId = Number(values.opponent_team);
      } else {
        opponentTeamId = Number(values.opponent_team);
      }
      
      if (!opponentTeamId) {
        console.log('No opponent team ID found, skipping game number update');
        return;
      }
      
      const result = await suggestGameNumber(
        Number(values.our_team),
        opponentTeamId,
        values.match_datetime,
        values.scrim_type
      );
      
      if (result && typeof result === 'number') {
        formikRef.current?.setFieldValue('game_number', result);
      }
    } catch (error) {
      console.error('Error getting game number suggestion:', error);
      // No need to show alert for this minor issue
    } finally {
      setIsUpdatingGameNumber(false);
    }
  };

  if (!isAuthenticated) {
       return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                 <Paper elevation={3} sx={{ p: 4 }}>
                    <Typography variant="h6" gutterBottom>Authentication Required</Typography>
                    <Typography>Please log in to access the match upload form.</Typography>
                    <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/login')}>Go to Login</Button>
                 </Paper>
                  <Snackbar open={connectionAlert.show} autoHideDuration={6000} onClose={() => setConnectionAlert({...connectionAlert, show: false})}>
                    <Alert onClose={() => setConnectionAlert({...connectionAlert, show: false})} severity={connectionAlert.severity} sx={{ width: '100%' }}>
                        {connectionAlert.message}
                    </Alert>
                 </Snackbar>
                 <Box sx={{ position: 'absolute', top: 16, right: 16 }}><AuthStatus /></Box>
            </Box>
       );
  }
  
  if (isSubmitting && teams.length === 0) {
        return (
             <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading essential data...</Typography>
             </Box>
        );
   }

  // --- UPDATED: Render Formik only after loading initial values ---
  if (isLoadingInitialValues) {
      return <CircularProgress />; // Or some other loading indicator
  }
  // --- END UPDATE ---

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <AuthStatus />
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>Submit Match Data</Typography>
        
        {/* Loading indicators for data fetching */}
        {(isLoadingInitialValues || isLoadingTeams || isLoadingHeroes) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              {isLoadingInitialValues ? 'Loading form...' : 
               isLoadingTeams ? 'Loading teams...' : 
               'Loading heroes...'}
            </Typography>
          </Box>
        )}
        
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {loadedInitialValues && (
        <Formik
          initialValues={loadedInitialValues}
          validationSchema={matchValidationSchema}
          onSubmit={handleSubmit}
          innerRef={(formik) => {
            formikRef.current = formik;
          }}
        >
          {(formikProps) => (
            <>
              <FormikPersistence formik={formikProps} currentStep={activeStep} draftFlag={includeDraftInfo} />
              {renderStepContent(activeStep, formikProps)}
              
              <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                <Button
                  color="primary"
                  disabled={activeStep === 0 || isSubmitting}
                  onClick={handleBack}
                  sx={{ mr: 1 }}
                >
                  Back
                </Button>
                <Box sx={{ flex: '1 1 auto' }} />
                
                {activeStep === steps.length - 1 ? (
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => formikProps.handleSubmit()}
                    disabled={isSubmitting || formikProps.isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <CircularProgress size={24} sx={{ mr: 1 }} />
                        Submitting...
                      </>
                    ) : 'Submit'}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleNext}
                    disabled={isSubmitting || formikProps.isSubmitting}
                  >
                    Next
                  </Button>
                )}
              </Box>
            </>
          )}
        </Formik>
        )}
      </Paper>
      
      <Snackbar 
        open={connectionAlert.show} 
        autoHideDuration={6000} 
        onClose={() => setConnectionAlert({...connectionAlert, show: false})}
      >
        <Alert 
          onClose={() => setConnectionAlert({...connectionAlert, show: false})} 
          severity={connectionAlert.severity}
          sx={{ width: '100%' }}
        >
          {connectionAlert.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MatchUploadForm;