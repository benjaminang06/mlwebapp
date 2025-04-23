import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Grid, 
  Typography, 
  Box, 
  Avatar, 
  Divider, 
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import { getPlayerStatistics } from '../../services/statistics.service';
import { api } from '../../services/api.service';
import { Player } from '../../types/player.types';
import { PlayerStatistics } from '../../types/statistics.types';
import { Match } from '../../types/match.types';

interface DetailedPlayerViewProps {
  playerId: number;
  teamId: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`player-tabpanel-${index}`}
      aria-labelledby={`player-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const StyledChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
}));

export const DetailedPlayerView: React.FC<DetailedPlayerViewProps> = ({ playerId, teamId }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);
  const [timeFilter, setTimeFilter] = useState<string>('all');

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        setLoading(true);
        
        // Fetch player details
        const playerResponse = await api.get<Player>(`/api/players/${playerId}/`);
        setPlayer(playerResponse.data);
        
        // Fetch player statistics
        const statistics = await getPlayerStatistics(playerId, teamId);
        setPlayerStats(statistics);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load player data. Please try again later.');
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [playerId, teamId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleTimeFilterChange = (event: SelectChangeEvent) => {
    setTimeFilter(event.target.value as string);
  };

  // Filter matches based on time filter
  const getFilteredMatches = (): Match[] => {
    if (!playerStats?.recent_matches) return [];
    
    const now = new Date();
    const matches = [...playerStats.recent_matches];
    
    switch (timeFilter) {
      case '7days':
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        return matches.filter(match => new Date(match.match_date) >= sevenDaysAgo);
        
      case '30days':
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return matches.filter(match => new Date(match.match_date) >= thirtyDaysAgo);
        
      case 'scrimmage':
        return matches.filter(match => match.scrim_type === 'SCRIMMAGE');
        
      case 'tournament':
        return matches.filter(match => match.scrim_type === 'TOURNAMENT');
        
      default:
        return matches;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!player || !playerStats) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        Player data not available.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Player Profile Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item>
            <Avatar
              src={player.profile_image_url}
              alt={player.current_ign}
              sx={{ width: 100, height: 100 }}
            >
              {player.current_ign.charAt(0)}
            </Avatar>
          </Grid>
          <Grid item xs>
            <Typography variant="h4">{player.current_ign}</Typography>
            {player.primary_role && (
              <Chip 
                label={player.primary_role} 
                color="primary" 
                sx={{ mt: 1 }}
              />
            )}
            
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">Matches</Typography>
                  <Typography variant="h6">{playerStats.total_matches}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">Winrate</Typography>
                  <Typography variant="h6">{playerStats.winrate.toFixed(1)}%</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">KDA</Typography>
                  <Typography variant="h6">{playerStats.avg_kda.toFixed(2)}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="player stats tabs">
            <Tab label="Overview" />
            <Tab label="Recent Matches" />
            <Tab label="Hero Stats" />
          </Tabs>
        </Box>
        
        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Performance Summary</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Total Matches</Typography>
                      <Typography variant="body1">{playerStats.total_matches}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Win-Loss</Typography>
                      <Typography variant="body1">{playerStats.wins}-{playerStats.losses}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Average KDA</Typography>
                      <Typography variant="body1">{playerStats.avg_kda.toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Avg. Kills</Typography>
                      <Typography variant="body1">{playerStats.avg_kills.toFixed(1)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Avg. Deaths</Typography>
                      <Typography variant="body1">{playerStats.avg_deaths.toFixed(1)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Avg. Assists</Typography>
                      <Typography variant="body1">{playerStats.avg_assists.toFixed(1)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Avg. Damage</Typography>
                      <Typography variant="body1">{playerStats.avg_damage_dealt.toFixed(0)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Avg. Gold</Typography>
                      <Typography variant="body1">{playerStats.avg_gold_earned.toFixed(0)}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Most Played Heroes</Typography>
                  <Divider sx={{ mb: 2 }} />
                  {playerStats.favorite_heroes.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Hero</TableCell>
                            <TableCell align="right">Played</TableCell>
                            <TableCell align="right">Wins</TableCell>
                            <TableCell align="right">Winrate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {playerStats.favorite_heroes.map((hero) => (
                            <TableRow key={hero.hero_id}>
                              <TableCell>{hero.hero_name}</TableCell>
                              <TableCell align="right">{hero.picks}</TableCell>
                              <TableCell align="right">{hero.wins}</TableCell>
                              <TableCell align="right">{hero.winrate.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No hero data available.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            {player.aliases && player.aliases.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Previous IGNs</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                      {player.aliases.map((alias) => (
                        <StyledChip
                          key={alias.alias_id}
                          label={alias.alias}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </TabPanel>
        
        {/* Recent Matches Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3 }}>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="time-filter-label">Time Period</InputLabel>
              <Select
                labelId="time-filter-label"
                value={timeFilter}
                onChange={handleTimeFilterChange}
                label="Time Period"
              >
                <MenuItem value="all">All Matches</MenuItem>
                <MenuItem value="7days">Last 7 Days</MenuItem>
                <MenuItem value="30days">Last 30 Days</MenuItem>
                <MenuItem value="scrimmage">Scrimmages Only</MenuItem>
                <MenuItem value="tournament">Tournaments Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Opponent</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>KDA</TableCell>
                  <TableCell>Hero</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getFilteredMatches().map((match) => {
                  // Find opponent team name
                  const opponentTeam = match.blue_side_team_details?.team_name === match.our_team_details?.team_name
                    ? match.red_side_team_details?.team_name || 'Unknown'
                    : match.blue_side_team_details?.team_name || 'Unknown';
                  
                  // Find player's stats in this match - this would be more accurate if we had access to the player's stats for each match
                  // For now this is a placeholder, ideally we would fetch the player's exact stats for each match
                  const playerMatchKda = playerStats.avg_kda;
                  
                  return (
                    <TableRow key={match.match_id}>
                      <TableCell>{new Date(match.match_date).toLocaleDateString()}</TableCell>
                      <TableCell>{opponentTeam}</TableCell>
                      <TableCell>
                        <Chip 
                          label={match.match_outcome} 
                          color={match.match_outcome === 'VICTORY' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{playerMatchKda.toFixed(2)}</TableCell>
                      <TableCell>-</TableCell> {/* We would need to fetch the specific hero played in this match */}
                      <TableCell>{match.scrim_type}</TableCell>
                      <TableCell>
                        <Link to={`/matches/${match.match_id}`}>View</Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {getFilteredMatches().length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="textSecondary">
                        No matches found for the selected time period.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        
        {/* Hero Stats Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Hero Performance</Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  {playerStats.favorite_heroes.length > 0 ? (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Hero</TableCell>
                            <TableCell align="right">Games</TableCell>
                            <TableCell align="right">Wins</TableCell>
                            <TableCell align="right">Losses</TableCell>
                            <TableCell align="right">Winrate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {playerStats.favorite_heroes.map((hero) => (
                            <TableRow key={hero.hero_id}>
                              <TableCell>{hero.hero_name}</TableCell>
                              <TableCell align="right">{hero.picks}</TableCell>
                              <TableCell align="right">{hero.wins}</TableCell>
                              <TableCell align="right">{hero.picks - hero.wins}</TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={`${hero.winrate.toFixed(1)}%`}
                                  color={hero.winrate >= 50 ? 'success' : 'error'}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No hero performance data available.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
    </Box>
  );
}; 