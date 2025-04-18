import api from './api';
import { DraftFormData, Draft, DraftBan, DraftPick } from '../types/draft';
import { Hero } from '../types/hero.types';
import { PaginatedResponse } from '../types/api';
import { AxiosResponse } from 'axios';

// Helper functions for managing drafts
class DraftService {
  /**
   * Fetch all available heroes, handling pagination.
   * @returns A promise that resolves to a single list containing all heroes.
   */
  async getHeroes(): Promise<Hero[]> {
    let allHeroes: Hero[] = [];
    let url: string | null = '/api/heroes/';

    console.log('[DraftService] Starting to fetch all heroes...');

    try {
      while (url) {
        console.log(`[DraftService] Fetching heroes from: ${url}`);
        const response: AxiosResponse<PaginatedResponse<Hero>> = await api.get(url);
        const data: PaginatedResponse<Hero> = response.data;

        if (data && data.results) {
          allHeroes = allHeroes.concat(data.results);
          url = data.next;
          console.log(`[DraftService] Fetched ${data.results.length} heroes. Next page: ${url}`);
        } else {
          console.warn('[DraftService] Unexpected response structure during pagination:', data);
          url = null;
        }
      }

      console.log(`[DraftService] Finished fetching. Total heroes: ${allHeroes.length}`);
      return allHeroes;

    } catch (error) {
      console.error('[DraftService] Error fetching heroes with pagination:', error);
      throw error;
    }
  }

  /**
   * Fetch a draft by match ID
   * @param matchId - The match ID
   * @returns Draft data
   */
  async getDraftByMatchId(matchId: number): Promise<Draft | null> {
    try {
      const response = await api.get(`/api/drafts/?match=${matchId}`);
      if (response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error) {
      console.error(`Error fetching draft for match ${matchId}:`, error);
      return null;
    }
  }

  /**
   * Create a draft for a match
   * @param matchId - The match ID
   * @param draftData - The draft data from the form
   * @returns The created draft
   */
  async createDraft(matchId: number, draftData: DraftFormData): Promise<Draft> {
    // First create the draft
    const draftPayload = {
      match: matchId,
      format: draftData.format,
      notes: draftData.notes || '',
    };

    try {
      // Create the draft
      const draftResponse = await api.post('/api/drafts/', draftPayload);
      const draftId = draftResponse.data.id;

      // Create bans
      const banPromises: Promise<DraftBan>[] = [];
      
      // Process blue side bans
      draftData.blueSideBans
        .filter(ban => ban !== null)
        .forEach((ban, index) => {
          if (ban) {
            const banPayload = {
              draft: draftId,
              hero: ban.id,
              team_side: 'BLUE',
              ban_order: index + 1
            };
            banPromises.push(api.post('/api/draft-bans/', banPayload).then(res => res.data));
          }
        });
      
      // Process red side bans
      draftData.redSideBans
        .filter(ban => ban !== null)
        .forEach((ban, index) => {
          if (ban) {
            const banPayload = {
              draft: draftId,
              hero: ban.id,
              team_side: 'RED',
              ban_order: index + 1
            };
            banPromises.push(api.post('/api/draft-bans/', banPayload).then(res => res.data));
          }
        });

      // Create picks
      const pickPromises: Promise<DraftPick>[] = [];
      
      // Process blue side picks
      draftData.blueSidePicks
        .filter(pick => pick !== null)
        .forEach((pick, index) => {
          if (pick) {
            const pickPayload = {
              draft: draftId,
              hero: pick.id,
              team_side: 'BLUE',
              pick_order: index + 1
            };
            pickPromises.push(api.post('/api/draft-picks/', pickPayload).then(res => res.data));
          }
        });
      
      // Process red side picks
      draftData.redSidePicks
        .filter(pick => pick !== null)
        .forEach((pick, index) => {
          if (pick) {
            const pickPayload = {
              draft: draftId,
              hero: pick.id,
              team_side: 'RED',
              pick_order: index + 1
            };
            pickPromises.push(api.post('/api/draft-picks/', pickPayload).then(res => res.data));
          }
        });

      // Wait for all promises to resolve
      await Promise.all([...banPromises, ...pickPromises]);

      // Fetch the complete draft
      const completeDraft = await this.getDraftByMatchId(matchId);
      if (!completeDraft) {
        throw new Error('Failed to fetch created draft');
      }
      
      return completeDraft;
    } catch (error) {
      console.error('Error creating draft:', error);
      throw error;
    }
  }

  /**
   * Convert a draft from the API to a form data format
   * @param draft - The draft from the API
   * @returns Draft data in form format
   */
  convertDraftToFormData(draft: Draft): DraftFormData {
    const blueSideBans = Array(5).fill(null);
    const redSideBans = Array(5).fill(null);
    const blueSidePicks = Array(5).fill(null);
    const redSidePicks = Array(5).fill(null);
    
    // Process bans
    if (draft.bans) {
      draft.bans.forEach(ban => {
        const banOrder = ban.ban_order - 1; // Adjust for 0-indexing
        
        if (ban.team_side === 'BLUE' && banOrder < 5) {
          blueSideBans[banOrder] = ban.hero;
        } else if (ban.team_side === 'RED' && banOrder < 5) {
          redSideBans[banOrder] = ban.hero;
        }
      });
    }
    
    // Process picks
    if (draft.picks) {
      draft.picks.forEach(pick => {
        const pickOrder = pick.pick_order - 1; // Adjust for 0-indexing
        
        if (pick.team_side === 'BLUE' && pickOrder < 5) {
          blueSidePicks[pickOrder] = pick.hero;
        } else if (pick.team_side === 'RED' && pickOrder < 5) {
          redSidePicks[pickOrder] = pick.hero;
        }
      });
    }
    
    return {
      trackDraft: true,
      format: draft.format,
      notes: draft.notes || '',
      blueSideBans,
      redSideBans,
      blueSidePicks,
      redSidePicks
    };
  }
}

export const draftService = new DraftService(); 