# Esports Management Application: Scrim Stats Tracker

## Overview
The Scrim Stats Tracker is a comprehensive application designed to help esports teams track and analyze practice match (scrim) performance. The system allows teams to record match data, player statistics, and view analytics to improve team performance. The application supports multiple teams, various match types, and detailed statistical analysis.

## Architecture
The application follows a client-server architecture:

### Backend
- **Framework**: Django REST Framework
- **Database**: PostgreSQL
- **Authentication**: Django's built-in authentication system with JWT tokens
- **Service Layer**: Dedicated service classes for business logic separation

### Frontend
- **Framework**: React with TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: React hooks (useState, useContext)
- **API Communication**: Axios for REST API calls

## Core Components
The application consists of several key components:

### Backend Components
1. **API Layer**:
   - RESTful endpoints for CRUD operations on matches, teams, players, and statistics
   - Authentication and permission handling
   - Pagination and filtering support

2. **Service Layer**:
   - MatchStatsService: Handles match creation, updating, and statistics calculation
   - TeamService: Manages team operations and player assignments
   - PlayerService: Handles player profile management and team history
   - ScrimGroupService: Manages grouping of related matches
   - HeroService: Manages hero data and calculates hero statistics

3. **Models**:
   - Match: Represents a scrim or official match
   - Team: Represents an esports team
   - Player: Represents a player with history of team affiliations
   - PlayerMatchStat: Stores individual player performance in a match
   - ScrimGroup: Groups related matches together
   - Hero: Stores information about playable characters

### Frontend Components
1. **Core Pages**:
   - MatchUploadForm.tsx: Form for adding new match data
   - BoxScoreInput.tsx: Component for entering player statistics
   - MatchListPage.tsx: Display of match history with filtering options
   - MatchDetailPage.tsx: Detailed view of a single match
   - TeamManagementPage.tsx: Interface for managing team rosters
   - PlayerProfilePage.tsx: View of individual player statistics

2. **Services**:
   - match.service.ts: API calls for match-related operations
   - team.service.ts: API calls for team-related operations
   - player.service.ts: API calls for player-related operations
   - api.service.ts: Base API configuration and error handling

3. **Shared Components**:
   - LoadingSpinner.tsx: Loading indicator for asynchronous operations
   - ErrorAlert.tsx: Standard error display component
   - FilterControls.tsx: Reusable filtering interface
   - AddNewPlayerDialog.tsx: Dialog for adding new players

## Data Flow
1. User authenticates through the login page
2. User navigates to Match Upload form and enters match details
3. System validates input and creates a new match record
4. Match appears in the Match List view with filtering options
5. Statistics are calculated and displayed in various reports

## Recent Implementations & Fixes

1. **Match Model Restructuring:** Simplified match data structure for better usability.
2. **Service Layer Consolidation:** Organized backend services into distinct modules.
3. **Permission System Enhancement:** Improved the role-based access control system.
4. **Team Service Implementation:** Created dedicated team service for consistent team data management.
5. **MatchListPage Optimization:** Fixed infinite loop issue and improved team filtering capability.

## Current Status

The application is functional with core features working as expected. Recent fixes have improved stability and performance. There are still some UI/UX issues to be addressed, particularly in the dashboard and analytics sections.

## Known Issues

1. **Performance:** Some components could benefit from optimization.
2. ~~**Team Data Loading:** Team dropdown in match list occasionally fails to populate.~~
3. **Authentication:** Token refresh mechanism could be more robust.
4. **Mobile Responsiveness:** Some views don't adapt well to mobile screens.
5. ~~**Infinite Rerendering:** MatchListPage component occasionally gets caught in render loops.~~

## Next Steps

1. **Complete Cleanup Tasks:** Finish the remaining items in the cleanup checklist.
2. **Enhance Data Visualization:** Improve charts and statistics displays.
3. **Mobile Optimization:** Make the application fully responsive.
4. **Testing:** Implement more comprehensive unit and integration tests.

## Frontend Architecture

The frontend is built with React and TypeScript, utilizing Material-UI for the component library. Key parts include:

### Core Components
- **Pages:** Container components representing full views (e.g., Dashboard, MatchList, PlayerStats)
- **Components:** Reusable UI elements shared across multiple pages
- **Services:** Modules for API interactions and data processing
  - **api.service.ts:** Core API client setup with authentication handling
  - **match.service.ts:** Match-related API calls
  - **player.service.ts:** Player data management
  - **team.service.ts:** Team data fetching and management
  - **auth.service.ts:** Authentication and user management

### Data Flow
1. User interacts with a component
2. Component calls appropriate service function
3. Service makes API request to backend
4. Response data is processed and returned to component
5. Component updates state and re-renders with new data

## Code Organization

### Frontend Structure
```
src/
├── components/         # Reusable UI components
├── contexts/           # React context providers
├── hooks/              # Custom React hooks
├── pages/              # Main view components
├── services/           # API and data services
│   ├── api.service.ts  # Core API client
│   ├── auth.service.ts # Authentication service
│   ├── match.service.ts # Match data service
│   ├── player.service.ts # Player data service
│   └── team.service.ts # Team data service
├── types/              # TypeScript interfaces
├── utils/              # Helper functions
└── App.tsx             # Main application component
```

## Known Issues and Next Steps
1. Add pagination to match list view for better performance with large datasets
2. Enhance form validation for all input components
3. Implement comprehensive unit and integration tests
4. Improve mobile responsiveness
5. Add caching for frequently accessed data
6. Fix any remaining TypeScript definition issues

## Future Enhancements
1. Advanced analytics dashboard with visualization
2. Export functionality for reports and statistics
3. Integration with external APIs for additional data
4. Public-facing team profiles and statistics pages
5. Enhanced permission system with role-based access control
