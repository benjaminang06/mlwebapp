import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Card, 
  CardContent, 
  CardHeader,
  List,
  ListItem,
  ListItemText,
  Divider,
  Box,
  CircularProgress,
  Button,
  Alert
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  SportsEsports as MatchIcon,
  TrendingUp as WinRateIcon,
  EmojiEvents as TopHeroIcon,
  People as PlayerIcon
} from '@mui/icons-material';
import { getDashboardStats, DashboardStats } from '../../services/dashboard.service';

// Initial placeholder data
const initialStatsData: DashboardStats = {
  totalMatches: 0,
  winRate: 0,
  topHeroes: [],
  recentMatches: [],
  topPlayers: []
};

const StatCard: React.FC<{ 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, icon, color = 'primary.main' }) => (
  <Card elevation={3}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{ 
          bgcolor: `${color}15`, 
          borderRadius: '50%', 
          p: 1, 
          mr: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Box sx={{ color: color }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h6" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>(initialStatsData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard 
            title="Total Matches" 
            value={stats.totalMatches} 
            icon={<MatchIcon />} 
            color="#4CAF50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard 
            title="Win Rate" 
            value={`${stats.winRate}%`} 
            icon={<WinRateIcon />} 
            color="#2196F3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard 
            title="Top Players" 
            value={stats.topPlayers.length} 
            icon={<PlayerIcon />} 
            color="#F44336"
          />
        </Grid>
      </Grid>

      {/* Recent Matches and Top Heroes */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card elevation={3}>
            <CardHeader 
              title="Recent Matches" 
              action={
                <Button 
                  component={Link} 
                  to="/matches" 
                  size="small" 
                  color="primary"
                >
                  View All
                </Button>
              } 
            />
            <Divider />
            {stats.recentMatches.length > 0 ? (
              <List>
                {stats.recentMatches.map((match) => (
                  <React.Fragment key={match.id}>
                    <ListItem 
                      component={Link} 
                      to={`/matches/${match.id}`} 
                      sx={{ 
                        textDecoration: 'none', 
                        color: 'inherit',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <ListItemText
                        primary={match.opponent}
                        secondary={match.date}
                      />
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: match.result === 'Win' ? 'success.main' : 'error.main',
                          fontWeight: 'bold'
                        }}
                      >
                        {match.result}
                      </Typography>
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No recent matches found
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card elevation={3}>
            <CardHeader 
              title="Top Heroes" 
              action={
                <Button 
                  component={Link} 
                  to="/heroes" 
                  size="small" 
                  color="primary"
                >
                  View All
                </Button>
              } 
            />
            <Divider />
            {stats.topHeroes.length > 0 ? (
              <List>
                {stats.topHeroes.map((hero, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemText
                        primary={hero.name}
                        secondary={`Win Rate: ${hero.winRate}%`}
                      />
                      <Box 
                        sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: index === 0 ? 'gold' : index === 1 ? 'silver' : '#cd7f32',
                          color: index === 0 || index === 1 ? 'black' : 'white',
                          fontWeight: 'bold'
                        }}
                      >
                        {index + 1}
                      </Box>
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No hero data available
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 