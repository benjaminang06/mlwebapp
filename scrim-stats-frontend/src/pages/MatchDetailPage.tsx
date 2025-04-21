import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMatchById, getPlayerStatsForMatch } from '../services/match';
import { Match, PlayerMatchStat } from '../types/match.types';
import { 
  Box, Typography, CircularProgress, Alert, Paper, Grid, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Chip, Button, Tabs, Tab
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const MatchDetailPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerMatchStat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const fetchMatchDetails = async () => {
      if (!matchId) return;

      try {
        setLoading(true);
        setError(null);
        const fetchedMatch = await getMatchById(matchId);
        console.log('Match data received:', fetchedMatch);
        console.log('Blue side team details:', fetchedMatch.blue_side_team_details);
        console.log('Red side team details:', fetchedMatch.red_side_team_details);
        setMatch(fetchedMatch);
        
        // After match is fetched, fetch player stats
        try {
          setStatsLoading(true);
          setStatsError(null);
          const stats = await getPlayerStatsForMatch(matchId);
          console.log('Player stats received:', stats);
          setPlayerStats(stats);
        } catch (statsErr) {
          console.error("Failed to fetch player stats:", statsErr);
          setStatsError('Failed to load player statistics.');
        } finally {
          setStatsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch match details:", err);
        setError('Failed to load match details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatchDetails();
  }, [matchId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Function to get team name safely
  const getTeamName = (teamId: number | undefined, blueSideTeam: number, redSideTeam: number) => {
    if (!teamId) return 'Unknown Team';
    
    if (match?.our_team_details && match.our_team_details.team_id === teamId) {
      return `${match.our_team_details.team_name} (Our Team)`;
    }
    
    if (match?.blue_side_team_details && match.blue_side_team_details.team_id === teamId) {
      return match.blue_side_team_details.team_name;
    }
    
    if (match?.red_side_team_details && match.red_side_team_details.team_id === teamId) {
      return match.red_side_team_details.team_name;
    }
    
    return teamId === blueSideTeam ? 'Blue Side' : 'Red Side';
  };

  // Helper to format K/D/A
  const formatKDA = (player: PlayerMatchStat) => {
    return `${player.kills || 0}/${player.deaths || 0}/${player.assists || 0}`;
  };

  // Calculate KDA ratio
  const calculateKDA = (player: PlayerMatchStat) => {
    const kills = player.kills || 0;
    const deaths = player.deaths || 0;
    const assists = player.assists || 0;
    
    if (deaths === 0) return (kills + assists).toFixed(2);
    return ((kills + assists) / deaths).toFixed(2);
  };

  // Get hero name safely
  const getHeroName = (hero: any) => {
    if (!hero) return 'Unknown';
    if (typeof hero === 'string') return hero;
    if (typeof hero === 'number') return `Hero #${hero}`;
    if (hero.name) return hero.name;
    return 'Unknown Hero';
  };

  // Group player stats by team
  const groupPlayerStatsByTeam = () => {
    const blueTeamStats = playerStats.filter(stat => stat.is_blue_side);
    const redTeamStats = playerStats.filter(stat => !stat.is_blue_side);
    return { blueTeamStats, redTeamStats };
  };

  const { blueTeamStats, redTeamStats } = groupPlayerStatsByTeam();

  return (
    <Box sx={{ p: 3 }}>
      <Button 
        component={Link} 
        to="/matches" 
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Back to Match History
      </Button>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && match && (
        <>
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h4" gutterBottom>
              Match Details {match.match_id && `#${match.match_id}`}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  General Information
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography><strong>Date:</strong> {formatDate(match.match_date)}</Typography>
                  <Typography><strong>Match Type:</strong> {match.scrim_type}</Typography>
                  <Typography><strong>Outcome:</strong> <Chip 
                    label={match.match_outcome} 
                    color={match.match_outcome === 'VICTORY' ? 'success' : 'error'}
                    size="small"
                  /></Typography>
                  <Typography><strong>Duration:</strong> {match.match_duration || 'Not recorded'}</Typography>
                  <Typography><strong>Game #:</strong> {match.game_number}</Typography>
                  {match.general_notes && (
                    <Typography><strong>Notes:</strong> {match.general_notes}</Typography>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Teams
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography>
                    <strong>Blue Side:</strong> {getTeamName(match.blue_side_team, match.blue_side_team, match.red_side_team)}
                    {match.winning_team === match.blue_side_team && (
                      <Chip label="Winner" color="success" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography>
                    <strong>Red Side:</strong> {getTeamName(match.red_side_team, match.blue_side_team, match.red_side_team)}
                    {match.winning_team === match.red_side_team && (
                      <Chip label="Winner" color="success" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="player stats tabs">
                <Tab label="All Players" />
                <Tab label="Blue Team" />
                <Tab label="Red Team" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <Typography variant="h5" gutterBottom>
                Player Statistics
              </Typography>
              
              {statsLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <CircularProgress size={30} />
                </Box>
              )}
              
              {statsError && (
                <Alert severity="warning" sx={{ my: 2 }}>
                  {statsError}
                </Alert>
              )}
              
              {!statsLoading && !statsError && playerStats.length === 0 && (
                <Typography color="text.secondary">
                  No player statistics available for this match.
                </Typography>
              )}
              
              {!statsLoading && !statsError && playerStats.length > 0 && (
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Player</TableCell>
                        <TableCell>Team</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Hero</TableCell>
                        <TableCell align="right">K/D/A</TableCell>
                        <TableCell align="right">KDA Ratio</TableCell>
                        <TableCell align="right">DMG Dealt</TableCell>
                        <TableCell align="right">DMG Taken</TableCell>
                        <TableCell align="right">Turret DMG</TableCell>
                        <TableCell>Awards</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {playerStats.map((stat) => (
                        <TableRow key={stat.stats_id}>
                          <TableCell>{stat.player_details?.current_ign || stat.ign || 'Unknown'}</TableCell>
                          <TableCell>
                            {stat.is_blue_side ? 'Blue Side' : 'Red Side'}
                            {stat.is_our_team && ' (Our Team)'}
                          </TableCell>
                          <TableCell>{stat.role_played || 'N/A'}</TableCell>
                          <TableCell>{getHeroName(stat.hero_played)}</TableCell>
                          <TableCell align="right">{formatKDA(stat)}</TableCell>
                          <TableCell align="right">{calculateKDA(stat)}</TableCell>
                          <TableCell align="right">{stat.damage_dealt || 'N/A'}</TableCell>
                          <TableCell align="right">{stat.damage_taken || 'N/A'}</TableCell>
                          <TableCell align="right">{stat.turret_damage || 'N/A'}</TableCell>
                          <TableCell>
                            {match.mvp === stat.player_id && (
                              <Chip 
                                icon={<StarIcon />} 
                                label="MVP"
                                color="primary"
                                size="small"
                                sx={{ mr: 1 }}
                              />
                            )}
                            {match.mvp_loss === stat.player_id && (
                              <Chip 
                                icon={<StarIcon />} 
                                label="MVP Loss"
                                color="secondary"
                                size="small"
                              />
                            )}
                            {stat.medal && (
                              <Chip 
                                label={stat.medal}
                                size="small"
                                color="default"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h5" gutterBottom>
                Blue Team Statistics
              </Typography>
              
              {statsLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <CircularProgress size={30} />
                </Box>
              )}
              
              {!statsLoading && !statsError && blueTeamStats.length === 0 && (
                <Typography color="text.secondary">
                  No blue team statistics available.
                </Typography>
              )}
              
              {!statsLoading && !statsError && blueTeamStats.length > 0 && (
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Player</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Hero</TableCell>
                        <TableCell align="right">K/D/A</TableCell>
                        <TableCell align="right">KDA Ratio</TableCell>
                        <TableCell align="right">DMG Dealt</TableCell>
                        <TableCell align="right">DMG Taken</TableCell>
                        <TableCell>Awards</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {blueTeamStats.map((stat) => (
                        <TableRow key={stat.stats_id}>
                          <TableCell>{stat.player_details?.current_ign || stat.ign || 'Unknown'}</TableCell>
                          <TableCell>{stat.role_played || 'N/A'}</TableCell>
                          <TableCell>{getHeroName(stat.hero_played)}</TableCell>
                          <TableCell align="right">{formatKDA(stat)}</TableCell>
                          <TableCell align="right">{calculateKDA(stat)}</TableCell>
                          <TableCell align="right">{stat.damage_dealt || 'N/A'}</TableCell>
                          <TableCell align="right">{stat.damage_taken || 'N/A'}</TableCell>
                          <TableCell>
                            {match.mvp === stat.player_id && (
                              <Chip 
                                icon={<StarIcon />} 
                                label="MVP"
                                color="primary"
                                size="small"
                                sx={{ mr: 1 }}
                              />
                            )}
                            {stat.medal && (
                              <Chip 
                                label={stat.medal}
                                size="small"
                                color="default"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>
            
            <TabPanel value={tabValue} index={2}>
              <Typography variant="h5" gutterBottom>
                Red Team Statistics
              </Typography>
              
              {statsLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <CircularProgress size={30} />
                </Box>
              )}
              
              {!statsLoading && !statsError && redTeamStats.length === 0 && (
                <Typography color="text.secondary">
                  No red team statistics available.
                </Typography>
              )}
              
              {!statsLoading && !statsError && redTeamStats.length > 0 && (
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Player</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Hero</TableCell>
                        <TableCell align="right">K/D/A</TableCell>
                        <TableCell align="right">KDA Ratio</TableCell>
                        <TableCell align="right">DMG Dealt</TableCell>
                        <TableCell align="right">DMG Taken</TableCell>
                        <TableCell>Awards</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {redTeamStats.map((stat) => (
                        <TableRow key={stat.stats_id}>
                          <TableCell>{stat.player_details?.current_ign || stat.ign || 'Unknown'}</TableCell>
                          <TableCell>{stat.role_played || 'N/A'}</TableCell>
                          <TableCell>{getHeroName(stat.hero_played)}</TableCell>
                          <TableCell align="right">{formatKDA(stat)}</TableCell>
                          <TableCell align="right">{calculateKDA(stat)}</TableCell>
                          <TableCell align="right">{stat.damage_dealt || 'N/A'}</TableCell>
                          <TableCell align="right">{stat.damage_taken || 'N/A'}</TableCell>
                          <TableCell>
                            {match.mvp === stat.player_id && (
                              <Chip 
                                icon={<StarIcon />} 
                                label="MVP"
                                color="primary"
                                size="small"
                                sx={{ mr: 1 }}
                              />
                            )}
                            {match.mvp_loss === stat.player_id && (
                              <Chip 
                                icon={<StarIcon />} 
                                label="MVP Loss"
                                color="secondary"
                                size="small"
                              />
                            )}
                            {stat.medal && (
                              <Chip 
                                label={stat.medal}
                                size="small"
                                color="default"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default MatchDetailPage; 