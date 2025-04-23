import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * Validation rule type
 */
export type ValidationRule<T> = {
  validate: (value: any, formValues: T) => boolean;
  message: string;
};

/**
 * Form field configuration
 */
export type FormField<T> = {
  value: any;
  touched: boolean;
  error: string | null;
  rules?: ValidationRule<T>[];
};

/**
 * Form state type
 */
export type FormState<T> = {
  [K in keyof T]: FormField<T>;
};

/**
 * Form options
 */
export interface FormOptions<T> {
  initialValues: T;
  onSubmit?: (values: T) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  persistKey?: string;
}

/**
 * Custom hook for form handling with validation and persistence
 * @param options Form configuration options
 * @returns Form state and handlers
 */
export function useForm<T extends Record<string, any>>({
  initialValues,
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
  persistKey,
}: FormOptions<T>) {
  // Initialize form state from localStorage if persistKey is provided
  const [storedValues, setStoredValues] = persistKey 
    ? useLocalStorage<T>(persistKey, initialValues)
    : [initialValues, (v: T) => {}];

  // Create initial form state
  const createInitialFormState = (): FormState<T> => {
    const formState: Record<string, FormField<T>> = {};
    
    // Use stored values if available, otherwise use initialValues
    const values = persistKey ? storedValues : initialValues;
    
    for (const key in values) {
      formState[key] = {
        value: values[key],
        touched: false,
        error: null,
        rules: [],
      };
    }
    
    return formState as FormState<T>;
  };

  // Form state
  const [formState, setFormState] = useState<FormState<T>>(createInitialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasBeenSubmitted, setHasBeenSubmitted] = useState(false);

  // Form values getter
  const values = useCallback((): T => {
    const formValues: Record<string, any> = {};
    
    for (const key in formState) {
      formValues[key] = formState[key].value;
    }
    
    return formValues as T;
  }, [formState]);

  // Add field and rules
  const registerField = useCallback((fieldName: keyof T, rules?: ValidationRule<T>[]) => {
    setFormState(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        rules: rules || [],
      },
    }));
  }, []);

  // Validate a single field
  const validateField = useCallback((fieldName: keyof T): boolean => {
    const field = formState[fieldName];
    const currentValues = values();
    
    if (!field.rules || field.rules.length === 0) {
      return true;
    }
    
    for (const rule of field.rules) {
      if (!rule.validate(field.value, currentValues)) {
        setFormState(prev => ({
          ...prev,
          [fieldName]: {
            ...prev[fieldName],
            error: rule.message,
          },
        }));
        return false;
      }
    }
    
    // Clear error if validation passes
    setFormState(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        error: null,
      },
    }));
    
    return true;
  }, [formState, values]);

  // Validate all fields
  const validate = useCallback((): boolean => {
    let isValid = true;
    
    for (const fieldName in formState) {
      const fieldIsValid = validateField(fieldName as keyof T);
      isValid = isValid && fieldIsValid;
    }
    
    return isValid;
  }, [formState, validateField]);

  // Handle field change
  const handleChange = useCallback((fieldName: keyof T, value: any) => {
    setFormState(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        value,
      },
    }));
    
    // Validate on change if enabled
    if (validateOnChange && formState[fieldName].touched) {
      validateField(fieldName);
    }
  }, [formState, validateField, validateOnChange]);

  // Handle field blur
  const handleBlur = useCallback((fieldName: keyof T) => {
    setFormState(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        touched: true,
      },
    }));
    
    // Validate on blur if enabled
    if (validateOnBlur) {
      validateField(fieldName);
    }
  }, [validateField, validateOnBlur]);

  // Reset form to initial values
  const resetForm = useCallback(() => {
    setFormState(createInitialFormState());
    setHasBeenSubmitted(false);
  }, [createInitialFormState]);

  // Handle form submission
  const handleSubmit = useCallback(async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    setHasBeenSubmitted(true);
    
    // Mark all fields as touched
    const touchedState: Record<string, FormField<T>> = {};
    for (const key in formState) {
      touchedState[key] = {
        ...formState[key],
        touched: true,
      };
    }
    setFormState(touchedState as FormState<T>);
    
    // Validate all fields
    const isValid = validate();
    
    if (isValid && onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values());
      } finally {
        setIsSubmitting(false);
      }
    }
    
    return isValid;
  }, [formState, validate, onSubmit, values]);

  // Update localStorage when form values change
  useEffect(() => {
    if (persistKey) {
      setStoredValues(values());
    }
  }, [formState, persistKey, setStoredValues, values]);

  return {
    formState,
    values: values(),
    isSubmitting,
    hasBeenSubmitted,
    registerField,
    handleChange,
    handleBlur,
    handleSubmit,
    validate,
    resetForm,
  };
}

export default useForm; 