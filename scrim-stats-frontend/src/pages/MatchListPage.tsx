import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMatches } from '../services/match';
import { Match } from '../types/match.types';
import { 
  Alert, 
  Box, 
  Card, 
  CardContent, 
  Chip, 
  CircularProgress, 
  Grid, 
  Typography, 
  Stack,
  useTheme
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TournamentIcon from '@mui/icons-material/EmojiEvents';
import RankedIcon from '@mui/icons-material/Leaderboard';

// Helper function to format date
const formatDate = (dateString: string): string => {
  if (!dateString) return 'Not available';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original if parsing fails
  }
};

// Helper function to format duration
const formatDuration = (durationString?: string): string => {
  if (!durationString) return 'Not recorded';
  
  // Parse HH:MM:SS format
  const match = durationString.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return durationString;
  
  const [_, hours, minutes, seconds] = match;
  
  // Build readable format
  const parts = [];
  if (parseInt(hours) > 0) parts.push(`${parseInt(hours)}h`);
  if (parseInt(minutes) > 0) parts.push(`${parseInt(minutes)}m`);
  if (parseInt(seconds) > 0 || parts.length === 0) parts.push(`${parseInt(seconds)}s`);
  
  return parts.join(' ');
};

const MatchListPage: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const data = await getMatches();
        setMatches(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching matches:', error);
        setError('Failed to load matches. Please try again later.');
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  // Helper to get match type icon
  const getMatchTypeIcon = (type: string) => {
    switch(type) {
      case 'SCRIMMAGE':
        return <SportsEsportsIcon fontSize="small" />;
      case 'TOURNAMENT':
        return <TournamentIcon fontSize="small" />;
      case 'RANKED':
        return <RankedIcon fontSize="small" />;
      default:
        return <SportsEsportsIcon fontSize="small" />;
    }
  };

  // Helper to format match outcome - Modified to handle external matches better
  const getOutcomeChip = (match: Match) => {
    const outcome = match.match_outcome;
    const isExternalMatch = match.our_team_details === undefined || match.our_team_details === null;
    
    if (!outcome) return <Chip size="small" label="No Result" color="default" />;
    
    // For external matches, show which team won instead of Victory/Defeat
    if (isExternalMatch) {
      const winningTeam = match.winning_team === match.blue_side_team ? 
                          match.blue_side_team_details?.team_name : 
                          match.red_side_team_details?.team_name;
      
      return <Chip 
        size="small" 
        label={`${winningTeam || 'Blue Team'} Won`}
        color="primary"
        icon={<EmojiEventsIcon />} 
        sx={{ fontWeight: 'bold' }} 
      />;
    }
    
    // For our team's matches, show victory/defeat as before
    return outcome === 'VICTORY' 
      ? <Chip 
          size="small" 
          label="Victory" 
          color="success" 
          icon={<EmojiEventsIcon />} 
          sx={{ fontWeight: 'bold' }} 
        />
      : <Chip 
          size="small" 
          label="Defeat" 
          color="error" 
          sx={{ fontWeight: 'bold' }} 
        />;
  };

  // Helper to get team names with appropriate fallbacks
  const getTeamDisplay = (match: Match) => {
    // For external matches (no our_team_details), use the actual blue/red side team names
    if (!match.our_team_details) {
      const blueTeam = match.blue_side_team_details?.team_name || 'Blue Team';
      const redTeam = match.red_side_team_details?.team_name || 'Red Team';
      return { blueTeam, redTeam, ourTeam: null, opponentTeam: null };
    }
    
    // For our team's matches, determine which team is the opponent
    const ourTeam = match.our_team_details?.team_name || 'Our Team';
    let opponentTeam;
    
    // Find opponent based on which side our team is on
    if (match.our_team_details?.team_id === match.blue_side_team) {
      opponentTeam = match.red_side_team_details?.team_name || 'Opponent Team';
    } else {
      opponentTeam = match.blue_side_team_details?.team_name || 'Opponent Team';
    }
    
    // Determine which team is on which side
    const blueTeam = match.blue_side_team_details?.team_name || 'Blue Team';
    const redTeam = match.red_side_team_details?.team_name || 'Red Team';
    
    return { blueTeam, redTeam, ourTeam, opponentTeam };
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Match History
      </Typography>
      
      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {!loading && !error && matches.length === 0 && (
        <Alert severity="info">No matches found. Start by adding your first match!</Alert>
      )}
      
      <Grid container spacing={2}>
        {matches.map((match) => {
          const { blueTeam, redTeam } = getTeamDisplay(match);
          return (
            <Grid item xs={12} key={match.match_id}>
              <Card 
                component={Link} 
                to={`/matches/${match.match_id}`}
                sx={{ 
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: 3
                  }
                }}
              >
                <CardContent>
                  <Grid container alignItems="center" spacing={2}>
                    {/* Left: Match info */}
                    <Grid item xs={12} md={3}>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(match.match_date)}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {getMatchTypeIcon(match.scrim_type)}
                          <Typography variant="body1">
                            {match.scrim_type.charAt(0) + match.scrim_type.slice(1).toLowerCase()}
                          </Typography>
                        </Stack>
                        {match.match_duration && (
                          <Typography variant="body2" color="text.secondary">
                            Duration: {formatDuration(match.match_duration)}
                          </Typography>
                        )}
                      </Stack>
                    </Grid>

                    {/* Middle: Teams */}
                    <Grid item xs={12} md={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body1" fontWeight="bold" textAlign="right" sx={{ flex: 1 }}>
                          {blueTeam}
                        </Typography>
                        <Box 
                          sx={{ 
                            mx: 2, 
                            px: 2, 
                            py: 0.5, 
                            borderRadius: 1, 
                            bgcolor: 'grey.200',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Typography variant="body2" fontWeight="bold">
                            VS
                          </Typography>
                        </Box>
                        <Typography variant="body1" fontWeight="bold" textAlign="left" sx={{ flex: 1 }}>
                          {redTeam}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Right: Outcome */}
                    <Grid item xs={12} md={3} sx={{ textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        {getOutcomeChip(match)}
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default MatchListPage; 