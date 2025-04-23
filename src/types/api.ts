export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Represents an API error response with detailed error information
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

/**
 * Represents an API error response
 */
export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  details?: ApiErrorDetail[] | Record<string, string[]>;
  response?: {
    data?: {
      error?: string;
      detail?: string | ApiErrorDetail[] | Record<string, string[]>;
      message?: string;
      non_field_errors?: string[];
    };
    status?: number;
    statusText?: string;
  };
  isAxiosError?: boolean;
  code?: string;
}

/**
 * Convert an unknown error to an ApiError
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof Error) {
    return error as ApiError;
  }
  return new Error('Unknown error occurred') as ApiError;
} 