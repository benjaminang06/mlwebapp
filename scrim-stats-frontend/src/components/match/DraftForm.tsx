import React, { useState, useEffect } from 'react';
import { Box, Typography, FormControl, FormControlLabel, Switch, 
  Select, MenuItem, Grid, TextField, Button, Paper, Autocomplete, SelectChangeEvent } from '@mui/material';
import { DraftFormData, DraftFormat } from '../../types/draft';
import { Hero } from '../../types/hero';
import { PaginatedResponse } from '../../types/api';
import { draftService } from '../../services/draftService';

interface DraftFormProps {
  data: DraftFormData;
  onChange: (draftData: DraftFormData) => void;
  onNext: () => void;
  onBack: () => void;
}

const DraftForm: React.FC<DraftFormProps> = ({ data, onChange, onNext, onBack }) => {
  // Log component mount
  console.log('[DraftForm] Component mounted. Initial data:', data);

  const [availableHeroes, setAvailableHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available heroes
  useEffect(() => {
    console.log('[DraftForm] useEffect triggered.');

    const fetchHeroes = async () => {
      console.log('[DraftForm] fetchHeroes function called.');
      try {
        setLoading(true);
        console.log('[DraftForm] Calling draftService.getHeroes...');
        const response: PaginatedResponse<Hero> | Hero[] = await draftService.getHeroes();
        console.log('[DraftForm] draftService.getHeroes returned:', response);
        
        if (response && typeof response === 'object' && 'results' in response && Array.isArray(response.results)) {
          console.log('[DraftForm] Handling paginated response. Setting state with results.');
          setAvailableHeroes(response.results);
        } else if (Array.isArray(response)) {
            console.log('[DraftForm] Handling direct array response.');
            setAvailableHeroes(response);
        } else {
            console.warn('[DraftForm] Unexpected response structure from getHeroes:', response);
            setAvailableHeroes([]);
        }

        setError(null);
      } catch (err) {
        console.error('[DraftForm] Error fetching heroes inside component:', err);
        setError('Failed to load heroes. Please try again.');
        setAvailableHeroes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHeroes();
  }, []);

  // Helper to determine how many bans/picks to display based on format
  const getMaxBans = (format: DraftFormat): number => {
    return format === '6_BANS' ? 3 : 5; // 3 bans per team for 6_BANS, 5 for 10_BANS
  };

  // Handle draft tracking toggle
  const handleTrackDraftChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...data,
      trackDraft: event.target.checked
    });
  };

  // Handle format change
  const handleFormatChange = (event: SelectChangeEvent) => {
    const newFormat = event.target.value as DraftFormat;
    onChange({
      ...data,
      format: newFormat
    });
  };

  // Handle notes change
  const handleNotesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...data,
      notes: event.target.value
    });
  };

  // Handle hero selection for bans
  const handleBanChange = (side: 'blue' | 'red', index: number, hero: Hero | null) => {
    const newData = { ...data };
    if (side === 'blue') {
      newData.blueSideBans[index] = hero;
    } else {
      newData.redSideBans[index] = hero;
    }
    onChange(newData);
  };

  // Handle hero selection for picks
  const handlePickChange = (side: 'blue' | 'red', index: number, hero: Hero | null) => {
    const newData = { ...data };
    if (side === 'blue') {
      newData.blueSidePicks[index] = hero;
    } else {
      newData.redSidePicks[index] = hero;
    }
    onChange(newData);
  };

  // Get heroes that are not already picked or banned
  const getAvailableHeroesForSelection = (currentHero: Hero | null): Hero[] => {
    if (!Array.isArray(availableHeroes)) {
      console.warn('[DraftForm] availableHeroes is not an array in getAvailableHeroesForSelection:', availableHeroes); 
      return []; 
    }
    
    if (!data.trackDraft) return availableHeroes;

    const allSelectedHeroes = [
      ...data.blueSideBans.filter(Boolean),
      ...data.redSideBans.filter(Boolean),
      ...data.blueSidePicks.filter(Boolean),
      ...data.redSidePicks.filter(Boolean)
    ];

    // If this is editing an existing selection, we need to exclude the current hero
    // from the "already selected" list
    const selectedIds = allSelectedHeroes
      .filter(hero => hero && hero.id !== currentHero?.id)
      .map(hero => hero?.id);

    return availableHeroes.filter(hero => !selectedIds.includes(hero.id));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Draft Information
      </Typography>

      {/* Draft Tracking Toggle */}
      <FormControlLabel
        control={
          <Switch
            checked={data.trackDraft}
            onChange={handleTrackDraftChange}
            name="trackDraft"
            color="primary"
          />
        }
        label="Track Draft for this match"
        sx={{ mb: 3 }}
      />

      {data.trackDraft && (
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={3}>
            {/* Draft Format */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <Typography variant="subtitle2" gutterBottom>
                  Draft Format
                </Typography>
                <Select
                  value={data.format}
                  onChange={handleFormatChange}
                  displayEmpty
                >
                  <MenuItem value="6_BANS">Standard (3 bans per team)</MenuItem>
                  <MenuItem value="10_BANS">Pro (5 bans per team)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Draft Notes */}
            <Grid item xs={12}>
              <TextField
                label="Draft Notes"
                value={data.notes || ''}
                onChange={handleNotesChange}
                fullWidth
                multiline
                rows={2}
                placeholder="Any additional notes about the draft phase..."
              />
            </Grid>
          </Grid>

          {/* Ban Phase */}
          <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
            Ban Phase
          </Typography>

          <Grid container spacing={3}>
            {/* Blue Side Bans */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Blue Side Bans
                </Typography>
                {Array.from({ length: getMaxBans(data.format) }).map((_, index) => (
                  <Box sx={{ mb: 2 }} key={`blue-ban-${index}`}>
                    <Autocomplete
                      value={data.blueSideBans[index] || null}
                      onChange={(_, newValue) => handleBanChange('blue', index, newValue)}
                      options={getAvailableHeroesForSelection(data.blueSideBans[index])}
                      getOptionLabel={(option) => option.name}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label={`Ban ${index + 1}`}
                          variant="outlined"
                          fullWidth
                        />
                      )}
                      loading={loading}
                      disabled={loading}
                    />
                  </Box>
                ))}
              </Paper>
            </Grid>

            {/* Red Side Bans */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Red Side Bans
                </Typography>
                {Array.from({ length: getMaxBans(data.format) }).map((_, index) => (
                  <Box sx={{ mb: 2 }} key={`red-ban-${index}`}>
                    <Autocomplete
                      value={data.redSideBans[index] || null}
                      onChange={(_, newValue) => handleBanChange('red', index, newValue)}
                      options={getAvailableHeroesForSelection(data.redSideBans[index])}
                      getOptionLabel={(option) => option.name}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label={`Ban ${index + 1}`}
                          variant="outlined"
                          fullWidth
                        />
                      )}
                      loading={loading}
                      disabled={loading}
                    />
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>

          {/* Pick Phase */}
          <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
            Pick Phase
          </Typography>

          <Grid container spacing={3}>
            {/* Blue Side Picks */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Blue Side Picks
                </Typography>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Box sx={{ mb: 2 }} key={`blue-pick-${index}`}>
                    <Autocomplete
                      value={data.blueSidePicks[index] || null}
                      onChange={(_, newValue) => handlePickChange('blue', index, newValue)}
                      options={getAvailableHeroesForSelection(data.blueSidePicks[index])}
                      getOptionLabel={(option) => option.name}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label={`Pick ${index + 1}`}
                          variant="outlined"
                          fullWidth
                        />
                      )}
                      loading={loading}
                      disabled={loading}
                    />
                  </Box>
                ))}
              </Paper>
            </Grid>

            {/* Red Side Picks */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Red Side Picks
                </Typography>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Box sx={{ mb: 2 }} key={`red-pick-${index}`}>
                    <Autocomplete
                      value={data.redSidePicks[index] || null}
                      onChange={(_, newValue) => handlePickChange('red', index, newValue)}
                      options={getAvailableHeroesForSelection(data.redSidePicks[index])}
                      getOptionLabel={(option) => option.name}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label={`Pick ${index + 1}`}
                          variant="outlined"
                          fullWidth
                        />
                      )}
                      loading={loading}
                      disabled={loading}
                    />
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button onClick={onBack} variant="outlined">
          Back
        </Button>
        
        <Button onClick={onNext} variant="contained" color="primary">
          Next
        </Button>
      </Box>
    </Box>
  );
};

export default DraftForm; 