import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.service';
import { TeamService } from '../services/api.service';
import { getMatches, getScrimGroups } from '../services/match.service';
import { Match, ScrimGroup } from '../types/match.types';
import { Team } from '../types/team.types';
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
  styled,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Container,
  Pagination,
  TablePagination
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
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ScrimGroupList from '../components/match/ScrimGroupList';
import { formatDate, isSameDay, isThisWeek, isThisMonth } from '../utils/dateUtils';

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

/**
 * Formats a duration string from "HH:MM:SS" format to a readable format like "1h 30m 45s"
 * @param durationString - Duration string in "HH:MM:SS" format
 * @returns Formatted duration string or "Not recorded" if input is undefined
 */
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

/**
 * Calculates win-loss record and win rate percentage for a specific team
 * @param matches - Array of matches to analyze
 * @param teamId - Team ID to calculate statistics for
 * @returns Object containing wins, losses, and win rate percentage
 */
const calculateWinLossRecord = (matches: Match[], teamId: number): { wins: number, losses: number, winRate: number } => {
  if (!matches.length) return { wins: 0, losses: 0, winRate: 0 };
  
  const wins = matches.filter(match => match.winning_team === teamId).length;
  const losses = matches.filter(match => match.winning_team !== teamId).length;
  const winRate = matches.length > 0 ? (wins / matches.length) * 100 : 0;
  
  return { wins, losses, winRate: Math.round(winRate) };
};

const MatchListPage: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  
  // View mode state (default to scrim group view)
  const [viewMode, setViewMode] = useState<'group' | 'individual'>('group');
  const [scrimGroups, setScrimGroups] = useState<ScrimGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(true);
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('our'); // Default to our matches
  const [teams, setTeams] = useState<{value: string, label: string}[]>([]);
  const [showFilters, setShowFilters] = useState<boolean>(true);
  
  // Add pagination state
  const [page, setPage] = useState<number>(0); // 0-based for TablePagination
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  /**
   * Fetches team data from the API and formats it for the team filter dropdown
   * Handles both paginated and direct array response formats for improved robustness
   */
  const fetchTeams = useCallback(async () => {
    try {
      // Change this to use TeamService.getAll() instead of getTeams()
      const response = await TeamService.getAll();
      
      // Handle both PaginatedResponse<Team> and Team[] response types
      let fetchedTeams: Team[] = [];
      if (response.data && Array.isArray(response.data)) {
        fetchedTeams = response.data;
      } else if (response.data && 'results' in response.data && Array.isArray(response.data.results)) {
        fetchedTeams = response.data.results;
      }
      
      console.log(`Fetched ${fetchedTeams.length} teams from database`);

      if (fetchedTeams.length > 0) {
        // Format teams for dropdown
        const teamOptions = fetchedTeams.map((team: Team) => ({
          value: team.team_id.toString(),
          label: team.team_name
        })).sort((a: {label: string}, b: {label: string}) => a.label.localeCompare(b.label));
        
        console.log('Team options:', teamOptions);
        setTeams(teamOptions);
      } else {
        console.log('No teams found, creating empty team dropdown');
        setTeams([]);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array to stabilize the function reference

  /**
   * Main data fetching function that initializes all data for the page
   * Retrieves matches, applies initial filtering, fetches teams, and loads scrim groups
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch matches using the getMatches function from match.service.ts
      const matchData = await getMatches();
      setMatches(matchData);
      
      // Initial filtering based on default "our" tab
      const initialFiltered = matchData.filter(match => match.our_team_details !== null);
      setFilteredMatches(initialFiltered);
      
      // Fetch teams using the fetchTeams function we defined above
      await fetchTeams();
      
      // Fetch scrim groups using getScrimGroups from match.service.ts
      try {
        const groupData = await getScrimGroups();
        setScrimGroups(groupData);
        setLoadingGroups(false);
      } catch (groupError) {
        console.error('Error fetching scrim groups:', groupError);
        setLoadingGroups(false);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load matches. Please try again later.");
      setLoading(false);
    }
  }, [fetchTeams]);

  // Initialize data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Applies all active filters to the match list
   * This is the core filtering function that handles all filter criteria
   * 
   * @param matchList - Array of matches to filter
   * @returns Filtered array of matches that match all selected criteria
   */
  const applyFilters = useCallback((matchList: Match[]) => {
    if (!matchList) return [];
    
    return matchList.filter(match => {
      // Apply all active filters
      if (teamFilter && teamFilter !== 'all') {
        const teamId = parseInt(teamFilter, 10);
        const matchTeamIds = [
          match.blue_side_team, 
          match.red_side_team
        ];
        if (!matchTeamIds.includes(teamId)) return false;
      }
      
      if (typeFilter && typeFilter !== 'all') {
        if (match.scrim_type !== typeFilter) return false;
      }
      
      if (outcomeFilter && outcomeFilter !== 'all') {
        if (match.match_outcome !== outcomeFilter) return false;
      }
      
      if (dateFilter && dateFilter !== 'all') {
        const matchDate = new Date(match.match_date);
        const now = new Date();
        
        switch (dateFilter) {
          case 'today':
            if (!isSameDay(matchDate, now)) return false;
            break;
          case 'week':
            if (!isThisWeek(matchDate)) return false;
            break;
          case 'month':
            if (!isThisMonth(matchDate)) return false;
            break;
          default:
            break;
        }
      }
      
      // Filter by ownership
      if (ownershipFilter === 'our') {
        if (match.our_team_details === null) return false;
      } else if (ownershipFilter === 'external') {
        if (match.our_team_details !== null) return false;
      }
      
      return true;
    });
  }, [teamFilter, typeFilter, outcomeFilter, dateFilter, ownershipFilter]);
  
  // Update filtered matches when filters or matches change
  useEffect(() => {
    const filtered = applyFilters(matches);
    setFilteredMatches(filtered);
  }, [matches, applyFilters]);

  // Memoize win-loss record calculation
  const winLossRecord = useMemo(() => {
    if (!filteredMatches || filteredMatches.length === 0 || !teamFilter || teamFilter === 'all') {
      return { wins: 0, losses: 0 };
    }

    const teamId = parseInt(teamFilter, 10);
    return calculateWinLossRecord(filteredMatches, teamId);
  }, [filteredMatches, teamFilter]);

  // Memoize the handler functions to prevent unnecessary re-renders
  const handleTypeFilterChange = useCallback((event: SelectChangeEvent) => {
    setTypeFilter(event.target.value);
  }, []);
  
  const handleOutcomeFilterChange = useCallback((event: SelectChangeEvent) => {
    setOutcomeFilter(event.target.value);
  }, []);
  
  const handleTeamFilterChange = useCallback((event: SelectChangeEvent) => {
    setTeamFilter(event.target.value);
  }, []);
  
  const handleDateFilterChange = useCallback((event: SelectChangeEvent) => {
    setDateFilter(event.target.value);
  }, []);
  
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: string) => {
    setOwnershipFilter(newValue);
  }, []);
  
  const clearFilters = useCallback(() => {
    setTypeFilter('');
    setOutcomeFilter('');
    setTeamFilter('');
    setDateFilter('all');
    // Don't clear the tab selection when clearing other filters
  }, []);

  const handleViewModeChange = useCallback((event: React.MouseEvent<HTMLElement>, newViewMode: 'group' | 'individual' | null) => {
    if (newViewMode !== null) {
      setViewMode(newViewMode);
    }
  }, []);

  // Use useMemo for helper functions that compute values
  const getMatchTypeIcon = useCallback((type: string) => {
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
  }, []);

  // Helper to format match outcome - Memoized
  const getOutcomeChip = useCallback((match: Match) => {
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
  }, []);

  /**
   * Safely gets and formats team display information from a match
   * Handles cases where team information might be missing
   * 
   * @param match - The match object containing team information
   * @returns Object with team display names for blue side, red side, our team, and opponent team
   */
  const getTeamDisplay = useCallback((match: Match) => {
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
  }, []);

  // Get counts for tab badges - Memoized
  const ourMatchesCount = useMemo(() => {
    return matches.filter(match => match.our_team_details !== null).length;
  }, [matches]);
  
  const externalMatchesCount = useMemo(() => {
    return matches.filter(match => match.our_team_details === null).length;
  }, [matches]);

  // Add useEffect to monitor viewMode changes
  useEffect(() => {
    // Removed debug logging
  }, [viewMode]);
  
  // Function to force group view
  const forceGroupView = () => {
    setViewMode('group');
  };
  
  // Add effect to automatically call forceGroupView after data is loaded
  useEffect(() => {
    if (!loading && !loadingGroups && scrimGroups.length > 0) {
      forceGroupView();
    }
  }, [loading, loadingGroups, scrimGroups.length]);

  // Add pagination handlers
  const handleChangePage = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);
  
  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to first page when changing rows per page
  }, []);
  
  // Calculate paginated matches for the current view
  const paginatedMatches = useMemo(() => {
    // Only paginate in individual view mode
    if (viewMode !== 'individual') return filteredMatches;
    
    const startIndex = page * rowsPerPage;
    return filteredMatches.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredMatches, page, rowsPerPage, viewMode]);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Match History</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            aria-label="view mode"
            size="small"
            sx={{ mr: 2 }}
          >
            <ToggleButton value="group" aria-label="scrim group view">
              <Tooltip title="Scrim Group View">
                <ViewModuleIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="individual" aria-label="individual match view">
              <Tooltip title="Individual Match View">
                <ViewListIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          
          {/* Filter Button */}
          <IconButton 
            color={showFilters ? "primary" : "default"} 
            onClick={() => setShowFilters(!showFilters)}
          >
            <FilterAltIcon />
          </IconButton>
        </Box>
      </Box>
      
      {/* Filter Controls */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Filter Tabs */}
            <Grid item xs={12}>
              <StyledTabs 
                value={ownershipFilter} 
                onChange={handleTabChange}
                aria-label="match filter tabs"
              >
                <StyledTab 
                  value="our" 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <GroupIcon sx={{ mr: 1 }} />
                      Our Matches ({ourMatchesCount})
                    </Box>
                  } 
                />
                <StyledTab 
                  value="external" 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PublicIcon sx={{ mr: 1 }} />
                      External Matches ({externalMatchesCount})
                    </Box>
                  } 
                />
                <StyledTab 
                  value="all" 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AllInclusiveIcon sx={{ mr: 1 }} />
                      All Matches ({matches.length})
                    </Box>
                  } 
                />
              </StyledTabs>
            </Grid>
            
            {/* Type Filter */}
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="type-filter-label">Match Type</InputLabel>
                <Select
                  labelId="type-filter-label"
                  id="type-filter"
                  value={typeFilter}
                  onChange={handleTypeFilterChange}
                  label="Match Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="SCRIMMAGE">Scrimmage</MenuItem>
                  <MenuItem value="TOURNAMENT">Tournament</MenuItem>
                  <MenuItem value="RANKED">Ranked</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Outcome Filter */}
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="outcome-filter-label">Outcome</InputLabel>
                <Select
                  labelId="outcome-filter-label"
                  id="outcome-filter"
                  value={outcomeFilter}
                  onChange={handleOutcomeFilterChange}
                  label="Outcome"
                >
                  <MenuItem value="">All Outcomes</MenuItem>
                  <MenuItem value="VICTORY">Victory</MenuItem>
                  <MenuItem value="DEFEAT">Defeat</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Team Filter */}
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="team-filter-label">Team</InputLabel>
                <Select
                  labelId="team-filter-label"
                  id="team-filter"
                  value={teamFilter}
                  onChange={handleTeamFilterChange}
                  label="Team"
                  input={<OutlinedInput />}
                >
                  <MenuItem value="">All Teams</MenuItem>
                  {teams.length > 0 ? (
                    teams.map(team => (
                      <MenuItem 
                        key={team.value} 
                        value={team.value}
                      >
                        {team.label}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>No teams available</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            
            {/* Date Filter */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel id="date-filter-label">Time Period</InputLabel>
                <Select
                  labelId="date-filter-label"
                  id="date-filter"
                  value={dateFilter}
                  onChange={handleDateFilterChange}
                  label="Time Period"
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="week">Past Week</MenuItem>
                  <MenuItem value="month">Past Month</MenuItem>
                  <MenuItem value="year">Past Year</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Clear Filters Button */}
            <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'center' }}>
              <IconButton onClick={clearFilters} color="primary" title="Clear Filters">
                <ClearIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {!loading && filteredMatches.length === 0 && (
        <Alert severity="info">No matches found with the selected filters.</Alert>
      )}

      {/* Match List */}
      {viewMode === 'group' ? (
        <ScrimGroupList
          scrimGroups={scrimGroups}
          matches={filteredMatches}
          loading={loading || loadingGroups}
          isOurTeamFilter={ownershipFilter === 'our'}
        />
      ) : (
        <>
          <Grid container spacing={2}>
            {paginatedMatches.map((match) => {
              const { blueTeam, redTeam } = getTeamDisplay(match);
              
              // Determine result for styling - only for our matches
              const isOurMatch = match.our_team_details !== null;
              const isVictory = isOurMatch && match.match_outcome === 'VICTORY';
              const isDefeat = isOurMatch && match.match_outcome === 'DEFEAT';
              
              return (
                <Grid item xs={12} key={match.match_id}>
                  <Card 
                    component={Link} 
                    to={`/matches/${match.match_id}`}
                    sx={{ 
                      textDecoration: 'none',
                      display: 'block',
                      transition: 'transform 0.2s',
                      borderLeft: isOurMatch ? 
                        (isVictory ? '4px solid green' : isDefeat ? '4px solid red' : 'none') : 
                        'none',
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
                            <Typography 
                              variant="body1" 
                              fontWeight={match.winning_team === match.blue_side_team ? "bold" : "normal"} 
                              textAlign="right" 
                              sx={{ 
                                flex: 1,
                                color: match.winning_team === match.blue_side_team ? 'success.main' : 'text.primary'
                              }}
                            >
                              {blueTeam}
                            </Typography>
                            <Box 
                              sx={{ 
                                mx: 2, 
                                px: 2, 
                                py: 0.5, 
                                borderRadius: 1, 
                                bgcolor: 'grey.100',
                                display: 'flex',
                                alignItems: 'center',
                                minWidth: '70px',
                                justifyContent: 'center'
                              }}
                            >
                              {match.score_details ? (
                                <Typography variant="body2" fontWeight="bold">
                                  {match.score_details.blue_side_score || 0} - {match.score_details.red_side_score || 0}
                                </Typography>
                              ) : (
                                <Typography variant="body2" fontWeight="bold">
                                  VS
                                </Typography>
                              )}
                            </Box>
                            <Typography 
                              variant="body1" 
                              fontWeight={match.winning_team === match.red_side_team ? "bold" : "normal"} 
                              textAlign="left" 
                              sx={{ 
                                flex: 1,
                                color: match.winning_team === match.red_side_team ? 'success.main' : 'text.primary'
                              }}
                            >
                              {redTeam}
                            </Typography>
                          </Box>
                          {/* Add score explanation if score exists */}
                          {match.score_details && match.score_details.blue_side_score !== undefined && (
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
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                              Game #{match.game_number}
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
          
          {/* Pagination Controls */}
          {filteredMatches.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <TablePagination
                component="div"
                count={filteredMatches.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Matches per page:"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default MatchListPage; 