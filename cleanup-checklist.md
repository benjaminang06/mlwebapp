# Codebase Cleanup Checklist

## Project Summary
The Esports Management Application is designed to track esports teams, player performance, and match statistics. It provides tools for coaches and analysts to evaluate team and player performance over time.

- **Architecture:** Django REST API backend, React TypeScript frontend
- **Core Entities:** Teams, Players, Matches, PlayerMatchStats, Heroes, Drafts

## Backend Cleanup Tasks

### Models & Database
- [x] Fix model inconsistencies in `Match` model - current implementation has both old `match_outcome` logic and new team-based structure
- [x] Resolve duplicate service files (`match_service.py` vs `match_services.py`) - merged functionality and removed redundant file
- [ ] Remove redundant model methods that should be in the service layer:
  - [x] `Player.create_alias_from_current_ign`, `Player.get_awards_count`
  - [x] `Match.get_mvp`, `Match.get_mvp_loss` 
- [x] Check migration files for errors or inconsistencies with current model structure
- [x] Ensure proper validation in model `save()` methods 
- [x] Fix `score_details` calculation in `Match.update_score_details()` - seems to be a mismatch with the frontend expectations
- [x] Fix match grouping logic to only group matches of the same type (scrimmage, tournament, etc.)
- [x] Remove unused 'authentication' app from the backend - contains only empty boilerplate files and isn't registered in INSTALLED_APPS
- [x] Fix `PlayerMatchStatCreateSerializer` which uses non-existent `Player.find_by_ign` method
- [x] Fix inconsistency in Team model validation - category values should match database

### Services Layer
- [x] Consolidate match-related services between `match_service.py` and `match_services.py` - completed
- [x] Complete service layer refactoring:
  - [x] Create missing `TeamService` class - implemented with core functionality
  - [x] Create missing `ScrimGroupService` class - implemented with methods for creating and finding scrim groups
  - [x] Create missing `HeroService` class - implemented with methods for hero statistics and pairings
- [x] Move business logic from views to services:
  - [x] Move `TeamViewSet.add_player` logic to `TeamService` - updated view to use service correctly
  - [x] Move `PlayerViewSet.change_ign` logic to `PlayerService` - added proper error handling
  - [x] Move `VerifyMatchPlayersView` complex logic to appropriate service - implemented in MatchStatsService
- [x] Fix references to outdated model fields in `MatchStatsService.calculate_score_details` method
- [x] Create a `PlayerService.find_by_ign` method to replace direct model queries

### API & Serializers
- [x] Fix outdated filtering/query logic in `TeamViewSet.statistics` action
- [x] Fix inconsistencies between serializer fields and model fields (e.g., `PlayerMatchStatSerializer` might reference outdated fields)
- [x] Fix inconsistent pagination handling across different views
- [x] Update `PlayerMatchStatSerializer.get_is_our_team` to handle null cases
- [x] Fix outdated imports in views.py (using wrong paths to services)
- [x] Update `PlayerLookupView` to use `PlayerTeamHistory` instead of direct team references
- [x] ~Fix `TeamRoleManagementView` to use `role` instead of `role_level` field~ (Not needed - already using `role` correctly)

### Authentication & Permissions
- [x] Ensure consistent permission checks across all viewsets (some use `get_permissions()`, others don't)
- [x] Review the implementation of `IsTeamManager` permission class
- [x] Verify token handling in frontend API calls

## Frontend Cleanup Tasks (Updated Priority)

### High Priority (Low Risk)

#### Code Organization
- [x] Remove unused components and code
  - [x] Remove unused ImportExample.tsx component
  - [x] Update component index exports to remove references to deleted components
- [x] Add code comments to complex functions
  - [x] Added JSDoc comments to key functions in MatchListPage.tsx
  - [x] Documented parameter types and return values
- [x] Document component usage patterns for future developers
  - [x] Created component-guide.md with comprehensive documentation
  - [x] Included patterns for component organization, naming, and composition
  - [x] Documented state management and performance optimization techniques
  - [x] Added practical examples from the existing codebase

#### Performance Improvements
- [x] Implement proper caching for frequently accessed data
  - [x] Add caching for team and hero lists
  - [ ] Implement React Query for cache invalidation
- [x] Add pagination for all list views to handle large datasets
  - [x] Added pagination to MatchListPage with configurable rows per page

#### Documentation
- [x] Add inline documentation for complex functions
  - [x] Added detailed JSDoc comments to utility and key business logic functions
- [ ] Document component usage patterns

### Medium Priority (Moderate Risk)

#### Component Structure
- [x] Organize frontend component imports for consistency
  - [x] Order imports logically (React/external libraries first, then internal modules)

#### Code Quality
- [x] Implement consistent naming conventions
  - [x] Use PascalCase for components and interfaces
  - [x] Use camelCase for variables, functions, and instances
  - [x] Add prefix "use" for all custom hooks
- [x] Fix API Import Issues After Removing Duplicate API Files
  - [x] Update imports in MatchListPage.tsx to properly use TeamService from api.service.ts
  - [x] Fix references to team.service.ts for API functions
  - [x] Implement locally needed helper functions instead of importing non-existent ones
- [x] Add robust error handling for API responses
  - [x] Add defensive coding to handle potentially missing data
  - [x] Implement type-safe handling of API responses
  - [x] Handle both paginated and non-paginated response formats properly

### Low Priority (Unless Causing Issues)

#### Feature Enhancement
- [ ] Add confirmation dialogs for critical actions like deletion
- [ ] Implement form field focus management for accessibility
- [ ] Create context providers for shared state only if prop drilling becomes problematic

## Removed Tasks (Not Needed Unless Issues Occur)

The following tasks have been removed since they involve high-risk refactoring of components that are currently working well:

- Standardize pagination handling across components when there are no actual pagination issues
- Fix validation errors in forms that are functioning correctly
- Implement complex context providers where prop drilling isn't causing problems
- Change TypeScript definitions that aren't causing compilation issues

## Completed Tasks

#### 1. Consolidate Match Service Files
- **Issue**: There were two separate service files (`match_service.py` and `match_services.py`) with overlapping functionality.
- **Files Affected**:
  - `scrim_stats_backend/services/match_services.py`
  - `scrim_stats_backend/services/match_service.py` (deleted)
  - `scrim_stats_backend/api/views.py`
- **Changes Made**:
  - Merged functionality from `match_service.py` into `match_services.py`
  - Updated MatchStatsService methods to use the new Match model structure
  - Fixed the `calculate_score_details` method to use the blue/red side team structure
  - Removed references to `MatchService` in `views.py` and updated to use `MatchStatsService`
  - Added missing method `suggest_game_number` to `MatchStatsService`
  - Deleted the redundant `match_service.py` file
- **Testing**: Need to manually test API endpoints that use these services
- **Status**: Completed

#### 2. Fix PlayerMatchStatSerializer.get_is_our_team Method
- **Issue**: The `get_is_our_team` method in `PlayerMatchStatSerializer` was not handling null values properly, which could lead to errors.
- **Files Affected**:
  - `scrim_stats_backend/api/serializers.py`
- **Changes Made**:
  - Updated the method to check if `obj.match`, `obj.match.our_team`, and `obj.team` are not None before accessing their properties
  - Added more comprehensive null checks to prevent NullReferenceException errors
- **Testing**: Need to test the API endpoint that returns player match stats
- **Status**: Completed

#### 3. Fix TeamViewSet.statistics Action
- **Issue**: The `statistics` action in `TeamViewSet` was using outdated query logic and contained TODO comments about updating for the new Match model structure.
- **Files Affected**:
  - `scrim_stats_backend/api/views.py`
- **Changes Made**:
  - Updated the query to properly filter matches based on the blue_side_team and red_side_team fields
  - Added proper calculation of wins and losses based on the winning_team field
  - Added additional statistics like draws, blue_side_matches, and red_side_matches
  - Used select_related to optimize database queries
  - Improved code organization and readability
- **Testing**: Need to test the team statistics endpoint 
- **Status**: Completed

#### 4. Fix Match Grouping Logic
- **Issue**: Matches were being grouped together regardless of their type, which could result in scrimmage and tournament matches being incorrectly grouped together.
- **Files Affected**:
  - `scrim_stats_backend/services/match_services.py`
- **Changes Made**:
  - Updated the `assign_scrim_group_for_match` method to consider the match type when grouping
  - Added `scrim_type` to the filter criteria when finding previous matches
  - Included match type in the group name for clearer identification
  - Added match type to the automatically generated notes
  - Added validation to check that match type is not None before proceeding
- **Testing**: Need to test match creation and verify proper grouping behavior
- **Status**: Completed 

#### 5. Update TeamViewSet.add_player Method
- **Issue**: The `add_player` method in `TeamViewSet` wasn't correctly using the `TeamService.add_player_to_team` method, which returns a tuple of (player, created).
- **Files Affected**:
  - `scrim_stats_backend/api/views.py`
- **Changes Made**:
  - Updated the method to properly unpack the tuple returned by `TeamService.add_player_to_team`
  - Changed variable naming from `new_player` to `player` to reflect that the player might not be new
  - Ensured proper use of the unpacked values in the serialization and response
- **Testing**: Need to test adding players to teams through the API endpoint
- **Status**: Completed

#### 6. Remove Unused Authentication App
- **Issue**: The project contained an unused 'authentication' app with empty boilerplate files.
- **Files Affected**:
  - `scrim_stats_backend/authentication/` (entire directory)
- **Changes Made**:
  - Verified the app wasn't used anywhere in the codebase (no imports)
  - Confirmed it wasn't registered in INSTALLED_APPS in settings.py
  - Removed the entire directory
- **Testing**: Confirmed the backend still works without the directory
- **Status**: Completed

#### 7. Fix Match Model Inconsistencies 
- **Issue**: The Match model had a mix of old match_outcome logic and new team-based structure, leading to potential bugs.
- **Files Affected**:
  - `scrim_stats_backend/api/models.py`
- **Changes Made**:
  - Updated the save method to set match_outcome only from our_team's perspective, not blue/red sides
  - Simplified the logic for determining match_outcome based on winning_team and our_team fields
  - Added comments clarifying the purpose of each condition
- **Testing**: Need to test match creation and updating to ensure proper outcome calculation
- **Status**: Completed

#### 8. Move PlayerViewSet.change_ign Logic to PlayerService
- **Issue**: The change_ign method in PlayerViewSet was not fully utilizing the PlayerService functionality.
- **Files Affected**:
  - `scrim_stats_backend/api/views.py`
- **Changes Made**:
  - Updated the method to fully use PlayerService.change_player_ign
  - Added proper error handling with try/except block
  - Return the updated player object from the service method
- **Testing**: Need to test changing player IGNs through the API endpoint
- **Status**: Completed

#### 9. Create ScrimGroupService Class
- **Issue**: ScrimGroup related logic was scattered in views and MatchStatsService rather than having a dedicated service.
- **Files Affected**:
  - `scrim_stats_backend/services/scrim_group_services.py` (new file)
  - `scrim_stats_backend/api/views.py`
- **Changes Made**:
  - Created a new ScrimGroupService class with methods for:
    - Creating and finding scrim groups
    - Getting matches within a group
    - Calculating group statistics
  - Updated MatchViewSet to use the new service for assigning scrim groups
  - Added new API endpoints to ScrimGroupViewSet for stats and matches
- **Testing**: Need to test scrim group creation, stats calculation, and API endpoints
- **Status**: Completed 

#### 10. Create HeroService Class
- **Issue**: There was no dedicated service for hero-related functionality.
- **Files Affected**:
  - `scrim_stats_backend/services/hero_services.py` (new file)
  - `scrim_stats_backend/api/views.py`
- **Changes Made**:
  - Created a new HeroService class with methods for:
    - Getting heroes by name, ID, or popularity
    - Calculating hero statistics like pick rate, win rate, and ban rate
    - Finding hero pairings that work well together
  - Updated HeroViewSet to use the service class
  - Added new API endpoints for popular heroes, banned heroes, and hero statistics
- **Testing**: Need to test the hero endpoints to ensure they return the expected data
- **Status**: Completed

#### 11. Fix Match.update_score_details Method
- **Issue**: The score_details calculation in Match.update_score_details() didn't match frontend expectations.
- **Files Affected**:
  - `scrim_stats_backend/api/models.py`
- **Changes Made**:
  - Added json import and improved error handling
  - Added explicit team name variables to avoid potential NoneType errors
  - Used raw SQL update to ensure the JSON is stored correctly
  - Added logging for debugging purposes
- **Testing**: Need to verify the score_details are displayed correctly in the frontend
- **Status**: Completed

#### 12. Move Player.create_alias_from_current_ign to PlayerService
- **Issue**: The Player model had a method that should be in the service layer.
- **Files Affected**:
  - `scrim_stats_backend/services/player_services.py`
  - `scrim_stats_backend/api/models.py`
- **Changes Made**:
  - Added create_alias_from_current_ign method to PlayerService
  - Updated change_player_ign method to use the new service method
  - Removed the redundant method from the Player model
  - Improved the Player.__str__ method to include role information
- **Testing**: Need to test changing player IGNs to ensure aliases are created correctly
- **Status**: Completed

#### 13. Move VerifyMatchPlayersView Logic to MatchStatsService
- **Issue**: The VerifyMatchPlayersView had complex player resolution logic that should be in a service.
- **Files Affected**:
  - `scrim_stats_backend/services/match_services.py`
  - `scrim_stats_backend/api/views.py`
- **Changes Made**:
  - Added verify_and_process_match_players method to MatchStatsService
  - Added helper methods for resolving players and creating stats
  - Updated VerifyMatchPlayersView to use the service methods
  - Simplified the view code by delegating complex logic to the service
- **Testing**: Need to test the player verification and stat creation process
- **Status**: Completed 

#### 14. Fix Inconsistent Pagination Handling
- **Issue**: Various API endpoints had inconsistent or missing pagination, leading to potential performance issues with large datasets.
- **Files Affected**:
  - `scrim_stats_backend/api/views.py`
  - `scrim_stats_backend/services/hero_services.py`
- **Changes Made**:
  - Updated `recent` method in `MatchViewSet` to use pagination properly
  - Added pagination support to `popular` method in `HeroViewSet`
  - Added pagination support to `banned` method in `HeroViewSet`
  - Added pagination support to `statistics` method in `HeroViewSet`
  - Added pagination support to `pairings` method in `HeroViewSet`
  - Modified service methods to support retrieving all items when needed for pagination:
    - Updated `get_popular_heroes` to accept None as limit parameter
    - Updated `get_most_banned_heroes` to accept None as limit parameter
    - Updated `get_hero_pairings` to accept None as limit parameter
- **Testing**: Need to test each endpoint with and without pagination to ensure proper behavior
- **Status**: Completed

#### 15. Fix Migration Circular Dependency Error
- **Issue**: Migration files had a circular dependency between 0023_remove_match_is_external_match_and_more and 0024_populate_sides, causing a django.db.migrations.exceptions.CircularDependencyError.
- **Files Affected**:
  - `scrim_stats_backend/api/migrations/0023_remove_match_is_external_match_and_more.py`
  - `scrim_stats_backend/api/migrations/0024_populate_sides.py` (renamed to 0026_populate_sides.py)
  - New files created:
    - `scrim_stats_backend/api/migrations/0025_add_nullable_sides.py`
    - `scrim_stats_backend/api/migrations/0027_make_sides_non_nullable.py`
- **Changes Made**:
  - Updated migration 0023 to depend on 0022 instead of 0024
  - Created new migration 0025 to make blue_side_team and red_side_team nullable temporarily
  - Moved the data migration to 0026 to run after 0025
  - Created new migration 0027 to make fields non-nullable again
  - Reorganized the migration sequence to avoid the circular dependency
- **Testing**: Confirmed migration commands run without errors
- **Status**: Completed

#### 16. Add Validation to Team Model save() Method
- **Issue**: The Team model lacked proper validation for fields like team_name and team_abbreviation.
- **Files Affected**:
  - `scrim_stats_backend/api/models.py`
- **Changes Made**:
  - Added validation for team_name (required, not empty)
  - Added validation for team_abbreviation (required, not empty, max length 10)
  - Added validation for team_category (must be one of valid options)
  - Added automatic trimming for team_abbreviation that exceeds max length
- **Testing**: Need to test team creation with valid and invalid data
- **Status**: Completed

#### 17. Fix PlayerMatchStatSerializer Field Inconsistencies
- **Issue**: The serializer had inconsistencies with the model fields and improper validation.
- **Files Affected**:
  - `scrim_stats_backend/api/serializers.py`
- **Changes Made**:
  - Made hero_played field optional and allow null values
  - Fixed is_our_team and is_blue_side methods to properly handle null values
  - Added comprehensive validation for team consistency and KDA values
  - Updated validation logic to verify player's team is either blue or red side
- **Testing**: Need to test serializer with various data scenarios
- **Status**: Completed

#### 18. Review and Improve IsTeamManager Permission Class
- **Issue**: The permission class had inconsistencies and potential bugs.
- **Files Affected**:
  - `scrim_stats_backend/api/permissions.py`
- **Changes Made**:
  - Fixed permission checks to use the correct role names
  - Added proper handling for staff users
  - Improved player team management check using get_current_team_history
  - Enhanced docstrings and comments
  - Added proper has_permission method to IsTeamMember
- **Testing**: Need to test permission checks with various user roles
- **Status**: Completed

#### 19. Add Consistent Permission Checks to ViewSets
- **Issue**: Permission handling was inconsistent across viewsets.
- **Files Affected**:
  - `scrim_stats_backend/api/views.py`
- **Changes Made**:
  - Added get_permissions() methods to PlayerMatchStatViewSet, ScrimGroupViewSet, and MatchViewSet
  - Implemented consistent permission logic across all viewsets
  - Fixed imports for permission classes
  - Cleaned up duplicate imports in views.py
- **Testing**: Need to test permission enforcement for different user roles
- **Status**: Completed 

#### 20. Fix API Import Issues in Frontend Components
- **Issue**: Several components were using incorrect import paths after reorganizing API service files.
- **Files Affected**:
  - `scrim-stats-frontend/src/pages/MatchListPage.tsx`
  - `scrim-stats-frontend/src/services/hero.service.ts`
- **Changes Made**:
  - Updated imports to use `TeamService` from api.service.ts instead of non-existent functions
  - Implemented proper type handling for API responses to handle both paginated and direct arrays
  - Added defensive coding in fetchTeams to safely handle different response formats
  - Implemented local helper functions instead of importing from non-existent modules
  - Added comprehensive error handling for API responses
- **Testing**: Successfully fixed the runtime errors and improved code robustness
- **Status**: Completed

#### 21. Fix Infinite Loop Issue in MatchListPage
- **Issue**: The match history page was continuously reloading and re-fetching data due to dependency cycle between `fetchData` and unstable `fetchTeams` function.
- **Files Affected**:
  - `scrim-stats-frontend/src/pages/MatchListPage.tsx`
- **Changes Made**:
  - Wrapped `fetchTeams` function in useCallback with empty dependency array to stabilize its reference
  - Removed redundant date filter handler functions (handleTodayFilter, handleThisWeekFilter, handleThisMonthFilter) that were causing duplicate state updates
  - Fixed the useEffect dependency chain to prevent infinite re-renders
- **Testing**: Verified that the page loads correctly and doesn't trigger infinite API calls
- **Status**: Completed

#### 22. Remove Unused Code and Add Documentation
- **Issue**: The codebase contained unused components and lacked proper documentation for complex functions.
- **Files Affected**:
  - `scrim-stats-frontend/src/components/ImportExample.tsx` (deleted)
  - `scrim-stats-frontend/src/components/index.ts` (updated)
  - `scrim-stats-frontend/src/pages/MatchListPage.tsx` (updated)
- **Changes Made**:
  - Removed the unused ImportExample.tsx component
  - Updated the index.ts file to remove references to the deleted component
  - Added comprehensive JSDoc comments to key functions in MatchListPage.tsx
  - Documented parameter types, return values, and function purposes
- **Testing**: Verified that the application still works after removing the unused component
- **Status**: Completed

#### 23. Add Pagination to Match List View
- **Issue**: The match list view loaded all matches at once, which could cause performance issues with large datasets.
- **Files Affected**:
  - `scrim-stats-frontend/src/pages/MatchListPage.tsx`
- **Changes Made**:
  - Added pagination state (page and rowsPerPage)
  - Implemented page change and rows-per-page change handlers
  - Added TablePagination component to control pagination
  - Created a paginatedMatches computed value to display the correct subset of matches
  - Made pagination controls only appear when in individual match view mode
- **Testing**: Verified pagination controls work correctly and display the proper number of matches per page
- **Status**: Completed

#### 24. Create Component Usage Guide
- **Issue**: The project lacked standardized documentation for component patterns and best practices, making it difficult for new developers to understand the codebase architecture.
- **Files Affected**:
  - Created new file: `component-guide.md`
- **Changes Made**:
  - Documented component organization structure and directory patterns
  - Defined naming conventions for components
  - Explained component composition patterns including container/presenter pattern
  - Documented state management approaches and custom hooks usage
  - Added examples of performance optimization techniques like memoization and pagination
  - Included form handling and error handling patterns
  - Provided real examples from the existing codebase
  - Added future recommendations for further improvements
- **Testing**: Not applicable (documentation)
- **Status**: Completed

## Testing Tasks

- [ ] Test match creation flow with various team configurations
- [ ] Test player statistics recording
- [ ] Test filtering functionality on match list page
- [ ] Test team management features
- [ ] Verify all API endpoints with Postman/Insomnia

## Documentation Tasks

- [x] Update project specification to reflect current implementation
- [x] Document API endpoints for frontend reference
- [x] Create deployment guide for backend and frontend
- [x] Add code comments for complex functions
  - [x] Added detailed JSDoc comments to utility functions
  - [x] Documented key business logic in MatchListPage component

## Bug Fixes

- [x] Fix issue with team extraction in match list page
- [x] Fix score display in match list
- [x] Fix match type filter not working correctly
- [x] Fix dropdown options in team selection
- [x] Fix infinite reloading in match list page
- [ ] Fix validation errors in match upload form
- [x] Fix pagination in match list

## Performance Improvements

- [x] Optimize API calls in MatchListPage to prevent unnecessary re-renders
- [x] Use useCallback for API service functions to stabilize references
- [x] Centralize filtering logic for better maintenance
- [x] Implement proper caching for frequently accessed data
- [x] Add pagination for list views

## Deployment

- [ ] Set up CI/CD pipeline
- [ ] Configure production environment variables
- [ ] Set up database migrations for production
- [ ] Configure static file serving

## Future Maintenance Recommendations

- Create a style guide for new code
- Set up a testing framework for critical components
- Consider migrating to newer React patterns (like React Query) in incremental steps
- Document API integration points for easier maintenance


