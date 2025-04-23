# Component Usage Guide

## Overview

This guide documents the component patterns and best practices used in the Esports Management Application. It provides guidance on how components should be structured, organized, and used throughout the application.

## Component Organization

### Directory Structure

Components are organized into feature-based directories:

```
src/
├── components/
│   ├── common/         # Shared UI components used across features
│   ├── match/          # Match-related components
│   ├── player/         # Player-related components
│   ├── team/           # Team-related components
│   └── auth/           # Authentication-related components
├── pages/              # Page components that use feature components
├── services/           # API service functions
├── types/              # TypeScript interfaces and types
└── utils/              # Utility functions
```

### Barrel File Pattern

We use barrel files (`index.ts`) in component directories to simplify imports:

```typescript
// components/match/index.ts
export { default as MatchList } from './MatchList';
export { default as MatchDetail } from './MatchDetail';
export { default as MatchForm } from './MatchForm';
```

This allows for cleaner imports in consumer components:

```typescript
import { MatchList, MatchDetail } from '../components/match';
```

## Component Naming Conventions

1. **PascalCase for Components**: All component files and component names should use PascalCase (e.g., `MatchDetailPage.tsx`, `MatchUploadForm.tsx`).

2. **Descriptive Names**: Component names should clearly describe their purpose and be specific enough to avoid confusion.

3. **Suffixes for Special Types**:
   - `Page` suffix for top-level page components (e.g., `MatchListPage`)
   - `List` suffix for list components (e.g., `ScrimGroupList`)
   - `Form` suffix for form components (e.g., `MatchUploadForm`)
   - `Item` suffix for individual items in a list (e.g., `MatchItem`)

## Component Composition Patterns

### Container/Presenter Pattern

We follow a container/presenter pattern where appropriate:

- **Container Components**: Handle data fetching, state management, and business logic
- **Presenter Components**: Focus on UI rendering and receive data via props

Example:
```tsx
// Container Component
const MatchListContainer: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      const data = await getMatches();
      setMatches(data);
      setLoading(false);
    };
    
    fetchMatches();
  }, []);
  
  return <MatchList matches={matches} loading={loading} />;
};

// Presenter Component
interface MatchListProps {
  matches: Match[];
  loading: boolean;
}

const MatchList: React.FC<MatchListProps> = ({ matches, loading }) => {
  if (loading) return <CircularProgress />;
  
  return (
    <List>
      {matches.map(match => (
        <MatchListItem key={match.id} match={match} />
      ))}
    </List>
  );
};
```

### Component Composition Over Inheritance

Prefer composition over inheritance by breaking down complex components into smaller, reusable pieces:

```tsx
// Prefer this:
const MatchDetail = () => (
  <Card>
    <MatchHeader />
    <MatchScoreBoard />
    <PlayerStatsList />
  </Card>
);

// Over this:
const MatchDetail = () => (
  <Card>
    {/* All header, score board, and player stats logic in one component */}
  </Card>
);
```

## State Management Patterns

### Local State

Use local state for UI-specific state that doesn't need to be shared:

```tsx
const [isExpanded, setIsExpanded] = useState(false);
```

### Props for Data Flow

Pass data and callbacks down through props for parent-child communication:

```tsx
// Parent
const ParentComponent = () => {
  const [data, setData] = useState([]);
  
  const handleDataUpdate = (newItem) => {
    setData([...data, newItem]);
  };
  
  return <ChildComponent onDataUpdate={handleDataUpdate} data={data} />;
};

// Child
const ChildComponent = ({ data, onDataUpdate }) => {
  // Use data and onDataUpdate callback
};
```

### Custom Hooks for Reusable Logic

Extract reusable logic into custom hooks:

```tsx
// Custom hook
const useMatchData = (matchId: string) => {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        setLoading(true);
        const data = await getMatchById(matchId);
        setMatch(data);
      } catch (err) {
        setError("Failed to load match");
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatch();
  }, [matchId]);
  
  return { match, loading, error };
};

// Usage in component
const MatchDetailPage = ({ matchId }) => {
  const { match, loading, error } = useMatchData(matchId);
  
  // Render based on loading, error, and match data
};
```

## Performance Optimization Patterns

### Memoization

Use memoization to prevent unnecessary re-renders:

```tsx
// Memoize expensive calculations
const filteredMatches = useMemo(() => {
  return matches.filter(match => match.type === selectedType);
}, [matches, selectedType]);

// Memoize callback functions
const handleDelete = useCallback(() => {
  deleteMatch(matchId);
}, [matchId]);

// Memoize component instances
const MemoizedComponent = React.memo(MyComponent);
```

### Pagination

Implement pagination for large datasets as demonstrated in `MatchListPage.tsx`:

```tsx
// State for pagination
const [page, setPage] = useState(0);
const [rowsPerPage, setRowsPerPage] = useState(10);

// Calculate paginated data
const paginatedData = useMemo(() => {
  const startIndex = page * rowsPerPage;
  return data.slice(startIndex, startIndex + rowsPerPage);
}, [data, page, rowsPerPage]);

// Render pagination controls
<TablePagination
  component="div"
  count={data.length}
  page={page}
  onPageChange={(_, newPage) => setPage(newPage)}
  rowsPerPage={rowsPerPage}
  onRowsPerPageChange={(e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }}
/>
```

## Form Handling Patterns

We use Formik for form management with the following patterns:

```tsx
const MyForm = () => {
  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ values, errors, touched, handleChange, handleBlur, handleSubmit }) => (
        <form onSubmit={handleSubmit}>
          {/* Form fields */}
        </form>
      )}
    </Formik>
  );
};
```

## Error Handling Patterns

```tsx
// Use error boundaries for component-level errors
<ErrorBoundary fallback={<ErrorMessage />}>
  <ComponentThatMightError />
</ErrorBoundary>

// Use try/catch for async operations
try {
  const data = await fetchData();
  setData(data);
} catch (error) {
  setError("Failed to fetch data");
} finally {
  setLoading(false);
}

// Display errors to users
{error && <Alert severity="error">{error}</Alert>}
```

## Documentation Standards

### Component Documentation

Use JSDoc comments for components and their props:

```tsx
/**
 * Displays a list of matches with filtering and pagination
 * 
 * @component
 * @example
 * <MatchList 
 *   matches={matches}
 *   loading={loading}
 *   error={error}
 * />
 */
interface MatchListProps {
  /** Array of match objects to display */
  matches: Match[];
  /** Whether the matches are currently loading */
  loading: boolean;
  /** Error message if the matches failed to load */
  error?: string | null;
}

const MatchList: React.FC<MatchListProps> = ({ matches, loading, error }) => {
  // Component implementation
};
```

### Code Comments

Add comments for complex logic:

```tsx
// Calculate win rate percentage
const winRate = totalGames > 0 
  ? Math.round((wins / totalGames) * 100) 
  : 0;

// Only apply filters if they're actually set
if (filterValue && filterValue !== 'all') {
  // Filter implementation
}
```

## Examples from Existing Codebase

### Example 1: MatchListPage Pattern

The `MatchListPage.tsx` component demonstrates several best practices:

1. Using `useCallback` to stabilize function references
2. Using `useMemo` for computed values
3. Implementing pagination for large datasets
4. Using JSDoc comments for complex functions
5. Applying proper error handling with user feedback

### Example 2: Component Composition in Match Upload Form

The match upload process is broken down into steps with separate components:
- `MatchUploadForm` (container)
  - `MatchDetailsStep` (form step)
  - `RosterStep` (form step)
  - `DraftForm` (form step)
  - `ReviewStep` (form step)

This makes the code more maintainable and focused.

## Future Recommendations

1. Consider implementing React Query for more efficient data fetching and caching
2. Create a comprehensive UI component library for common elements
3. Implement Storybook for visual component documentation
4. Add unit tests for critical component logic 