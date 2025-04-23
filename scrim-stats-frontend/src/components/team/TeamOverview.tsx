import React from 'react';
import { 
  Card, 
  CardContent, 
  Grid, 
  Typography, 
  Box, 
  Divider, 
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { TeamStatistics } from '../../types/statistics.types';
import { Team } from '../../types/team.types';

// Custom CircularProgressWithLabel component for the winrate visualization
const CircularProgressWithLabel = styled((props: { value: number, size?: number }) => {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={props.value}
        size={props.size || 100}
        sx={{
          color: props.value >= 50 ? 'success.main' : 'error.main',
        }}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          component="div"
          color="text.secondary"
          sx={{ fontSize: '1rem' }}
        >{`${Math.round(props.value)}%`}</Typography>
      </Box>
    </Box>
  );
})(({ theme }) => ({
  // No additional styling needed
}));

// StatCard component for displaying key metrics
const StatCard = ({ title, value, secondaryValue }: { title: string, value: string | number, secondaryValue?: string }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent>
      <Typography color="textSecondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h5" component="div">
        {value}
      </Typography>
      {secondaryValue && (
        <Typography color="textSecondary" sx={{ fontSize: '0.875rem' }}>
          {secondaryValue}
        </Typography>
      )}
    </CardContent>
  </Card>
);

// Distribution chart using LinearProgress
const DistributionChart = ({ 
  data, 
  title
}: { 
  data: { player_name: string, percentage: number, average_value?: number }[],
  title: string 
}) => (
  <Card variant="outlined" sx={{ mt: 2 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {data.map((item, index) => (
        <Box key={index} sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">{item.player_name}</Typography>
            <Typography variant="body2">
              {item.percentage.toFixed(1)}%
              {item.average_value && ` (${item.average_value.toFixed(0)})`}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={item.percentage} 
            sx={{ height: 8, borderRadius: 5, mt: 0.5 }} 
          />
        </Box>
      ))}
    </CardContent>
  </Card>
);

// Hero pick table
const HeroPickTable = ({ heroes }: { heroes: TeamStatistics['hero_pick_frequency'] }) => (
  <TableContainer component={Paper} sx={{ mt: 2 }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Hero</TableCell>
          <TableCell align="right">Picks</TableCell>
          <TableCell align="right">Wins</TableCell>
          <TableCell align="right">Winrate</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {heroes.map((hero) => (
          <TableRow key={hero.hero_id}>
            <TableCell component="th" scope="row">
              {hero.hero_name}
            </TableCell>
            <TableCell align="right">{hero.picks}</TableCell>
            <TableCell align="right">{hero.wins}</TableCell>
            <TableCell align="right">{hero.winrate.toFixed(1)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

// Recent matches table
const RecentMatchesTable = ({ matches }: { matches: TeamStatistics['recent_matches'] }) => (
  <TableContainer component={Paper} sx={{ mt: 2 }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Opponent</TableCell>
          <TableCell>Result</TableCell>
          <TableCell>Type</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {matches.map((match) => {
          const opponentTeam = match.blue_side_team_details?.team_name === match.our_team_details?.team_name
            ? match.red_side_team_details?.team_name || 'Unknown'
            : match.blue_side_team_details?.team_name || 'Unknown';
          
          return (
            <TableRow key={match.match_id}>
              <TableCell>
                {new Date(match.match_date).toLocaleDateString()}
              </TableCell>
              <TableCell>{opponentTeam}</TableCell>
              <TableCell>
                <Chip 
                  label={match.match_outcome} 
                  color={match.match_outcome === 'VICTORY' ? 'success' : 'error'}
                  size="small"
                />
              </TableCell>
              <TableCell>{match.scrim_type}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);

// Performance trend
const PerformanceTrend = ({ trend }: { trend: TeamStatistics['performance_trend'] }) => (
  <Card variant="outlined" sx={{ mt: 2 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Performance Trend
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Opponent</TableCell>
              <TableCell>Result</TableCell>
              <TableCell align="right">KDA</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trend.map((point, index) => (
              <TableRow key={index}>
                <TableCell>{new Date(point.date).toLocaleDateString()}</TableCell>
                <TableCell>{point.opponent}</TableCell>
                <TableCell>
                  <Chip 
                    label={point.won ? 'WIN' : 'LOSS'} 
                    color={point.won ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">{point.kda.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </CardContent>
  </Card>
);

interface TeamOverviewProps {
  team: Team;
  statistics: TeamStatistics;
}

export const TeamOverview: React.FC<TeamOverviewProps> = ({ team, statistics }) => {
  // Add debugging to check data availability
  console.log("Team Statistics Overview:", {
    team,
    damageDistSize: statistics.damage_distribution?.length || 0,
    goldDistSize: statistics.gold_distribution?.length || 0,
    heroPickSize: statistics.hero_pick_frequency?.length || 0,
    heroPickFrequency: statistics.hero_pick_frequency
  });
  
  // Additional debugging specifically for hero pick frequency
  if (statistics.hero_pick_frequency && statistics.hero_pick_frequency.length > 0) {
    console.log("Hero pick frequency details:", 
      statistics.hero_pick_frequency.map(hero => ({
        id: hero.hero_id,
        name: hero.hero_name,
        picks: hero.picks,
        wins: hero.wins,
        winrate: hero.winrate
      }))
    );
  } else {
    console.log("No hero pick frequency data available");
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <CircularProgressWithLabel value={statistics.winrate} />
          </Grid>
          <Grid item xs>
            <Typography variant="h4">{team.team_name}</Typography>
            <Typography variant="subtitle1" color="textSecondary">
              {team.team_abbreviation} - {team.team_category}
            </Typography>
            <Box sx={{ display: 'flex', mt: 1 }}>
              <Typography variant="body2" sx={{ mr: 2 }}>
                <strong>Matches:</strong> {statistics.total_matches}
              </Typography>
              <Typography variant="body2" sx={{ mr: 2 }}>
                <strong>W-L:</strong> {statistics.wins}-{statistics.losses}
              </Typography>
              <Typography variant="body2">
                <strong>Avg. Duration:</strong> {statistics.avg_match_duration}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Key Metrics Row */}
        <Grid item xs={12} md={4}>
          <StatCard 
            title="Team KDA" 
            value={statistics.avg_team_kda.toFixed(2)} 
            secondaryValue={`${statistics.avg_kills_per_match.toFixed(1)} / ${statistics.avg_deaths_per_match.toFixed(1)} / ${statistics.avg_assists_per_match.toFixed(1)}`}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard 
            title="Objective Control Rate" 
            value={`${statistics.objective_control_rate.toFixed(1)}%`} 
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard 
            title="Matches Played" 
            value={statistics.total_matches} 
            secondaryValue={`Win Rate: ${statistics.winrate.toFixed(1)}%`}
          />
        </Grid>

        {/* Distribution Charts */}
        <Grid item xs={12} md={6}>
          {statistics.damage_distribution && statistics.damage_distribution.length > 0 ? (
            <DistributionChart 
              title="Damage Distribution" 
              data={statistics.damage_distribution.map(item => ({
                player_name: item.player_name,
                percentage: item.percentage,
                average_value: item.average_damage
              }))}
            />
          ) : (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Damage Distribution</Typography>
                <Typography variant="body2" color="textSecondary">
                  No damage data available. Complete matches with damage statistics to see this chart.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
        <Grid item xs={12} md={6}>
          {statistics.gold_distribution && statistics.gold_distribution.length > 0 ? (
            <DistributionChart 
              title="Gold Distribution" 
              data={statistics.gold_distribution.map(item => ({
                player_name: item.player_name,
                percentage: item.percentage,
                average_value: item.average_gold
              }))}
            />
          ) : (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Gold Distribution</Typography>
                <Typography variant="body2" color="textSecondary">
                  No gold data available. Complete matches with gold statistics to see this chart.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Hero Picks */}
        <Grid item xs={12} md={6}>
          <Box>
            <Typography variant="h6" gutterBottom>Hero Pick Frequency</Typography>
            {statistics.hero_pick_frequency && statistics.hero_pick_frequency.length > 0 ? (
              <HeroPickTable heroes={statistics.hero_pick_frequency} />
            ) : (
              <Typography variant="body2" color="textSecondary">
                No hero pick data available. Complete matches with hero selections to see this chart.
              </Typography>
            )}
          </Box>
        </Grid>

        {/* Recent Matches */}
        <Grid item xs={12} md={6}>
          <Box>
            <Typography variant="h6" gutterBottom>Recent Matches</Typography>
            {statistics.recent_matches && statistics.recent_matches.length > 0 ? (
              <RecentMatchesTable matches={statistics.recent_matches} />
            ) : (
              <Typography variant="body2" color="textSecondary">
                No recent matches available.
              </Typography>
            )}
          </Box>
        </Grid>

        {/* Performance Trend */}
        <Grid item xs={12}>
          {statistics.performance_trend && statistics.performance_trend.length > 0 ? (
            <PerformanceTrend trend={statistics.performance_trend} />
          ) : (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Performance Trend</Typography>
                <Typography variant="body2" color="textSecondary">
                  Not enough match data to display performance trend.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}; 