# API Data Fetching Guide

## The Problem: Handling Paginated Responses

When fetching data from the Django REST Framework backend, responses are often paginated, especially for endpoints that may return large datasets. 

A paginated response looks like this:
```json
{
  "count": 42,  // Total number of items
  "next": "http://api.example.org/accounts/?page=2",  // URL to the next page
  "previous": null,  // URL to the previous page
  "results": [  // The actual array of items
    { /* item 1 */ },
    { /* item 2 */ },
    // ...
  ]
}
```

In contrast, some endpoints may return direct arrays:
```json
[
  { /* item 1 */ },
  { /* item 2 */ },
  // ...
]
```

## Common Error

The most common error occurs when code assumes a direct array is returned, when in fact the data is nested inside the `results` property of a paginated response. This leads to errors like:

```
TypeError: response.data.filter is not a function
```

This occurs because `response.data` is an object with a `results` property, not an array that has the `filter` method.

## Best Practices for API Data Fetching

### 1. Use Utility Functions for Response Extraction

We already have a utility function in `match.service.ts` that handles both paginated and non-paginated responses:

```typescript
/**
 * Uniform handling of potentially paginated responses
 * @param response API response that could be paginated or a direct array
 * @returns Extracted array of results
 */
const extractResultsFromResponse = <T>(response: AxiosResponse<PaginatedResponse<T> | T[]>): T[] => {
  if (response.data && 'results' in response.data && Array.isArray(response.data.results)) {
    return response.data.results;
  } else if (Array.isArray(response.data)) {
    return response.data;
  }
  console.error('Unexpected API response structure:', response.data);
  return [];
};
```

### 2. Use Existing Service Functions Instead of Direct API Calls

Instead of making direct API calls with `api.get()`, use the service functions that have been created to abstract away these details. For example:

```typescript
// ❌ AVOID this:
const response = await api.get<PlayerMatchStat[]>(`/api/matches/${match.match_id}/player-stats/`);
const teamPlayerStats = response.data.filter(stat => stat.team === Number(teamId));

// ✅ DO this instead:
const matchPlayerStats = await getPlayerStatsForMatch(match.match_id);
const teamPlayerStats = matchPlayerStats.filter(stat => stat.team === Number(teamId));
```

### 3. Handling Errors Gracefully

Always include try/catch blocks around API calls and provide meaningful error messages:

```typescript
try {
  const data = await someApiCall();
  // Process data
} catch (error) {
  console.error(`Failed to fetch data: ${error.message}`);
  // Provide fallback or user-friendly error message
}
```

### 4. Typing API Responses Properly

When making direct API calls, ensure proper type annotations for paginated responses:

```typescript
// For potentially paginated responses:
const response = await api.get<PaginatedResponse<MyType> | MyType[]>(url);

// Define the PaginatedResponse type:
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
```

## Fixed Issue: Statistics Service

The issue in `statistics.service.ts` was fixed by modifying the `calculateTeamStatistics` function to:

1. Import and use the `getPlayerStatsForMatch` function that already handles pagination correctly
2. Use the returned array directly for filtering instead of assuming `response.data` is an array

```typescript
// Before:
const response = await api.get<PlayerMatchStat[]>(`/api/matches/${match.match_id}/player-stats/`);
const teamPlayerStats = response.data.filter(stat => stat.team === Number(teamId));

// After:
const matchPlayerStats = await getPlayerStatsForMatch(match.match_id);
const teamPlayerStats = matchPlayerStats.filter(stat => stat.team === Number(teamId));
```

## Conclusion

By following these best practices, we can avoid common errors related to API data fetching and ensure our application handles both paginated and non-paginated responses correctly. 