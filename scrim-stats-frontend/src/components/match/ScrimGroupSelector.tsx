import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Button, Box } from '@mui/material';
import { getScrimGroups } from '../../services/scrim.service';
import { ScrimGroup } from '../../types/match.types';

interface ScrimGroupSelectorProps {
  value: ScrimGroup | null;
  onChange: (value: ScrimGroup | null) => void;
}

const ScrimGroupSelector: React.FC<ScrimGroupSelectorProps> = ({ value, onChange }) => {
  const [options, setOptions] = useState<ScrimGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScrimGroups = async () => {
      try {
        const data = await getScrimGroups();
        setOptions(data);
      } catch (error) {
        console.error('Error fetching scrim groups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScrimGroups();
  }, []);

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      options={options}
      getOptionLabel={(option) => option.scrim_group_name}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Scrim Group"
          fullWidth
          helperText="Select an existing scrim group or create a new one"
        />
      )}
    />
  );
};

export default ScrimGroupSelector; 