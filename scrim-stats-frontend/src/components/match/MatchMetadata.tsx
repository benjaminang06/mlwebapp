import React, { useState, useEffect } from 'react';
import { Box, TextField, FormControl, InputLabel, Select, MenuItem, Typography, Button, SelectChangeEvent, Grid, FormControlLabel, Checkbox, FormHelperText } from '@mui/material';
import { FormikProps, useFormikContext } from 'formik';
import ScrimGroupSelector from './ScrimGroupSelector';
import { ScrimGroup } from '../../types/match.types'; // Import ScrimGroup type if not already
import api from '../../services/api';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

// Define the props the component expects
interface MatchMetadataProps {
  // Use a more specific type for Formik values if available
  formik: FormikProps<any>;
  teams?: { team_id: number; team_name: string }[];
  newTeamMode?: boolean;
  setNewTeamMode?: (mode: boolean) => void;
}

const MatchMetadata: React.FC<MatchMetadataProps> = ({ formik, teams = [], newTeamMode = false, setNewTeamMode = () => {} }) => {
  const { values, errors, touched, handleChange, setFieldValue } = useFormikContext<any>();
  const [suggestedGameNumber, setSuggestedGameNumber] = useState<number | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);

  // Correct the event type for MUI Select onChange
  const handleOpponentChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === 'new_team') {
      if (setNewTeamMode) setNewTeamMode(true); // Check if function exists before calling
      formik.setFieldValue('opponent_team', '');
      formik.setFieldValue('is_new_opponent', true);
    } else {
      if (setNewTeamMode) setNewTeamMode(false); // Check if function exists
      formik.setFieldValue('opponent_team', value);
      formik.setFieldValue('is_new_opponent', false);
      formik.setFieldValue('opponent_team_name', '');
      formik.setFieldValue('opponent_team_abbreviation', '');
      formik.setFieldValue('opponent_category', '');
    }
  };

  // Helper function to safely render Formik errors
  const renderError = (error: any): React.ReactNode => {
    if (typeof error === 'string') {
      return error;
    }
    // Handle other error types if necessary, or return empty string
    return '';
  };

  // Function to check for suggested game number
  const checkForGameNumberSuggestion = async () => {
    if (!values.match_date || !values.match_time || !values.opponent_team) {
      return; // Only check when all required fields are present
    }

    setIsLoadingSuggestion(true);
    
    try {
      // Combine date and time into an ISO string
      const dateObj = new Date(values.match_date);
      const timeObj = new Date(values.match_time);
      
      dateObj.setHours(timeObj.getHours());
      dateObj.setMinutes(timeObj.getMinutes());
      
      const isoDateTime = dateObj.toISOString();
      
      // Call API endpoint to get suggestion
      const response = await api.get('/api/matches/suggest_game_number/', {
        params: {
          our_team_id: values.our_team_id,
          opponent_team_id: values.opponent_team,
          match_date: isoDateTime,
          scrim_type: values.scrim_type
        }
      });
      
      if (response.data && response.data.suggested_game_number) {
        setSuggestedGameNumber(response.data.suggested_game_number);
        
        // If the user hasn't manually set a game number yet, or it's still 1,
        // automatically apply the suggestion
        if (values.game_number === 1) {
          setFieldValue('game_number', response.data.suggested_game_number);
        }
      }
    } catch (error) {
      console.error('Error fetching game number suggestion:', error);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  // Watch for changes in relevant fields to update game number suggestion
  useEffect(() => {
    if (values.opponent_team && values.match_date && values.match_time) {
      checkForGameNumberSuggestion();
    }
  }, [values.opponent_team, values.match_date, values.match_time, values.scrim_type]);

  return (
    <Grid container spacing={2}>
      {/* First row */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <Typography variant="subtitle1">Match Date</Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              value={values.match_date ? new Date(values.match_date) : null}
              onChange={(newDate: Date | null) => {
                setFieldValue('match_date', newDate ? newDate.toISOString().split('T')[0] : null);
              }}
              slotProps={{ 
                textField: { 
                  error: touched.match_date && Boolean(errors.match_date),
                  helperText: touched.match_date && errors.match_date as string 
                } 
              }}
            />
          </LocalizationProvider>
        </FormControl>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <Typography variant="subtitle1">Match Time</Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <TimePicker
              value={values.match_time ? new Date(values.match_time) : null}
              onChange={(newTime: Date | null) => {
                setFieldValue('match_time', newTime ? newTime.toISOString() : null);
              }}
              slotProps={{ 
                textField: { 
                  error: touched.match_time && Boolean(errors.match_time),
                  helperText: touched.match_time && errors.match_time as string 
                } 
              }}
            />
          </LocalizationProvider>
        </FormControl>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <Typography variant="subtitle1">Game Number</Typography>
          <TextField
            name="game_number"
            type="number"
            value={values.game_number}
            onChange={handleChange}
            inputProps={{ min: 1 }}
            error={touched.game_number && Boolean(errors.game_number)}
            helperText={
              touched.game_number && errors.game_number ? 
              errors.game_number as string :
              suggestedGameNumber && suggestedGameNumber > 1 ? 
              `We found Game ${suggestedGameNumber - 1} within 8 hours of this time. Suggesting Game ${suggestedGameNumber}.` : 
              "Enter 1 for first game, 2 for second game, etc."
            }
          />
        </FormControl>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          margin="normal"
          id="map_played"
          name="map_played"
          label="Map Played"
          value={values.map_played || ''}
          onChange={handleChange}
          onBlur={formik.handleBlur}
          error={touched.map_played && Boolean(errors.map_played)}
           // Use helper function to cast error
          helperText={touched.map_played && renderError(errors.map_played)}
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <FormControl fullWidth margin="normal">
          <InputLabel id="match-result-label">Match Result</InputLabel>
          <Select
            labelId="match-result-label"
            id="match_result"
            name="match_result"
            value={values.match_result || ''}
            onChange={handleChange} // Standard handleChange is fine here
            onBlur={formik.handleBlur}
            error={touched.match_result && Boolean(errors.match_result)}
            label="Match Result"
          >
            <MenuItem value={'Win'}>Win</MenuItem>
            <MenuItem value={'Loss'}>Loss</MenuItem>
            <MenuItem value={'Draw'}>Draw</MenuItem>
          </Select>
           {touched.match_result && errors.match_result && (
              <Typography color="error" variant="caption" sx={{ pl: 2, mt: 0.5 }}>
                   {/* Use helper function to cast error */}
                   {renderError(errors.match_result)}
              </Typography>
           )}
        </FormControl>
      </Grid>

      {/* Opponent Selection Logic */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth margin="normal">
          <InputLabel id="opponent-team-label">Opponent Team</InputLabel>
          {!newTeamMode ? (
            <>
              <Select
                labelId="opponent-team-label"
                name="opponent_team"
                value={values.opponent_team || ''}
                onChange={handleOpponentChange} // Use corrected handler
                label="Opponent Team"
                error={touched.opponent_team && Boolean(errors.opponent_team) && !values.is_new_opponent}
              >
                {/* Ensure teams is an array before mapping */}
                {Array.isArray(teams) && teams.map(team => (
                  <MenuItem key={team.team_id} value={team.team_id.toString()}>
                    {team.team_name}
                  </MenuItem>
                ))}
                <MenuItem value="new_team"><em>Add New Team...</em></MenuItem>
              </Select>
              {touched.opponent_team && errors.opponent_team && !values.is_new_opponent && (
                 <Typography color="error" variant="caption" sx={{ pl: 2, mt: 0.5 }}>
                      {/* Use helper function to cast error */}
                      {renderError(errors.opponent_team)}
                 </Typography>
              )}
            </>
          ) : (
            <Box sx={{ mt: 2, border: '1px dashed grey', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Enter New Opponent Details</Typography>
              <TextField
                label="Team Name"
                name="opponent_team_name"
                value={values.opponent_team_name || ''}
                onChange={handleChange}
                onBlur={formik.handleBlur}
                fullWidth
                margin="dense"
                error={touched.opponent_team_name && Boolean(errors.opponent_team_name)}
                // Use helper function to cast error
                helperText={touched.opponent_team_name && renderError(errors.opponent_team_name)}
              />
              <TextField
                label="Team Abbreviation"
                name="opponent_team_abbreviation"
                value={values.opponent_team_abbreviation || ''}
                onChange={handleChange}
                onBlur={formik.handleBlur}
                fullWidth
                margin="dense"
                error={touched.opponent_team_abbreviation && Boolean(errors.opponent_team_abbreviation)}
                 // Use helper function to cast error
                helperText={touched.opponent_team_abbreviation && renderError(errors.opponent_team_abbreviation)}
              />
              <FormControl fullWidth margin="dense">
                <InputLabel id="opponent-category-label">Team Category</InputLabel>
                <Select
                    labelId="opponent-category-label"
                    name="opponent_category"
                    value={values.opponent_category || ''}
                    onChange={handleChange} // Standard handleChange is fine
                    onBlur={formik.handleBlur}
                    label="Team Category"
                    error={touched.opponent_category && Boolean(errors.opponent_category)}
                >
                  <MenuItem value="Collegiate">Collegiate</MenuItem>
                  <MenuItem value="Amateur">Amateur</MenuItem>
                  <MenuItem value="Professional">Professional</MenuItem>
                </Select>
                 {touched.opponent_category && errors.opponent_category && (
                    <Typography color="error" variant="caption" sx={{ pl: 2, mt: 0.5 }}>
                         {/* Use helper function to cast error */}
                         {renderError(errors.opponent_category)}
                    </Typography>
                 )}
              </FormControl>
              <Button onClick={() => { if (setNewTeamMode) setNewTeamMode(false); }} size="small" sx={{ mt: 1 }}> {/* Check setNewTeamMode */}
                Cancel New Team
              </Button>
            </Box>
          )}
        </FormControl>
      </Grid>

      {/* Scrim Group Selector - Pass correct props */}
      <Grid item xs={12}>
        <ScrimGroupSelector
           value={values.scrim_group as ScrimGroup | null} // Assume 'scrim_group' is the field name
           onChange={(newValue) => setFieldValue('scrim_group', newValue)}
        />
      </Grid>
    </Grid>
  );
};

export default MatchMetadata; 