/**
 * Barrel file for hooks directory
 * Allows importing multiple hooks from a single path:
 * import { useDataFetching, usePagination, useDebounce } from '../hooks';
 */

export { default as useDataFetching } from './useDataFetching';
export { default as usePagination } from './usePagination';
export { default as useDebounce } from './useDebounce';
export { default as useLocalStorage } from './useLocalStorage';
export { default as useForm } from './useForm';

// Re-export hooks types
export type { PaginationOptions } from './usePagination';
export type { 
  ValidationRule, 
  FormField, 
  FormState, 
  FormOptions 
} from './useForm'; 