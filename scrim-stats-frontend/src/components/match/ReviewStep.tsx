import React from 'react';
import { FormikProps } from 'formik';
import { Box, Typography, Paper, Button, Grid } from '@mui/material';
import { MatchFormData, PlayerMatchStat } from '../../types/match.types'; // Adjust path
import { Team } from '../../types/team.types'; // Adjust path
import { Hero } from '../../types/hero.types'; // Adjust path
import { formatDuration } from '../../utils/matchUtils'; // Adjust path

interface ReviewStepProps {
  formik: FormikProps<MatchFormData>;
  teams: Team[]; // Pass all teams for getTeamName
  onBack: () => void;
  onSubmit: () => void;
  navigateToStep: (step: number) => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({ 
  formik, 
  teams: reviewTeams, // Rename prop to avoid conflict
  onBack, 
  onSubmit, 
  navigateToStep 
}) => {
  const { values } = formik;
  
  // Helper function to find team by ID
  const getTeamName = (teamId: string | undefined): string => {
    if (!teamId) return 'N/A';
    const team = reviewTeams.find(t => String(t.team_id) === teamId);
    return team ? team.team_name : 'Unknown Team';
  };

  // Get team names based on match type
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
  
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Invalid Date';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
  };
  
  const formatTime = (timeString: string): string => {
    if (!timeString) return 'Invalid Time';
    const time = new Date(timeString);
    return isNaN(time.getTime()) ? 'Invalid Time' : time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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
  const allPlayersForMvp = [...values.team_players, ...values.enemy_players];
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
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">{teamInfo.team1Label}</Typography> <Typography variant="body1">{teamInfo.team1Value}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">{teamInfo.team2Label}</Typography> <Typography variant="body1">{teamInfo.team2Value}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Match Outcome</Typography> <Typography variant="body1">{getOutcomeText()}</Typography> </Grid>
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Scrim Type</Typography> <Typography variant="body1">{values.scrim_type || 'N/A'}</Typography> </Grid>
            {!values.is_external_match && ( <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Team Side</Typography> <Typography variant="body1">{values.team_side || 'N/A'}</Typography> </Grid> )}
            <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Game Number</Typography> <Typography variant="body1">{values.game_number}</Typography> </Grid>
            {formattedDuration && ( <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">Match Duration</Typography> <Typography variant="body1">{formattedDuration}</Typography> </Grid> )}
            {mvpPlayer && <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">MVP</Typography> <Typography variant="body1">{mvpPlayer.ign || `Player ID ${mvpPlayer.player_id}`}</Typography> </Grid>}
            {mvpLossPlayer && <Grid item xs={12} md={6}> <Typography variant="body2" color="text.secondary">MVP (Loss)</Typography> <Typography variant="body1">{mvpLossPlayer.ign || `Player ID ${mvpLossPlayer.player_id}`}</Typography> </Grid>}
        </Grid>
      </Paper>
      
      {/* Draft Section */}
      {values.draft.trackDraft && (
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Draft</Typography>
            <Button size="small" onClick={() => navigateToStep(1)}>Edit</Button>
          </Box>
           <Typography variant="body2" color="text.secondary">Format</Typography>
           <Typography variant="body1">{values.draft.format === '6_BANS' ? '6 Bans (3 per team)' : '10 Bans (5 per team)'}</Typography>
           <Box sx={{ mt: 2 }}>
             <Typography variant="body2" color="text.secondary">Blue Side Bans</Typography>
             <Typography variant="body1">{values.draft.blueSideBans?.filter(Boolean).map((hero: Hero | null) => hero?.name).join(', ') || 'None'}</Typography>
           </Box>
           <Box sx={{ mt: 2 }}>
             <Typography variant="body2" color="text.secondary">Red Side Bans</Typography>
             <Typography variant="body1">{values.draft.redSideBans?.filter(Boolean).map((hero: Hero | null) => hero?.name).join(', ') || 'None'}</Typography>
           </Box>
           <Box sx={{ mt: 2 }}>
             <Typography variant="body2" color="text.secondary">Blue Side Picks</Typography>
             <Typography variant="body1">{values.draft.blueSidePicks?.filter(Boolean).map((hero: Hero | null) => hero?.name).join(', ') || 'None'}</Typography>
           </Box>
           <Box sx={{ mt: 2 }}>
             <Typography variant="body2" color="text.secondary">Red Side Picks</Typography>
             <Typography variant="body1">{values.draft.redSidePicks?.filter(Boolean).map((hero: Hero | null) => hero?.name).join(', ') || 'None'}</Typography>
           </Box>
           {values.draft.notes && (
             <Box sx={{ mt: 2 }}>
               <Typography variant="body2" color="text.secondary">Draft Notes</Typography>
               <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>{values.draft.notes}</Typography>
             </Box>
           )}
        </Paper>
      )}
      
      {/* Team Players Section (Blue Side) */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {teamInfo.team1Label === 'Blue Side Team' ? (getTeamName(values.team_1) || 'Blue Side') : teamInfo.team1Value} Players
          </Typography>
          <Button size="small" onClick={() => navigateToStep(2)}>Edit</Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                <th style={{ padding: '8px', textAlign: 'left', width: '18%' }}>Player</th>
                <th style={{ padding: '8px', textAlign: 'left', width: '18%' }}>Hero</th>
                <th style={{ padding: '8px', textAlign: 'left', width: '12%' }}>Role</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>K/D/A</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>KDA</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>Medal</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>Damage</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>DMG Tkn</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>Turret</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>Gold</th>
              </tr>
            </thead>
            <tbody>
              {values.team_players.map((player: Partial<PlayerMatchStat>, idx: number) => {
                // --- NEW: Safely format KDA ---
                const kdaValue = typeof player.kda === 'number' 
                    ? player.kda 
                    : parseFloat(String(player.kda)); // Attempt to parse if not number
                const formattedKDA = !isNaN(kdaValue) ? kdaValue.toFixed(2) : '-';
                // --- END NEW ---
                return (
                    <tr key={`team1-${idx}`} style={{ borderBottom: '1px solid rgba(224, 224, 224, 0.5)' }}>
                    <td style={{ padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.ign || `Player ${idx + 1}`}</td>
                    <td style={{ padding: '8px' }}>{renderHero(player.hero_played)}</td>
                    <td style={{ padding: '8px' }}>{player.role_played || '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.kills ?? 0}/{player.deaths ?? 0}/{player.assists ?? 0}</td>
                    {/* --- UPDATED: Use formatted KDA --- */}
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formattedKDA}</td>
                    {/* --- END UPDATE --- */}
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatMedal(player.medal)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.damage_dealt ?? '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.damage_taken ?? '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.turret_damage ?? '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.gold_earned ?? '-'}</td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Paper>
      
      {/* Enemy Players Section (Red Side) */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
             {teamInfo.team2Label === 'Red Side Team' ? (getTeamName(values.team_2) || 'Red Side') : teamInfo.team2Value} Players
          </Typography>
          <Button size="small" onClick={() => navigateToStep(2)}>Edit</Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
             <thead>
               <tr style={{ borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                <th style={{ padding: '8px', textAlign: 'left', width: '18%' }}>Player</th>
                <th style={{ padding: '8px', textAlign: 'left', width: '18%' }}>Hero</th>
                <th style={{ padding: '8px', textAlign: 'left', width: '12%' }}>Role</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>K/D/A</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>KDA</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>Medal</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>Damage</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>DMG Tkn</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>Turret</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '8%' }}>Gold</th>
               </tr>
             </thead>
            <tbody>
              {values.enemy_players.map((player: Partial<PlayerMatchStat>, idx: number) => {
                 // --- NEW: Safely format KDA ---
                 const kdaValue = typeof player.kda === 'number' 
                    ? player.kda 
                    : parseFloat(String(player.kda)); // Attempt to parse if not number
                 const formattedKDA = !isNaN(kdaValue) ? kdaValue.toFixed(2) : '-';
                 // --- END NEW ---
                 return (
                    <tr key={`team2-${idx}`} style={{ borderBottom: '1px solid rgba(224, 224, 224, 0.5)' }}>
                    <td style={{ padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.ign || `Player ${idx + 1}`}</td>
                    <td style={{ padding: '8px' }}>{renderHero(player.hero_played)}</td>
                    <td style={{ padding: '8px' }}>{player.role_played || '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.kills ?? 0}/{player.deaths ?? 0}/{player.assists ?? 0}</td>
                    {/* --- UPDATED: Use formatted KDA --- */}
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formattedKDA}</td>
                    {/* --- END UPDATE --- */}
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatMedal(player.medal)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.damage_dealt ?? '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.damage_taken ?? '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.turret_damage ?? '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{player.gold_earned ?? '-'}</td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Paper>
      
      {/* Files Section */}
      {values.files.length > 0 && (
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Uploaded Files</Typography>
            <Button size="small" onClick={() => navigateToStep(3)}>Edit</Button>
          </Box>
          <Typography variant="body1">{values.files.length} file(s) to be uploaded</Typography>
          <Box sx={{ mt: 1 }}>
            {values.files.map((file: File, idx: number) => (
              <Typography key={idx} variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}
      
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