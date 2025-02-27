import React, { useState, useEffect } from 'react';
import { Box, Grid, TextField, Autocomplete, Typography, Paper, IconButton } from '@mui/material';
import { getPlayers, searchPlayerByIGN } from '../../services/player.service';
import { getHeroes } from '../../services/hero.service';
import { Player } from '../../types/player.types';
import { Hero } from '../../types/hero.types';
import InfoIcon from '@mui/icons-material/Info';

interface PlayerStatRowProps {
  index: number;
  formik: any;
  fieldNamePrefix: string;
  isOurTeam: boolean;
}

const PlayerStatRow: React.FC<PlayerStatRowProps> = ({ index, formik, fieldNamePrefix, isOurTeam }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showPlayerVerification, setShowPlayerVerification] = useState(false);
  const [possiblePlayerMatches, setPossiblePlayerMatches] = useState<Player[]>([]);

  // Extract values and helpers from formik
  const { values, touched, errors, handleChange, handleBlur, setFieldValue } = formik;
  
  // Get current values from form
  const currentValues = fieldNamePrefix.split('[').reduce((obj, path) => {
    const key = path.replace(']', '');
    return key ? obj[key] : obj;
  }, values);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const playersData = await getPlayers();
        setPlayers(playersData);
        
        const heroesData = await getHeroes();
        setHeroes(heroesData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
  }, []);

  // Handle player selection
  const handlePlayerChange = async (event: React.SyntheticEvent, value: Player | string | null) => {
    if (value === null) {
      setFieldValue(`${fieldNamePrefix}.player_id`, null);
      setSelectedPlayer(null);
      return;
    }
    
    // If user entered a string (IGN)
    if (typeof value === 'string') {
      try {
        // Search for player with this IGN
        const searchResults = await searchPlayerByIGN(value);
        
        if (searchResults.length === 0) {
          // No exact match found, show verification dialog
          setShowPlayerVerification(true);
          setSearchText(value);
          setPossiblePlayerMatches([]); // No matches
        } else if (searchResults.length === 1) {
          // Exact match found
          const player = searchResults[0];
          setFieldValue(`${fieldNamePrefix}.player_id`, player.player_id);
          setSelectedPlayer(player);
        } else {
          // Multiple potential matches
          setShowPlayerVerification(true);
          setSearchText(value);
          setPossiblePlayerMatches(searchResults);
        }
      } catch (error) {
        console.error('Error searching for player:', error);
      }
    } else {
      // Direct player object selection
      setFieldValue(`${fieldNamePrefix}.player_id`, value.player_id);
      setSelectedPlayer(value);
    }
  };

  // Handle hero selection
  const handleHeroChange = (event: React.SyntheticEvent, value: Hero | null) => {
    setFieldValue(`${fieldNamePrefix}.hero_played`, value ? value.hero_name : '');
  };

  // Calculate KDA whenever kills, deaths or assists change
  useEffect(() => {
    const kills = Number(values[fieldNamePrefix].kills) || 0;
    const deaths = Number(values[fieldNamePrefix].deaths) || 0;
    const assists = Number(values[fieldNamePrefix].assists) || 0;
    
    let kda = 0;
    if (deaths === 0) {
      kda = kills + assists;
    } else {
      kda = (kills + assists) / deaths;
    }
    
    // Format to 2 decimal places
    const formattedKDA = Math.round(kda * 100) / 100;
    setFieldValue(`${fieldNamePrefix}.computed_kda`, formattedKDA);
  }, [values[fieldNamePrefix].kills, values[fieldNamePrefix].deaths, values[fieldNamePrefix].assists]);

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        {isOurTeam ? `Our Player ${index + 1}` : `Enemy Player ${index + 1}`}
      </Typography>
      
      <Grid container spacing={2}>
        {/* Player selection */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            value={selectedPlayer}
            onChange={handlePlayerChange}
            options={players}
            getOptionLabel={(option) => 
              typeof option === 'string' ? option : option.current_ign
            }
            freeSolo
            renderInput={(params) => (
              <TextField
                {...params}
                label="Player IGN"
                fullWidth
                error={touched[fieldNamePrefix]?.player_id && Boolean(errors[fieldNamePrefix]?.player_id)}
                helperText={touched[fieldNamePrefix]?.player_id && errors[fieldNamePrefix]?.player_id}
              />
            )}
          />
        </Grid>
        
        {/* Hero selection */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            value={heroes.find(h => h.hero_name === values[fieldNamePrefix].hero_played) || null}
            onChange={handleHeroChange}
            options={heroes}
            getOptionLabel={(option) => option.hero_name}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Hero Played"
                fullWidth
                error={touched[fieldNamePrefix]?.hero_played && Boolean(errors[fieldNamePrefix]?.hero_played)}
                helperText={touched[fieldNamePrefix]?.hero_played && errors[fieldNamePrefix]?.hero_played}
              />
            )}
          />
        </Grid>
        
        {/* KDA Inputs */}
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.kills`}
            label="Kills"
            type="number"
            fullWidth
            value={values[fieldNamePrefix].kills}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[fieldNamePrefix]?.kills && Boolean(errors[fieldNamePrefix]?.kills)}
            helperText={touched[fieldNamePrefix]?.kills && errors[fieldNamePrefix]?.kills}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.deaths`}
            label="Deaths"
            type="number"
            fullWidth
            value={values[fieldNamePrefix].deaths}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[fieldNamePrefix]?.deaths && Boolean(errors[fieldNamePrefix]?.deaths)}
            helperText={touched[fieldNamePrefix]?.deaths && errors[fieldNamePrefix]?.deaths}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.assists`}
            label="Assists"
            type="number"
            fullWidth
            value={values[fieldNamePrefix].assists}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[fieldNamePrefix]?.assists && Boolean(errors[fieldNamePrefix]?.assists)}
            helperText={touched[fieldNamePrefix]?.assists && errors[fieldNamePrefix]?.assists}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        {/* Computed KDA (read-only) */}
        <Grid item xs={4}>
          <TextField
            label="KDA"
            value={values[fieldNamePrefix].computed_kda || 0}
            fullWidth
            InputProps={{
              readOnly: true,
            }}
          />
        </Grid>
        
        {/* Other stats */}
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.damage_dealt`}
            label="Damage Dealt"
            type="number"
            fullWidth
            value={values[fieldNamePrefix].damage_dealt}
            onChange={handleChange}
            onBlur={handleBlur}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.damage_taken`}
            label="Damage Taken"
            type="number"
            fullWidth
            value={values[fieldNamePrefix].damage_taken}
            onChange={handleChange}
            onBlur={handleBlur}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.turret_damage`}
            label="Turret Damage"
            type="number"
            fullWidth
            value={values[fieldNamePrefix].turret_damage}
            onChange={handleChange}
            onBlur={handleBlur}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.teamfight_participation`}
            label="Teamfight %"
            type="number"
            fullWidth
            value={values[fieldNamePrefix].teamfight_participation}
            onChange={handleChange}
            onBlur={handleBlur}
            InputProps={{ 
              inputProps: { min: 0, max: 100 },
              endAdornment: <Typography>%</Typography>
            }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.gold_earned`}
            label="Gold Earned"
            type="number"
            fullWidth
            value={values[fieldNamePrefix].gold_earned}
            onChange={handleChange}
            onBlur={handleBlur}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        {/* Notes */}
        <Grid item xs={12}>
          <TextField
            name={`${fieldNamePrefix}.player_notes`}
            label="Player Notes"
            multiline
            rows={2}
            fullWidth
            value={values[fieldNamePrefix].player_notes}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </Grid>
      </Grid>
      
      {/* Player verification dialog would go here */}
      {showPlayerVerification && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center' }}>
            <InfoIcon color="info" sx={{ mr: 1 }} />
            Verifying player identity for "{searchText}"
          </Typography>
          
          {possiblePlayerMatches.length > 0 ? (
            <>
              <Typography variant="body2">
                We found similar IGNs. Is this player one of these?
              </Typography>
              {/* Player selection options */}
              {/* Implementation details omitted for brevity */}
            </>
          ) : (
            <>
              <Typography variant="body2">
                This IGN is new. Would you like to:
              </Typography>
              {/* Create new player or update existing options */}
              {/* Implementation details omitted for brevity */}
            </>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default PlayerStatRow; 