import React, { useState, useEffect } from 'react';
import { Formik, FormikProps, useFormikContext } from 'formik';
import * as Yup from 'yup';
import { Box, Stepper, Step, StepLabel, Button, Typography, Paper, FormControl, InputLabel, Select, MenuItem, TextField, Alert, Snackbar, Switch, FormControlLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Grid, SelectChangeEvent, RadioGroup, FormControlLabel as MuiFormControlLabel, Radio, Autocomplete } from '@mui/material';
import FileUploader from './FileUploader';
import { useNavigate } from 'react-router-dom';
import { createMatch, createPlayerStat, uploadMatchFile } from '../../services/match.service';
import { Match, PlayerMatchStat, ScrimGroup } from '../../types/match.types';
import { Player } from '../../types/player.types';
import { Team } from '../../types/team.types';
import MatchMetadata from './MatchMetadata';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AuthStatus from '../common/AuthStatus';
import DraftForm from './DraftForm';
import { DraftFormData, getEmptyDraftFormData } from '../../types/draft';
import { draftService } from '../../services/draftService';
import { Hero } from '../../types/hero';
import { testBackendConnection, BackendConnectionResult } from '../../services/api.service';
import PlayerStatRow from './PlayerStatRow';
import BoxScoreInput from './BoxScoreInput';
import { formatDuration } from '../../utils/matchUtils';
import { initialMatchValues, matchValidationSchema } from '../../config/matchForm.config';
import { TeamPlayerData } from '../../types/form.types';

const steps = ['Match Details', 'Draft', 'Player Stats', 'File Uploads', 'Review'];

// Define the empty player stat structure for resetting
const getEmptyPlayerStat = (isOurTeam: boolean): Partial<PlayerMatchStat> => ({
  is_our_team: isOurTeam, // Keep this for form logic differentiation if needed
  player_id: undefined,
  ign: '',
  hero_played: null, // Or undefined, depends on Autocomplete handling
  role_played: '',
    kills: 0,
    deaths: 0,
    assists: 0,
  damage_dealt: undefined, // Use undefined for optional number fields
  damage_taken: undefined,
  turret_damage: undefined,
  gold_earned: undefined,
  player_notes: '',
});

// --- Helper Component to Handle Roster Fetching and Pre-population ---
// This component lives inside Formik context to access values and setFieldValue
const RosterManager: React.FC<{ 
    teams: Team[]; // Pass all teams for getTeamName
}> = ({ teams }) => {
    const { values, setFieldValue, initialValues: formikInitialValues } = useFormikContext<MatchFormData>();
    const [blueSideRoster, setBlueSideRoster] = useState<Player[]>([]);
    const [redSideRoster, setRedSideRoster] = useState<Player[]>([]);
    const [rosterLoading, setRosterLoading] = useState<Record<string, boolean>>({}); // Track loading per team
    const [rosterError, setRosterError] = useState<string | null>(null);

    // Helper function to fetch roster for a team ID
    const fetchTeamRoster = async (teamId: string | undefined): Promise<Player[]> => {
        if (!teamId) return [];
        setRosterLoading(prev => ({ ...prev, [teamId]: true }));
        try {
            // Use the TeamPlayersView endpoint: /api/teams/<id>/players/
            // Assuming it returns Player[] directly or { results: Player[] } for pagination
            const response = await api.get<Player[] | { results: Player[] }>(`/api/teams/${teamId}/players/`);
            // Adjust based on actual API response structure
            const roster = Array.isArray(response.data) ? response.data : response.data.results || [];
            setRosterLoading(prev => ({ ...prev, [teamId]: false }));
            return roster;
        } catch (error) {            
            console.error(`Error fetching roster for team ${teamId}:`, error);
            setRosterError(`Failed to load roster for team ${teamId}.`);
            setRosterLoading(prev => ({ ...prev, [teamId]: false }));
            return []; // Return empty array on error
        }
    };

    // Effect to fetch rosters when relevant team IDs change
    useEffect(() => {
        let blueTeamId: string | undefined;
        let redTeamId: string | undefined;

        if (values.is_external_match) {
            blueTeamId = values.team_1;
            redTeamId = values.team_2;
        } else {
            if (values.team_side === 'BLUE') {
                blueTeamId = values.our_team;
                redTeamId = values.opponent_team;
            } else if (values.team_side === 'RED') {
                blueTeamId = values.opponent_team;
                redTeamId = values.our_team;
            }
        }

        // Fetch rosters only if IDs are defined
        if (blueTeamId) fetchTeamRoster(blueTeamId).then(setBlueSideRoster);
        else setBlueSideRoster([]); // Clear roster if ID is removed

        if (redTeamId) fetchTeamRoster(redTeamId).then(setRedSideRoster);
        else setRedSideRoster([]); // Clear roster if ID is removed

    }, [values.is_external_match, values.team_1, values.team_2, values.our_team, values.opponent_team, values.team_side]);

    // Effect for clearing/pre-populating player slots
    useEffect(() => {
        let blueTeamId: string | undefined;
        let redTeamId: string | undefined;

        // Determine which team IDs are currently relevant
    if (values.is_external_match) {
            blueTeamId = values.team_1;
            redTeamId = values.team_2;
    } else {
            if (values.team_side === 'BLUE') {
                blueTeamId = values.our_team;
                redTeamId = values.opponent_team;
            } else if (values.team_side === 'RED') {
                blueTeamId = values.opponent_team;
                redTeamId = values.our_team;
            }
        }

        // Helper to reset or populate a slot
        const processPlayerSlot = (index: number, teamId: string | undefined, roster: Player[], fieldPrefix: 'team_players' | 'enemy_players') => {
            const player = teamId ? roster[index] : undefined; // Get player from roster if team selected
            const isOurTeam = fieldPrefix === 'team_players'; // Determine based on prefix
            const baseEmptyStat = getEmptyPlayerStat(isOurTeam);

            if (player) {
                // Team selected and player exists in roster for this slot: Populate
                setFieldValue(`${fieldPrefix}[${index}].ign`, player.current_ign || '');
                setFieldValue(`${fieldPrefix}[${index}].player_id`, player.player_id);
                setFieldValue(`${fieldPrefix}[${index}].role_played`, player.primary_role || '');
                // Reset other stats to default when populating based on roster
                setFieldValue(`${fieldPrefix}[${index}].hero_played`, baseEmptyStat.hero_played);
                setFieldValue(`${fieldPrefix}[${index}].kills`, baseEmptyStat.kills);
                setFieldValue(`${fieldPrefix}[${index}].deaths`, baseEmptyStat.deaths);
                setFieldValue(`${fieldPrefix}[${index}].assists`, baseEmptyStat.assists);
                setFieldValue(`${fieldPrefix}[${index}].damage_dealt`, baseEmptyStat.damage_dealt);
                setFieldValue(`${fieldPrefix}[${index}].damage_taken`, baseEmptyStat.damage_taken);
                setFieldValue(`${fieldPrefix}[${index}].turret_damage`, baseEmptyStat.turret_damage);
                setFieldValue(`${fieldPrefix}[${index}].gold_earned`, baseEmptyStat.gold_earned);
                setFieldValue(`${fieldPrefix}[${index}].player_notes`, baseEmptyStat.player_notes);
                // Ensure is_our_team flag is correct (might differ in external matches)
                setFieldValue(`${fieldPrefix}[${index}].is_our_team`, isOurTeam);
    } else {
                // Team not selected OR roster doesn't have a player for this slot: Clear all fields
                setFieldValue(`${fieldPrefix}[${index}]`, baseEmptyStat);
            }
        };

        // Process all 5 slots for both teams
        for (let i = 0; i < 5; i++) {
            processPlayerSlot(i, blueTeamId, blueSideRoster, 'team_players');
            processPlayerSlot(i, redTeamId, redSideRoster, 'enemy_players');
        }

    }, [blueSideRoster, redSideRoster, values.is_external_match, values.team_1, values.team_2, values.our_team, values.opponent_team, values.team_side, setFieldValue]); // Depends on rosters and the IDs

    // This component doesn't render anything itself
    // It just manages the roster fetching and pre-population logic
    // Optionally display loading/error states if needed
    // if (Object.values(rosterLoading).some(Boolean)) return <CircularProgress size={20} />;
    // if (rosterError) return <Alert severity="error">{rosterError}</Alert>;
    return null;
};

// --- Main Component --- 
const MatchUploadForm: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [managedTeams, setManagedTeams] = useState<Team[]>([]);
  const [connectionAlert, setConnectionAlert] = useState<{show: boolean, message: string, severity: 'error' | 'success' | 'info' | 'warning'}>({ show: false, message: '', severity: 'info' });
  const { isAuthenticated } = useAuth();
  const [availableHeroes, setAvailableHeroes] = useState<Hero[]>([]);
  
  // New team dialog states
  const [newOpponentDialogOpen, setNewOpponentDialogOpen] = useState(false);
  const [newTeam1DialogOpen, setNewTeam1DialogOpen] = useState(false);
  const [newTeam2DialogOpen, setNewTeam2DialogOpen] = useState(false);

  // Load available heroes when component mounts
  useEffect(() => {
    const fetchHeroes = async () => {
      try {
        const heroes = await draftService.getHeroes();
        setAvailableHeroes(heroes);
      } catch (error) {
        console.error('Error fetching heroes:', error);
      }
    };
    fetchHeroes();
  }, []);
  
  // Fetch teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        // Use Promise.allSettled to handle potential errors independently
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
        
      } catch (error) { // Catch unexpected errors from Promise.allSettled or setup
        console.error('Generic error fetching teams:', error);
        setConnectionAlert({ show: true, message: 'Failed to load teams. Please check connection.', severity: 'error' });
      }
    };
    
    if (isAuthenticated) {
      fetchTeams();
    }
  }, [isAuthenticated]);

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Handle new team creation
  const handleAddNewTeam = async (teamData: Partial<Team>, formik: FormikProps<MatchFormData>, teamType: 'opponent' | 'team1' | 'team2') => {
    try {
      const response = await api.post('/api/teams/', {
        team_name: teamData.team_name,
        team_abbreviation: teamData.team_abbreviation,
        team_category: teamData.team_category,
        is_opponent_only: teamType === 'opponent'
      });
      
      const newTeam = response.data;
      setTeams(prevTeams => [...prevTeams, newTeam]);
      
      if (teamType === 'opponent') {
        formik.setFieldValue('opponent_team', newTeam.team_id.toString());
        formik.setFieldValue('is_new_opponent', false);
        setNewOpponentDialogOpen(false);
      } else if (teamType === 'team1') {
        formik.setFieldValue('team_1', newTeam.team_id.toString());
        formik.setFieldValue('team_1_new', false);
        setNewTeam1DialogOpen(false);
      } else if (teamType === 'team2') {
        formik.setFieldValue('team_2', newTeam.team_id.toString());
        formik.setFieldValue('team_2_new', false);
        setNewTeam2DialogOpen(false);
      }
      
      setConnectionAlert({ show: true, message: `Team ${newTeam.team_name} created successfully!`, severity: 'success' });
      
    } catch (error) {
      console.error('Error creating team:', error);
      setConnectionAlert({ show: true, message: 'Failed to create team. Please try again.', severity: 'error' });
    }
  };
  
  // Helper function to find team by ID (used by details and review steps)
  const getTeamName = (teamId: string | undefined): string => {
    if (!teamId) return 'N/A';
    // Ensure comparison is string vs string if team_id is number
    const team = teams.find(t => String(t.team_id) === teamId);
    return team ? team.team_name : 'Unknown Team';
  };

  // Match Details Step Component (potentially move to separate file later)
  const MatchDetailsStep = ({ formik, getTeamName }: { formik: FormikProps<MatchFormData>; getTeamName: (teamId: string | undefined) => string; }) => {
    const { values, errors, touched, handleChange, handleBlur, setFieldValue } = formik;
    const generateId = (name: string) => `match-upload-${name}`;

    const currentBlueTeamName = getTeamName(values.team_1);
    const currentRedTeamName = getTeamName(values.team_2);

    const blueLabel = (currentBlueTeamName && currentBlueTeamName !== 'N/A' && currentBlueTeamName !== 'Unknown Team') 
                       ? currentBlueTeamName : 'Blue Side Team';
    const redLabel = (currentRedTeamName && currentRedTeamName !== 'N/A' && currentRedTeamName !== 'Unknown Team') 
                      ? currentRedTeamName : 'Red Side Team';

    const handleOutcomeChange = (event: SelectChangeEvent<string>) => {
      const selectedValue = event.target.value;
      if (values.is_external_match) {
        // Ensure team IDs are strings for comparison/setting
        const blueTeamIdStr = values.team_1 ? String(values.team_1) : undefined;
        const redTeamIdStr = values.team_2 ? String(values.team_2) : undefined;
        setFieldValue('match_result', selectedValue);
        if (selectedValue === 'VICTORY' && blueTeamIdStr) {
          setFieldValue('_temp_winning_team_id', parseInt(blueTeamIdStr)); 
        } else if (selectedValue === 'DEFEAT' && redTeamIdStr) {
          setFieldValue('_temp_winning_team_id', parseInt(redTeamIdStr));
        } else {
          setFieldValue('_temp_winning_team_id', undefined);
        }
      } else {
        handleChange(event);
        setFieldValue('_temp_winning_team_id', undefined);
      }
    };

    const ADD_NEW_TEAM_OPTION_ID = "__add_new__";
    const externalTeamOptions = [
        { team_id: ADD_NEW_TEAM_OPTION_ID, team_name: "+ Add New Team", team_abbreviation: 'NEW', team_category: '' },
        ...teams
    ];
    const opponentOptions = [
        { team_id: ADD_NEW_TEAM_OPTION_ID, team_name: "+ Add New Opponent", team_abbreviation: 'NEW', team_category: '' },
        ...teams
    ];

    // Find selected objects ensuring string comparison for IDs
    const selectedBlueObject = teams.find(team => String(team.team_id) === values.team_1) || null;
    const selectedRedObject = teams.find(team => String(team.team_id) === values.team_2) || null;
    const selectedOpponentObject = teams.find(team => String(team.team_id) === values.opponent_team) || null;
    const selectedOurTeamObject = managedTeams.find(team => String(team.team_id) === values.our_team) || null;

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Match Details</Typography>

        {/* Match Type Toggle */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={values.is_external_match}
                onChange={(e) => { setFieldValue('is_external_match', e.target.checked); /* Resetting handled by RosterManager */ }}
                name="is_external_match"
                color="primary"
              />
            }
            label={values.is_external_match ? "External Match (between other teams)" : "Our Team's Match"}
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {values.is_external_match ? "Track a match between two external teams" : "Record a match where your team participated"}
          </Typography>
        </Paper>

        {/* Date, Time and Duration */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Date & Duration</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                name="match_datetime"
                label="Match Date and Time"
                id={generateId("match_datetime")}
                type="datetime-local"
                value={values.match_datetime}
                onChange={handleChange}
                onBlur={handleBlur}
                fullWidth
                InputLabelProps={{ shrink: true }}
                error={touched.match_datetime && Boolean(errors.match_datetime)}
                helperText={touched.match_datetime && errors.match_datetime}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Match Duration</Typography>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={3}>
                  <TextField
                    name="match_duration_hours"
                    label="HH"
                    id={generateId("match_duration_hours")}
                    type="number"
                    InputProps={{ inputProps: { min: 0 } }}
                    value={values.match_duration_hours}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                    error={touched.match_duration_hours && Boolean(errors.match_duration_hours)}
                    helperText={touched.match_duration_hours && errors.match_duration_hours}
                  />
                </Grid>
                <Grid item xs="auto"><Typography variant="h6">:</Typography></Grid>
                <Grid item xs={3}>
                  <TextField
                    name="match_duration_minutes"
                    label="MM"
                    id={generateId("match_duration_minutes")}
                    type="number"
                    InputProps={{ inputProps: { min: 0, max: 59 } }}
                    value={values.match_duration_minutes}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                    error={touched.match_duration_minutes && Boolean(errors.match_duration_minutes)}
                    helperText={touched.match_duration_minutes && errors.match_duration_minutes}
                  />
                </Grid>
                <Grid item xs="auto"><Typography variant="h6">:</Typography></Grid>
                <Grid item xs={3}>
                  <TextField
                    name="match_duration_seconds"
                    label="SS"
                    id={generateId("match_duration_seconds")}
                    type="number"
                    InputProps={{ inputProps: { min: 0, max: 59 } }}
                    value={values.match_duration_seconds}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                    error={touched.match_duration_seconds && Boolean(errors.match_duration_seconds)}
                    helperText={touched.match_duration_seconds && errors.match_duration_seconds}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Paper>

        {/* Team Selection */}
        {values.is_external_match ? (
          <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>External Match Teams</Typography>
            <Grid container spacing={2}>
              {/* Blue Side Team (Using Autocomplete) */}
              <Grid item xs={12} md={6}>
                 {values.team_1_new ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}> <Button variant="outlined" onClick={() => setNewTeam1DialogOpen(true)} fullWidth> Enter New Blue Side Team Details </Button> <Button variant="text" size="small" onClick={() => setFieldValue('team_1_new', false)} sx={{ ml: 1}}> Cancel </Button> </Box>
                 ) : (
                    <Autocomplete
                        id={generateId("team_1-autocomplete")}
                        options={externalTeamOptions} 
                        getOptionLabel={(option) => option.team_name}
                        value={selectedBlueObject} 
                        isOptionEqualToValue={(option, value) => option.team_id === value.team_id}
                        onChange={(event, newValue) => {
                            if (newValue && newValue.team_id === ADD_NEW_TEAM_OPTION_ID) { setFieldValue('team_1_new', true); setFieldValue('team_1', ''); setNewTeam1DialogOpen(true); }
                            else { setFieldValue('team_1_new', false); setFieldValue('team_1', newValue ? String(newValue.team_id) : ''); }
                        }}
                        onBlur={handleBlur}
                        renderInput={(params) => (
                            <TextField {...params} name="team_1" label="Blue Side Team" variant="outlined" fullWidth error={touched.team_1 && Boolean(errors.team_1)} helperText={touched.team_1 && errors.team_1} sx={{ mb: 2 }} />
                        )}
                    />
                 )}
                  <NewTeamDialog open={newTeam1DialogOpen} onClose={() => { setNewTeam1DialogOpen(false); setFieldValue('team_1_new', false); }} onSave={(teamData) => handleAddNewTeam(teamData, formik, 'team1')} dialogTitle="Add New Blue Side Team" initialData={{ team_name: values.team_1_name, team_abbreviation: values.team_1_abbreviation, team_category: values.team_1_category }} />
              </Grid>
              {/* Red Side Team (Using Autocomplete) */}
              <Grid item xs={12} md={6}>
                {values.team_2_new ? (
                     <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}> <Button variant="outlined" onClick={() => setNewTeam2DialogOpen(true)} fullWidth> Enter New Red Side Team Details </Button> <Button variant="text" size="small" onClick={() => setFieldValue('team_2_new', false)} sx={{ ml: 1}}> Cancel </Button> </Box>
                ) : (
                    <Autocomplete
                        id={generateId("team_2-autocomplete")}
                        options={externalTeamOptions} 
                        getOptionLabel={(option) => option.team_name}
                        value={selectedRedObject} 
                        isOptionEqualToValue={(option, value) => option.team_id === value.team_id}
                        onChange={(event, newValue) => {
                            if (newValue && newValue.team_id === ADD_NEW_TEAM_OPTION_ID) { setFieldValue('team_2_new', true); setFieldValue('team_2', ''); setNewTeam2DialogOpen(true); }
                            else { setFieldValue('team_2_new', false); setFieldValue('team_2', newValue ? String(newValue.team_id) : ''); }
                        }}
                        onBlur={handleBlur} 
                        renderInput={(params) => (
                            <TextField {...params} name="team_2" label="Red Side Team" variant="outlined" fullWidth error={touched.team_2 && Boolean(errors.team_2)} helperText={touched.team_2 && errors.team_2} sx={{ mb: 2 }} />
                        )}
                    />
                )}
                  <NewTeamDialog open={newTeam2DialogOpen} onClose={() => { setNewTeam2DialogOpen(false); setFieldValue('team_2_new', false); }} onSave={(teamData) => handleAddNewTeam(teamData, formik, 'team2')} dialogTitle="Add New Red Side Team" initialData={{ team_name: values.team_2_name, team_abbreviation: values.team_2_abbreviation, team_category: values.team_2_category }} />
              </Grid>
            </Grid>
          </Paper>
        ) : (
          <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Teams & Side</Typography>
            <Grid container spacing={2}>
                {/* Our Team Selection */}
                <Grid item xs={12} md={6}>
                    <Autocomplete
                      id={generateId('our-team')}
                      options={managedTeams}
                      getOptionLabel={(option) => `${option.team_name} (${option.team_abbreviation})`}
                      value={selectedOurTeamObject} // Use derived object
                      onChange={(_, newValue) => { formik.setFieldValue('our_team', newValue ? String(newValue.team_id) : ''); }}
                      onBlur={() => formik.setFieldTouched('our_team', true)}
                      renderInput={(params) => ( <TextField {...params} label="Our Team *" fullWidth error={formik.touched.our_team && Boolean(formik.errors.our_team)} helperText={formik.touched.our_team && formik.errors.our_team} name="our_team" sx={{ mb: 2 }} /> )}
                    />
                </Grid>
                {/* Opponent Team Selection (Using Autocomplete) */}
                <Grid item xs={12} md={6}>
                     {values.is_new_opponent ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}> <Button variant="outlined" onClick={() => setNewOpponentDialogOpen(true)} fullWidth > Enter New Opponent Details </Button> <Button variant="text" size="small" onClick={() => { setFieldValue('is_new_opponent', false); setFieldValue('opponent_team_name', ''); setFieldValue('opponent_team_abbreviation', ''); setFieldValue('opponent_category', ''); }} sx={{ ml: 1}} > Cancel </Button> </Box>
                     ) : (
                        <Autocomplete
                            id={generateId("opponent_team-autocomplete")}
                            options={opponentOptions}
                            getOptionLabel={(option) => option.team_name}
                            value={selectedOpponentObject} // Use derived object
                            isOptionEqualToValue={(option, value) => option.team_id === value.team_id}
                            onChange={(event, newValue) => {
                                if (newValue && newValue.team_id === ADD_NEW_TEAM_OPTION_ID) { setFieldValue('is_new_opponent', true); setFieldValue('opponent_team', ''); setNewOpponentDialogOpen(true); }
                                else { setFieldValue('is_new_opponent', false); setFieldValue('opponent_team', newValue ? String(newValue.team_id) : ''); }
                            }}
                            onBlur={handleBlur} 
                            renderInput={(params) => ( <TextField {...params} name="opponent_team" label="Opponent Team" variant="outlined" fullWidth error={touched.opponent_team && Boolean(errors.opponent_team)} helperText={touched.opponent_team && errors.opponent_team} sx={{ mb: 2 }} /> )}
                        />
                     )}
                    <NewTeamDialog open={newOpponentDialogOpen} onClose={() => { setNewOpponentDialogOpen(false); setFieldValue('is_new_opponent', false); }} onSave={(teamData) => handleAddNewTeam(teamData, formik, 'opponent')} dialogTitle="Add New Opponent Team" initialData={{ team_name: values.opponent_team_name, team_abbreviation: values.opponent_team_abbreviation, team_category: values.opponent_category }} />
                </Grid>
                {/* Team Side Selection (Only for non-external) */}
                <Grid item xs={12}>
                   <FormControl component="fieldset" error={touched.team_side && Boolean(errors.team_side)} sx={{ mb: 2 }}>
                        <Typography component="legend">Our Team Side</Typography>
                        <RadioGroup row aria-label="team-side" name="team_side" value={values.team_side} onChange={handleChange} >
                            <MuiFormControlLabel value="BLUE" control={<Radio />} label="Blue Side" />
                            <MuiFormControlLabel value="RED" control={<Radio />} label="Red Side" />
                        </RadioGroup>
                         {touched.team_side && errors.team_side && <Typography color="error" variant="caption">{errors.team_side}</Typography>}
                    </FormControl>
                </Grid>
            </Grid>
          </Paper>
        )}

        {/* Outcome, Type, Game Number, Notes */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Match Configuration & Outcome</Typography>
          <Grid container spacing={2}>
              {/* Scrim Type */}
              <Grid item xs={12} md={4}>
                  <FormControl fullWidth error={touched.scrim_type && Boolean(errors.scrim_type)}>
                    <InputLabel id={generateId("scrim_type-label")}>Scrim Type</InputLabel>
                    <Select
                      name="scrim_type"
                      labelId={generateId("scrim_type-label")}
                      id={generateId("scrim_type")}
                      value={values.scrim_type}
                      label="Scrim Type"
                      onChange={handleChange}
                    >
                      <MenuItem value="SCRIMMAGE">Scrimmage</MenuItem>
                      <MenuItem value="TOURNAMENT">Tournament</MenuItem>
                      <MenuItem value="RANKED">Ranked</MenuItem>
                    </Select>
                    {touched.scrim_type && errors.scrim_type && (
                      <Typography color="error" variant="caption">{errors.scrim_type}</Typography>
                    )}
                  </FormControl>
              </Grid>
              {/* Game Number */}
              <Grid item xs={12} md={4}>
                   <TextField
                       name="game_number"
                       label="Game Number"
                       id={generateId("game_number")}
                       type="number"
                       value={values.game_number}
                       onChange={handleChange}
                       fullWidth
                       InputProps={{ inputProps: { min: 1 } }}
                       error={touched.game_number && Boolean(errors.game_number)}
                       helperText={touched.game_number && errors.game_number}
                   />
              </Grid>
              {/* Match Outcome */}
              <Grid item xs={12} md={4}>
                  <FormControl fullWidth error={touched.match_result && Boolean(errors.match_result)} sx={{ mb: 2 }}>
                    <InputLabel id={generateId("match_result-label")}>Match Outcome / Winner</InputLabel>
                    <Select
                      labelId={generateId("match_result-label")}
                      id={generateId("match_result")}
                      name="match_result"
                      value={values.match_result}
                      label="Match Outcome / Winner"
                      onChange={handleOutcomeChange} // Use custom handler
                    >
                      {/* Add outcome options based on external/internal match */}
                    </Select>
                    {touched.match_result && errors.match_result && <Typography color="error" variant="caption">{errors.match_result}</Typography>}
                  </FormControl>
              </Grid>
              {/* General Notes */}
              <Grid item xs={12}>
                  <TextField
                      name="general_notes"
                      label="General Notes"
                      id={generateId("general_notes")}
                      multiline
                      rows={4}
                      value={values.general_notes}
                      onChange={handleChange}
                      fullWidth
                      error={touched.general_notes && Boolean(errors.general_notes)}
                      helperText={touched.general_notes && errors.general_notes}
                  />
              </Grid>
          </Grid>
        </Paper>
      </Box>
    );
  };

  // Helper function to get ID (ensure it handles potential string/number IDs)
  const getId = (value: any): number | undefined => {
    if (typeof value === 'object' && value !== null && (value.id || value.team_id || value.player_id || value.scrim_group_id)) {
      const id = value.id || value.team_id || value.player_id || value.scrim_group_id;
      return parseInt(String(id), 10);
    } else if (value && !isNaN(parseInt(String(value), 10))) {
      return parseInt(String(value), 10);
    }
    return undefined;
  };

  // handleSubmit function - Using _id suffixes based on linter feedback
  const handleSubmit = async (values: MatchFormData) => {
    setIsSubmitting(true);
    setConnectionAlert({ show: false, message: '', severity: 'info' });

    const getHeroId = (value: any): number | undefined => {
      if (typeof value === 'object' && value !== null && value.hero_id) return value.hero_id;
      const id = parseInt(value, 10);
      return isNaN(id) ? undefined : id;
    };

    const durationString = formatDuration(values.match_duration_hours, values.match_duration_minutes, values.match_duration_seconds);

    let matchData: { [key: string]: any } = {
      match_date: new Date(values.match_datetime).toISOString(),
      scrim_type: values.scrim_type,
      game_number: values.game_number,
      match_duration: durationString,
      general_notes: values.general_notes || null,
      mvp: getId(values.mvp_player_id) ?? null,
      mvp_loss: getId(values.mvp_loss_player_id) ?? null,
    };

    // Determine blue/red/our/winning based on form state
    let blueTeamIdSubmit: number | null = null;
    let redTeamIdSubmit: number | null = null;
    let ourTeamIdSubmit: number | null = null;
    let winningTeamIdSubmit: number | null = null;

    if (values.is_external_match) {
        blueTeamIdSubmit = getId(values.team_1) ?? null;
        redTeamIdSubmit = getId(values.team_2) ?? null;
        winningTeamIdSubmit = getId(values._temp_winning_team_id) ?? null;
    } else {
        const ourTeamIdSelected = getId(values.our_team);
        const opponentTeamIdSelected = getId(values.opponent_team);
        ourTeamIdSubmit = ourTeamIdSelected ?? null;

        if (values.team_side === 'BLUE') {
            blueTeamIdSubmit = ourTeamIdSelected ?? null;
            redTeamIdSubmit = opponentTeamIdSelected ?? null;
        } else {
            blueTeamIdSubmit = opponentTeamIdSelected ?? null;
            redTeamIdSubmit = ourTeamIdSelected ?? null;
        }
        winningTeamIdSubmit = (values.match_result === 'VICTORY') ? ourTeamIdSelected : opponentTeamIdSelected;
        winningTeamIdSubmit = winningTeamIdSubmit ?? null;
    }

        matchData = {
            ...matchData,
       blue_side_team: blueTeamIdSubmit,
       red_side_team: redTeamIdSubmit,
       our_team: ourTeamIdSubmit,
       winning_team: winningTeamIdSubmit,
    };

    console.log("Prepared match data for API:", matchData);

    try {
      const matchResponse = await api.post<Match>('/api/matches/', matchData); 
      const createdMatch = matchResponse.data;
      const matchId = createdMatch.match_id;
      console.log("Match created:", createdMatch);
      setConnectionAlert({ show: true, message: `Match (ID: ${matchId}) created successfully.`, severity: 'success' });

      // Combine player stats ensuring correct team ID association
      const allPlayerStats = [
          ...values.team_players.map(p => ({ ...p, is_blue_side: true })),
          ...values.enemy_players.map(p => ({ ...p, is_blue_side: false }))
      ];

      const playerStatPromises = allPlayerStats.map(async (stat) => {
        const playerId = getId(stat.player_id);
        const heroId = getHeroId(stat.hero_played);
        const teamId = stat.is_blue_side ? createdMatch.blue_side_team : createdMatch.red_side_team;

        if (!playerId || !heroId || !teamId) { console.warn("Skipping player stat due to missing ID:", stat); return null; }
        
        const playerStatData: { [key: string]: any } = {
          match: matchId,
          player: playerId,
          team: teamId,
          role_played: stat.role_played || null,
          hero_played: heroId,
          kills: stat.kills ?? 0,
          deaths: stat.deaths ?? 0,
          assists: stat.assists ?? 0,
          damage_dealt: stat.damage_dealt ?? null,
          damage_taken: stat.damage_taken ?? null,
          turret_damage: stat.turret_damage ?? null,
          gold_earned: stat.gold_earned ?? null,
          player_notes: stat.player_notes || null,
        };
        console.log("Submitting player stat:", playerStatData);
        return api.post<PlayerMatchStat>('/api/player-stats/', playerStatData); 
      });

      const statResults = await Promise.all(playerStatPromises);
      console.log("Player stat submission results:", statResults);

      navigate('/matches'); 
    } catch (err: any) {
      console.error("Error submitting match:", err);
      let apiError = 'Failed to submit match data.';
      if (err.response && err.response.data) {
        const errors = err.response.data;
        if (typeof errors === 'object') {
          apiError = Object.entries(errors).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ');
        } else if (typeof errors === 'string') { apiError = errors; }
      }
      setConnectionAlert({ show: true, message: `Submission failed: ${apiError}`, severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle MVP selection for team players
  const handleMvpChange = (formik: FormikProps<MatchFormData>, playerId: number | undefined, isMvp: boolean) => {
    formik.setFieldValue('mvp_player_id', isMvp ? playerId : undefined);
    if (isMvp) formik.setFieldValue('mvp_loss_player_id', undefined);
  };
  
  // Handle MVP Loss selection for enemy players
  const handleMvpLossChange = (formik: FormikProps<MatchFormData>, playerId: number | undefined, isMvpLoss: boolean) => {
    formik.setFieldValue('mvp_loss_player_id', isMvpLoss ? playerId : undefined);
    if (isMvpLoss) formik.setFieldValue('mvp_player_id', undefined);
  };

  // Function to render different steps
  const renderStepContent = (step: number, formikProps: FormikProps<MatchFormData>) => {
    const { values, errors, touched, handleChange, handleBlur, setFieldValue } = formikProps;
    
    switch (step) {
      case 0:
        return <MatchDetailsStep formik={formikProps} getTeamName={getTeamName} />;
      case 1:
        return <DraftForm data={values.draft} onChange={(draft) => setFieldValue('draft', draft)} onNext={handleNext} onBack={handleBack} />;
      case 2: // Player Stats step
        let blueTeamLabel = "Blue Side";
        let redTeamLabel = "Red Side";
        if (values.is_external_match) {
          const blueTeamName = getTeamName(values.team_1); const redTeamName = getTeamName(values.team_2);
          if (blueTeamName && blueTeamName !== 'Unknown Team' && blueTeamName !== 'N/A') blueTeamLabel = blueTeamName;
          if (redTeamName && redTeamName !== 'Unknown Team' && redTeamName !== 'N/A') redTeamLabel = redTeamName;
        } else {
          const ourTeamName = getTeamName(values.our_team); const opponentTeamName = getTeamName(values.opponent_team);
          if (values.team_side === 'BLUE') {
            if (ourTeamName && ourTeamName !== 'Unknown Team' && ourTeamName !== 'N/A') blueTeamLabel = ourTeamName;
            if (opponentTeamName && opponentTeamName !== 'Unknown Team' && opponentTeamName !== 'N/A') redTeamLabel = opponentTeamName; else redTeamLabel = "Opponent";
          } else if (values.team_side === 'RED') {
            if (opponentTeamName && opponentTeamName !== 'Unknown Team' && opponentTeamName !== 'N/A') blueTeamLabel = opponentTeamName; else blueTeamLabel = "Opponent";
            if (ourTeamName && ourTeamName !== 'Unknown Team' && ourTeamName !== 'N/A') redTeamLabel = ourTeamName;
          }
        }
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Player Stats (Box Score)</Typography>
            <BoxScoreInput 
              formik={formikProps}
              team1PlayersData={values.team_players}
              team2PlayersData={values.enemy_players}
              availableHeroes={availableHeroes} 
              team1Label={blueTeamLabel} 
              team2Label={redTeamLabel} 
            />
          </Box>
        );
      case 3: // File Uploads
        return <FileUploader onChange={(files) => formikProps.setFieldValue('files', files)} />;
      case 4: // Review
        return <ReviewStep formik={formikProps} teams={teams} onBack={handleBack} onSubmit={() => handleSubmit(formikProps.values)} navigateToStep={setActiveStep} />;
      default: return null;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Formik<MatchFormData>
        initialValues={initialMatchValues}
        validationSchema={matchValidationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {(formikProps: FormikProps<MatchFormData>) => (
          <form onSubmit={formikProps.handleSubmit}>
            <RosterManager teams={teams} />

            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => ( <Step key={label}><StepLabel>{label}</StepLabel> </Step> ))}
            </Stepper>
            <div>
              {renderStepContent(activeStep, formikProps)} 
            </div>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>Back</Button>
              <Box>
                {activeStep === steps.length - 1 ? (
                  null // No submit button needed here anymore
                ) : (
                  <Button variant="contained" color="primary" onClick={handleNext}>Next</Button>
                )}
              </Box>
            </Box>
          </form>
        )}
      </Formik>
      <Snackbar open={connectionAlert.show} autoHideDuration={6000} onClose={() => setConnectionAlert({...connectionAlert, show: false})}>
        <Alert onClose={() => setConnectionAlert({...connectionAlert, show: false})} severity={connectionAlert.severity} sx={{ width: '100%' }}>
          {connectionAlert.message}
        </Alert>
      </Snackbar>
       <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
         <AuthStatus />
       </Box>
    </Box>
  );
};

// ReviewStep Component (potentially move to separate file later)
const ReviewStep: React.FC<{ 
    formik: FormikProps<MatchFormData>; 
    teams: Team[];
    onBack: () => void; 
    onSubmit: () => void;
    navigateToStep: (step: number) => void;
}> = ({ formik, teams: reviewTeams, onBack, onSubmit, navigateToStep }) => {
  const { values } = formik;
  
  const getTeamName = (teamId: string | undefined): string => {
    if (!teamId) return 'N/A';
    const team = reviewTeams.find(t => String(t.team_id) === teamId);
    return team ? team.team_name : 'Unknown Team';
  };

  const getTeamNames = (): { team1Label: string, team1Value: string, team2Label: string, team2Value: string } => {
    if (values.is_external_match) {
      return {
        team1Label: 'Blue Side Team',
        team1Value: getTeamName(values.team_1) + (values.team_1_new ? ' (New)' : ''),
        team2Label: 'Red Side Team',
        team2Value: getTeamName(values.team_2) + (values.team_2_new ? ' (New)' : ''),
      };
    } else {
      return {
        team1Label: 'Our Team',
        team1Value: getTeamName(values.our_team),
        team2Label: 'Opponent Team',
        team2Value: getTeamName(values.opponent_team) + (values.is_new_opponent ? ' (New)' : ''),
      };
    }
  };
  
  const teamInfo = getTeamNames();
  const formatDate = (dateString: string): string => { const date = new Date(dateString); return date.toLocaleDateString(); };
  const formatTime = (timeString: string): string => { const time = new Date(timeString); return time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
  const renderHero = (hero: any): string => { return typeof hero === 'string' ? hero : (hero?.name || 'Unknown Hero'); };

  const getOutcomeText = () => {
    if (values.is_external_match) {
      const winnerId = values._temp_winning_team_id?.toString();
      const blueTeamName = getTeamName(values.team_1);
      const redTeamName = getTeamName(values.team_2);
      if (winnerId === values.team_1) return `${blueTeamName} Victory`;
      if (winnerId === values.team_2) return `${redTeamName} Victory`;
      return 'N/A';
    } else {
      return values.match_result === 'VICTORY' ? 'Victory' : 'Defeat';
    }
  };

  const formattedDuration = formatDuration(values.match_duration_hours, values.match_duration_minutes, values.match_duration_seconds);

  const allPlayers = [...values.team_players, ...values.enemy_players];
  const mvpPlayer = allPlayers.find(p => p.player_id === values.mvp_player_id);
  const mvpLossPlayer = allPlayers.find(p => p.player_id === values.mvp_loss_player_id);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Review Match Data</Typography>
      
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}> <Typography variant="subtitle1" fontWeight="bold">Match Details</Typography> <Button size="small" onClick={() => navigateToStep(0)}>Edit</Button> </Box>
        <Grid container spacing={2}>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Match Type</Typography> <Typography variant="body1">{values.is_external_match ? 'External Match' : 'Our Team\'s Match'}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Date & Time</Typography> <Typography variant="body1">{formatDate(values.match_datetime)} at {formatTime(values.match_datetime)}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">{teamInfo.team1Label}</Typography> <Typography variant="body1">{teamInfo.team1Value}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">{teamInfo.team2Label}</Typography> <Typography variant="body1">{teamInfo.team2Value}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Match Outcome</Typography> <Typography variant="body1">{getOutcomeText()}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Scrim Type</Typography> <Typography variant="body1">{values.scrim_type}</Typography> </Grid>
            {!values.is_external_match && ( <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Team Side</Typography> <Typography variant="body1">{values.team_side}</Typography> </Grid> )}
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Game Number</Typography> <Typography variant="body1">{values.game_number}</Typography> </Grid>
            {formattedDuration && ( <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Match Duration</Typography> <Typography variant="body1">{formattedDuration}</Typography> </Grid> )}
             {mvpPlayer && <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">MVP</Typography> <Typography variant="body1">{mvpPlayer.ign || `Player ${mvpPlayer.player_id}`}</Typography> </Grid>}
            {mvpLossPlayer && <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">MVP (Loss)</Typography> <Typography variant="body1">{mvpLossPlayer.ign || `Player ${mvpLossPlayer.player_id}`}</Typography> </Grid>}
        </Grid>
      </Paper>
      
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}> <Typography variant="subtitle1" fontWeight="bold">Draft</Typography> <Button size="small" onClick={() => navigateToStep(1)}>Edit</Button> </Box>
        <Typography variant="body2" color="text.secondary">Format</Typography> <Typography variant="body1">{values.draft.format === '6_BANS' ? '6 Bans (3 per team)' : '10 Bans (5 per team)'}</Typography>
        <Box sx={{ mt: 2 }}> <Typography variant="body2" color="text.secondary">Blue Side Bans</Typography> <Typography variant="body1">{values.draft.blueSideBans.filter(Boolean).map(hero => hero?.name).join(', ') || 'None'}</Typography> </Box>
        <Box sx={{ mt: 2 }}> <Typography variant="body2" color="text.secondary">Red Side Bans</Typography> <Typography variant="body1">{values.draft.redSideBans.filter(Boolean).map(hero => hero?.name).join(', ') || 'None'}</Typography> </Box>
        <Box sx={{ mt: 2 }}> <Typography variant="body2" color="text.secondary">Blue Side Picks</Typography> <Typography variant="body1">{values.draft.blueSidePicks.filter(Boolean).map(hero => hero?.name).join(', ') || 'None'}</Typography> </Box>
        <Box sx={{ mt: 2 }}> <Typography variant="body2" color="text.secondary">Red Side Picks</Typography> <Typography variant="body1">{values.draft.redSidePicks.filter(Boolean).map(hero => hero?.name).join(', ') || 'None'}</Typography> </Box>
        {values.draft.notes && ( <Box sx={{ mt: 2 }}> <Typography variant="body2" color="text.secondary">Draft Notes</Typography> <Typography variant="body1">{values.draft.notes}</Typography> </Box> )}
      </Paper>
      
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}> <Typography variant="subtitle1" fontWeight="bold"> {teamInfo.team1Label} Players</Typography> <Button size="small" onClick={() => navigateToStep(2)}>Edit</Button> </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead> <tr style={{ borderBottom: '1px solid rgba(224, 224, 224, 1)' }}> <th style={{ padding: '8px', textAlign: 'left' }}>Player</th> <th style={{ padding: '8px', textAlign: 'left' }}>Hero</th> <th style={{ padding: '8px', textAlign: 'right' }}>KDA</th> <th style={{ padding: '8px', textAlign: 'right' }}>Damage</th> <th style={{ padding: '8px', textAlign: 'right' }}>DMG Tkn</th> <th style={{ padding: '8px', textAlign: 'right' }}>Turret</th> <th style={{ padding: '8px', textAlign: 'right' }}>Gold</th> </tr> </thead>
            <tbody>
              {values.team_players.map((player, idx) => (
                <tr key={`team1-${idx}`} style={{ borderBottom: '1px solid rgba(224, 224, 224, 0.5)' }}>
                  <td style={{ padding: '8px' }}>{player.ign || `Player ${idx + 1}`}</td>
                  <td style={{ padding: '8px' }}>{renderHero(player.hero_played)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.kills ?? 0}/{player.deaths ?? 0}/{player.assists ?? 0}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.damage_dealt ?? '-'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.damage_taken ?? '-'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.turret_damage ?? '-'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.gold_earned ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Paper>
      
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}> <Typography variant="subtitle1" fontWeight="bold"> {teamInfo.team2Label} Players</Typography> <Button size="small" onClick={() => navigateToStep(2)}>Edit</Button> </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
             <thead> <tr style={{ borderBottom: '1px solid rgba(224, 224, 224, 1)' }}> <th style={{ padding: '8px', textAlign: 'left' }}>Player</th> <th style={{ padding: '8px', textAlign: 'left' }}>Hero</th> <th style={{ padding: '8px', textAlign: 'right' }}>KDA</th> <th style={{ padding: '8px', textAlign: 'right' }}>Damage</th> <th style={{ padding: '8px', textAlign: 'right' }}>DMG Tkn</th> <th style={{ padding: '8px', textAlign: 'right' }}>Turret</th> <th style={{ padding: '8px', textAlign: 'right' }}>Gold</th> </tr> </thead>
            <tbody>
              {values.enemy_players.map((player, idx) => (
                 <tr key={`team2-${idx}`} style={{ borderBottom: '1px solid rgba(224, 224, 224, 0.5)' }}>
                  <td style={{ padding: '8px' }}>{player.ign || `Player ${idx + 1}`}</td>
                  <td style={{ padding: '8px' }}>{renderHero(player.hero_played)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.kills ?? 0}/{player.deaths ?? 0}/{player.assists ?? 0}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.damage_dealt ?? '-'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.damage_taken ?? '-'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.turret_damage ?? '-'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{player.gold_earned ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Paper>
      
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}> <Typography variant="subtitle1" fontWeight="bold">Uploaded Files</Typography> <Button size="small" onClick={() => navigateToStep(3)}>Edit</Button> </Box>
        <Typography variant="body1"> {values.files.length} file(s) to be uploaded </Typography>
        <Box sx={{ mt: 1 }}> {values.files.map((file, idx) => ( <Typography key={idx} variant="body2">{file.name}</Typography> ))} </Box>
      </Paper>
      
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>General Notes</Typography> <Typography variant="body1">{values.general_notes}</Typography>
        <Box sx={{ textAlign: 'right', mt: 1 }}> <Button size="small" onClick={() => navigateToStep(0)}>Edit Notes</Button> </Box>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" color="primary" onClick={onSubmit}> Submit Match </Button>
      </Box>
    </Box>
  );
};

// New Team Dialog Component (potentially move to separate file later)
interface NewTeamDialogProps { open: boolean; onClose: () => void; onSave: (team: Partial<Team>) => void; dialogTitle: string; initialData?: Partial<Team>; }
const NewTeamDialog: React.FC<NewTeamDialogProps> = ({ open, onClose, onSave, dialogTitle, initialData = {} }) => {
  const [teamData, setTeamData] = useState<Partial<Team>>({ team_name: initialData.team_name || '', team_abbreviation: initialData.team_abbreviation || '', team_category: initialData.team_category || '' });
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; if (name) setTeamData({ ...teamData, [name]: value }); };
  const handleSelectChange = (e: SelectChangeEvent<string>) => { const { name, value } = e.target; if (name) setTeamData({ ...teamData, [name]: value }); };

  useEffect(() => { // Sync with initialData if dialog reopens with different data
    setTeamData({ team_name: initialData.team_name || '', team_abbreviation: initialData.team_abbreviation || '', team_category: initialData.team_category || '' });
  }, [initialData]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <TextField name="team_name" label="Team Name" value={teamData.team_name} onChange={handleTextChange} fullWidth margin="normal" required />
        <TextField name="team_abbreviation" label="Team Abbreviation" value={teamData.team_abbreviation} onChange={handleTextChange} fullWidth margin="normal" required inputProps={{ maxLength: 10 }} helperText="Maximum 10 characters" />
        <FormControl fullWidth margin="normal" required> <InputLabel>Team Category</InputLabel> <Select name="team_category" value={teamData.team_category || ''} onChange={handleSelectChange}> <MenuItem value="COLLEGIATE">Collegiate</MenuItem> <MenuItem value="AMATEUR">Amateur</MenuItem> <MenuItem value="PRO">Professional</MenuItem> </Select> </FormControl>
      </DialogContent>
      <DialogActions> <Button onClick={onClose}>Cancel</Button> <Button onClick={() => onSave(teamData)} variant="contained" color="primary" disabled={!teamData.team_name || !teamData.team_abbreviation || !teamData.team_category} > Save Team </Button> </DialogActions>
    </Dialog>
  );
};

export default MatchUploadForm;