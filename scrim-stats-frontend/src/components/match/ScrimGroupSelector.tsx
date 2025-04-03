import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Button, Box, Typography } from '@mui/material';
import { getScrimGroups } from '../../services/scrim.service';
import { ScrimGroup } from '../../types/match.types';

interface ScrimGroupSelectorProps {
  value: ScrimGroup | null;
  onChange: (value: ScrimGroup | null) => void;
}

const ScrimGroupSelector: React.FC<ScrimGroupSelectorProps> = ({ value, onChange }) => {
  const [options, setOptions] = useState<ScrimGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScrimGroups = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getScrimGroups();
        setOptions(data || []);
      } catch (err) {
        console.error('Error fetching scrim groups:', err);
        setError('Unable to load scrim groups');
        // Still continue with empty options
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchScrimGroups();
  }, []);

  // Create a new helper to ensure the value is of the right type
  const safeValue = value && typeof value === 'object' && 'id' in value ? value : null;

  return (
    <Box>
      <Autocomplete
        value={safeValue}
        onChange={(_, newValue) => onChange(newValue)}
        options={options}
        getOptionLabel={(option) => {
          return option && typeof option === 'object' ? option.scrim_group_name : '';
        }}
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Scrim Group"
            fullWidth
            helperText={error || "Select an existing scrim group or create a new one"}
            error={!!error}
          />
        )}
        noOptionsText="No scrim groups found. You can create a new one."
        loadingText="Loading scrim groups..."
      />
    </Box>
  );
};

export default ScrimGroupSelector; 