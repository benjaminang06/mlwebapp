import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Box,
  SelectChangeEvent
} from '@mui/material';

interface AddNewPlayerDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (playerData: { ign: string; primary_role: string | null }) => Promise<void>;
  initialIgn: string;
  teamName: string;
  availableRoles: Array<{ value: string; label: string }>;
  error: string | null;
  isSubmitting: boolean;
}

const AddNewPlayerDialog: React.FC<AddNewPlayerDialogProps> = ({
  open,
  onClose,
  onSubmit,
  initialIgn,
  teamName,
  availableRoles,
  error,
  isSubmitting,
}) => {
  const [ign, setIgn] = useState(initialIgn);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Update internal IGN state if the initialIgn prop changes (e.g., user types a different name before dialog opens)
  useEffect(() => {
    setIgn(initialIgn);
  }, [initialIgn]);

  const handleRoleChange = (event: SelectChangeEvent<string | null>) => {
    setSelectedRole(event.target.value as string | null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); // Prevent default form submission if wrapped in form
    // Basic validation
    if (!ign.trim()) {
      // Although the dialog might not open with an empty IGN, add check just in case
      alert("In-Game Name cannot be empty."); // Simple alert, could be improved
      return;
    }
    await onSubmit({ ign: ign.trim(), primary_role: selectedRole });
    // Let the parent component handle closing on success/error via isSubmitting and error props
  };

  const handleCloseDialog = () => {
    if (!isSubmitting) {
      onClose();
      // Reset role selection on close? Optional.
      // setSelectedRole(null);
    }
  };

  return (
    <Dialog open={open} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
      <DialogTitle>Add New Player to "{teamName}"</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus // Focus IGN field on open
            margin="dense"
            id="ign"
            label="In-Game Name (IGN)"
            type="text"
            fullWidth
            variant="outlined"
            value={ign}
            onChange={(e) => setIgn(e.target.value)}
            required
            disabled={isSubmitting}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth size="small" variant="outlined" disabled={isSubmitting}>
            <InputLabel id="primary-role-select-label">Primary Role (Optional)</InputLabel>
            <Select
              labelId="primary-role-select-label"
              id="primary-role-select"
              value={selectedRole ?? ''} // Handle null state for Select
              label="Primary Role (Optional)"
              onChange={handleRoleChange}
            >
              <MenuItem value="">
                <em>None / Unknown</em>
              </MenuItem>
              {availableRoles.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  {role.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleCloseDialog} disabled={isSubmitting} color="inherit">
            Cancel
          </Button>
          <Button type="button" variant="contained" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? <CircularProgress size={24} /> : 'Add Player'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddNewPlayerDialog; 