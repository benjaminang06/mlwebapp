import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api.service';
import { getMatchById, getPlayerStatsForMatch, updateMatch, updatePlayerStat } from '../services/match.service';
import { Match, PlayerMatchStat } from '../types/match.types';
import { 
  Box, Typography, CircularProgress, Alert, Paper, Grid, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Chip, Button, Tabs, Tab, TextField, MenuItem, Select, FormControl,
  InputLabel, SelectChangeEvent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

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
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editedMatch, setEditedMatch] = useState<Partial<Match> | null>(null);
  const [editedPlayerStats, setEditedPlayerStats] = useState<PlayerMatchStat[]>([]);

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

  // Initialize edit states when match and player stats are loaded
  useEffect(() => {
    if (match) {
      setEditedMatch({
        match_date: match.match_date,
        scrim_type: match.scrim_type,
        winning_team: match.winning_team,
        general_notes: match.general_notes,
      });
    }
  }, [match]);

  useEffect(() => {
    if (playerStats.length > 0) {
      setEditedPlayerStats([...playerStats]);
    }
  }, [playerStats]);

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
  const getHeroName = (stat: PlayerMatchStat) => {
    // First try to use hero_name from the API if available
    if (stat.hero_name) return stat.hero_name;
    
    // Fallbacks for different hero_played representations
    if (stat.hero_played === null || stat.hero_played === undefined) return 'Unknown';
    if (typeof stat.hero_played === 'string') return stat.hero_played;
    if (typeof stat.hero_played === 'number') return `Hero #${stat.hero_played}`;
    // For object type, we need to handle differently since TypeScript doesn't know the shape
    const heroObj = stat.hero_played as any;
    if (typeof heroObj === 'object' && heroObj && 'name' in heroObj) return heroObj.name;
    return 'Unknown Hero';
  };

  // Group player stats by team
  const groupPlayerStatsByTeam = () => {
    const blueTeamStats = playerStats.filter(stat => stat.is_blue_side);
    const redTeamStats = playerStats.filter(stat => !stat.is_blue_side);
    return { blueTeamStats, redTeamStats };
  };

  const { blueTeamStats, redTeamStats } = groupPlayerStatsByTeam();

  // Calculate team KDA
  const calculateTeamKDA = (teamStats: PlayerMatchStat[]): string => {
    const totalKills = teamStats.reduce((sum, stat) => sum + (stat.kills || 0), 0);
    const totalDeaths = teamStats.reduce((sum, stat) => sum + (stat.deaths || 0), 0);
    const totalAssists = teamStats.reduce((sum, stat) => sum + (stat.assists || 0), 0);
    
    if (totalDeaths === 0) return (totalKills + totalAssists).toFixed(2);
    return ((totalKills + totalAssists) / totalDeaths).toFixed(2);
  };

  const handleEditClick = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    // Reset edited values to original
    if (match) {
      setEditedMatch({
        match_date: match.match_date,
        scrim_type: match.scrim_type,
        winning_team: match.winning_team,
        general_notes: match.general_notes,
      });
    }
    setEditedPlayerStats([...playerStats]);
    setEditMode(false);
    setSaveError(null);
  };

  const handleSaveEdit = async () => {
    if (!match || !matchId) return;
    
    try {
      setSaving(true);
      setSaveError(null);
      
      // Update match metadata
      if (editedMatch) {
        const updatedMatch = await updateMatch(matchId, editedMatch);
        setMatch(updatedMatch);
      }
      
      // Update player stats
      for (const stat of editedPlayerStats) {
        if (stat.stats_id) {
          await updatePlayerStat(matchId, stat.stats_id, {
            kills: stat.kills,
            deaths: stat.deaths,
            assists: stat.assists,
            damage_dealt: stat.damage_dealt,
            damage_taken: stat.damage_taken,
            turret_damage: stat.turret_damage,
            teamfight_participation: stat.teamfight_participation,
            gold_earned: stat.gold_earned,
            player_notes: stat.player_notes,
          });
        }
      }
      
      // Refresh player stats
      const refreshedStats = await getPlayerStatsForMatch(matchId);
      setPlayerStats(refreshedStats);
      
      setEditMode(false);
    } catch (err) {
      console.error("Failed to save edits:", err);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleMatchFieldChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (editedMatch) {
      setEditedMatch({
        ...editedMatch,
        [field]: e.target.value
      });
    }
  };

  const handleScrimTypeChange = (e: SelectChangeEvent) => {
    if (editedMatch) {
      setEditedMatch({
        ...editedMatch,
        scrim_type: e.target.value as 'SCRIMMAGE' | 'TOURNAMENT' | 'RANKED'
      });
    }
  };

  const handleWinningTeamChange = (e: SelectChangeEvent) => {
    if (editedMatch) {
      setEditedMatch({
        ...editedMatch,
        winning_team: e.target.value ? Number(e.target.value) : undefined
      });
    }
  };

  const handlePlayerStatChange = (statId: number | undefined, field: keyof PlayerMatchStat) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!statId) return;
    
    const newValue = field === 'player_notes' ? e.target.value : Number(e.target.value);
    
    setEditedPlayerStats(prevStats => 
      prevStats.map(stat => 
        stat.stats_id === statId ? { ...stat, [field]: newValue } : stat
      )
    );
  };

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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" gutterBottom>
                Match Details {match.match_id && `#${match.match_id}`}
              </Typography>
              {!editMode ? (
                <Button 
                  variant="outlined" 
                  startIcon={<EditIcon />} 
                  onClick={handleEditClick}
                >
                  Edit Match
                </Button>
              ) : (
                <Box>
                  <Button 
                    variant="outlined" 
                    color="error"
                    startIcon={<CancelIcon />} 
                    onClick={handleCancelEdit}
                    sx={{ mr: 1 }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary"
                    startIcon={<SaveIcon />} 
                    onClick={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Box>
              )}
            </Box>
            
            {saveError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {saveError}
              </Alert>
            )}
            
            <Divider sx={{ mb: 2 }} />
            
            {/* Match Metadata Section */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  General Information
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {!editMode ? (
                    <>
                      <Typography><strong>Date:</strong> {formatDate(match.match_date)}</Typography>
                      <Typography><strong>Match Type:</strong> {match.scrim_type}</Typography>
                      <Typography><strong>Game Number:</strong> {match.game_number}</Typography>
                      {match.match_duration && (
                        <Typography><strong>Duration:</strong> {match.match_duration}</Typography>
                      )}
                      {match.general_notes && (
                        <Typography><strong>Notes:</strong> {match.general_notes}</Typography>
                      )}
                    </>
                  ) : (
                    <>
                      <TextField
                        label="Date"
                        type="datetime-local"
                        value={editedMatch?.match_date ? editedMatch.match_date.slice(0, 16) : ''}
                        onChange={handleMatchFieldChange('match_date')}
                        fullWidth
                        margin="normal"
                        InputLabelProps={{ shrink: true }}
                      />
                      
                      <FormControl fullWidth margin="normal">
                        <InputLabel id="match-type-label">Match Type</InputLabel>
                        <Select
                          labelId="match-type-label"
                          value={editedMatch?.scrim_type || ''}
                          onChange={handleScrimTypeChange}
                          label="Match Type"
                        >
                          <MenuItem value="SCRIMMAGE">Scrimmage</MenuItem>
                          <MenuItem value="TOURNAMENT">Tournament</MenuItem>
                          <MenuItem value="RANKED">Ranked</MenuItem>
                        </Select>
                      </FormControl>
                      
                      <TextField
                        label="Game Number"
                        type="number"
                        value={match.game_number}
                        disabled
                        fullWidth
                        margin="normal"
                      />
                      
                      <TextField
                        label="Notes"
                        multiline
                        rows={4}
                        value={editedMatch?.general_notes || ''}
                        onChange={handleMatchFieldChange('general_notes')}
                        fullWidth
                        margin="normal"
                      />
                    </>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Teams
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography>
                    <strong>Blue Side:</strong> {match.blue_side_team_details?.team_name || 'Unknown Team'}
                  </Typography>
                  <Typography>
                    <strong>Red Side:</strong> {match.red_side_team_details?.team_name || 'Unknown Team'}
                  </Typography>
                  
                  {!editMode ? (
                    <Typography>
                      <strong>Winner:</strong> {match.winning_team ? 
                        (match.winning_team === match.blue_side_team ? 
                          match.blue_side_team_details?.team_name : 
                          match.red_side_team_details?.team_name) : 
                        'Not specified'}
                    </Typography>
                  ) : (
                    <FormControl fullWidth margin="normal">
                      <InputLabel id="winning-team-label">Winning Team</InputLabel>
                      <Select
                        labelId="winning-team-label"
                        value={editedMatch?.winning_team?.toString() || ''}
                        onChange={handleWinningTeamChange}
                        label="Winning Team"
                      >
                        <MenuItem value="">Not specified</MenuItem>
                        <MenuItem value={match.blue_side_team.toString()}>
                          {match.blue_side_team_details?.team_name || 'Blue Side'}
                        </MenuItem>
                        <MenuItem value={match.red_side_team.toString()}>
                          {match.red_side_team_details?.team_name || 'Red Side'}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Player Statistics Section */}
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Player Statistics
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            {statsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <CircularProgress />
              </Box>
            ) : statsError ? (
              <Alert severity="error" sx={{ my: 2 }}>
                {statsError}
              </Alert>
            ) : (
              <Box>
                {/* Blue Side Team Stats */}
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {match.blue_side_team_details?.team_name || 'Blue Side'} (Blue Side)
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 4 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Player</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Hero</TableCell>
                        <TableCell>KDA</TableCell>
                        {editMode && (
                          <>
                            <TableCell>Kills</TableCell>
                            <TableCell>Deaths</TableCell>
                            <TableCell>Assists</TableCell>
                            <TableCell>Damage Dealt</TableCell>
                            <TableCell>Damage Taken</TableCell>
                          </>
                        )}
                        {!editMode && (
                          <>
                            <TableCell>Damage Dealt</TableCell>
                            <TableCell>Gold</TableCell>
                            <TableCell>Notes</TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {editMode ? 
                        (editedPlayerStats.filter(stat => stat.is_blue_side).map(stat => (
                          <TableRow key={stat.stats_id}>
                            <TableCell>{stat.player_details?.current_ign || stat.ign}</TableCell>
                            <TableCell>{stat.role_played || ''}</TableCell>
                            <TableCell>{getHeroName(stat)}</TableCell>
                            <TableCell>{formatKDA(stat)}</TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.kills}
                                onChange={handlePlayerStatChange(stat.stats_id, 'kills')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.deaths}
                                onChange={handlePlayerStatChange(stat.stats_id, 'deaths')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.assists}
                                onChange={handlePlayerStatChange(stat.stats_id, 'assists')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.damage_dealt || 0}
                                onChange={handlePlayerStatChange(stat.stats_id, 'damage_dealt')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.damage_taken || 0}
                                onChange={handlePlayerStatChange(stat.stats_id, 'damage_taken')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))) : 
                        (blueTeamStats.map(stat => (
                          <TableRow key={stat.stats_id}>
                            <TableCell>{stat.player_details?.current_ign || stat.ign}</TableCell>
                            <TableCell>{stat.role_played || ''}</TableCell>
                            <TableCell>{getHeroName(stat)}</TableCell>
                            <TableCell>{formatKDA(stat)} ({calculateKDA(stat)})</TableCell>
                            <TableCell>{stat.damage_dealt || 'N/A'}</TableCell>
                            <TableCell>{stat.gold_earned || 'N/A'}</TableCell>
                            <TableCell>{stat.player_notes || '-'}</TableCell>
                          </TableRow>
                        )))
                      }
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Red Side Team Stats */}
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {match.red_side_team_details?.team_name || 'Red Side'} (Red Side)
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Player</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Hero</TableCell>
                        <TableCell>KDA</TableCell>
                        {editMode && (
                          <>
                            <TableCell>Kills</TableCell>
                            <TableCell>Deaths</TableCell>
                            <TableCell>Assists</TableCell>
                            <TableCell>Damage Dealt</TableCell>
                            <TableCell>Damage Taken</TableCell>
                          </>
                        )}
                        {!editMode && (
                          <>
                            <TableCell>Damage Dealt</TableCell>
                            <TableCell>Gold</TableCell>
                            <TableCell>Notes</TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {editMode ? 
                        (editedPlayerStats.filter(stat => !stat.is_blue_side).map(stat => (
                          <TableRow key={stat.stats_id}>
                            <TableCell>{stat.player_details?.current_ign || stat.ign}</TableCell>
                            <TableCell>{stat.role_played || ''}</TableCell>
                            <TableCell>{getHeroName(stat)}</TableCell>
                            <TableCell>{formatKDA(stat)}</TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.kills}
                                onChange={handlePlayerStatChange(stat.stats_id, 'kills')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.deaths}
                                onChange={handlePlayerStatChange(stat.stats_id, 'deaths')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.assists}
                                onChange={handlePlayerStatChange(stat.stats_id, 'assists')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.damage_dealt || 0}
                                onChange={handlePlayerStatChange(stat.stats_id, 'damage_dealt')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                value={stat.damage_taken || 0}
                                onChange={handlePlayerStatChange(stat.stats_id, 'damage_taken')}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))) : 
                        (redTeamStats.map(stat => (
                          <TableRow key={stat.stats_id}>
                            <TableCell>{stat.player_details?.current_ign || stat.ign}</TableCell>
                            <TableCell>{stat.role_played || ''}</TableCell>
                            <TableCell>{getHeroName(stat)}</TableCell>
                            <TableCell>{formatKDA(stat)} ({calculateKDA(stat)})</TableCell>
                            <TableCell>{stat.damage_dealt || 'N/A'}</TableCell>
                            <TableCell>{stat.gold_earned || 'N/A'}</TableCell>
                            <TableCell>{stat.player_notes || '-'}</TableCell>
                          </TableRow>
                        )))
                      }
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
};

export default MatchDetailPage; 