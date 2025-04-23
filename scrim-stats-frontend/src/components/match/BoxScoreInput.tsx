import React, { useState, useEffect } from 'react';
import { Box, Grid, TextField, Autocomplete, Typography, Paper, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert, IconButton, SelectChangeEvent, createFilterOptions } from '@mui/material';
import { FormikProps, useFormikContext } from 'formik';
import { MatchFormData, PlayerMatchStat } from '../../types/match.types';
import { Player } from '../../types/player.types';
import { Hero } from '../../types/hero.types';
import { Team } from '../../types/team.types';
import { api } from '../../services/api.service';
import { getEmptyPlayerStat } from '../../utils/playerUtils';
// --- NEW: Import Icons --- 
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
// --- END NEW ---
// --- NEW: Import AddNewPlayerDialog (Corrected path if needed) ---
import AddNewPlayerDialog from './AddNewPlayerDialog'; // Assuming it's in the same directory
// --- NEW: Import API function (Corrected path) ---
import { addPlayerToTeam } from '../../services/player.service'; // Use the correct service file

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
  availableHeroes?: Hero[];
  team1Label: string;
  team2Label: string;
  includeDraftInfo: boolean;
}

const BoxScoreInput: React.FC<BoxScoreInputProps> = ({ 
  formik,
  availableHeroes,
  team1Label,
  team2Label,
  includeDraftInfo,
}) => {

  const { values, handleChange, handleBlur, setFieldValue } = useFormikContext<MatchFormData>();

  // --- Roster Fetching Logic (Moved from RosterManager) ---
  const [blueSideRoster, setBlueSideRoster] = useState<Player[]>([]);
  const [redSideRoster, setRedSideRoster] = useState<Player[]>([]);
  const [rosterLoading, setRosterLoading] = useState<Record<string, boolean>>({});
  const [rosterError, setRosterError] = useState<string | null>(null);
  // --- NEW: State for Add Player Dialog ---
  const [isAddPlayerDialogOpen, setIsAddPlayerDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null); // Error state for dialog
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false); // Loading state for dialog
  const [newPlayerData, setNewPlayerData] = useState<{
    ign: string;
    teamId: string;
    teamName: string;
    rosterIndex: number;
    fieldPrefix: 'team_players' | 'enemy_players';
  } | null>(null);

  const fetchTeamRoster = async (teamId: string | undefined): Promise<Player[]> => {
    console.log(`[BoxScoreInput] Attempting to fetch roster for team ID: ${teamId}`);
    if (!teamId) {
        console.log(`[BoxScoreInput] No team ID provided, skipping fetch.`);
        return [];
    }
    setRosterLoading(prev => ({ ...prev, [teamId]: true }));
    try {
        const response = await api.get<Player[] | { results: Player[] }>(`/api/teams/${teamId}/players/`);
        console.log(`[BoxScoreInput] Raw API response for team ${teamId}:`, response.data);
        const roster = Array.isArray(response.data) ? response.data : response.data.results || [];
        console.log(`[BoxScoreInput] Extracted roster for team ${teamId}:`, roster);
        setRosterLoading(prev => ({ ...prev, [teamId]: false }));
        return roster;
    } catch (error) {
        console.error(`[BoxScoreInput] Error fetching roster for team ${teamId}:`, error);
        setRosterError(`Failed to load roster for team ${teamId}.`);
        setRosterLoading(prev => ({ ...prev, [teamId]: false }));
        return [];
    }
  };

  // Effect to fetch rosters when relevant team IDs change
  useEffect(() => {
      console.log('[BoxScoreInput] Team selection changed, determining IDs...');
      let blueTeamId: string | undefined;
      let redTeamId: string | undefined;

      if (values.is_external_match) {
          blueTeamId = values.team_1;
          redTeamId = values.team_2;
          // console.log(`[BoxScoreInput] External Match: Blue Team ID = ${blueTeamId}, Red Team ID = ${redTeamId}`);
      } else {
          if (values.team_side === 'BLUE') {
              blueTeamId = values.our_team;
              redTeamId = values.opponent_team;
          } else if (values.team_side === 'RED') {
              blueTeamId = values.opponent_team;
              redTeamId = values.our_team;
          }
          // console.log(`[BoxScoreInput] Internal Match: Side = ${values.team_side}, Our Team = ${values.our_team}, Opponent = ${values.opponent_team} -> Blue ID = ${blueTeamId}, Red ID = ${redTeamId}`);
      }

      setRosterError(null); // Clear previous errors

      const fetchBlue = async () => {
          const blueRoster = await fetchTeamRoster(blueTeamId);
          setBlueSideRoster(blueRoster);
          // console.log(`[BoxScoreInput] Set Blue Side Roster State:`, blueRoster);
      };
      const fetchRed = async () => {
           const redRoster = await fetchTeamRoster(redTeamId);
           setRedSideRoster(redRoster);
           // console.log(`[BoxScoreInput] Set Red Side Roster State:`, redRoster);
      };

      fetchBlue();
      fetchRed();

  }, [values.is_external_match, values.team_1, values.team_2, values.our_team, values.opponent_team, values.team_side]);

  // Effect for clearing/pre-populating player slots
  useEffect(() => {
      console.log('[BoxScoreInput] Rosters changed, attempting to populate slots...');
      // console.log('[BoxScoreInput] Current Blue Roster State:', blueSideRoster);
      // console.log('[BoxScoreInput] Current Red Roster State:', redSideRoster);

      let blueTeamId: string | undefined;
      let redTeamId: string | undefined;

      // Re-determine IDs for context
      if (values.is_external_match) { blueTeamId = values.team_1; redTeamId = values.team_2; }
      else { blueTeamId = (values.team_side === 'BLUE' ? values.our_team : values.opponent_team); redTeamId = (values.team_side === 'RED' ? values.our_team : values.opponent_team); }
      // console.log(`[BoxScoreInput Population Effect] Blue Team ID: ${blueTeamId}, Red Team ID: ${redTeamId}`);

      const processPlayerSlot = (index: number, teamId: string | undefined, roster: Player[], fieldPrefix: 'team_players' | 'enemy_players') => {
          const side = fieldPrefix === 'team_players' ? 'Blue' : 'Red';
          const player = teamId ? roster[index] : undefined;
          const isOurTeamFlag = (values.is_external_match ? false : (fieldPrefix === 'team_players' && values.team_side === 'BLUE') || (fieldPrefix === 'enemy_players' && values.team_side === 'RED'));
          const baseEmptyStat = getEmptyPlayerStat(isOurTeamFlag);

          // console.log(`[BoxScoreInput] Processing Slot ${index} for ${side} Side (Team ID: ${teamId})`);

          if (player) {
              // console.log(`[BoxScoreInput]   Populating Slot ${index} (${side}) with player:`, player);
              setFieldValue(`${fieldPrefix}[${index}].ign`, player.current_ign || '');
              setFieldValue(`${fieldPrefix}[${index}].player_id`, player.player_id);
              setFieldValue(`${fieldPrefix}[${index}].role_played`, player.primary_role || '');
              // Keep other fields as default ONLY IF they are currently empty/default
              // This prevents overwriting user input if they manually changed stats before roster loaded
              if(!values[fieldPrefix]?.[index]?.kills) setFieldValue(`${fieldPrefix}[${index}].kills`, baseEmptyStat.kills);
              if(!values[fieldPrefix]?.[index]?.deaths) setFieldValue(`${fieldPrefix}[${index}].deaths`, baseEmptyStat.deaths);
              if(!values[fieldPrefix]?.[index]?.assists) setFieldValue(`${fieldPrefix}[${index}].assists`, baseEmptyStat.assists);
              if(!values[fieldPrefix]?.[index]?.kda) setFieldValue(`${fieldPrefix}[${index}].kda`, baseEmptyStat.kda);
              if(!values[fieldPrefix]?.[index]?.medal) setFieldValue(`${fieldPrefix}[${index}].medal`, baseEmptyStat.medal);
              if(!values[fieldPrefix]?.[index]?.damage_dealt) setFieldValue(`${fieldPrefix}[${index}].damage_dealt`, baseEmptyStat.damage_dealt);
              if(!values[fieldPrefix]?.[index]?.damage_taken) setFieldValue(`${fieldPrefix}[${index}].damage_taken`, baseEmptyStat.damage_taken);
              if(!values[fieldPrefix]?.[index]?.turret_damage) setFieldValue(`${fieldPrefix}[${index}].turret_damage`, baseEmptyStat.turret_damage);
              if(!values[fieldPrefix]?.[index]?.gold_earned) setFieldValue(`${fieldPrefix}[${index}].gold_earned`, baseEmptyStat.gold_earned);
              if(!values[fieldPrefix]?.[index]?.player_notes) setFieldValue(`${fieldPrefix}[${index}].player_notes`, baseEmptyStat.player_notes);
              setFieldValue(`${fieldPrefix}[${index}].is_our_team`, isOurTeamFlag);
              setFieldValue(`${fieldPrefix}[${index}].is_blue_side`, fieldPrefix === 'team_players');
          } else {
              // console.log(`[BoxScoreInput]   Clearing Slot ${index} (${side}) - No player found in roster or no team ID.`);
              // Clear only if the player slot is currently populated by pre-population (check player_id)
              if (values[fieldPrefix]?.[index]?.player_id) {
                  // --- MODIFIED: Only clear roster-derived fields --- 
                  // setFieldValue(`${fieldPrefix}[${index}]`, baseEmptyStat); // DON'T reset the whole object
                  setFieldValue(`${fieldPrefix}[${index}].player_id`, null);
                  setFieldValue(`${fieldPrefix}[${index}].ign`, '');
                  setFieldValue(`${fieldPrefix}[${index}].role_played`, ''); // Or set to baseEmptyStat.role_played if preferred
                  // Leave hero_played, kills, deaths, assists, etc. untouched
                  // --- END MODIFICATION ---
              }
              // Ensure flags are correct even when not clearing full stat line
              setFieldValue(`${fieldPrefix}[${index}].is_our_team`, isOurTeamFlag);
              setFieldValue(`${fieldPrefix}[${index}].is_blue_side`, fieldPrefix === 'team_players');
          }
      };

      // Only run population if rosters have loaded to avoid clearing fields unnecessarily
      if (!Object.values(rosterLoading).some(Boolean)) { 
          for (let i = 0; i < 5; i++) {
              processPlayerSlot(i, blueTeamId, blueSideRoster, 'team_players');
              processPlayerSlot(i, redTeamId, redSideRoster, 'enemy_players');
          }
      }

  // Depend on fetched rosters and team selection that affects *which* roster applies to blue/red
  }, [blueSideRoster, redSideRoster, values.is_external_match, values.team_side, values.our_team, values.opponent_team, values.team_1, values.team_2, setFieldValue, rosterLoading]); 
  // --- End Moved Logic ---

  // --- Hero Filtering Functions (Conditionally include bans) --- 
  const getAvailableHeroesForSlot = (currentHeroForThisSlot: Hero | null): Hero[] => {
    if (!availableHeroes) return [];
    const allSelectedPicks = [
      ...(values.team_players || []).map(p => p?.hero_played).filter(Boolean),
      ...(values.enemy_players || []).map(p => p?.hero_played).filter(Boolean)
    ] as Hero[];
    
    // --- Conditionally add bans to the filter --- 
    const allSelectedBans = includeDraftInfo ? [
      ...(values.blueBans || []).filter(Boolean),
      ...(values.redBans || []).filter(Boolean)
    ] as Hero[] : [];
    // --- End Condition ---

    const otherSelectedHeroIds = new Set([
      ...allSelectedPicks,
      ...allSelectedBans
    ]
      .filter(hero => hero && hero.id !== currentHeroForThisSlot?.id) 
      .map(hero => hero.id)
    );
    return availableHeroes.filter(hero => !otherSelectedHeroIds.has(hero.id));
  };

  // --- NEW: Function to get available heroes for a BAN slot --- 
  const getAvailableHeroesForBanSlot = (currentHeroForThisBanSlot: Hero | null): Hero[] => {
    if (!availableHeroes) return [];

    const allSelectedPicks = [
      ...(values.team_players || []).map(p => p?.hero_played).filter(Boolean),
      ...(values.enemy_players || []).map(p => p?.hero_played).filter(Boolean)
    ] as Hero[];
    const allSelectedBans = [
      ...(values.blueBans || []).filter(Boolean),
      ...(values.redBans || []).filter(Boolean)
    ] as Hero[];

    const otherSelectedHeroIds = new Set([
        ...allSelectedPicks,
        ...allSelectedBans
    ]
      .filter(hero => hero && hero.id !== currentHeroForThisBanSlot?.id) 
      .map(hero => hero.id)
    );
    return availableHeroes.filter(hero => !otherSelectedHeroIds.has(hero.id));
  };
  // --- END NEW FUNCTIONS ---

  // --- NEW: Handle Ban Change --- 
  const handleBanChange = (side: 'blue' | 'red', index: number, hero: Hero | null) => {
    const fieldName = side === 'blue' ? 'blueBans' : 'redBans';
    setFieldValue(`${fieldName}[${index}]`, hero);
  };
  // --- END NEW HANDLER ---

  // --- NEW: Helper for number of bans ---
  const getMaxBans = (format: 'THREE_BANS' | 'FIVE_BANS'): number => {
    return format === 'THREE_BANS' ? 3 : 5;
  };
  // --- END NEW HELPER ---

  // --- Standard 5v5 Pick Order (adjust if needed) ---
  const pickOrderMap: { [key: string]: string[] } = {
    team_players: ['B1', 'B2', 'B3', 'B4', 'B5'], // Blue side picks
    enemy_players: ['R1', 'R2', 'R3', 'R4', 'R5']  // Red side picks - assumes standard draft phase pairing
  };
  // Adjust the full sequence if more detailed pairing is needed later
  // const fullPickOrder = ['B1', 'R1', 'R2', 'B2', 'B3', 'R3', 'R4', 'B4', 'B5', 'R5'];

  // --- NEW: Define Filter Options for Player Autocomplete ---
  // Allow adding a new player type definition
  type PlayerOptionType = Player | { isAddNew?: boolean; ign: string };
  const filter = createFilterOptions<PlayerOptionType>();
  // --- END NEW ---

  const renderTeamBoxScore = (teamLabel: string, fieldNamePrefix: 'team_players' | 'enemy_players', roster: Player[]) => {
    const teamPlayers = values[fieldNamePrefix] || [];

    // Calculate used pick orders for this team
    const getUsedPickOrders = (currentIndex: number): Set<number> => {
        const usedOrders = new Set<number>();
        teamPlayers.forEach((player, index) => {
            if (index !== currentIndex && player?.pick_order && player.pick_order >= 1 && player.pick_order <= 5) {
                usedOrders.add(player.pick_order);
            }
        });
        return usedOrders;
    };

    // Determine team ID for context in Autocomplete
    // This logic mirrors the useEffect hook
    let currentTeamId: string | undefined;
    if (fieldNamePrefix === 'team_players') { // Blue Side
        if (values.is_external_match) { currentTeamId = values.team_1; }
        else { currentTeamId = (values.team_side === 'BLUE' ? values.our_team : values.opponent_team); }
    } else { // Red Side
        if (values.is_external_match) { currentTeamId = values.team_2; }
        else { currentTeamId = (values.team_side === 'RED' ? values.our_team : values.opponent_team); }
    }

    // --- REORDERED & Adjusted Widths ---
    const pickColWidth = includeDraftInfo ? 0.7 : 0;
    const mvpColWidth = 0.5; 
    const remainingWidth = 12 - pickColWidth - mvpColWidth;
    
    // New distribution based on requested order & remainingWidth
    const colWidths = {
      pick: pickColWidth,
      ign: remainingWidth * 0.18, // Player
      role: remainingWidth * 0.10, // Role
      hero: remainingWidth * 0.18, // Hero
      k: remainingWidth * 0.05, // K
      d: remainingWidth * 0.05, // D
      a: remainingWidth * 0.05, // A
      dmg: remainingWidth * 0.08, // DMG Dealt
      dmgTaken: remainingWidth * 0.08, // DMG Taken
      turretDmg: remainingWidth * 0.08, // Turret DMG
      kda: remainingWidth * 0.07, // KDA
      medal: remainingWidth * 0.07, // Medal
      mvpCol: mvpColWidth,
    };
    // Quick sum check - should be close to 12
    // Example (with draft): 0.7 + (10.8 * (0.18*2 + 0.1 + 0.05*3 + 0.08*3 + 0.07*2)) + 0.5 
    // = 1.2 + 10.8 * (0.36 + 0.1 + 0.15 + 0.24 + 0.14) = 1.2 + 10.8 * (0.99) ~= 1.2 + 10.7 = 11.9 (OK)

    return (
      <Grid item xs={12} sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom align="center">{teamLabel}</Typography>
        <Paper elevation={2} sx={{ px: 1, pt: 0.5, pb: 1 }}>
          {/* Header Row - REORDERED */}
          <Grid container spacing={1} sx={{ pb: 0.5, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
             {includeDraftInfo && (
                <Grid item xs={colWidths.pick}><Typography variant="caption">Pick</Typography></Grid>
             )}
             <Grid item xs={colWidths.ign}><Typography variant="caption">Player</Typography></Grid>
             <Grid item xs={colWidths.role}><Typography variant="caption">Role</Typography></Grid>
             <Grid item xs={colWidths.hero}><Typography variant="caption">Hero</Typography></Grid>
             <Grid item xs={colWidths.k}><Typography variant="caption">K</Typography></Grid>
             <Grid item xs={colWidths.d}><Typography variant="caption">D</Typography></Grid>
             <Grid item xs={colWidths.a}><Typography variant="caption">A</Typography></Grid>
             <Grid item xs={colWidths.dmg}><Typography variant="caption">DMG Dealt</Typography></Grid>
             <Grid item xs={colWidths.dmgTaken}><Typography variant="caption">DMG Tkn</Typography></Grid>
             <Grid item xs={colWidths.turretDmg}><Typography variant="caption">Turret</Typography></Grid>
             <Grid item xs={colWidths.kda}><Typography variant="caption">KDA</Typography></Grid>
             <Grid item xs={colWidths.medal}><Typography variant="caption">Medal</Typography></Grid>
             <Grid item xs={colWidths.mvpCol}><Typography variant="caption">MVP</Typography></Grid>
          </Grid>

          {/* Player Data Rows - REORDERED */}
          {Array.from({ length: 5 }).map((_, index) => {
            const playerFieldName = `${fieldNamePrefix}[${index}]`;
            const playerValues = values[fieldNamePrefix]?.[index] || {};
            const selectedPlayerObject = roster.find(p => p.player_id === playerValues.player_id) || null;
            const selectedHero = (playerValues.hero_played as Hero | null) || null;
            const roleFieldName = `${playerFieldName}.role_played`;
            const medalFieldName = `${playerFieldName}.medal`;
            const kdaFieldName = `${playerFieldName}.kda`;
            const pickOrderFieldName = `${playerFieldName}.pick_order`;

            // --- Check if this player is selected as MVP/MVP(L) --- 
            const isSelectedMvp = values.mvp_player_id === playerValues.player_id;

            return (
              <Grid container spacing={1} key={`${fieldNamePrefix}-${index}`} sx={{ mt: 0.5 }} alignItems="center">
                {/* Pick Order Input (Conditional) - REPLACED TextField with Select */} 
                {includeDraftInfo && (
                   <Grid item xs={colWidths.pick}>
                     <FormControl fullWidth size="small">
                         {/* Intentionally no InputLabel here to keep it compact like the TextField */}
                         <Select
                             id={`${fieldNamePrefix}-${index}-pick-order`}
                             value={playerValues.pick_order ?? ''} // Use empty string for null/undefined
                             displayEmpty // Allow showing empty value
                             onChange={(event: SelectChangeEvent<string | number>) => {
                                 const value = event.target.value;
                                 const pickOrderValue = value === '' ? null : Number(value);
                                 setFieldValue(pickOrderFieldName, pickOrderValue);
                             }}
                             sx={{ textAlign: 'center' }} // Center the selected value
                         >
                             <MenuItem value="">
                                 <em>-</em> {/* Represent None with a dash */}
                             </MenuItem>
                             {[1, 2, 3, 4, 5].map((order) => {
                                 const usedOrders = getUsedPickOrders(index);
                                 const isDisabled = usedOrders.has(order);
                                 const currentPickOrder = playerValues.pick_order;
                                 const shouldDisable = isDisabled && currentPickOrder !== order;
                                 return (
                                     <MenuItem key={order} value={order} disabled={shouldDisable}>
                                         {order}
                                     </MenuItem>
                                 );
                             })}
                         </Select>
                     </FormControl>
                   </Grid>
                )}
                {/* Player (IGN) Autocomplete */}
                <Grid item xs={colWidths.ign}>
                   <Autocomplete<PlayerOptionType,
                      false,
                      false,
                      true
                   >
                        // --- MODIFIED: Add freeSolo and custom filtering/rendering ---
                        freeSolo
                        options={roster} // Base options are the fetched roster
                        value={selectedPlayerObject} // Value is still the selected Player object or null
                        filterOptions={(options, params) => {
                          const filtered = filter(options.filter(opt => !(opt as any).isAddNew), params); // Filter existing players first
                          const { inputValue } = params;
                          // Suggest the creation of a new player if input doesn't match existing
                          const isExisting = options.some(option => !(option as any).isAddNew && inputValue === (option as Player).current_ign);
                          if (inputValue !== '' && !isExisting) {
                            filtered.push({ isAddNew: true, ign: inputValue });
                          }
                          return filtered;
                        }}
                        renderOption={(props, option) => {
                          if ((option as any).isAddNew) {
                            // Ensure correct type assertion/check before accessing ign
                            const addNewOption = option as { isAddNew?: boolean; ign: string };
                            return <li {...props}>Add "{addNewOption.ign}" as new player</li>;
                          }
                          // Cast to Player for clarity, or handle potential null/undefined if needed
                          const playerOption = option as Player;
                          return <li {...props}>{playerOption.current_ign || 'Unknown IGN'}</li>;
                        }}
                        getOptionLabel={(option) => {
                           // Handle string input from freeSolo typing
                           if (typeof option === 'string') { return option; }
                           // Handle "Add new" option object
                           if ((option as any).isAddNew) {
                              // Ensure correct type assertion/check
                              const addNewOption = option as { isAddNew?: boolean; ign: string };
                              return addNewOption.ign;
                           }
                           // Handle Player object
                           // Cast to Player for clarity, or handle potential null/undefined if needed
                           const playerOption = option as Player | null; // Allow null? Check usage
                           if (playerOption && playerOption.current_ign) { return playerOption.current_ign; }
                           return ''; // Default
                         }}
                        isOptionEqualToValue={(option, value) => {
                          // Important: Ensure comparison works correctly with our custom option type
                          // Check if either is the AddNew type before comparing player_id
                          if (!value || (value as any).isAddNew || !option || (option as any).isAddNew) return false;
                          // Now safe to assume both are Player types (or null/undefined handled by initial check)
                          return (option as Player).player_id === (value as Player).player_id;
                        }}
                        onChange={(event, newValue, reason) => {
                            console.log(`[BoxScoreInput Player onChange ${fieldNamePrefix}[${index}]]`, { newValue, reason });
                            const playerFieldName = `${fieldNamePrefix}[${index}]`;
                            if (typeof newValue === 'string') {
                              // User typed a string and didn't select an option (e.g., pressed Enter)
                              // Treat this as wanting to add the player
                               if (currentTeamId && newValue.trim()) {
                                  // Fix: Use explicit property assignment, not shorthand
                                  setNewPlayerData({ ign: newValue.trim(), teamId: currentTeamId, teamName: teamLabel, rosterIndex: index, fieldPrefix: fieldNamePrefix });
                                  setIsAddPlayerDialogOpen(true);
                               } else {
                                  console.error("Cannot add player: Team ID missing or IGN empty.");
                                  // Maybe show a snackbar error?
                                  // Clear the selection if invalid?
                                  setFieldValue(`${playerFieldName}.player_id`, null);
                                  setFieldValue(`${playerFieldName}.ign`, '');
                                  setFieldValue(`${playerFieldName}.role_played`, '');
                               }
                            } else if (newValue && (newValue as any).isAddNew) {
                              // User clicked the "Add new..." option
                              if (currentTeamId) {
                                // Ensure correct type assertion/check and explicit property assignment
                                const addNewOption = newValue as { isAddNew?: boolean; ign: string };
                                setNewPlayerData({ ign: addNewOption.ign, teamId: currentTeamId, teamName: teamLabel, rosterIndex: index, fieldPrefix: fieldNamePrefix });
                                setIsAddPlayerDialogOpen(true);
                              } else {
                                console.error("Cannot add player: Team ID is missing.");
                                // Maybe show a snackbar error?
                              }
                            } else {
                              // User selected an existing player (newValue is Player or null)
                              const player = newValue as Player | null;
                              setFieldValue(`${playerFieldName}.player_id`, player ? player.player_id : null);
                              setFieldValue(`${playerFieldName}.ign`, player ? player.current_ign || '' : '');
                              setFieldValue(`${playerFieldName}.role_played`, player ? player.primary_role || '' : '');
                            }
                        }}
                        onBlur={handleBlur} // Keep Formik blur handling
                        size="small"
                        fullWidth
                        // Use the selectedPlayerObject.current_ign for the input display if available, 
                        // otherwise let Autocomplete handle display based on getOptionLabel and typed value.
                        renderInput={(params) => 
                           <TextField 
                              {...params} 
                              name={`${playerFieldName}.ign`} // Keep name for formik touch detection
                              variant="outlined" 
                           />
                        }
                    />
                </Grid>
                {/* Role Select */}
                <Grid item xs={colWidths.role}>
                  <FormControl fullWidth size="small" variant="outlined">
                    <Select name={roleFieldName} value={playerValues.role_played ?? ''} onChange={handleChange} onBlur={handleBlur} displayEmpty>
                       {ROLE_CHOICES.map(role => ( <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem> ))}
                    </Select>
                  </FormControl>
                </Grid>
                {/* Hero Autocomplete */}
                <Grid item xs={colWidths.hero}>
                   <Autocomplete
                        // --- Use the filtered list for options --- 
                        options={getAvailableHeroesForSlot(selectedHero)}
                        // -----------------------------------------
                        getOptionLabel={(option) => {
                            if (typeof option === 'object' && option && option.name) {
                              return option.name;
                            }
                            return '';
                          }}
                        value={selectedHero}
                        isOptionEqualToValue={(option, value) => option.id === value?.id}
                        onChange={(e, newValue) => {
                            console.log(`[BoxScoreInput Hero onChange ${fieldNamePrefix}[${index}]]`, { 
                              newValueObject: newValue, 
                            });
                            setFieldValue(`${playerFieldName}.hero_played`, newValue);
                        }}
                        size="small"
                        renderInput={(params) => <TextField {...params} variant="outlined" />}
                    />
                </Grid>
                {/* Kills Input */}
                <Grid item xs={colWidths.k}>
                   <TextField name={`${playerFieldName}.kills`} value={playerValues.kills ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0, style: { textAlign: 'center' } } }} />
                </Grid>
                {/* Deaths Input */}
                <Grid item xs={colWidths.d}>
                   <TextField name={`${playerFieldName}.deaths`} value={playerValues.deaths ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0, style: { textAlign: 'center' } } }} />
                </Grid>
                {/* Assists Input */}
                <Grid item xs={colWidths.a}>
                   <TextField name={`${playerFieldName}.assists`} value={playerValues.assists ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0, style: { textAlign: 'center' } } }} />
                </Grid>
                {/* Damage Dealt */}
                <Grid item xs={colWidths.dmg}>
                   <TextField name={`${playerFieldName}.damage_dealt`} value={playerValues.damage_dealt ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0 } }} />
                </Grid>
                {/* Damage Taken */}
                <Grid item xs={colWidths.dmgTaken}>
                   <TextField name={`${playerFieldName}.damage_taken`} value={playerValues.damage_taken ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0 } }} />
                </Grid>
                {/* Turret Damage */}
                <Grid item xs={colWidths.turretDmg}>
                   <TextField name={`${playerFieldName}.turret_damage`} value={playerValues.turret_damage ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { min: 0 } }} />
                </Grid>
                 {/* KDA Input */}
                <Grid item xs={colWidths.kda}>
                   <TextField name={kdaFieldName} value={playerValues.kda ?? ''} onChange={handleChange} onBlur={handleBlur} type="number" size="small" variant="outlined" InputProps={{ inputProps: { step: "0.01", min: 0, style: { textAlign: 'right' } } }} />
                </Grid>
                 {/* Medal Select */}
                <Grid item xs={colWidths.medal}>
                    {(() => {
                      const labelId = `${fieldNamePrefix}-${index}-medal-label`;
                      const selectId = `${fieldNamePrefix}-${index}-medal-select`;
                      return (
                        <FormControl fullWidth size="small" variant="outlined">
                          <Select
                            labelId={labelId}
                            id={selectId}
                            name={medalFieldName}
                            value={playerValues.medal ?? ''}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            displayEmpty
                          >
                            {MEDAL_CHOICES.map(medal => (
                              <MenuItem key={medal.value} value={medal.value}>{medal.label}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      );
                    })()}
                </Grid>
                {/* MVP Icon Button */}
                <Grid item xs={colWidths.mvpCol} sx={{ textAlign: 'center' }}>
                  <IconButton 
                    size="small" 
                    color={isSelectedMvp ? "warning" : "default"}
                    onClick={() => {
                      // --- SIMPLIFIED onClick ---
                      setFieldValue('mvp_player_id', isSelectedMvp ? null : playerValues.player_id);
                      // --- No need to check mvp_loss_player_id ---
                    }}
                    disabled={!playerValues.player_id} 
                  >
                    {isSelectedMvp ? <StarIcon /> : <StarBorderIcon />}
                  </IconButton>
                </Grid>
              </Grid>
            );
          })}
        </Paper>
      </Grid>
    );
  };

  // --- NEW: Add Player Dialog Submission Handler ---
  const handleAddNewPlayerSubmit = async (playerData: { ign: string; primary_role: string | null }) => {
    if (!newPlayerData) {
      console.error("Cannot submit new player: Context data missing.");
      setDialogError("An internal error occurred. Please close and try again.");
      return;
    }
    setDialogError(null);
    setIsDialogSubmitting(true);
    try {
      const newPlayer = await addPlayerToTeam(newPlayerData.teamId, playerData); 
      if (newPlayer) {
        console.log("New player added:", newPlayer);
        // Update the correct roster state
        if (newPlayerData.fieldPrefix === 'team_players') {
          setBlueSideRoster(prevRoster => [...prevRoster, newPlayer]);
        } else {
          setRedSideRoster(prevRoster => [...prevRoster, newPlayer]);
        }
        // Update the formik state for the specific slot
        const playerFieldName = `${newPlayerData.fieldPrefix}[${newPlayerData.rosterIndex}]`;
        setFieldValue(`${playerFieldName}.player_id`, newPlayer.player_id);
        setFieldValue(`${playerFieldName}.ign`, newPlayer.current_ign || '');
        setFieldValue(`${playerFieldName}.role_played`, newPlayer.primary_role || ''); // Pre-fill role
        // Keep existing stats if any, otherwise they are default
        setIsAddPlayerDialogOpen(false);
        setNewPlayerData(null);
      } else {
         // Should not happen if API call is successful and returns data, but handle defensively
         throw new Error("API returned success but no player data.");
      }
    } catch (error: any) {
      console.error("Error adding new player:", error);
      setDialogError(error.response?.data?.error || error.message || "Failed to add player. Please try again.");
    } finally {
      setIsDialogSubmitting(false);
    }
  };
  // --- END NEW HANDLER ---

  return (
    <Box sx={{ width: '100%' }}>
      {/* --- Conditionally render Draft Format Selector & Ban Section --- */} 
      {includeDraftInfo && (
        <>
          <FormControl sx={{ mb: 3, minWidth: 200 }} size="small">
            <InputLabel id="draft-format-select-label">Draft Format</InputLabel>
            <Select
              labelId="draft-format-select-label"
              id="draft-format-select"
              name="draft_format" // Ensure name matches Formik field
              value={values.draft_format}
              label="Draft Format"
              onChange={handleChange} // Use Formik's handleChange
              onBlur={handleBlur}
            >
              <MenuItem value={'THREE_BANS'}>3 Bans per team</MenuItem>
              <MenuItem value={'FIVE_BANS'}>5 Bans per team</MenuItem>
            </Select>
          </FormControl>
          
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Ban Phase</Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Blue Side Bans */} 
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <Typography variant="subtitle1" gutterBottom>Blue Side Bans</Typography>
                {/* --- Use getMaxBans --- */}
                {Array.from({ length: getMaxBans(values.draft_format) }).map((_, index) => (
                  <Box sx={{ mb: 2 }} key={`blue-ban-${index}`}>
                    <Autocomplete
                      value={values.blueBans?.[index] || null}
                      onChange={(_, newValue) => handleBanChange('blue', index, newValue)}
                      options={getAvailableHeroesForBanSlot(values.blueBans?.[index])}
                      getOptionLabel={(option) => option?.name || ''} // Safe access
                      isOptionEqualToValue={(option, value) => option?.id === value?.id}
                      renderInput={(params) => (
                        <TextField {...params} label={`Ban ${index + 1}`} variant="outlined" fullWidth size="small" />
                      )}
                      // Add loading/disabled state if needed based on availableHeroes fetch
                    />
                  </Box>
                ))}
              </Paper>
            </Grid>
            {/* Red Side Bans */} 
            <Grid item xs={12} md={6}>
               <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Typography variant="subtitle1" gutterBottom>Red Side Bans</Typography>
                {/* --- Use getMaxBans --- */}
                {Array.from({ length: getMaxBans(values.draft_format) }).map((_, index) => (
                  <Box sx={{ mb: 2 }} key={`red-ban-${index}`}>
                    <Autocomplete
                      value={values.redBans?.[index] || null}
                      onChange={(_, newValue) => handleBanChange('red', index, newValue)}
                      options={getAvailableHeroesForBanSlot(values.redBans?.[index])}
                      getOptionLabel={(option) => option?.name || ''} // Safe access
                      isOptionEqualToValue={(option, value) => option?.id === value?.id}
                      renderInput={(params) => (
                        <TextField {...params} label={`Ban ${index + 1}`} variant="outlined" fullWidth size="small" />
                      )}
                      // Add loading/disabled state if needed
                    />
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
      {/* --------------------------------------------------------- */}

      {/* --- Player Stats & Picks Section (Title adjusted) --- */} 
      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
        {includeDraftInfo ? 'Player Stats & Picks' : 'Player Stats'}
      </Typography>
      <Grid container spacing={0}> {/* Assuming Box Scores are direct children? Might need adjustment */} 
      {renderTeamBoxScore(team1Label, 'team_players', blueSideRoster)}
      {renderTeamBoxScore(team2Label, 'enemy_players', redSideRoster)}
                </Grid>
       {rosterError && <Alert severity="error" sx={{ mt: 2 }}>{rosterError}</Alert>}

      {/* --- NEW: Render Add Player Dialog --- */}
      {/* Ensure newPlayerData is not null before rendering/accessing props */}
      {newPlayerData && (
          <AddNewPlayerDialog
               open={isAddPlayerDialogOpen}
               onClose={() => {
                   setIsAddPlayerDialogOpen(false);
                   setNewPlayerData(null); // Clear context data on close
                   setDialogError(null); // Clear errors
                   setIsDialogSubmitting(false); // Reset submitting state
               }}
               onSubmit={handleAddNewPlayerSubmit}
               initialIgn={newPlayerData.ign} // Null check handled by outer condition
               teamName={newPlayerData.teamName} // Null check handled by outer condition
               availableRoles={ROLE_CHOICES} // Pass available roles
               error={dialogError} // Pass error message to dialog
               isSubmitting={isDialogSubmitting}
          />
      )}
      {/* --- END NEW --- */}
    </Box>
  );
};

export default BoxScoreInput;