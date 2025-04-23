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
 * Represents the different states of an API request
 */
export interface ApiRequestState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Represents a successful API response
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

/**
 * Base response interface with a discriminator
 */
export interface BaseResponse {
  status: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Success response with data
 */
export interface SuccessResponse<T> extends BaseResponse {
  status: 'success';
  data: T;
  message?: string;
}

/**
 * Error response with details
 */
export interface ErrorResponse extends BaseResponse {
  status: 'error';
  error: string;
  details?: ApiErrorDetail[] | Record<string, string[]>;
  message?: string;
}

/**
 * Warning response with message
 */
export interface WarningResponse extends BaseResponse {
  status: 'warning';
  message: string;
  data?: unknown;
}

/**
 * Info response with message
 */
export interface InfoResponse extends BaseResponse {
  status: 'info';
  message: string;
  data?: unknown;
}

/**
 * Discriminated union of all possible API responses
 */
export type ApiResponseUnion<T> = 
  | SuccessResponse<T> 
  | ErrorResponse 
  | WarningResponse 
  | InfoResponse;

/**
 * Type guard to check if a response is a paginated response
 */
export function isPaginatedResponse<T>(response: any): response is PaginatedResponse<T> {
  return response 
    && typeof response === 'object'
    && 'results' in response 
    && Array.isArray(response.results)
    && 'count' in response 
    && typeof response.count === 'number';
}

/**
 * Type guard to check if a response is an error response
 */
export function isErrorResponse(response: any): response is ErrorResponse {
  return response 
    && typeof response === 'object'
    && 'status' in response 
    && response.status === 'error'
    && 'error' in response;
}

/**
 * Type guard to check if a response is a success response
 */
export function isSuccessResponse<T>(response: any): response is SuccessResponse<T> {
  return response 
    && typeof response === 'object'
    && 'status' in response 
    && response.status === 'success'
    && 'data' in response;
}

/**
 * Type guard to check if a response is a specific API response union
 */
export function isApiResponse<T>(response: any): response is ApiResponseUnion<T> {
  return response 
    && typeof response === 'object'
    && 'status' in response 
    && (
      response.status === 'success' || 
      response.status === 'error' || 
      response.status === 'warning' || 
      response.status === 'info'
    );
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