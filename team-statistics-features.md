# Team Statistics & Match Editing Features Checklist

## Core Feature: Team Statistics

### 1. Team Selection
- [x] Implement team selector dropdown/searchable input
  - [x] Include all teams in the system
  - [x] Update view when team is selected
  - [x] Add visual indicator for currently selected team
  - [x] Include team logo/icon if available

### 2. Team Overview
- [x] Create aggregate team metrics dashboard
  - [x] Display total matches played
  - [x] Show overall winrate with visual indicator
  - [x] Calculate and display average team KDA
  - [x] Show hero pick frequency across the team
  - [x] Add charts for key metrics:
    - [x] Damage distribution
    - [x] Gold earned
    - [x] Vision score
    - [x] Objective control rate
  - [x] Implement trend visualization for performance over time
  - [x] Add team comparison feature with historical opponents

### 3. Player List & Aggregated Statistics
- [x] Develop player list component
  - [x] Table or card view listing all team players
  - [x] Display current IGN for each player
  - [x] Show player role/position
  - [x] Include key metrics for each player:
    - [x] Individual winrate
    - [x] Average computed KDA
    - [x] Total matches played
    - [x] Most played hero with icon
  - [x] Make each player entry clickable for detailed view
  - [x] Add sorting functionality (by role, performance, etc.)
  - [x] Implement filtering options (active players, substitutes, etc.)

### 4. Detailed Player View
- [x] Create player profile header
  - [x] Display player name and profile image
  - [x] Show basic stats summary
  - [x] Add history of player's IGNs
  - [x] Include player's current team status

- [x] Implement recent matches section
  - [x] List/table showing recent matches with details:
    - [x] Date and opponent
    - [x] Match outcome
    - [x] Key performance metrics
    - [x] Hero played
  - [x] Add filtering options:
    - [x] Past 7 days
    - [x] Past month
    - [x] Custom date range
    - [x] By match type (scrim, tournament)

- [x] Develop hero-specific statistics
  - [x] Display most played heroes with icons
  - [x] Show winrates with specific heroes (charts/tables)
  - [x] Include performance trends over time
  - [x] Add hero matchup analysis
  - [x] Visualize hero pool breadth and depth

### 5. Backend Services Implementation
- [x] Implement team statistics backend services
  - [x] Create StatisticsService for data calculations
  - [x] Implement TeamStatisticsView endpoint handler
  - [x] Add robust error handling and logging
  - [x] Implement data aggregation for team stats (KDA, winrate, etc.)
  - [x] Develop match history retrieval functionality
  - [x] Add performance trend calculation
  - [x] Ensure proper data serialization

## Match Editing Feature

### 1. Backend API Implementation
- [x] Create/update API endpoints for match editing
  - [x] Update MatchService with edit capabilities
    - [x] Implement updateMatch method
    - [x] Add validation logic for match updates
  - [x] Add PlayerMatchStatService.updatePlayerStats method
  - [ ] Create API endpoint for retrieving match edit history
  - [x] Implement authorization middleware for edit permissions
- [ ] Add database model for tracking edit history
  - [ ] Create MatchEditHistory model with fields for:
    - [ ] User who made the edit
    - [ ] Timestamp
    - [ ] Previous values
    - [ ] New values
    - [ ] Edit reason/notes
  - [ ] Add migrations for new model

### 2. Unified Match Editor Interface
- [x] Create comprehensive MatchEditorPage component
  - [x] Implement route at /matches/:matchId/edit
  - [x] Add "Edit Match" button to MatchDetailPage
  - [x] Design unified interface with sections for:
    - [x] Match metadata (top section)
    - [x] Player statistics (tabular section below)
  - [x] Implement match metadata editing section
    - [x] Match date/time picker
    - [x] Match type selector (dropdown)
    - [x] Team assignment controls
    - [x] Match outcome selector
    - [x] Notes/comments field
  - [x] Create player statistics editing section in same view
    - [x] Implement tabular interface for all players in match
    - [x] Group players by team with clear visual separation
    - [x] Add inline editing for statistics fields:
      - [x] KDA values with validation
      - [x] CS/farm with validation
      - [x] Damage metrics with validation
      - [x] Vision metrics with validation
    - [x] Calculate and display derived statistics in real-time
    - [ ] Show visual indicators for changed values
  - [x] Add single save button that validates and saves both match metadata and player statistics
  - [x] Implement permission checks to hide/show edit button based on user role
- [ ] Create confirmation dialog for edits
  - [ ] Build reusable ConfirmDialog component
  - [ ] Add explanation of edit impact
  - [ ] Include optional field for edit reason/notes
- [ ] Implement stat validation logic
  - [ ] Create utility functions for validating ranges
  - [ ] Add warnings for unusual values
  - [ ] Implement cross-field validation
- [ ] Add batch editing capabilities for player stats
  - [ ] Create BatchEditDialog component
  - [ ] Allow selecting multiple players to edit same stat
  - [ ] Add review screen before applying batch changes

### 3. Data Integrity & History
- [ ] Implement edit history viewer
  - [ ] Create MatchEditHistoryComponent
  - [ ] Add tab or expandable section to view edit history
  - [ ] Display list of edits with timestamps and users
  - [ ] Add filtering by edit type, user, and date range
  - [ ] Implement diff view to compare versions
- [ ] Add version restoration capability
  - [ ] Create RestoreVersionDialog component
  - [ ] Implement API endpoint for restoring previous versions
  - [ ] Add confirmation for restoration with impact explanation
- [ ] Create automated validation system
  - [ ] Implement server-side validation rules
  - [ ] Add suspicious edit flagging system
  - [ ] Create admin review interface for flagged edits

### 4. Integration & Testing
- [x] Integrate with existing components
  - [x] Update MatchDetailPage to reflect edited data
  - [x] Ensure PlayerProfilePage shows updated statistics
  - [x] Update team statistics calculations to use latest match data
- [x] Add testing utilities
  - [x] Create test script for team statistics endpoint
  - [ ] Create unit tests for validation logic
  - [ ] Implement integration tests for edit workflows
  - [ ] Add UI tests for editor components
- [ ] Create documentation
  - [ ] Document edit permissions model
  - [ ] Create user guide for match editing
  - [ ] Add technical documentation for the edit history system

