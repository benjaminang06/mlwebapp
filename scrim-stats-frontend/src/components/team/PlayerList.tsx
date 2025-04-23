import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Grid, 
  Typography, 
  Box, 
  Avatar, 
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  TableSortLabel,
  CircularProgress,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { getTeamPlayers } from '../../services/team.service';
import { getTeamStatistics } from '../../services/statistics.service';
import { Player } from '../../types/player.types';
import { PlayerStatistics } from '../../types/statistics.types';
import { HeroPickStats } from '../../types/statistics.types';

interface PlayerData extends Player {
  statistics?: {
    total_matches: number;
    winrate: number;
    avg_kda: number;
    favorite_heroes: HeroPickStats[];
  };
}

interface PlayerListProps {
  teamId: string;
  onPlayerSelect: (playerId: number) => void;
}

type SortField = 'ign' | 'role' | 'matches' | 'winrate' | 'kda';
type SortDirection = 'asc' | 'desc';

export const PlayerList: React.FC<PlayerListProps> = ({ teamId, onPlayerSelect }) => {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('ign');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch team players and their statistics
  useEffect(() => {
    const fetchPlayersWithStats = async () => {
      try {
        setLoading(true);
        
        // Fetch players
        const fetchedPlayers = await getTeamPlayers(teamId);
        
        // Try to fetch team statistics to get player stats
        try {
          const teamStats = await getTeamStatistics(teamId);
          
          // Combine player data with statistics
          const playersWithStats: PlayerData[] = fetchedPlayers.map(player => {
            const playerStats = teamStats.player_statistics.find(
              ps => ps.player.player_id === player.player_id
            );
            
            return {
              ...player,
              statistics: playerStats ? {
                total_matches: playerStats.total_matches,
                winrate: playerStats.winrate,
                avg_kda: playerStats.avg_kda,
                favorite_heroes: playerStats.favorite_heroes
              } : undefined
            };
          });
          
          setPlayers(playersWithStats);
        } catch (statsError) {
          // If stats fetch fails, just use players without statistics
          console.error('Failed to fetch team statistics:', statsError);
          setPlayers(fetchedPlayers);
        }
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load team players. Please try again later.');
        setLoading(false);
      }
    };

    fetchPlayersWithStats();
  }, [teamId]);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle sort request
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if already sorting by this field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter players based on search query
  const filteredPlayers = players.filter(player => 
    player.current_ign.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (player.primary_role && player.primary_role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort players based on sort field and direction
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'ign':
        return multiplier * a.current_ign.localeCompare(b.current_ign);
      case 'role':
        return multiplier * (a.primary_role || '').localeCompare(b.primary_role || '');
      case 'matches':
        return multiplier * ((a.statistics?.total_matches || 0) - (b.statistics?.total_matches || 0));
      case 'winrate':
        return multiplier * ((a.statistics?.winrate || 0) - (b.statistics?.winrate || 0));
      case 'kda':
        return multiplier * ((a.statistics?.avg_kda || 0) - (b.statistics?.avg_kda || 0));
      default:
        return 0;
    }
  });

  // Helper function to get role color
  const getRoleColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'top':
        return '#f44336'; // Red
      case 'jungle':
        return '#4caf50'; // Green
      case 'mid':
        return '#2196f3'; // Blue
      case 'adc':
        return '#ff9800'; // Orange
      case 'support':
        return '#9c27b0'; // Purple
      default:
        return '#757575'; // Grey
    }
  };

  // Helper to render favorite hero
  const renderFavoriteHero = (player: PlayerData) => {
    if (!player.statistics?.favorite_heroes?.length) return 'N/A';
    
    const favoriteHero = player.statistics.favorite_heroes[0];
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <SportsEsportsIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
        <Typography variant="body2">
          {favoriteHero.hero_name} ({favoriteHero.picks})
        </Typography>
      </Box>
    );
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

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by player name or role..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'ign'}
                  direction={sortField === 'ign' ? sortDirection : 'asc'}
                  onClick={() => handleSort('ign')}
                >
                  Player
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'role'}
                  direction={sortField === 'role' ? sortDirection : 'asc'}
                  onClick={() => handleSort('role')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'matches'}
                  direction={sortField === 'matches' ? sortDirection : 'asc'}
                  onClick={() => handleSort('matches')}
                >
                  Matches
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'winrate'}
                  direction={sortField === 'winrate' ? sortDirection : 'asc'}
                  onClick={() => handleSort('winrate')}
                >
                  Winrate
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'kda'}
                  direction={sortField === 'kda' ? sortDirection : 'asc'}
                  onClick={() => handleSort('kda')}
                >
                  KDA
                </TableSortLabel>
              </TableCell>
              <TableCell>Most Played</TableCell>
              <TableCell align="right">Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPlayers.map((player) => (
              <TableRow key={player.player_id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar 
                      src={player.profile_image_url} 
                      alt={player.current_ign}
                      sx={{ mr: 2, bgcolor: getRoleColor(player.primary_role) }}
                    >
                      {player.current_ign.charAt(0)}
                    </Avatar>
                    <Typography>{player.current_ign}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {player.primary_role && (
                    <Chip 
                      label={player.primary_role} 
                      size="small"
                      sx={{ 
                        bgcolor: getRoleColor(player.primary_role),
                        color: 'white'
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>{player.statistics?.total_matches || 'N/A'}</TableCell>
                <TableCell>
                  {player.statistics?.winrate !== undefined
                    ? `${player.statistics.winrate.toFixed(1)}%`
                    : 'N/A'
                  }
                </TableCell>
                <TableCell>
                  {player.statistics?.avg_kda !== undefined
                    ? player.statistics.avg_kda.toFixed(2)
                    : 'N/A'
                  }
                </TableCell>
                <TableCell>{renderFavoriteHero(player)}</TableCell>
                <TableCell align="right">
                  <IconButton 
                    aria-label="View player details"
                    onClick={() => onPlayerSelect(player.player_id)}
                  >
                    <InfoIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {sortedPlayers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No players found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}; 