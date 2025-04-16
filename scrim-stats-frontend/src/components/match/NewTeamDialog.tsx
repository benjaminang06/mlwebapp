import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, FormControl, InputLabel, Select, MenuItem, DialogActions, Button, SelectChangeEvent } from '@mui/material';
import { Team } from '../../types/team.types'; // Adjust path as needed

interface NewTeamDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (team: Partial<Team>) => void;
  dialogTitle: string;
  initialData?: Partial<Team>;
}

const NewTeamDialog: React.FC<NewTeamDialogProps> = ({ 
  open, 
  onClose, 
  onSave, 
  dialogTitle,
  initialData = {} 
}) => {
  const [teamData, setTeamData] = useState<Partial<Team>>({
    team_name: initialData.team_name || '',
    team_abbreviation: initialData.team_abbreviation || '',
    team_category: initialData.team_category || ''
  });

  // Sync with initialData if dialog reopens with different data
  useEffect(() => {
    setTeamData({
      team_name: initialData.team_name || '',
      team_abbreviation: initialData.team_abbreviation || '',
      team_category: initialData.team_category || ''
    });
  }, [initialData, open]); // Reset when initialData changes or dialog opens

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name) {
      setTeamData({ ...teamData, [name]: value });
    }
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    if (name) {
      setTeamData({ ...teamData, [name]: value });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <TextField
          name="team_name"
          label="Team Name"
          value={teamData.team_name}
          onChange={handleTextChange}
          fullWidth
          margin="normal"
          required
        />
        <TextField
          name="team_abbreviation"
          label="Team Abbreviation"
          value={teamData.team_abbreviation}
          onChange={handleTextChange}
          fullWidth
          margin="normal"
          required
          inputProps={{ maxLength: 10 }}
          helperText="Maximum 10 characters"
        />
        <FormControl fullWidth margin="normal" required>
          <InputLabel>Team Category</InputLabel>
          <Select
            name="team_category"
            value={teamData.team_category || ''}
            onChange={handleSelectChange}
            label="Team Category" // Add label prop to Select
          >
            <MenuItem value="COLLEGIATE">Collegiate</MenuItem>
            <MenuItem value="AMATEUR">Amateur</MenuItem>
            <MenuItem value="PRO">Professional</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => onSave(teamData)} 
          variant="contained" 
          color="primary"
          disabled={!teamData.team_name || !teamData.team_abbreviation || !teamData.team_category}
        >
          Save Team
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewTeamDialog; 