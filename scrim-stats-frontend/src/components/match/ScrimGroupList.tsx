import React, { useState } from 'react';
import { 
  Accordion, 
  AccordionSummary, 
  AccordionDetails, 
  Typography, 
  Box, 
  Chip, 
  Card, 
  CardContent, 
  Grid, 
  Stack,
  Paper,
  styled,
  LinearProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link } from 'react-router-dom';
import { ScrimGroup, Match } from '../../types/match.types';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TournamentIcon from '@mui/icons-material/EmojiEvents';
import RankedIcon from '@mui/icons-material/Leaderboard';

// Styling
const StyledAccordion = styled(Accordion)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  '&.Mui-expanded': {
    margin: theme.spacing(1, 0, 2),
  },
}));

const StyledAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  '&.Mui-expanded': {
    minHeight: 48,
  },
}));

// Helper functions
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

// Component props
interface ScrimGroupListProps {
  scrimGroups: ScrimGroup[];
  matches: Match[];
  loading: boolean;
  isOurTeamFilter: boolean;
}

const ScrimGroupList: React.FC<ScrimGroupListProps> = ({ 
  scrimGroups, 
  matches, 
  loading,
  isOurTeamFilter
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Debug logging
  console.log("ScrimGroupList received props:", { 
    scrimGroupsCount: scrimGroups.length, 
    matchesCount: matches.length,
    isOurTeamFilter
  });
  
  // Debug log scrim groups
  console.log("Available scrim groups:", scrimGroups);
  
  // Detailed inspection of the matches structure
  console.log("DETAILED MATCHES INSPECTION:");
  console.log("First match example:", matches.length > 0 ? matches[0] : "No matches");
  
  // Check for scrim_group vs scrim_group_id pattern in matches
  const usesScrimGroup = matches.some(match => match.scrim_group !== undefined);
  const usesScrimGroupId = matches.some(match => match.scrim_group_id !== undefined);
  console.log("Match data structure analysis:", {
    usesScrimGroup,
    usesScrimGroupId
  });
  
  // Log all matches scrim group details
  console.log("All matches scrim group details:");
  matches.forEach(match => {
    console.log(`Match ${match.match_id}:`, {
      scrim_group: match.scrim_group,
      scrim_group_id: match.scrim_group_id
    });
  });

  // Generate dynamic scrim groups if none are provided
  let workingScrimGroups = [...scrimGroups];
  if (workingScrimGroups.length === 0 && matches.length > 0) {
    console.log("No scrim groups provided, generating dynamic groups");
    // Use a numbers-only Map to avoid type issues
    const dynamicGroups = new Map<number, ScrimGroup>();
    
    matches.forEach(match => {
      // Ensure we're working with a numeric ID
      const scrimGroupId = typeof match.scrim_group === 'number' ? 
                          match.scrim_group : 
                          match.scrim_group ? Number(match.scrim_group) : 0;
      
      if (scrimGroupId && !dynamicGroups.has(scrimGroupId)) {
        // Get team names for more descriptive group name
        const blueTeam = match.blue_side_team_details?.team_abbreviation || 
                        match.blue_side_team_details?.team_name || 'Team1';
        const redTeam = match.red_side_team_details?.team_abbreviation || 
                        match.red_side_team_details?.team_name || 'Team2';
        const date = formatDate(match.match_date).replace(/,/g, '');
        const descriptiveName = `${date} - ${blueTeam} vs ${redTeam}`;
        
        dynamicGroups.set(scrimGroupId, {
          scrim_group_id: scrimGroupId,
          scrim_group_name: descriptiveName,
          start_date: match.match_date
        });
      }
    });
    
    workingScrimGroups = Array.from(dynamicGroups.values());
    console.log("Generated dynamic scrim groups:", workingScrimGroups);
  }

  // Organize matches by scrim group - using number as the key type
  const matchesByGroup: Record<number, Match[]> = {};
  const standaloneMatches: Match[] = [];

  // Safely get numeric ID from a scrim group
  const getNumericGroupId = (group: ScrimGroup): number => {
    return typeof group.scrim_group_id === 'number' ? 
      group.scrim_group_id : 
      Number(group.scrim_group_id);
  };

  matches.forEach(match => {
    // Debug score details for each match
    console.log(`Match ${match.match_id} score details:`, match.score_details);
    
    // Check if scrim_group is present as a number (ID)
    if (match.scrim_group) {
      // Use scrim_group directly as the ID since it's a number
      const groupId = typeof match.scrim_group === 'number' ? match.scrim_group : Number(match.scrim_group);
      if (!matchesByGroup[groupId]) {
        matchesByGroup[groupId] = [];
      }
      matchesByGroup[groupId].push(match);
    } else {
      standaloneMatches.push(match);
    }
  });

  // Debug organized matches
  console.log("Matches organized by group:", matchesByGroup);
  console.log("Standalone matches:", standaloneMatches.length);
  
  // Log which scrim groups have matches
  const groupsWithMatches = Object.keys(matchesByGroup).map(Number);
  console.log("Scrim group IDs with matches:", groupsWithMatches);
  
  // Check if any scrim groups from props don't have matches
  const missingGroups = workingScrimGroups
    .filter(group => {
      const numericId = getNumericGroupId(group);
      return !groupsWithMatches.includes(numericId);
    })
    .map(group => getNumericGroupId(group));
  console.log("Scrim groups without matches:", missingGroups);

  // Calculate group record
  const calculateGroupRecord = (matches: Match[]) => {
    const wins = matches.filter(m => m.match_outcome === 'VICTORY').length;
    const losses = matches.filter(m => m.match_outcome === 'DEFEAT').length;
    const winRate = matches.length > 0 ? (wins / matches.length) * 100 : 0;
    
    return { wins, losses, winRate: Math.round(winRate) };
  };

  const handleAccordionChange = (groupId: number) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: isExpanded }));
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

  // Helper to format match outcome
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
    
    // For our team's matches, show victory/defeat
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

  // Helper to get team names
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

  const renderMatch = (match: Match) => {
    const { blueTeam, redTeam } = getTeamDisplay(match);
    
    // Debug team display and score details
    console.log(`renderMatch for match ${match.match_id}:`, {
      blueTeam,
      redTeam,
      scoreDetails: match.score_details
    });
    
    // Determine styling for our matches
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      px: 1,
                      minWidth: '70px',
                    }}
                  >
                    {match.score_details ? (
                      <Typography variant="body2" fontWeight="bold">
                        {match.score_details.blue_side_score || 0} - {match.score_details.red_side_score || 0}
                      </Typography>
                    ) : (
                      <Typography variant="body2">vs</Typography>
                    )}
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: 1,
                    }}
                  >
                    <Typography
                      variant="body1"
                      fontWeight={match.winning_team === match.red_side_team ? 'bold' : 'normal'}
                      sx={{
                        color: match.winning_team === match.red_side_team ? 'error.main' : 'text.primary',
                      }}
                    >
                      {redTeam}
                    </Typography>
                  </Box>
                </Box>
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
  };

  // Helper to render a scrim group with its matches
  const renderGroup = (group: ScrimGroup) => {
    const numericGroupId = getNumericGroupId(group);
    // Get matches for this group
    const groupMatches = matchesByGroup[numericGroupId] || [];
    
    // Skip empty groups or those that don't match filter
    if (groupMatches.length === 0) return null;
    if (isOurTeamFilter && !groupMatches.some(m => m.our_team_details)) return null;
    
    // Record for the group
    const { wins, losses, winRate } = calculateGroupRecord(groupMatches);
    
    // Get a more descriptive name for the scrim group
    const getDescriptiveGroupName = () => {
      if (groupMatches.length === 0) return group.scrim_group_name;
      
      // Use the first match to get date and teams
      const firstMatch = groupMatches[0];
      const date = formatDate(firstMatch.match_date).replace(/,/g, '');
      const blueTeam = firstMatch.blue_side_team_details?.team_abbreviation || 
                       firstMatch.blue_side_team_details?.team_name || 'Team1';
      const redTeam = firstMatch.red_side_team_details?.team_abbreviation || 
                      firstMatch.red_side_team_details?.team_name || 'Team2';
      
      return `${date} - ${blueTeam} vs ${redTeam}`;
    };
    
    const descriptiveGroupName = getDescriptiveGroupName();
    
    return (
      <StyledAccordion
        key={numericGroupId}
        expanded={expandedGroups[numericGroupId.toString()] || false}
        onChange={handleAccordionChange(numericGroupId)}
      >
        <StyledAccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls={`group-${numericGroupId}-content`}
          id={`group-${numericGroupId}-header`}
        >
          <Grid container alignItems="center">
            <Grid item xs={6} md={3}>
              <Typography variant="subtitle1" fontWeight="bold">
                {descriptiveGroupName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(group.start_date)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3} textAlign="center">
              <Typography variant="subtitle2">
                {groupMatches.length} {groupMatches.length === 1 ? 'Match' : 'Matches'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} textAlign="right">
              <Box display="flex" justifyContent="flex-end" alignItems="center">
                <Typography variant="body2" sx={{ mr: 1 }}>
                  {wins}W - {losses}L
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={winRate}
                  color={winRate > 50 ? "success" : "error"}
                  sx={{ width: 80, height: 8, borderRadius: 4 }}
                />
              </Box>
            </Grid>
          </Grid>
        </StyledAccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {groupMatches.map(match => renderMatch(match))}
          </Grid>
        </AccordionDetails>
      </StyledAccordion>
    );
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <div>
      {/* Render Scrim Groups */}
      {workingScrimGroups.map(group => renderGroup(group))}

      {/* Render Standalone Matches (if any) */}
      {standaloneMatches.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Individual Matches
          </Typography>
          <Grid container spacing={2}>
            {standaloneMatches.map(match => renderMatch(match))}
          </Grid>
        </Paper>
      )}

      {/* Empty State */}
      {matches.length === 0 && !loading && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6">No Matches Found</Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your filters or check back later for new matches.
          </Typography>
        </Paper>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <Typography>Loading matches...</Typography>
        </Box>
      )}
    </div>
  );
};

export default ScrimGroupList; 