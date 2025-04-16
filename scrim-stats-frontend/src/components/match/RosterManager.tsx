import React, { useState, useEffect } from 'react';
import { useFormikContext } from 'formik';
import { CircularProgress, Alert } from '@mui/material';
import { Player } from '../../types/player.types';
import { Team } from '../../types/team.types';
import { MatchFormData } from '../../types/match.types'; // Use the type from match.types
import api from '../../services/api';
import { getEmptyPlayerStat } from '../../utils/playerUtils'; // Import helper

interface RosterManagerProps {
    teams: Team[]; // Pass all teams for getTeamName (though not used directly here)
}

// Helper Component to Handle Roster Fetching and Pre-population
const RosterManager: React.FC<RosterManagerProps> = ({ teams }) => {
    const { values, setFieldValue } = useFormikContext<MatchFormData>();
    const [blueSideRoster, setBlueSideRoster] = useState<Player[]>([]);
    const [redSideRoster, setRedSideRoster] = useState<Player[]>([]);
    const [rosterLoading, setRosterLoading] = useState<Record<string, boolean>>({}); // Track loading per team
    const [rosterError, setRosterError] = useState<string | null>(null);

    // Helper function to fetch roster for a team ID
    const fetchTeamRoster = async (teamId: string | undefined): Promise<Player[]> => {
        if (!teamId) return [];
        setRosterLoading(prev => ({ ...prev, [teamId]: true }));
        try {
            const response = await api.get<Player[] | { results: Player[] }>(`/api/teams/${teamId}/players/`);
            const roster = Array.isArray(response.data) ? response.data : response.data.results || [];
            setRosterLoading(prev => ({ ...prev, [teamId]: false }));
            return roster;
        } catch (error) {
            console.error(`Error fetching roster for team ${teamId}:`, error);
            setRosterError(`Failed to load roster for team ${teamId}.`); // Set specific error
            setRosterLoading(prev => ({ ...prev, [teamId]: false }));
            return [];
        }
    };

    // Effect to fetch rosters when relevant team IDs change
    useEffect(() => {
        let blueTeamId: string | undefined;
        let redTeamId: string | undefined;

        if (values.is_external_match) {
            blueTeamId = values.team_1;
            redTeamId = values.team_2;
        } else {
            if (values.team_side === 'BLUE') {
                blueTeamId = values.our_team;
                redTeamId = values.opponent_team;
            } else if (values.team_side === 'RED') {
                blueTeamId = values.opponent_team;
                redTeamId = values.our_team;
            }
        }

        setRosterError(null); // Clear previous errors

        // Define async functions to fetch
        const fetchBlue = async () => {
            if (blueTeamId) setBlueSideRoster(await fetchTeamRoster(blueTeamId));
            else setBlueSideRoster([]);
        };
        const fetchRed = async () => {
            if (redTeamId) setRedSideRoster(await fetchTeamRoster(redTeamId));
            else setRedSideRoster([]);
        };

        // Call fetch functions
        fetchBlue();
        fetchRed();

    }, [values.is_external_match, values.team_1, values.team_2, values.our_team, values.opponent_team, values.team_side]);

    // Effect for clearing/pre-populating player slots
    useEffect(() => {
        let blueTeamId: string | undefined;
        let redTeamId: string | undefined;

        if (values.is_external_match) {
            blueTeamId = values.team_1;
            redTeamId = values.team_2;
        } else {
            if (values.team_side === 'BLUE') {
                blueTeamId = values.our_team;
                redTeamId = values.opponent_team;
            } else if (values.team_side === 'RED') {
                blueTeamId = values.opponent_team;
                redTeamId = values.our_team;
            }
        }

        const processPlayerSlot = (index: number, teamId: string | undefined, roster: Player[], fieldPrefix: 'team_players' | 'enemy_players') => {
            const player = teamId ? roster[index] : undefined;
            const isOurTeamFlag = fieldPrefix === 'team_players'; // Corresponds to Blue side
            const baseEmptyStat = getEmptyPlayerStat(isOurTeamFlag);

            if (player) {
                setFieldValue(`${fieldPrefix}[${index}].ign`, player.current_ign || '');
                setFieldValue(`${fieldPrefix}[${index}].player_id`, player.player_id);
                setFieldValue(`${fieldPrefix}[${index}].role_played`, player.primary_role || '');
                setFieldValue(`${fieldPrefix}[${index}].hero_played`, baseEmptyStat.hero_played);
                setFieldValue(`${fieldPrefix}[${index}].kills`, baseEmptyStat.kills);
                setFieldValue(`${fieldPrefix}[${index}].deaths`, baseEmptyStat.deaths);
                setFieldValue(`${fieldPrefix}[${index}].assists`, baseEmptyStat.assists);
                setFieldValue(`${fieldPrefix}[${index}].damage_dealt`, baseEmptyStat.damage_dealt);
                setFieldValue(`${fieldPrefix}[${index}].damage_taken`, baseEmptyStat.damage_taken);
                setFieldValue(`${fieldPrefix}[${index}].turret_damage`, baseEmptyStat.turret_damage);
                setFieldValue(`${fieldPrefix}[${index}].gold_earned`, baseEmptyStat.gold_earned);
                setFieldValue(`${fieldPrefix}[${index}].player_notes`, baseEmptyStat.player_notes);
                setFieldValue(`${fieldPrefix}[${index}].is_our_team`, isOurTeamFlag);
                 // Set is_blue_side helper flag
                setFieldValue(`${fieldPrefix}[${index}].is_blue_side`, fieldPrefix === 'team_players');
            } else {
                setFieldValue(`${fieldPrefix}[${index}]`, baseEmptyStat);
                 // Ensure helper flag is also set correctly when clearing
                setFieldValue(`${fieldPrefix}[${index}].is_blue_side`, fieldPrefix === 'team_players');
            }
        };

        for (let i = 0; i < 5; i++) {
            processPlayerSlot(i, blueTeamId, blueSideRoster, 'team_players');
            processPlayerSlot(i, redTeamId, redSideRoster, 'enemy_players');
        }

    }, [blueSideRoster, redSideRoster, values.is_external_match, values.team_1, values.team_2, values.our_team, values.opponent_team, values.team_side, setFieldValue]);

    // Optionally render loading/error indicators
    // if (Object.values(rosterLoading).some(Boolean)) return <CircularProgress size={20} sx={{ display: 'block', margin: '10px auto' }} />;
    // if (rosterError) return <Alert severity="warning" sx={{ mb: 2 }}>{rosterError}</Alert>; // Use warning for roster issues

    return null; // This component doesn't render UI itself
};

export default RosterManager; 