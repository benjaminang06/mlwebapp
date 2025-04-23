import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Grid, 
  Paper, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  Tabs,
  Tab,
  SelectChangeEvent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { getTeams, getTeam, getTeamPlayers } from '../services/team.service';
import { getTeamStatistics } from '../services/statistics.service';
import { Team } from '../types/team.types';
import { TeamOverview } from '../components/team/TeamOverview';
import { PlayerList } from '../components/team/PlayerList';
import { DetailedPlayerView } from '../components/team/DetailedPlayerView';
import { TeamStatistics } from '../types/statistics.types';

const TeamStatisticsPage: React.FC = () => {
  const theme = useTheme();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<TeamStatistics | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  // Fetch all teams on component mount
  useEffect(() => {
    const fetchAllTeams = async () => {
      try {
        setLoading(true);
        const fetchedTeams = await getTeams();
        setTeams(fetchedTeams);
        
        // If teams are available, select the first one by default
        if (fetchedTeams.length > 0) {
          setSelectedTeamId(fetchedTeams[0].team_id.toString());
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to load teams. Please try again later.');
        setLoading(false);
      }
    };

    fetchAllTeams();
  }, []);

  // Fetch selected team details when selectedTeamId changes
  useEffect(() => {
    const fetchTeamDetails = async () => {
      if (!selectedTeamId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // First fetch the team info
        const teamData = await getTeam(selectedTeamId);
        setSelectedTeam(teamData);
        
        // Then fetch team statistics
        try {
          const teamStats = await getTeamStatistics(selectedTeamId);
          console.log("Received team statistics:", teamStats);
          setStatistics(teamStats);
        } catch (statsError: any) {
          console.error("Error fetching team statistics:", statsError);
          
          // Show a specific error just for the stats, don't fail the whole page
          if (statsError.message.includes('No matches found')) {
            // This is normal for new teams - just set statistics to null
            setStatistics(null);
          } else {
            // For other errors, set an error message
            setError(`Statistics error: ${statsError.message || 'Unknown error'}`);
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load team details:', err);
        setError(`Failed to load team details: ${err.message || 'Unknown error'}`);
        setLoading(false);
      }
    };

    fetchTeamDetails();
  }, [selectedTeamId]);

  // Handle team selection change
  const handleTeamChange = (event: SelectChangeEvent) => {
    setSelectedTeamId(event.target.value);
    setSelectedPlayerId(null); // Reset selected player when changing teams
    setActiveTab(0); // Reset to team overview tab
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    if (newValue !== 2) {
      setSelectedPlayerId(null); // Reset selected player when not on player detail tab
    }
  };

  // Handle player selection
  const handlePlayerSelect = (playerId: number) => {
    setSelectedPlayerId(playerId);
    setActiveTab(2); // Switch to detailed player view
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Team Statistics
        </Typography>

        {/* Team Selector */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="team-select-label">Select Team</InputLabel>
            <Select
              labelId="team-select-label"
              id="team-select"
              value={selectedTeamId}
              onChange={handleTeamChange}
              label="Select Team"
              disabled={loading || teams.length === 0}
            >
              {teams.map((team) => (
                <MenuItem key={team.team_id} value={team.team_id.toString()}>
                  {team.team_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {/* Loading and Error States */}
        {loading && (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Content tabs */}
        {selectedTeam && !loading && (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs 
                value={activeTab} 
                onChange={handleTabChange}
                aria-label="team statistics tabs"
              >
                <Tab label="Team Overview" />
                <Tab label="Players" />
                {selectedPlayerId && <Tab label="Player Details" />}
              </Tabs>
            </Box>

            {/* Tab Content */}
            {activeTab === 0 && statistics && (
              <TeamOverview team={selectedTeam} statistics={statistics} />
            )}

            {activeTab === 1 && selectedTeam && (
              <PlayerList 
                teamId={selectedTeam.team_id.toString()} 
                onPlayerSelect={handlePlayerSelect} 
              />
            )}

            {activeTab === 2 && selectedPlayerId && (
              <DetailedPlayerView 
                playerId={selectedPlayerId} 
                teamId={selectedTeam.team_id.toString()} 
              />
            )}
          </>
        )}

        {selectedTeam && !loading && !statistics && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              No match data available for this team.
            </Typography>
            <Typography variant="body2">
              To see team statistics, complete matches with the following data:
            </Typography>
            <ul>
              <li>Damage statistics: For damage distribution</li>
              <li>Gold earned statistics: For gold distribution</li>
              <li>Hero selections: For hero pick frequency</li>
            </ul>
            <Typography variant="body2">
              All of these fields are optional in match data, but they enable these statistics views.
            </Typography>
          </Alert>
        )}
      </Box>
    </Container>
  );
};

export default TeamStatisticsPage; 