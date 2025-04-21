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
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  SelectChangeEvent,
  Paper,
  IconButton,
  Tabs,
  Tab,
  styled
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TournamentIcon from '@mui/icons-material/EmojiEvents';
import RankedIcon from '@mui/icons-material/Leaderboard';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import GroupIcon from '@mui/icons-material/Group';
import PublicIcon from '@mui/icons-material/Public';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';

// Styled tabs for better visibility
const StyledTabs = styled(Tabs)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTabs-indicator': {
    height: 3,
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: theme.typography.fontWeightRegular,
  fontSize: theme.typography.pxToRem(15),
  marginRight: theme.spacing(1),
  '&.Mui-selected': {
    fontWeight: theme.typography.fontWeightMedium,
  },
}));

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
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('our'); // Default to our matches
  const [teams, setTeams] = useState<{id: number, name: string}[]>([]);
  const [showFilters, setShowFilters] = useState<boolean>(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const data = await getMatches();
        setMatches(data);
        
        // Initial filtering based on default "our" tab
        const initialFiltered = data.filter(match => match.our_team_details !== null);
        setFilteredMatches(initialFiltered);
        
        // Extract unique teams for filter dropdown
        const uniqueTeams = new Map<number, string>();
        data.forEach(match => {
          if (match.blue_side_team_details) {
            uniqueTeams.set(match.blue_side_team, match.blue_side_team_details.team_name);
          }
          if (match.red_side_team_details) {
            uniqueTeams.set(match.red_side_team, match.red_side_team_details.team_name);
          }
        });
        
        const teamOptions = Array.from(uniqueTeams.entries()).map(([id, name]) => ({
          id, name
        }));
        
        setTeams(teamOptions);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching matches:', error);
        setError('Failed to load matches. Please try again later.');
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);
  
  // Apply filters when any filter changes
  useEffect(() => {
    if (!matches.length) return;
    
    let filtered = [...matches];
    
    // Apply ownership filter (tabs)
    if (ownershipFilter === 'our') {
      filtered = filtered.filter(match => match.our_team_details !== null);
    } else if (ownershipFilter === 'external') {
      filtered = filtered.filter(match => match.our_team_details === null);
    }
    // 'all' requires no filtering
    
    // Apply type filter
    if (typeFilter) {
      filtered = filtered.filter(match => match.scrim_type === typeFilter);
    }
    
    // Apply outcome filter
    if (outcomeFilter) {
      filtered = filtered.filter(match => match.match_outcome === outcomeFilter);
    }
    
    // Apply team filter
    if (teamFilter) {
      const teamId = parseInt(teamFilter, 10);
      filtered = filtered.filter(
        match => match.blue_side_team === teamId || match.red_side_team === teamId
      );
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (dateFilter) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case 'quarter':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(match => {
        const matchDate = new Date(match.match_date);
        return matchDate >= cutoffDate;
      });
    }
    
    setFilteredMatches(filtered);
  }, [matches, typeFilter, outcomeFilter, teamFilter, dateFilter, ownershipFilter]);
  
  const handleTypeFilterChange = (event: SelectChangeEvent) => {
    setTypeFilter(event.target.value);
  };
  
  const handleOutcomeFilterChange = (event: SelectChangeEvent) => {
    setOutcomeFilter(event.target.value);
  };
  
  const handleTeamFilterChange = (event: SelectChangeEvent) => {
    setTeamFilter(event.target.value);
  };
  
  const handleDateFilterChange = (event: SelectChangeEvent) => {
    setDateFilter(event.target.value);
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setOwnershipFilter(newValue);
  };
  
  const clearFilters = () => {
    setTypeFilter('');
    setOutcomeFilter('');
    setTeamFilter('');
    setDateFilter('all');
    // Don't clear the tab selection when clearing other filters
  };

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

  // Get counts for tab badges
  const getOurMatchesCount = () => {
    return matches.filter(match => match.our_team_details !== null).length;
  };
  
  const getExternalMatchesCount = () => {
    return matches.filter(match => match.our_team_details === null).length;
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Match History</Typography>
        <Box>
          <IconButton 
            color={showFilters ? "primary" : "default"} 
            onClick={() => setShowFilters(!showFilters)}
            sx={{ mr: 1 }}
          >
            <FilterAltIcon />
          </IconButton>
        </Box>
      </Box>
      
      {/* Tabs for Our / External / All Matches */}
      <StyledTabs
        value={ownershipFilter}
        onChange={handleTabChange}
        aria-label="match ownership tabs"
      >
        <StyledTab 
          value="our" 
          label={`Our Matches (${getOurMatchesCount()})`} 
          icon={<GroupIcon />} 
          iconPosition="start"
        />
        <StyledTab 
          value="external" 
          label={`External Matches (${getExternalMatchesCount()})`} 
          icon={<PublicIcon />} 
          iconPosition="start"
        />
        <StyledTab 
          value="all" 
          label="All Matches" 
          icon={<AllInclusiveIcon />} 
          iconPosition="start"
        />
      </StyledTabs>
      
      {showFilters && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="match-type-filter-label">Match Type</InputLabel>
                <Select
                  labelId="match-type-filter-label"
                  value={typeFilter}
                  onChange={handleTypeFilterChange}
                  input={<OutlinedInput label="Match Type" />}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="SCRIMMAGE">Scrimmage</MenuItem>
                  <MenuItem value="TOURNAMENT">Tournament</MenuItem>
                  <MenuItem value="RANKED">Ranked</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="outcome-filter-label">Outcome</InputLabel>
                <Select
                  labelId="outcome-filter-label"
                  value={outcomeFilter}
                  onChange={handleOutcomeFilterChange}
                  input={<OutlinedInput label="Outcome" />}
                >
                  <MenuItem value="">All Outcomes</MenuItem>
                  <MenuItem value="VICTORY">Victory</MenuItem>
                  <MenuItem value="DEFEAT">Defeat</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="team-filter-label">Team</InputLabel>
                <Select
                  labelId="team-filter-label"
                  value={teamFilter}
                  onChange={handleTeamFilterChange}
                  input={<OutlinedInput label="Team" />}
                >
                  <MenuItem value="">All Teams</MenuItem>
                  {teams.map(team => (
                    <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="date-filter-label">Date</InputLabel>
                <Select
                  labelId="date-filter-label"
                  value={dateFilter}
                  onChange={handleDateFilterChange}
                  input={<OutlinedInput label="Date" />}
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="week">Past Week</MenuItem>
                  <MenuItem value="month">Past Month</MenuItem>
                  <MenuItem value="quarter">Past Quarter</MenuItem>
                  <MenuItem value="year">Past Year</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={1}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <IconButton 
                  color="primary" 
                  onClick={clearFilters}
                  title="Clear all filters"
                >
                  <ClearIcon />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {!loading && !error && filteredMatches.length === 0 && (
        <Alert severity="info">No matches found with the selected filters.</Alert>
      )}
      
      <Grid container spacing={2}>
        {filteredMatches.map((match) => {
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
                          {match.score_details ? (
                            <Typography variant="body2" fontWeight="bold">
                              {match.score_details.blue_side_score} - {match.score_details.red_side_score}
                            </Typography>
                          ) : (
                            <Typography variant="body2" fontWeight="bold">
                              VS
                            </Typography>
                          )}
                        </Box>
                        <Typography variant="body1" fontWeight="bold" textAlign="left" sx={{ flex: 1 }}>
                          {redTeam}
                        </Typography>
                      </Box>
                      {/* Add score explanation if score exists */}
                      {match.score_details && (
                        <Typography 
                          variant="caption" 
                          align="center" 
                          display="block" 
                          sx={{ mt: 0.5, color: 'text.secondary' }}
                        >
                          Score based on total kills
                        </Typography>
                      )}
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