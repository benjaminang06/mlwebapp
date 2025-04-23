import { useState, useCallback, useMemo } from 'react';
import { PaginatedResponse } from '../types/api';

export interface PaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
}

/**
 * Custom hook for handling pagination logic
 * @param options - Pagination configuration options
 * @returns Pagination state and handler functions
 */
export function usePagination({
  initialPage = 1,
  initialPageSize = 10,
  totalItems = 0,
}: PaginationOptions = {}) {
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [total, setTotal] = useState<number>(totalItems);

  /**
   * Update pagination state from a paginated API response
   */
  const updateFromResponse = useCallback(<T>(response: PaginatedResponse<T>) => {
    setTotal(response.count);
    return response.results;
  }, []);

  /**
   * Handle page change event
   */
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  /**
   * Handle page size change event
   */
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    // Reset to first page when changing page size
    setPage(1);
  }, []);

  /**
   * Calculate pagination values for API requests
   */
  const paginationParams = useMemo(() => {
    return {
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };
  }, [page, pageSize]);

  /**
   * Calculate total number of pages
   */
  const totalPages = useMemo(() => {
    return Math.ceil(total / pageSize);
  }, [total, pageSize]);

  return {
    // Current state
    page,
    pageSize,
    total,
    totalPages,
    
    // API helpers
    paginationParams,
    updateFromResponse,
    
    // Event handlers
    handlePageChange,
    handlePageSizeChange,
    
    // Direct state setters
    setPage,
    setPageSize,
    setTotal,
  };
}

export default usePagination; 