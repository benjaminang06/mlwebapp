import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for fetching data from an API with loading and error states
 * @template T - The type of data expected from the API
 * @param fetchFunction - Function that returns a promise resolving to data of type T
 * @param dependencies - Optional array of dependencies that should trigger a refetch
 * @param initialData - Optional initial data value
 * @returns Object containing data, loading state, error, and refetch function
 */
export function useDataFetching<T>(
  fetchFunction: () => Promise<T>,
  dependencies: any[] = [],
  initialData?: T
) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Define the fetch function with useCallback to stabilize its reference
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFunction();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      setError(error);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, ...dependencies]);

  // Execute the fetch function on mount and when dependencies change
  useEffect(() => {
    const controller = new AbortController();
    fetchData();
    
    // Cleanup function to abort any pending requests
    return () => {
      controller.abort();
    };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export default useDataFetching; 