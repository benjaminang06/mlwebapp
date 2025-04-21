import React from 'react';
import { FormikProps } from 'formik';
import { Box, Typography, Paper, Button, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Tooltip } from '@mui/material';
import { MatchFormData, PlayerMatchStat } from '../../types/match.types'; // Adjust path
import { Team } from '../../types/team.types'; // Adjust path
import { Hero } from '../../types/hero.types'; // Adjust path
import { formatDuration } from '../../utils/matchUtils'; // Adjust path
import StarIcon from '@mui/icons-material/Star'; // Import Star icon for MVP

interface ReviewStepProps {
  values: MatchFormData;
  getTeamName: (teamId: string | undefined) => string;
  getHeroName: (heroValue: Hero | Partial<Hero> | string | null | undefined) => string;
  includeDraftInfo: boolean | null;
  navigateToStep: (step: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({ 
  values, 
  getTeamName,
  getHeroName,
  includeDraftInfo,
  navigateToStep, 
  onBack,
  onSubmit
}) => {
  const { team_players, enemy_players } = values;
  
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Invalid Date';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
  };
  
  const formatTime = (timeString: string): string => {
    if (!timeString) return 'Invalid Time';
    const date = new Date(timeString);
    return isNaN(date.getTime()) ? 'Invalid Time' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };
  
  const renderHero = (hero: Hero | string | number | null | undefined): string => {
    if (!hero) return '-';
    if (typeof hero === 'string') return hero;
    if (typeof hero === 'number') return `Hero ID ${hero}`; // Fallback
    return hero.name || 'Unknown Hero';
  };

  const getOutcomeText = () => {
    if (values.is_external_match) {
      const winnerId = values._temp_winning_team_id?.toString();
      const blueTeamName = getTeamName(values.team_1);
      const redTeamName = getTeamName(values.team_2);
      if (winnerId === values.team_1) return `${blueTeamName} Victory`;
      if (winnerId === values.team_2) return `${redTeamName} Victory`;
      return 'N/A'; // Should not happen if validation passed
    } else {
      return values.match_result === 'VICTORY' ? 'Victory' : values.match_result === 'DEFEAT' ? 'Defeat' : 'N/A';
    }
  };

  const formattedDuration = formatDuration(
      values.match_duration_hours,
      values.match_duration_minutes,
      values.match_duration_seconds
  );

  // Find selected players for MVP display
  const allPlayersForMvp = [...team_players, ...enemy_players];
  const mvpPlayer = allPlayersForMvp.find(p => p.player_id === values.mvp_player_id);
  const mvpLossPlayer = allPlayersForMvp.find(p => p.player_id === values.mvp_loss_player_id);

  // Helper to format Medal display
  const formatMedal = (medal?: string | null): string => {
      if (!medal) return '-';
      return medal.charAt(0).toUpperCase() + medal.slice(1).toLowerCase(); // Capitalize (e.g., GOLD -> Gold)
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Review Match Data</Typography>
      
      {/* Match Details Section */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Match Details</Typography>
          <Button size="small" onClick={() => navigateToStep(0)}>Edit</Button>
        </Box>
        <Grid container spacing={2}>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Match Type</Typography> <Typography variant="body1">{values.is_external_match ? 'External Match' : 'Our Team\'s Match'}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Date & Time</Typography> <Typography variant="body1">{formatDate(values.match_datetime)} at {formatTime(values.match_datetime)}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Match Outcome</Typography> <Typography variant="body1">{getOutcomeText()}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Scrim Type</Typography> <Typography variant="body1">{values.scrim_type || 'N/A'}</Typography> </Grid>
            {!values.is_external_match && ( <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Team Side</Typography> <Typography variant="body1">{values.team_side || 'N/A'}</Typography> </Grid> )}
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Game Number</Typography> <Typography variant="body1">{values.game_number}</Typography> </Grid>
            {formattedDuration && ( <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Match Duration</Typography> <Typography variant="body1">{formattedDuration}</Typography> </Grid> )}
            {mvpPlayer && <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">MVP</Typography> <Typography variant="body1">{mvpPlayer.ign || `Player ID ${mvpPlayer.player_id}`}</Typography> </Grid>}
            {mvpLossPlayer && <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">MVP (Loss)</Typography> <Typography variant="body1">{mvpLossPlayer.ign || `Player ID ${mvpLossPlayer.player_id}`}</Typography> </Grid>}
        </Grid>
      </Paper>
      
      {/* --- NEW: Conditional Bans Section --- */}
      {includeDraftInfo && (
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Draft Bans</Typography>
            {/* Optional: Add Edit button if bans are editable in a specific step */}
            {/* <Button size="small" onClick={() => navigateToStep(STEP_INDEX_FOR_DRAFT)}>Edit</Button> */}
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Blue Side Bans</Typography>
                <Typography variant="body1">
                    {values.blueBans?.filter(Boolean).map((hero) => getHeroName(hero)).join(', ') || 'None'}
                </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Red Side Bans</Typography>
                <Typography variant="body1">
                    {values.redBans?.filter(Boolean).map((hero) => getHeroName(hero)).join(', ') || 'None'}
                </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
      {/* --- END NEW Bans Section --- */}
      
      {/* --- REMOVED Old Draft Section relying on values.draft --- */}
      {/* {values.draft.trackDraft && ( ... )} */}
      
      {/* --- RESTRUCTURED Player Stats Sections --- */}
      {[ 
        { sideLabel: 'Blue Side', players: team_players, editStep: 1 /* Assuming step 1 is BoxScoreInput */ },
        { sideLabel: 'Red Side', players: enemy_players, editStep: 1 },
      ].map((teamData, teamIndex) => (
        <Paper key={teamIndex} elevation={2} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">{teamData.sideLabel} Players</Typography>
            <Button size="small" onClick={() => navigateToStep(teamData.editStep)}>Edit</Button>
          </Box>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'auto' }}>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 'bold', whiteSpace: 'nowrap', p: 1 } }}>
                  {includeDraftInfo && <TableCell align="center">Pick</TableCell>}
                  <TableCell>Player</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Hero</TableCell>
                  <TableCell align="center">K</TableCell>
                  <TableCell align="center">D</TableCell>
                  <TableCell align="center">A</TableCell>
                  <TableCell align="right">DMG Dealt</TableCell>
                  <TableCell align="right">DMG Tkn</TableCell>
                  <TableCell align="right">Turret DMG</TableCell>
                  <TableCell align="right">KDA</TableCell>
                  <TableCell align="center">Medal</TableCell>
                  {/* Gold column removed to match BoxScoreInput closer */}
                  {/* <TableCell align="right">Gold</TableCell> */} 
                </TableRow>
              </TableHead>
              <TableBody>
                {teamData.players.map((player: Partial<PlayerMatchStat>, idx: number) => {
                  const kdaValue = typeof player.kda === 'number' 
                      ? player.kda 
                      : parseFloat(String(player.kda));
                  const formattedKDA = !isNaN(kdaValue) ? kdaValue.toFixed(2) : '-';
                  const isMvp = player.player_id === values.mvp_player_id;
                  const isMvpLoss = player.player_id === values.mvp_loss_player_id;

                  return (
                    <TableRow key={`${teamData.sideLabel}-${idx}`} sx={{ '& td': { p: 1 } }}>
                      {includeDraftInfo && <TableCell align="center">{player.pick_order ?? '-'}</TableCell>}
                      <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                          {player.ign || `Player ${idx + 1}`}
                          {isMvp && <Tooltip title="MVP"><StarIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', color: 'gold', ml: 0.5 }} /></Tooltip>}
                          {isMvpLoss && <Tooltip title="MVP (Loss)"><StarIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', color: 'silver', ml: 0.5 }} /></Tooltip>}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{player.role_played || '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{getHeroName(player.hero_played)}</TableCell>
                      <TableCell align="center">{player.kills ?? '-'}</TableCell>
                      <TableCell align="center">{player.deaths ?? '-'}</TableCell>
                      <TableCell align="center">{player.assists ?? '-'}</TableCell>
                      <TableCell align="right">{player.damage_dealt ?? '-'}</TableCell>
                      <TableCell align="right">{player.damage_taken ?? '-'}</TableCell>
                      <TableCell align="right">{player.turret_damage ?? '-'}</TableCell>
                      <TableCell align="right">{formattedKDA}</TableCell>
                      <TableCell align="center">{formatMedal(player.medal)}</TableCell>
                      {/* <TableCell align="right">{player.gold_earned ?? '-'}</TableCell> */}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ))}
      {/* --- END RESTRUCTURED Player Stats --- */}
      
      {/* Notes Section */}
      {values.general_notes && (
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
             <Typography variant="subtitle1" fontWeight="bold">General Notes</Typography>
             <Button size="small" onClick={() => navigateToStep(0)}>Edit</Button>
          </Box>
          <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>{values.general_notes}</Typography>
        </Paper>
      )}
      
      {/* Action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" color="primary" onClick={onSubmit}>Submit Match</Button>
      </Box>
    </Box>
  );
};

export default ReviewStep; 