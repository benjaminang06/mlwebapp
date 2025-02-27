import React, { useState, useEffect } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { Box, Stepper, Step, StepLabel, Button, Typography, Paper, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import MatchMetadata from './MatchMetadata';
import ScrimGroupSelector from './ScrimGroupSelector';
import PlayerStatRow from './PlayerStatRow';
import FileUploader from './FileUploader';
import { useNavigate } from 'react-router-dom';
import { createMatch } from '../../services/match.service';
import { Match, PlayerStat } from '../../types/match.types';

const steps = ['Match Details', 'Team Players', 'Enemy Players', 'File Uploads', 'Review'];

// Initial form values
const initialValues = {
  // Match metadata
  match_date_time: new Date().toISOString().substring(0, 16),
  opponent_category: 'Collegiate',
  opponent_team_name: '',
  opponent_team_abbreviation: '',
  scrim_type: 'Practice',
  match_outcome: 'Win',
  general_notes: '',
  game_number: 1,
  team_side: 'Blue Side',
  
  // Scrim group
  scrim_group: null,
  
  // Players and stats
  team_players: Array(5).fill({
    player_id: null,
    hero_played: '',
    kills: 0,
    deaths: 0,
    assists: 0,
    damage_dealt: 0,
    damage_taken: 0,
    turret_damage: 0,
    teamfight_participation: 0,
    gold_earned: 0,
    player_notes: '',
  }),
  
  enemy_players: Array(5).fill({
    player_id: null,
    hero_played: '',
    kills: 0,
    deaths: 0,
    assists: 0,
    damage_dealt: 0,
    damage_taken: 0,
    turret_damage: 0,
    teamfight_participation: 0,
    gold_earned: 0,
    player_notes: '',
  }),
  
  // File uploads
  files: [],
};

// Validation schemas for each step
const matchDetailsSchema = Yup.object({
  match_date_time: Yup.date().required('Required'),
  opponent_team_name: Yup.string().required('Required'),
  opponent_team_abbreviation: Yup.string().required('Required'),
  scrim_type: Yup.string().required('Required'),
  match_outcome: Yup.string().required('Required'),
  game_number: Yup.number().required('Required').positive().integer(),
  team_side: Yup.string().required('Required'),
});

const MatchUploadForm: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamMode, setNewTeamMode] = useState(false);

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSubmit = async (values: typeof initialValues) => {
    setIsSubmitting(true);
    try {
      // Format the data for the API
      const matchData: Match = {
        match_date_time: values.match_date_time,
        opponent_category: values.opponent_category,
        opponent_team_name: values.opponent_team_name,
        opponent_team_abbreviation: values.opponent_team_abbreviation,
        scrim_type: values.scrim_type,
        match_outcome: values.match_outcome,
        general_notes: values.general_notes,
        game_number: values.game_number,
        team_side: values.team_side,
        scrim_group: values.scrim_group?.id || null,
      };

      // Create the match
      const createdMatch = await createMatch(matchData);
      
      // Upload player stats (team players)
      const teamPlayerPromises = values.team_players.map(player => {
        if (player.player_id) {
          const playerStat: PlayerStat = {
            match: createdMatch.id,
            player: player.player_id,
            hero_played: player.hero_played,
            kills: player.kills,
            deaths: player.deaths,
            assists: player.assists,
            damage_dealt: player.damage_dealt,
            damage_taken: player.damage_taken,
            turret_damage: player.turret_damage,
            teamfight_participation: player.teamfight_participation,
            gold_earned: player.gold_earned,
            player_notes: player.player_notes,
            is_our_team: true
          };
          return createPlayerStat(playerStat);
        }
        return Promise.resolve();
      });
      
      // Upload player stats (enemy players)
      const enemyPlayerPromises = values.enemy_players.map(player => {
        if (player.player_id) {
          const playerStat: PlayerStat = {
            match: createdMatch.id,
            player: player.player_id,
            hero_played: player.hero_played,
            kills: player.kills,
            deaths: player.deaths,
            assists: player.assists,
            damage_dealt: player.damage_dealt,
            damage_taken: player.damage_taken,
            turret_damage: player.turret_damage,
            teamfight_participation: player.teamfight_participation,
            gold_earned: player.gold_earned,
            player_notes: player.player_notes,
            is_our_team: false
          };
          return createPlayerStat(playerStat);
        }
        return Promise.resolve();
      });
      
      // Upload files
      const filePromises = values.files.map(file => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('match', createdMatch.id);
        return uploadMatchFile(formData);
      });
      
      // Wait for all uploads to complete
      await Promise.all([...teamPlayerPromises, ...enemyPlayerPromises, ...filePromises]);
      
      // Navigate to the match details page
      navigate(`/matches/${createdMatch.id}`);
    } catch (error) {
      console.error('Error submitting match:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get the current step content
  const getStepContent = (step: number, formikProps: any) => {
    switch (step) {
      case 0:
        return <MatchMetadata formik={formikProps} />;
      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Team Players</Typography>
            {formikProps.values.team_players.map((player: any, index: number) => (
              <PlayerStatRow 
                key={index} 
                index={index} 
                formik={formikProps} 
                fieldNamePrefix={`team_players[${index}]`}
                isOurTeam={true}
              />
            ))}
          </Box>
        );
      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Enemy Players</Typography>
            {formikProps.values.enemy_players.map((player: any, index: number) => (
              <PlayerStatRow 
                key={index} 
                index={index} 
                formik={formikProps} 
                fieldNamePrefix={`enemy_players[${index}]`}
                isOurTeam={false}
              />
            ))}
          </Box>
        );
      case 3:
        return <FileUploader formik={formikProps} />;
      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Review Match Details</Typography>
            <pre>{JSON.stringify(formikProps.values, null, 2)}</pre>
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  // Fetch teams on component mount
  useEffect(() => {
    const fetchTeams = async () => {
      const response = await fetch('/api/teams/');
      const data = await response.json();
      setTeams(data);
    };
    fetchTeams();
  }, []);

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Upload Match Results</Typography>
        
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        <Formik
          initialValues={initialValues}
          validationSchema={matchDetailsSchema}
          onSubmit={handleSubmit}
        >
          {(formikProps) => (
            <Form>
              {getStepContent(activeStep, formikProps)}
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button
                  disabled={activeStep === 0}
                  onClick={handleBack}
                  sx={{ mr: 1 }}
                >
                  Back
                </Button>
                
                <Box>
                  {activeStep === steps.length - 1 ? (
                    <Button 
                      variant="contained" 
                      color="primary" 
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleNext}
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </Box>

              <FormControl fullWidth>
                <InputLabel>Opponent Team</InputLabel>
                {!newTeamMode ? (
                  <>
                    <Select
                      name="opponent_team"
                      value={formikProps.values.opponent_team || ''}
                      onChange={formikProps.handleChange}
                    >
                      {teams.map(team => (
                        <MenuItem key={team.team_id} value={team.team_id}>
                          {team.team_name}
                        </MenuItem>
                      ))}
                      <MenuItem value="new_team"><em>Add New Team...</em></MenuItem>
                    </Select>
                    {formikProps.values.opponent_team === 'new_team' && (
                      <Button onClick={() => setNewTeamMode(true)}>
                        Create New Team
                      </Button>
                    )}
                  </>
                ) : (
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      label="Team Name"
                      name="opponent_team_name"
                      value={formikProps.values.opponent_team_name || ''}
                      onChange={formikProps.handleChange}
                      fullWidth
                      margin="normal"
                    />
                    <TextField
                      label="Team Abbreviation"
                      name="opponent_team_abbreviation"
                      value={formikProps.values.opponent_team_abbreviation || ''}
                      onChange={formikProps.handleChange}
                      fullWidth
                      margin="normal"
                    />
                    <FormControl fullWidth margin="normal">
                      <InputLabel>Team Category</InputLabel>
                      <Select
                        name="opponent_category"
                        value={formikProps.values.opponent_category || ''}
                        onChange={formikProps.handleChange}
                      >
                        <MenuItem value="Collegiate">Collegiate</MenuItem>
                        <MenuItem value="Amateur">Amateur</MenuItem>
                        <MenuItem value="Professional">Professional</MenuItem>
                      </Select>
                    </FormControl>
                    <Button onClick={() => setNewTeamMode(false)}>
                      Cancel
                    </Button>
                  </Box>
                )}
              </FormControl>
            </Form>
          )}
        </Formik>
      </Paper>
    </Box>
  );
};

export default MatchUploadForm; 