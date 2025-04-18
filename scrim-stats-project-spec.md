# Esports Management Application - Project Specification

## Overview

The Esports Management Application is a comprehensive system for managing esports teams, tracking player performance, and recording match statistics. It provides tools for coaches and analysts to evaluate team and player performance over time.

## Architecture

The application follows a client-server architecture:

- **Backend**: Django REST API (Python)
- **Frontend**: React with TypeScript, using Vite as the build tool
- **Database**: SQLite (development), can be replaced with PostgreSQL in production

## Key Components

### Backend Components

1.  **Models**: Django ORM models representing the application's data entities (`api/models.py`).
2.  **Services**: Business logic extracted into dedicated service classes (`services/`).
3.  **APIs**: Django REST framework viewsets and views exposing data to the frontend (`api/views.py`).
4.  **Authentication**: User management and permissions system using JWT.

### Frontend Components

1.  **Components**: Reusable React UI components (`src/components/`). This now includes extracted step components like `MatchDetailsStep`, `ReviewStep`, and helpers like `NewTeamDialog`. `BoxScoreInput` now handles fetching team rosters and uses Autocomplete for player selection.
    *   **`BoxScoreInput.tsx` (Enhanced):** Uses Material UI `Autocomplete` with `freeSolo` enabled for player selection in both Blue and Red side slots. If a typed IGN doesn't match an existing player in the fetched roster, an option "Add '[typed name]' as new player..." is presented. Selecting this option opens the `AddNewPlayerDialog`.
    *   **`AddNewPlayerDialog.tsx` (New):** A modal dialog used within `BoxScoreInput` to quickly add a new player (providing IGN and optional primary role) to a selected team (Blue or Red).
2.  **Pages**: Top-level React components representing application screens (`src/pages/`).
3.  **Context**: State management using React Context API (e.g., `AuthContext.tsx`).
4.  **Services**: API integration services for communicating with the backend (`src/services/`).
5.  **Configuration**: Form configurations like initial values and validation schemas (e.g., `src/config/matchForm.config.ts`).
6.  **Utilities**: Helper functions (e.g., `src/utils/`).

### PlayerTeamHistory

- Tracks a player's history of team membership (`PlayerTeamHistory` model).
- Allows tracking stats when players move between teams.
- Includes an `is_starter` field to indicate if the player was part of the main starting lineup for that team during that period.

## Core Entities

### Teams

- Represents esports teams (your own and opponents)
- Managed by users with specific roles (via `TeamManagerRole` model)
- Can be categorized (Collegiate, Amateur, Pro)

### Players

- Represents individual players with in-game names (IGNs)
- Tracks previous IGNs as aliases (`PlayerAlias` model)
- Associated with teams through team history records (`PlayerTeamHistory` model)
- Has primary game role (Jungler, Mid Laner, etc.)

### Matches

- Individual game instances between teams (`Match` model)
- Contains match metadata (date, outcome, type, duration, MVP)
- **Team Tracking (Refactored & Verified):**
    - The database model (`Match`) *always* stores the participating teams using `blue_side_team` (FK to Team, non-null) and `red_side_team` (FK to Team, non-null).
    - The fields `opponent_team`, `team_side`, and `is_external_match` **have been removed** from the database model.
    - An additional field `our_team` (FK to Team, nullable) is stored. This field **provides context based on the user submitting the data**; it is populated by the frontend with the ID of the participating team (either blue or red) *if* that team is managed by the user performing the upload. It remains `NULL` if the uploader manages neither participating team.
    - `winning_team` field stores the winner (FK to Team, nullable).
- **Frontend UI (`MatchUploadForm.tsx`):** While the UI might still use concepts like "Our Team" vs "Opponent Team" (controlled by an "Is this an external match?" toggle in `MatchDetailsStep.tsx`), the `handleSubmit` logic in `MatchUploadForm.tsx` **correctly translates** this input into the required backend payload format (`blue_side_team`, `red_side_team`, and the contextual `our_team`).
- **Backend Serializer (`MatchSerializer`):** Correctly accepts the `blue_side_team`, `red_side_team`, and `our_team` fields from the frontend payload.
- **Duration Input:**
    - Backend (`Match` model) stores `match_duration` as a `DurationField`.
    - Frontend (`MatchUploadForm.tsx`) uses separate numeric inputs for hours, minutes, and seconds for easier entry. These are formatted into an `HH:MM:SS` string before submission.
- Groups related matches into "Scrim Groups" (`ScrimGroup` model). **Note:** The `MatchUploadForm` does not currently include manual selection for scrim groups (the `ScrimGroupSelector.tsx` component is not used here and likely removed).
- Records scores (`score_details` JSON field) and links to `PlayerMatchStat`.

### Player Match Stats

- Detailed statistics for each player in a match (`PlayerMatchStat` model)
- Records KDA, damage dealt/taken, gold, turret damage, etc.
- Links players to the heroes/champions they played (`Hero` model).
- **Submission:** After a `Match` is created via `POST /api/matches/`, the frontend (`MatchUploadForm.tsx`) sends **individual** `POST` requests for each player's stats to `/api/player-stats/`, linking them to the newly created `matchId`.

### Drafts

- Records hero/champion drafts for matches (`Draft`, `DraftBan`, `DraftPick` models)
- Tracks picks and bans for both teams and preserves order.
- **Frontend (`DraftForm.tsx`):** Successfully fetches all heroes from `/api/heroes/` (handling pagination) to populate pick/ban autocomplete inputs. 
- Uses DRF `ModelViewSet` for main entities (`Team`, `Player`, `Match`, `ScrimGroup`, `Hero`, `Draft`).
- Contains `TeamPlayersView` (`GET /api/teams/{pk}/players/`) which fetches the current roster for a given team, sorting by `is_starter` (descending) then `current_ign`.
- Other views: `ApiStatus`, `ApiRootView`, `RegisterView`, `ManagedTeamListView`.
- **Player Stat Creation:** A simplified `PlayerMatchStatViewSet` (using `CreateModelMixin` and `GenericViewSet`) exists at `/api/player-stats/` to handle `POST` requests for creating individual player stats after a match is created.
- Permissions and custom actions are implemented as described under "Authentication and Permissions".
- **Removed/Unused ViewSets:** Full `ModelViewSet` implementations for `FileUpload`, `PlayerTeamHistory`, `TeamManagerRole` might not be exposed via the main router. Data might be accessed via relationships/actions on other viewsets.

## Service Layer (Backend)

The application aims to use dedicated service classes for business logic located in `scrim_stats_backend/services/`.

- **Implemented:** `PlayerService`, `MatchStatsService`, `AwardService`.
- **Missing:** Logic for Teams, ScrimGroups, Heroes has not yet been fully moved to dedicated services (`TeamService`, `ScrimGroupService`, `HeroService`).

## Authentication and Permissions

- Users can register (`/api/register/`) and log in (`/api/token/`).
- JWT tokens (`access`, `refresh`) are used for authentication.
- **Frontend Usage:** Tokens stored in localStorage (`token`, `refreshToken`). API requests must include the `Authorization: Bearer <token>` header. Token refresh via `/api/token/refresh/`.
- **Permissions:** DRF permission classes are used. Default is `IsAuthenticated`. Specific views/actions have overrides (e.g., `HeroViewSet` is `IsAuthenticatedOrReadOnly`, `RegisterView`/`ApiStatus` are `AllowAny`, some `TeamViewSet` actions require admin). Custom permissions like `IsTeamManager` exist.
- **Status Check:** Unprotected `/api/status/` endpoint exists for connectivity checks.
- **Frontend Diagnostics:** The spec previously mentioned `BackendConnectionTest` components and functions (`testBackendConnection`, `checkApiStatus`, `checkEndpoint`) in the frontend (`api.ts` or `api.service.ts`) for troubleshooting; verify their current implementation state if needed.

## Frontend Structure (Based on Spec)

```
src/
├── components/
│   ├── auth/
│   ├── common/
│   ├── match/
│   │   ├── MatchUploadForm.tsx       # Main orchestrator
│   │   ├── MatchDetailsStep.tsx    # Extracted Step 0
│   │   ├── DraftForm.tsx           # Step 1
│   │   ├── BoxScoreInput.tsx       # Step 2 (Handles roster fetching, Autocomplete with Quick Add)
│   │   ├── FileUploader.tsx        # Step 3
│   │   ├── ReviewStep.tsx          # Extracted Step 4
│   │   ├── NewTeamDialog.tsx       # Helper dialog
│   │   └── AddNewPlayerDialog.tsx  # New: Dialog for Quick Add Player
│   │   └── ... 
│   ├── team/
│   └── player/
├── config/
│   └── matchForm.config.ts       # Form initial values & validation
├── context/
│   └── AuthContext.tsx
├── services/
│   ├── api.ts / apiClient.ts / api.service.ts
│   ├── auth.ts
│   ├── match.ts
│   ├── player.ts             # Contains addPlayerToTeam function
│   └── team.ts
├── types/
│   ├── match.types.ts
│   └── ...
├── utils/
│   ├── matchUtils.ts
│   └── playerUtils.ts
└── pages/
    ├── MatchUploadPage.tsx
    └── ...
```
*(Review actual frontend structure for deviations)*

## Current Backend Implementation Status (as of April 6, 2025)

While the overall architecture aims to follow the spec, recent refactoring is incomplete, leading to some inconsistencies.

### 1. Models (`api/models.py`)

- Core models are defined as listed under "Core Entities".
- Some model methods intended for the service layer might still exist (e.g., `Player.get_awards_count`, `Match.get_mvp`). Check if these are still used directly or if service methods have replaced them.

### 2. Services (`services/`)

- Directory `scrim_stats_backend/services/` exists.
- **Existing Services:** `PlayerService`, `MatchStatsService`, `AwardService`.
- **Missing Services:** `TeamService`, `ScrimGroupService`, `HeroService` are not implemented. Related logic might be in views/models.

### 3. Views (`api/views.py`)

- Uses DRF `ModelViewSet` for main entities (`Team`, `Player`, `Match`, `ScrimGroup`, `Hero`, `Draft`).
- Contains `TeamPlayersView` (`GET /api/teams/{pk}/players/`) which fetches the current roster for a given team, sorting by `is_starter` (descending) then `current_ign`.
- Other views: `ApiStatus`, `ApiRootView`, `RegisterView`, `ManagedTeamListView`.
- **Player Stat Creation:** A simplified `PlayerMatchStatViewSet` (using `CreateModelMixin` and `GenericViewSet`) exists at `/api/player-stats/` to handle `POST` requests for creating individual player stats after a match is created.
- Permissions and custom actions are implemented as described under "Authentication and Permissions".
- **Removed/Unused ViewSets:** Full `ModelViewSet` implementations for `FileUpload`, `PlayerTeamHistory`, `TeamManagerRole` might not be exposed via the main router. Data might be accessed via relationships/actions on other viewsets.

### 4. Serializers (`api/serializers.py`)

- Standard DRF `ModelSerializer` classes exist for most models.
- Uses `DefaultRouter` for viewsets.
- Specific paths exist for non-router views (status, register, token, managed teams, csrf).
- **Important Note:** The order of URL patterns matters. Specific paths (like `teams/managed/`) should generally be placed *before* the `include(router.urls)` line to ensure they are matched correctly and not mistakenly handled by a more general router pattern (e.g., the router's `/teams/` pattern conflicting with `/teams/managed/`).
- Paths for removed/missing views (`player_awards`, `match_detailed_stats`) are commented out.
- **Player Stats Endpoint:** The `/api/player-stats/` path is registered and points to `PlayerMatchStatViewSet` for handling stat creation.

### Key Inconsistencies & Areas for Review

- **Incomplete Service Refactoring:** Logic for Teams, ScrimGroups, and Heroes needs to be moved to dedicated service classes. Check `views.py` and `models.py` for remaining logic.
- **Model Methods:** Review remaining methods in models (e.g., `Player.get_awards_count`, `Match.get_mvp`) to ensure they are either correctly used or replaced by service calls.
- **Model/Serializer/View Mismatches:** Ensure fields used in serializers (`fields`, `read_only_fields`) and viewsets (`filterset_fields`, `search_fields`, `ordering_fields`) accurately reflect the fields defined in the corresponding models. Pay attention to DRF rules (e.g., avoid redundant `source` args, ensure all defined fields are in `Meta.fields`).
- **Dead Code/Imports:** Review and remove commented-out imports or code blocks related to missing/removed services/views once confirmed they are no longer needed (e.g., in `api/views.py`, `api/urls.py`).
- **Missing Functionality:** The removal/commenting out of URLs (`player_awards`, `match_detailed_stats`) implies these features might be missing or need to be implemented differently (e.g., as actions on existing viewsets). Full CRUD endpoints for `FileUpload`, `PlayerTeamHistory`, etc. may not be directly registered.
- **Check All Consumers:** After model changes (like the `Match` refactor), ensure *all* code using that model is updated, including potentially less obvious places like admin views (`admin.py`).
- **Pagination Handling:** Frontend components fetching list data must handle the paginated response structure (accessing the `.results` property), as confirmed for `/api/teams/` and `/api/teams/managed/`. Player roster fetching (`/api/teams/{id}/players/`) also needs pagination handling.
- **Scrim Group Creation:** Consider automatically generating `ScrimGroup` instances when matches are uploaded, potentially grouping them by date or session. Manual selection via `MatchUploadForm` is not currently implemented.
- **Player Pre-population & Selection (Refactored with Quick Add):** 
    - The `BoxScoreInput.tsx` component fetches team rosters via `/api/teams/{id}/players/`. The backend sorts this roster by `is_starter` (desc) then `current_ign`.
    - An `Autocomplete` dropdown (with `freeSolo` enabled) is used for player selection.
    - If a typed IGN doesn't match a fetched player, an "Add '[typed name]'..." option appears.
    - Selecting this option opens the `AddNewPlayerDialog.tsx` modal.
    - This dialog allows entering the IGN and optional primary role.
    - Submitting the dialog calls the `addPlayerToTeam` service function (`POST /api/teams/{id}/add_player/`).
    - On success, the frontend updates the local roster state and selects the newly added player in the `Autocomplete`.
    - Selecting an existing player from the `Autocomplete` auto-fills their IGN, Player ID, and primary role as before.