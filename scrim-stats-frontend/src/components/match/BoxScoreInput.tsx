import React from 'react';
import { Box, Grid, TextField, Autocomplete, Typography, Paper, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { FormikProps } from 'formik';
import { MatchFormData, PlayerMatchStat } from '../../types/match.types'; // Use types from match.types
import { Player } from '../../types/player.types';
import { Hero } from '../../types/hero.types';

// Mirror ROLE_CHOICES from backend model - Filtered to player roles
const ROLE_CHOICES = [
  { value: 'JUNGLER', label: 'Jungler' }, { value: 'MID', label: 'Mid Laner' },
  { value: 'ROAMER', label: 'Roamer' }, { value: 'EXP', label: 'Exp Laner' },
  { value: 'GOLD', label: 'Gold Laner' },
];

// Define Medal Choices
const MEDAL_CHOICES = [
    { value: 'GOLD', label: 'Gold' },
    { value: 'SILVER', label: 'Silver' },
    { value: 'BRONZE', label: 'Bronze' },
];

interface BoxScoreInputProps {
  formik: FormikProps<MatchFormData>;
  team1PlayersData: Partial<PlayerMatchStat>[]; 
  team2PlayersData: Partial<PlayerMatchStat>[];
  availableHeroes?: Hero[];
  team1Label: string;
  team2Label: string;
}

const BoxScoreInput: React.FC<BoxScoreInputProps> = ({ 
  formik, 
  availableHeroes,
  team1Label,
  team2Label,
}) => {

  const { values, handleChange, handleBlur, setFieldValue } = formik;

  const renderTeamBoxScore = (teamLabel: string, fieldNamePrefix: 'team_players' | 'enemy_players') => {

    // Adjusted column widths again for Medal
    const colWidths = { ign: 1.8, hero: 1.8, role: 1.4, k: 0.6, d: 0.6, a: 0.6, medal: 1.2, dmg: 1, dmgTaken: 1, turretDmg: 1, gold: 1 };

    return (
      <Grid item xs={12} sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom align="center">{teamLabel}</Typography>
        <Paper elevation={2} sx={{ px: 1, pt: 0.5, pb: 1 }}>
          {/* Header Row - Added Medal */}
          <Grid container spacing={1} sx={{ pb: 0.5, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Grid item xs={colWidths.ign}><Typography variant="caption">Player</Typography></Grid>
            <Grid item xs={colWidths.hero}><Typography variant="caption">Hero</Typography></Grid>
            <Grid item xs={colWidths.role}><Typography variant="caption">Role</Typography></Grid>
            <Grid item xs={colWidths.k}><Typography variant="caption">K</Typography></Grid>
            <Grid item xs={colWidths.d}><Typography variant="caption">D</Typography></Grid>
            <Grid item xs={colWidths.a}><Typography variant="caption">A</Typography></Grid>
            <Grid item xs={colWidths.medal}><Typography variant="caption">Medal</Typography></Grid>
            <Grid item xs={colWidths.dmg}><Typography variant="caption">DMG</Typography></Grid>
            <Grid item xs={colWidths.dmgTaken}><Typography variant="caption">DMG Tkn</Typography></Grid>
            <Grid item xs={colWidths.turretDmg}><Typography variant="caption">Turret</Typography></Grid>
            <Grid item xs={colWidths.gold}><Typography variant="caption">GOLD</Typography></Grid>
          </Grid>

          {/* Player Data Rows - Added Medal Select */}
          {Array.from({ length: 5 }).map((_, index) => {
            const playerFieldName = `${fieldNamePrefix}[${index}]`;
            const playerValues = values[fieldNamePrefix]?.[index] || {};
            // Ensure hero_played is handled correctly for Autocomplete value
            const selectedHero = playerValues.hero_played && typeof playerValues.hero_played === 'object' 
                                  ? playerValues.hero_played as Hero 
                                  : availableHeroes?.find(h => h.hero_id === Number(playerValues.hero_played)) || null;
            const roleFieldName = `${playerFieldName}.role_played`;
            const medalFieldName = `${playerFieldName}.medal`;

            return (
              <Grid container spacing={1} key={`${fieldNamePrefix}-${index}`} sx={{ mt: 0.5 }} alignItems="center">
                {/* IGN */}
                <Grid item xs={colWidths.ign}>
                  <TextField label="IGN" name={`${playerFieldName}.ign`} value={playerValues.ign ?? ''} onChange={handleChange} onBlur={handleBlur} size="small" fullWidth variant="outlined" />
                </Grid>
                {/* Hero */}
                <Grid item xs={colWidths.hero}>
                  <Autocomplete
                    options={availableHeroes || []}
                    getOptionLabel={(option) => option.name}
                    value={selectedHero}
                    isOptionEqualToValue={(option, value) => option.hero_id === value?.hero_id}
                    onChange={(e, newValue) => {
                      // Store the hero object or ID based on what backend/validation expects
                      setFieldValue(`${playerFieldName}.hero_played`, newValue); 
                    }}
                    size="small"
                    renderInput={(params) => <TextField {...params} label="Hero" variant="outlined" />}
                  />
                </Grid>
                {/* Role */}
                <Grid item xs={colWidths.role}>
                  <FormControl fullWidth size="small" variant="outlined">
                    <InputLabel>Role</InputLabel>
                    <Select label="Role" name={roleFieldName} value={playerValues.role_played ?? ''} onChange={handleChange} onBlur={handleBlur} >
                      {ROLE_CHOICES.map(role => ( <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem> ))}
                    </Select>
                  </FormControl>
                </Grid>
                {/* KDA */}
                <Grid item xs={colWidths.k}><TextField label="K" name={`${playerFieldName}.kills`} value={playerValues.kills ?? 0} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0, style: { textAlign: 'center' } } }} /></Grid>
                <Grid item xs={colWidths.d}><TextField label="D" name={`${playerFieldName}.deaths`} value={playerValues.deaths ?? 0} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0, style: { textAlign: 'center' } } }} /></Grid>
                <Grid item xs={colWidths.a}><TextField label="A" name={`${playerFieldName}.assists`} value={playerValues.assists ?? 0} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0, style: { textAlign: 'center' } } }} /></Grid>
                {/* Medal */}
                <Grid item xs={colWidths.medal}>
                    <FormControl fullWidth size="small" variant="outlined">
                       <InputLabel>Medal</InputLabel>
                       <Select label="Medal" name={medalFieldName} value={playerValues.medal ?? ''} onChange={handleChange} onBlur={handleBlur} displayEmpty>
                          <MenuItem value=""><em>None</em></MenuItem> {/* Explicit None option */}
                          {MEDAL_CHOICES.map(medal => (
                            <MenuItem key={medal.value} value={medal.value}>{medal.label}</MenuItem>
                          ))}
                       </Select>
                    </FormControl>
                </Grid>
                {/* Other Stats */}
                <Grid item xs={colWidths.dmg}><TextField label="DMG" name={`${playerFieldName}.damage_dealt`} value={playerValues.damage_dealt ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0 } }} /></Grid>
                <Grid item xs={colWidths.dmgTaken}><TextField label="DMG Tkn" name={`${playerFieldName}.damage_taken`} value={playerValues.damage_taken ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0 } }} /></Grid>
                <Grid item xs={colWidths.turretDmg}><TextField label="Turret" name={`${playerFieldName}.turret_damage`} value={playerValues.turret_damage ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0 } }} /></Grid>
                <Grid item xs={colWidths.gold}><TextField label="GOLD" name={`${playerFieldName}.gold_earned`} value={playerValues.gold_earned ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0 } }} /></Grid>
              </Grid>
            );
          })}
        </Paper>
      </Grid>
    );
  };

  return (
    <Box sx={{ mt: 2 }}>
      {renderTeamBoxScore(team1Label, 'team_players')}
      {renderTeamBoxScore(team2Label, 'enemy_players')}
      
      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Player Notes</Typography>
       <Grid container spacing={1.5}>
          {Array.from({ length: 5 }).map((_, index) => (
            <React.Fragment key={`notes-${index}`}>
                 <Grid item xs={12} sm={6}>
                    <TextField label={`${team1Label} - P${index + 1} Notes`} name={`team_players[${index}].player_notes`} value={values.team_players?.[index]?.player_notes ?? ''} onChange={handleChange} onBlur={handleBlur} multiline rows={1} size="small" fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12} sm={6}>
                     <TextField label={`${team2Label} - P${index + 1} Notes`} name={`enemy_players[${index}].player_notes`} value={values.enemy_players?.[index]?.player_notes ?? ''} onChange={handleChange} onBlur={handleBlur} multiline rows={1} size="small" fullWidth variant="outlined" />
                </Grid>
            </React.Fragment>
          ))}
       </Grid>
    </Box>
  );
};

export default BoxScoreInput;