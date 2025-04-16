import React, { useState, useEffect } from 'react';
import { Box, Grid, TextField, Autocomplete, Typography, Paper, IconButton, FormControlLabel, Checkbox } from '@mui/material';
import { getPlayers, searchPlayerByIGN } from '../../services/player.service';
import { getHeroes } from '../../services/hero.service';
import { Player } from '../../types/player.types';
import { Hero } from '../../types/hero';
import { PlayerMatchStat } from '../../types/match.types';
import InfoIcon from '@mui/icons-material/Info';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

interface PlayerStatRowProps {
  index: number;
  formik: any;
  fieldNamePrefix: string;
  isOurTeam: boolean;
  availableHeroes?: Hero[]; // Optional prop to restrict hero selection
  restrictHeroes?: boolean; // Flag to indicate if we should restrict heroes
  totalPlayers?: number; // Total number of players in this category for MVP logic
  isMvp?: boolean; // Is this player the MVP
  isMvpLoss?: boolean; // Is this player the MVP of the losing team
  onMvpChange?: (playerId: number | undefined, isMvp: boolean) => void; // Callback for MVP toggle
  onMvpLossChange?: (playerId: number | undefined, isMvpLoss: boolean) => void; // Callback for MVP Loss toggle
  match_outcome?: 'VICTORY' | 'DEFEAT'; // Match outcome to determine which MVP selection to show
}

const PlayerStatRow: React.FC<PlayerStatRowProps> = ({ 
  index, 
  formik, 
  fieldNamePrefix, 
  isOurTeam,
  availableHeroes,
  restrictHeroes = false,
  totalPlayers = 5, // Default to 5 players per team
  isMvp = false,
  isMvpLoss = false,
  onMvpChange,
  onMvpLossChange,
  match_outcome = 'VICTORY' // Default to victory
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showPlayerVerification, setShowPlayerVerification] = useState(false);
  const [possiblePlayerMatches, setPossiblePlayerMatches] = useState<Player[]>([]);

  // Extract values and helpers from formik
  const { values, touched, errors, handleChange, handleBlur, setFieldValue } = formik;
  
  // Get current values for this specific row from formik state
  // Need to safely access nested properties
  const getCurrentRowValues = () => {
    try {
      const pathSegments = fieldNamePrefix.match(/[^[\]\.]+/g) || [];
      let current = values;
      for (const segment of pathSegments) {
        if (current && typeof current === 'object' && segment in current) {
          current = current[segment];
        } else {
          return undefined; // Path doesn't exist
        }
      }
      return current as Partial<PlayerMatchStat>; // Cast to expected type
    } catch (e) {
      console.error("Error accessing Formik values for row:", fieldNamePrefix, e);
      return undefined;
    }
  };

  const currentRowValues = getCurrentRowValues();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const playersData = await getPlayers();
        setPlayers(playersData);
        
        // Only load heroes if not provided through props
        if (!availableHeroes) {
          const heroesData = await getHeroes();
          setHeroes(heroesData);
        } else {
          setHeroes(availableHeroes);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
  }, [availableHeroes]);

  // Update heroes when availableHeroes changes
  useEffect(() => {
    if (availableHeroes) {
      setHeroes(availableHeroes);
    }
  }, [availableHeroes]);

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
          
          // Update MVP state if callbacks provided
          if (isMvp && onMvpChange) {
            onMvpChange(player.player_id, true);
          }
          if (isMvpLoss && onMvpLossChange) {
            onMvpLossChange(player.player_id, true);
          }
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
      
      // Update MVP state if callbacks provided
      if (isMvp && onMvpChange) {
        onMvpChange(value.player_id, true);
      }
      if (isMvpLoss && onMvpLossChange) {
        onMvpLossChange(value.player_id, true);
      }
    }
  };

  // Handle hero selection
  const handleHeroChange = (event: React.SyntheticEvent, value: Hero | null) => {
    setFieldValue(`${fieldNamePrefix}.hero_played`, value ? value.name : '');
  };
  
  // Handle MVP selection change
  const handleMvpChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    if (onMvpChange && selectedPlayer) {
      onMvpChange(selectedPlayer.player_id, isChecked);
    }
  };
  
  // Handle MVP Loss selection change
  const handleMvpLossChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    if (onMvpLossChange && selectedPlayer) {
      onMvpLossChange(selectedPlayer.player_id, isChecked);
    }
  };

  // Calculate KDA whenever kills, deaths or assists change
  useEffect(() => {
    // --- Add Guard Clause --- 
    // Ensure the data for this row exists before calculating
    if (!currentRowValues) {
      console.warn(`[PlayerStatRow ${index}] Skipping KDA calculation: Row data not found for ${fieldNamePrefix}`);
      return; 
    }
    // --- End Guard Clause ---

    const kills = Number(currentRowValues.kills) || 0;
    const deaths = Number(currentRowValues.deaths) || 0;
    const assists = Number(currentRowValues.assists) || 0;
    
    let kda = 0;
    if (deaths === 0) {
      kda = kills + assists;
    } else {
      kda = (kills + assists) / deaths;
    }
    
    const formattedKDA = Math.round(kda * 100) / 100;
    // Check if KDA actually changed before setting field value to prevent potential loops
    if (currentRowValues.computed_kda !== formattedKDA) {
        setFieldValue(`${fieldNamePrefix}.computed_kda`, formattedKDA);
    }
  // Depend on the specific values from currentRowValues
  }, [currentRowValues?.kills, currentRowValues?.deaths, currentRowValues?.assists, fieldNamePrefix, setFieldValue, index, currentRowValues]); // Added currentRowValues to dependencies
  
  // Determine if we should show MVP or MVP Loss option based on team and match outcome
  const showMvpOption = (isOurTeam && match_outcome === 'VICTORY') || (!isOurTeam && match_outcome === 'DEFEAT');
  const showMvpLossOption = (isOurTeam && match_outcome === 'DEFEAT') || (!isOurTeam && match_outcome === 'VICTORY');

  // Get the hero name from the current row values, handling potential object/string/undefined
  const heroNameValue = typeof currentRowValues?.hero_played === 'object' && currentRowValues?.hero_played !== null 
                        ? currentRowValues.hero_played.name 
                        : typeof currentRowValues?.hero_played === 'string' 
                        ? currentRowValues.hero_played
                        : undefined;

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2, borderLeft: isMvp ? '4px solid gold' : (isMvpLoss ? '4px solid silver' : 'none') }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">
          {isOurTeam ? `Our Player ${index + 1}` : `Enemy Player ${index + 1}`}
        </Typography>
        
        {/* MVP Award indicators */}
        <Box display="flex" alignItems="center">
          {showMvpOption && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={isMvp}
                  onChange={handleMvpChange}
                  disabled={!selectedPlayer}
                  icon={<EmojiEventsIcon />}
                  checkedIcon={<EmojiEventsIcon color="warning" />}
                />
              }
              label="MVP"
            />
          )}
          
          {showMvpLossOption && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={isMvpLoss}
                  onChange={handleMvpLossChange}
                  disabled={!selectedPlayer}
                  icon={<EmojiEventsIcon />}
                  checkedIcon={<EmojiEventsIcon color="action" />}
                />
              }
              label="MVP Loss"
            />
          )}
        </Box>
      </Box>
      
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
            inputValue={currentRowValues?.ign ?? ''}
            onInputChange={(event, newInputValue) => {
                setFieldValue(`${fieldNamePrefix}.ign`, newInputValue); 
            }}
            freeSolo
            renderInput={(params) => (
              <TextField
                {...params}
                label="Player IGN"
                fullWidth
                error={touched[`${fieldNamePrefix}.player_id`] && Boolean(errors[`${fieldNamePrefix}.player_id`])}
                helperText={touched[`${fieldNamePrefix}.player_id`] && errors[`${fieldNamePrefix}.player_id`]}
              />
            )}
          />
        </Grid>
        
        {/* Hero selection */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            // Find the hero object based on the extracted name string
            value={heroNameValue ? heroes.find(h => h.name === heroNameValue) : null}
            onChange={handleHeroChange}
            options={heroes}
            getOptionLabel={(option) => option.name}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Hero Played"
                fullWidth
                error={touched[`${fieldNamePrefix}.hero_played`] && Boolean(errors[`${fieldNamePrefix}.hero_played`])}
                helperText={
                  restrictHeroes && heroes.length === 0
                    ? "No heroes available from draft"
                    : (touched[`${fieldNamePrefix}.hero_played`] && errors[`${fieldNamePrefix}.hero_played`])
                }
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
            value={currentRowValues?.kills ?? 0}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.kills`] && Boolean(errors[`${fieldNamePrefix}.kills`])}
            helperText={touched[`${fieldNamePrefix}.kills`] && errors[`${fieldNamePrefix}.kills`]}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.deaths`}
            label="Deaths"
            type="number"
            fullWidth
            value={currentRowValues?.deaths ?? 0}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.deaths`] && Boolean(errors[`${fieldNamePrefix}.deaths`])}
            helperText={touched[`${fieldNamePrefix}.deaths`] && errors[`${fieldNamePrefix}.deaths`]}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.assists`}
            label="Assists"
            type="number"
            fullWidth
            value={currentRowValues?.assists ?? 0}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.assists`] && Boolean(errors[`${fieldNamePrefix}.assists`])}
            helperText={touched[`${fieldNamePrefix}.assists`] && errors[`${fieldNamePrefix}.assists`]}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        {/* Computed KDA (read-only) */}
        <Grid item xs={4}>
          <TextField
            label="KDA"
            value={currentRowValues?.computed_kda ?? 0}
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
            value={currentRowValues?.damage_dealt ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.damage_dealt`] && Boolean(errors[`${fieldNamePrefix}.damage_dealt`])}
            helperText={touched[`${fieldNamePrefix}.damage_dealt`] && errors[`${fieldNamePrefix}.damage_dealt`]}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.damage_taken`}
            label="Damage Taken"
            type="number"
            fullWidth
            value={currentRowValues?.damage_taken ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.damage_taken`] && Boolean(errors[`${fieldNamePrefix}.damage_taken`])}
            helperText={touched[`${fieldNamePrefix}.damage_taken`] && errors[`${fieldNamePrefix}.damage_taken`]}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.turret_damage`}
            label="Turret Damage"
            type="number"
            fullWidth
            value={currentRowValues?.turret_damage ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.turret_damage`] && Boolean(errors[`${fieldNamePrefix}.turret_damage`])}
            helperText={touched[`${fieldNamePrefix}.turret_damage`] && errors[`${fieldNamePrefix}.turret_damage`]}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </Grid>
        
        <Grid item xs={4}>
          <TextField
            name={`${fieldNamePrefix}.teamfight_participation`}
            label="Teamfight %"
            type="number"
            fullWidth
            value={currentRowValues?.teamfight_participation ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.teamfight_participation`] && Boolean(errors[`${fieldNamePrefix}.teamfight_participation`])}
            helperText={touched[`${fieldNamePrefix}.teamfight_participation`] && errors[`${fieldNamePrefix}.teamfight_participation`]}
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
            value={currentRowValues?.gold_earned ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.gold_earned`] && Boolean(errors[`${fieldNamePrefix}.gold_earned`])}
            helperText={touched[`${fieldNamePrefix}.gold_earned`] && errors[`${fieldNamePrefix}.gold_earned`]}
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
            value={currentRowValues?.player_notes ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched[`${fieldNamePrefix}.player_notes`] && Boolean(errors[`${fieldNamePrefix}.player_notes`])}
            helperText={touched[`${fieldNamePrefix}.player_notes`] && errors[`${fieldNamePrefix}.player_notes`]}
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