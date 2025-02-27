import React from 'react';
import { Box, Grid, TextField, MenuItem, Typography } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ScrimGroupSelector from './ScrimGroupSelector';

interface MatchMetadataProps {
  formik: any;
}

const MatchMetadata: React.FC<MatchMetadataProps> = ({ formik }) => {
  const { values, touched, errors, handleChange, handleBlur, setFieldValue } = formik;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Match Details</Typography>
      
      <Grid container spacing={2}>
        {/* Date and Time */}
        <Grid item xs={12} md={6}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="Match Date & Time"
              value={values.match_date_time ? new Date(values.match_date_time) : null}
              onChange={(newValue) => {
                setFieldValue('match_date_time', newValue ? newValue.toISOString() : null);
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: touched.match_date_time && Boolean(errors.match_date_time),
                  helperText: touched.match_date_time && errors.match_date_time
                }
              }}
            />
          </LocalizationProvider>
        </Grid>
        
        {/* Opponent Category */}
        <Grid item xs={12} md={6}>
          <TextField
            name="opponent_category"
            label="Opponent Category"
            select
            fullWidth
            value={values.opponent_category}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.opponent_category && Boolean(errors.opponent_category)}
            helperText={touched.opponent_category && errors.opponent_category}
          >
            <MenuItem value="Collegiate">Collegiate</MenuItem>
            <MenuItem value="Amateur">Amateur</MenuItem>
            <MenuItem value="Pro">Pro</MenuItem>
          </TextField>
        </Grid>
        
        {/* Opponent Team Name */}
        <Grid item xs={12} md={6}>
          <TextField
            name="opponent_team_name"
            label="Opponent Team Name"
            fullWidth
            value={values.opponent_team_name}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.opponent_team_name && Boolean(errors.opponent_team_name)}
            helperText={touched.opponent_team_name && errors.opponent_team_name}
          />
        </Grid>
        
        {/* Opponent Team Abbreviation */}
        <Grid item xs={12} md={6}>
          <TextField
            name="opponent_team_abbreviation"
            label="Opponent Team Abbreviation"
            fullWidth
            value={values.opponent_team_abbreviation}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.opponent_team_abbreviation && Boolean(errors.opponent_team_abbreviation)}
            helperText={touched.opponent_team_abbreviation && errors.opponent_team_abbreviation}
          />
        </Grid>
        
        {/* Scrim Type */}
        <Grid item xs={12} md={6}>
          <TextField
            name="scrim_type"
            label="Scrim Type"
            select
            fullWidth
            value={values.scrim_type}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.scrim_type && Boolean(errors.scrim_type)}
            helperText={touched.scrim_type && errors.scrim_type}
          >
            <MenuItem value="Practice">Practice</MenuItem>
            <MenuItem value="Tournament">Tournament</MenuItem>
            <MenuItem value="Friendly">Friendly</MenuItem>
          </TextField>
        </Grid>
        
        {/* Match Outcome */}
        <Grid item xs={12} md={6}>
          <TextField
            name="match_outcome"
            label="Match Outcome"
            select
            fullWidth
            value={values.match_outcome}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.match_outcome && Boolean(errors.match_outcome)}
            helperText={touched.match_outcome && errors.match_outcome}
          >
            <MenuItem value="Win">Win</MenuItem>
            <MenuItem value="Loss">Loss</MenuItem>
            <MenuItem value="Draw">Draw</MenuItem>
          </TextField>
        </Grid>
        
        {/* Game Number */}
        <Grid item xs={12} md={6}>
          <TextField
            name="game_number"
            label="Game Number"
            type="number"
            fullWidth
            value={values.game_number}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.game_number && Boolean(errors.game_number)}
            helperText={touched.game_number && errors.game_number}
            InputProps={{ inputProps: { min: 1 } }}
          />
        </Grid>
        
        {/* Team Side */}
        <Grid item xs={12} md={6}>
          <TextField
            name="team_side"
            label="Team Side"
            select
            fullWidth
            value={values.team_side}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.team_side && Boolean(errors.team_side)}
            helperText={touched.team_side && errors.team_side}
          >
            <MenuItem value="Blue Side">Blue Side</MenuItem>
            <MenuItem value="Red Side">Red Side</MenuItem>
          </TextField>
        </Grid>
        
        {/* Scrim Group */}
        <Grid item xs={12}>
          <ScrimGroupSelector 
            value={values.scrim_group}
            onChange={(newValue) => setFieldValue('scrim_group', newValue)}
          />
        </Grid>
        
        {/* General Notes */}
        <Grid item xs={12}>
          <TextField
            name="general_notes"
            label="General Notes"
            multiline
            rows={4}
            fullWidth
            value={values.general_notes}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default MatchMetadata; 