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
  Divider, 
  Grid, 
  Paper, 
  Typography, 
  Stack,
  useTheme
} from '@mui/material';
import { formatDate, formatDuration } from '../utils/dateUtils';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TournamentIcon from '@mui/icons-material/EmojiEvents';
import RankedIcon from '@mui/icons-material/Leaderboard';

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

  // Helper to format match outcome
  const getOutcomeChip = (outcome: string | null) => {
    if (!outcome) return <Chip size="small" label="No Result" color="default" />;
    
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
    const ourTeam = match.blue_side_team_details?.team_name || 
                     match.our_team_details?.team_name || 
                     'Our Team';
    
    const opponentTeam = match.red_side_team_details?.team_name || 
                         match.opponent_details?.team_name || 
                         'Opponent Team';
    
    // Determine which team is which side
    let blueTeam = match.team_side === 'BLUE' ? ourTeam : opponentTeam;
    let redTeam = match.team_side === 'BLUE' ? opponentTeam : ourTeam;
    
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
          const { blueTeam, redTeam, ourTeam, opponentTeam } = getTeamDisplay(match);
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
                      <Box sx={{ mt: 1 }}>
                        <Typography 
                          variant="body2" 
                          textAlign="center" 
                          sx={{ 
                            mt: 1,
                            color: match.general_notes ? 'text.primary' : 'text.disabled',
                            fontStyle: match.general_notes ? 'normal' : 'italic'
                          }}
                        >
                          {match.general_notes || 'No match notes'}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Right: Outcome */}
                    <Grid item xs={12} md={3} sx={{ textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        {getOutcomeChip(match.match_outcome)}
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Match #{match.match_id}
                        </Typography>
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