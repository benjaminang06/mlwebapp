import React from 'react';
import { FormikProps } from 'formik';
import { Box, Grid, TextField, Switch, FormControlLabel, Typography, Paper, FormControl, InputLabel, Select, MenuItem, RadioGroup, FormControlLabel as MuiFormControlLabel, Radio, Button, Autocomplete, SelectChangeEvent } from '@mui/material';
import { MatchFormData } from '../../types/match.types'; // Adjust path
import { Team } from '../../types/team.types'; // Adjust path
import NewTeamDialog from './NewTeamDialog'; // Import dialog
import { useForm } from '../../hooks';
import { ApiErrorAlert } from '../common';

interface MatchDetailsStepProps {
  formik: FormikProps<MatchFormData>;
  getTeamName: (teamId: string | undefined) => string;
  teams: Team[]; // All teams for opponent/external selectors
  managedTeams: Team[]; // Managed teams for 'Our Team' selector
  handleAddNewTeam: (teamData: Partial<Team>, teamType: 'opponent' | 'team1' | 'team2') => void;
  // Dialog state and setters
  newOpponentDialogOpen: boolean;
  setNewOpponentDialogOpen: (open: boolean) => void;
  newTeam1DialogOpen: boolean;
  setNewTeam1DialogOpen: (open: boolean) => void;
  newTeam2DialogOpen: boolean;
  setNewTeam2DialogOpen: (open: boolean) => void;
  // --- NEW: Props for draft choice --- 
  includeDraftInfo: boolean | null;
  setIncludeDraftInfo: (value: boolean) => void;
  // --- END NEW PROPS ---
}

const ADD_NEW_TEAM_OPTION_ID = "__add_new__";

const MatchDetailsStep: React.FC<MatchDetailsStepProps> = ({
  formik,
  getTeamName,
  teams,
  managedTeams,
  handleAddNewTeam,
  newOpponentDialogOpen,
  setNewOpponentDialogOpen,
  newTeam1DialogOpen,
  setNewTeam1DialogOpen,
  newTeam2DialogOpen,
  setNewTeam2DialogOpen,
  // --- NEW: Destructure props ---
  includeDraftInfo,
  setIncludeDraftInfo,
  // --- END NEW ---
}) => {
  const { values, errors, touched, handleChange, handleBlur, setFieldValue } = formik;
  const generateId = (name: string) => `match-details-${name}`; // Prefix ids

  const currentBlueTeamName = getTeamName(values.team_1);
  const currentRedTeamName = getTeamName(values.team_2);

  const blueLabel = (currentBlueTeamName && currentBlueTeamName !== 'N/A' && currentBlueTeamName !== 'Unknown Team')
    ? currentBlueTeamName : 'Blue Side Team';
  const redLabel = (currentRedTeamName && currentRedTeamName !== 'N/A' && currentRedTeamName !== 'Unknown Team')
    ? currentRedTeamName : 'Red Side Team';

  const handleOutcomeChange = (event: SelectChangeEvent<string>) => {
    const selectedValue = event.target.value;
    if (values.is_external_match) {
      const blueTeamIdStr = values.team_1 ? String(values.team_1) : undefined;
      const redTeamIdStr = values.team_2 ? String(values.team_2) : undefined;
      setFieldValue('match_result', selectedValue);
      if (selectedValue === 'VICTORY' && blueTeamIdStr) {
        setFieldValue('_temp_winning_team_id', parseInt(blueTeamIdStr, 10));
      } else if (selectedValue === 'DEFEAT' && redTeamIdStr) {
        setFieldValue('_temp_winning_team_id', parseInt(redTeamIdStr, 10));
      } else {
        setFieldValue('_temp_winning_team_id', undefined);
      }
    } else {
      handleChange(event);
      setFieldValue('_temp_winning_team_id', undefined);
    }
  };

  // --- Prepare Autocomplete Options --- 
  // Need to define a structure compatible with Autocomplete options AND your Team type
  // Ensure the ADD_NEW option has a unique ID and all necessary fields for getOptionLabel.
  const addNewOption = { team_id: ADD_NEW_TEAM_OPTION_ID, team_name: "+ Add New Team", team_abbreviation: 'NEW', team_category: '' };
  const addNewOpponentOption = { team_id: ADD_NEW_TEAM_OPTION_ID, team_name: "+ Add New Opponent", team_abbreviation: 'NEW', team_category: '' };

  // Type assertion might be needed if Autocomplete complains about the extra fields in Team vs. the addNewOption structure
  const externalTeamOptions = [addNewOption, ...teams] as (Team | typeof addNewOption)[];
  const opponentOptions = [addNewOpponentOption, ...teams] as (Team | typeof addNewOpponentOption)[];
  
  // Find selected objects ensuring string comparison for IDs
  const selectedBlueObject = teams.find(team => String(team.team_id) === values.team_1) || null;
  const selectedRedObject = teams.find(team => String(team.team_id) === values.team_2) || null;
  const selectedOpponentObject = teams.find(team => String(team.team_id) === values.opponent_team) || null;
  const selectedOurTeamObject = managedTeams.find(team => String(team.team_id) === values.our_team) || null;

  const outcomeMenuItems = [];
    if (!values.is_external_match) {
      outcomeMenuItems.push(<MenuItem key="victory" value="VICTORY">Victory</MenuItem>);
      outcomeMenuItems.push(<MenuItem key="defeat" value="DEFEAT">Defeat</MenuItem>);
    } else {
      outcomeMenuItems.push(<MenuItem key="blue_victory" value="VICTORY">{`${blueLabel} Victory`}</MenuItem>);
      // Updated value for red victory to align with logic
      outcomeMenuItems.push(<MenuItem key="red_victory" value="DEFEAT">{`${redLabel} Victory`}</MenuItem>); 
    }

  // Replace existing validation with useForm validation
  const { validateField, validateForm } = useForm({
    validationRules: {
      match_date: [
        { rule: 'required', message: 'Match date is required' },
      ],
      our_team: [
        { rule: 'required', message: 'Our team selection is required' },
      ],
      opponent_team: [
        { rule: 'required', message: 'Opponent team selection is required' },
        { 
          rule: 'custom', 
          validator: (value, formValues) => value !== formValues.our_team, 
          message: 'Opponent team cannot be the same as our team' 
        },
      ],
      scrim_type: [
        { rule: 'required', message: 'Match type is required' },
      ],
      game_number: [
        { rule: 'required', message: 'Game number is required' },
        { rule: 'number', message: 'Game number must be a valid number' },
        { 
          rule: 'custom', 
          validator: (value) => parseInt(value) > 0, 
          message: 'Game number must be greater than 0' 
        },
      ],
    }
  });

  // Custom handleNext function that validates form before proceeding
  const handleNext = () => {
    // Validate all fields
    const formErrors = validateForm({
      match_date: values.match_datetime,
      our_team: values.our_team,
      opponent_team: values.opponent_team,
      scrim_type: values.scrim_type,
      game_number: values.game_number
    });

    // If there are validation errors, update the errors state
    if (Object.keys(formErrors).length > 0) {
      // Update parent component's errors state
      Object.entries(formErrors).forEach(([field, message]) => {
        handleBlur({
          target: { name: field, value: values[field] || '' }
        } as React.FocusEvent<HTMLInputElement>);
      });
      return;
    }

    // Proceed if validation passes
    // Implement the logic to proceed to the next step
  };

  // Add validateOnBlur function
  const validateOnBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const errorMessage = validateField(name, value, values);
    
    // Call the original handleBlur with the validated result
    handleBlur({
      target: { name, value }
    } as React.FocusEvent<HTMLInputElement>, errorMessage);
  };

  return (
    <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Match Details</Typography>
        {/* Match Type Toggle */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
            <FormControlLabel
                control={<Switch checked={values.is_external_match} onChange={(e) => { setFieldValue('is_external_match', e.target.checked); /* Resetting handled by RosterManager */ }} name="is_external_match" color="primary" />}
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
              <TextField name="match_datetime" label="Match Date and Time" id={generateId("match_datetime")} type="datetime-local" value={values.match_datetime} onChange={handleChange} onBlur={handleBlur} fullWidth InputLabelProps={{ shrink: true }} error={touched.match_datetime && Boolean(errors.match_datetime)} helperText={touched.match_datetime && errors.match_datetime as string} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Match Duration</Typography>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={3}> <TextField name="match_duration_hours" label="HH" id={generateId("match_duration_hours")} type="number" InputProps={{ inputProps: { min: 0 } }} value={values.match_duration_hours} onChange={handleChange} onBlur={handleBlur} fullWidth size="small" error={touched.match_duration_hours && Boolean(errors.match_duration_hours)} helperText={touched.match_duration_hours && errors.match_duration_hours as string} /> </Grid>
                <Grid item xs="auto"><Typography variant="h6">:</Typography></Grid>
                <Grid item xs={3}> <TextField name="match_duration_minutes" label="MM" id={generateId("match_duration_minutes")} type="number" InputProps={{ inputProps: { min: 0, max: 59 } }} value={values.match_duration_minutes} onChange={handleChange} onBlur={handleBlur} fullWidth size="small" error={touched.match_duration_minutes && Boolean(errors.match_duration_minutes)} helperText={touched.match_duration_minutes && errors.match_duration_minutes as string} /> </Grid>
                <Grid item xs="auto"><Typography variant="h6">:</Typography></Grid>
                <Grid item xs={3}> <TextField name="match_duration_seconds" label="SS" id={generateId("match_duration_seconds")} type="number" InputProps={{ inputProps: { min: 0, max: 59 } }} value={values.match_duration_seconds} onChange={handleChange} onBlur={handleBlur} fullWidth size="small" error={touched.match_duration_seconds && Boolean(errors.match_duration_seconds)} helperText={touched.match_duration_seconds && errors.match_duration_seconds as string} /> </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Paper>

        {/* Team Selection */}
        {values.is_external_match ? (
          <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>External Match Teams</Typography>
            <Grid container spacing={2}>
              {/* Blue Side Team */}
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
                            <TextField {...params} name="team_1" label="Blue Side Team" variant="outlined" fullWidth error={touched.team_1 && Boolean(errors.team_1)} helperText={touched.team_1 && errors.team_1 as string} sx={{ mb: 2 }} />
                        )}
                    />
                 )}
                  <NewTeamDialog open={newTeam1DialogOpen} onClose={() => { setNewTeam1DialogOpen(false); setFieldValue('team_1_new', false); }} onSave={(teamData) => handleAddNewTeam(teamData, 'team1')} dialogTitle="Add New Blue Side Team" initialData={{ team_name: values.team_1_name, team_abbreviation: values.team_1_abbreviation, team_category: values.team_1_category }} />
              </Grid>
              {/* Red Side Team */}
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
                            <TextField {...params} name="team_2" label="Red Side Team" variant="outlined" fullWidth error={touched.team_2 && Boolean(errors.team_2)} helperText={touched.team_2 && errors.team_2 as string} sx={{ mb: 2 }} />
                        )}
                    />
                )}
                  <NewTeamDialog open={newTeam2DialogOpen} onClose={() => { setNewTeam2DialogOpen(false); setFieldValue('team_2_new', false); }} onSave={(teamData) => handleAddNewTeam(teamData, 'team2')} dialogTitle="Add New Red Side Team" initialData={{ team_name: values.team_2_name, team_abbreviation: values.team_2_abbreviation, team_category: values.team_2_category }} />
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
                      value={selectedOurTeamObject}
                      isOptionEqualToValue={(option, value) => option.team_id === value.team_id}
                      onChange={(_, newValue) => { formik.setFieldValue('our_team', newValue ? String(newValue.team_id) : ''); }}
                      onBlur={() => formik.setFieldTouched('our_team', true)}
                      renderInput={(params) => ( <TextField {...params} label="Our Team *" fullWidth error={formik.touched.our_team && Boolean(formik.errors.our_team)} helperText={formik.touched.our_team && formik.errors.our_team as string} name="our_team" sx={{ mb: 2 }} /> )}
                    />
                </Grid>
                {/* Opponent Team Selection */}
                <Grid item xs={12} md={6}>
                     {values.is_new_opponent ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}> <Button variant="outlined" onClick={() => setNewOpponentDialogOpen(true)} fullWidth > Enter New Opponent Details </Button> <Button variant="text" size="small" onClick={() => { setFieldValue('is_new_opponent', false); setFieldValue('opponent_team_name', ''); setFieldValue('opponent_team_abbreviation', ''); setFieldValue('opponent_category', ''); }} sx={{ ml: 1}} > Cancel </Button> </Box>
                     ) : (
                        <Autocomplete
                            id={generateId("opponent_team-autocomplete")}
                            options={opponentOptions}
                            getOptionLabel={(option) => option.team_name}
                            value={selectedOpponentObject}
                            isOptionEqualToValue={(option, value) => option.team_id === value.team_id}
                            onChange={(event, newValue) => {
                                if (newValue && newValue.team_id === ADD_NEW_TEAM_OPTION_ID) { setFieldValue('is_new_opponent', true); setFieldValue('opponent_team', ''); setNewOpponentDialogOpen(true); }
                                else { setFieldValue('is_new_opponent', false); setFieldValue('opponent_team', newValue ? String(newValue.team_id) : ''); }
                            }}
                            onBlur={handleBlur}
                            renderInput={(params) => ( <TextField {...params} name="opponent_team" label="Opponent Team" variant="outlined" fullWidth error={touched.opponent_team && Boolean(errors.opponent_team)} helperText={touched.opponent_team && errors.opponent_team as string} sx={{ mb: 2 }} /> )}
                        />
                     )}
                    <NewTeamDialog open={newOpponentDialogOpen} onClose={() => { setNewOpponentDialogOpen(false); setFieldValue('is_new_opponent', false); }} onSave={(teamData) => handleAddNewTeam(teamData, 'opponent')} dialogTitle="Add New Opponent Team" initialData={{ team_name: values.opponent_team_name, team_abbreviation: values.opponent_team_abbreviation, team_category: values.opponent_category }} />
                </Grid>
                {/* Team Side Selection */}
                <Grid item xs={12}>
                   <FormControl component="fieldset" error={touched.team_side && Boolean(errors.team_side)} sx={{ mb: 2 }}>
                        <Typography component="legend">Our Team Side</Typography>
                        <RadioGroup row aria-label="team-side" name="team_side" value={values.team_side} onChange={handleChange} >
                            <MuiFormControlLabel value="BLUE" control={<Radio />} label="Blue Side" />
                            <MuiFormControlLabel value="RED" control={<Radio />} label="Red Side" />
                        </RadioGroup>
                         {touched.team_side && errors.team_side && <Typography color="error" variant="caption">{errors.team_side as string}</Typography>}
                    </FormControl>
                </Grid>
            </Grid>
          </Paper>
        )}

        {/* Outcome, Type, Game Number, Notes */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Match Configuration & Outcome</Typography>
          <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={touched.scrim_type && Boolean(errors.scrim_type)}>
                    <InputLabel id={generateId("scrim_type-label")}>Scrim Type</InputLabel>
                    <Select name="scrim_type" labelId={generateId("scrim_type-label")} id={generateId("scrim_type")} value={values.scrim_type} label="Scrim Type" onChange={handleChange} >
                      <MenuItem value="SCRIMMAGE">Scrimmage</MenuItem> <MenuItem value="TOURNAMENT">Tournament</MenuItem> <MenuItem value="RANKED">Ranked</MenuItem>
                    </Select>
                    {touched.scrim_type && errors.scrim_type && ( <Typography color="error" variant="caption">{errors.scrim_type as string}</Typography> )}
                  </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={touched.match_result && Boolean(errors.match_result)} sx={{ mb: 2 }}>
                    <InputLabel id={generateId("match_result-label")}>Match Outcome / Winner</InputLabel>
                    <Select labelId={generateId("match_result-label")} id={generateId("match_result")} name="match_result" value={values.match_result} label="Match Outcome / Winner" onChange={handleOutcomeChange} >
                      {outcomeMenuItems}
                    </Select>
                    {touched.match_result && errors.match_result && <Typography color="error" variant="caption">{errors.match_result as string}</Typography>}
                  </FormControl>
                  {/* Hidden game number field - no longer displayed to users but kept in form data */}
                  <input type="hidden" name="game_number" value={values.game_number} />
                  <Typography variant="caption" color="text.secondary" display="block">
                    Game numbers are automatically calculated based on existing matches between these teams in the same 8-hour window.
                  </Typography>
              </Grid>
              <Grid item xs={12}>
                  <TextField name="general_notes" label="General Notes" id={generateId("general_notes")} multiline rows={4} value={values.general_notes} onChange={handleChange} fullWidth error={touched.general_notes && Boolean(errors.general_notes)} helperText={touched.general_notes && errors.general_notes as string} />
              </Grid>
          </Grid>
        </Paper>

        {/* --- NEW: Draft Choice Section --- */} 
        <Paper elevation={2} sx={{ p: 2, mt: 3, border: includeDraftInfo === null ? '1px solid red' : undefined }}>
          <Typography variant="subtitle1" gutterBottom>
            Draft Information
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Do you want to include detailed draft information (bans and pick order) for the next step?
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button 
              variant={includeDraftInfo === true ? "contained" : "outlined"}
              color="primary" 
              onClick={() => setIncludeDraftInfo(true)}
            >
              Yes, Include Draft
            </Button>
            <Button 
              variant={includeDraftInfo === false ? "contained" : "outlined"}
              color="secondary" 
              onClick={() => setIncludeDraftInfo(false)}
            >
              No, Basic Stats Only
            </Button>
          </Box>
          {includeDraftInfo === null && (
            <Typography color="error" variant="caption" display="block" sx={{ textAlign: 'center', mt: 1 }}>
              Please make a selection to proceed.
            </Typography>
          )}
        </Paper>
        {/* --- END NEW SECTION --- */}

        {/* Add ApiErrorAlert at the top if there are API errors */}
        {errors.apiError && (
          <ApiErrorAlert error={errors.apiError} />
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handleNext}
          >
            Next
          </Button>
        </Box>
    </Box>
  );
};

export default MatchDetailsStep; 