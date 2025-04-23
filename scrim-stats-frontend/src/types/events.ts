import React from 'react';

/**
 * Common event types for React components
 * These types can be imported throughout the application for consistent event handler typing
 */

// Form events
export type FormEventHandler = React.FormEventHandler<HTMLFormElement>;
export type FormEvent = React.FormEvent<HTMLFormElement>;

// Input element events
export type InputChangeEvent = React.ChangeEvent<HTMLInputElement>;
export type InputChangeEventHandler = React.ChangeEventHandler<HTMLInputElement>;

export type TextareaChangeEvent = React.ChangeEvent<HTMLTextAreaElement>;
export type TextareaChangeEventHandler = React.ChangeEventHandler<HTMLTextAreaElement>;

export type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>;
export type SelectChangeEventHandler = React.ChangeEventHandler<HTMLSelectElement>;

// Focus events
export type FocusEvent = React.FocusEvent<HTMLElement>;
export type FocusEventHandler = React.FocusEventHandler<HTMLElement>;

// Input-specific focus events
export type InputFocusEvent = React.FocusEvent<HTMLInputElement>;
export type InputFocusEventHandler = React.FocusEventHandler<HTMLInputElement>;

export type TextareaFocusEvent = React.FocusEvent<HTMLTextAreaElement>;
export type TextareaFocusEventHandler = React.FocusEventHandler<HTMLTextAreaElement>;

// Mouse events
export type MouseEvent = React.MouseEvent<HTMLElement>;
export type MouseEventHandler = React.MouseEventHandler<HTMLElement>;

export type ButtonMouseEvent = React.MouseEvent<HTMLButtonElement>;
export type ButtonMouseEventHandler = React.MouseEventHandler<HTMLButtonElement>;

// Keyboard events
export type KeyboardEvent = React.KeyboardEvent<HTMLElement>;
export type KeyboardEventHandler = React.KeyboardEventHandler<HTMLElement>;

export type InputKeyboardEvent = React.KeyboardEvent<HTMLInputElement>;
export type InputKeyboardEventHandler = React.KeyboardEventHandler<HTMLInputElement>;

// Drag events
export type DragEvent = React.DragEvent<HTMLElement>;
export type DragEventHandler = React.DragEventHandler<HTMLElement>;

// Material UI specific event types
export interface MUISelectChangeEvent {
  target: {
    value: string | number | null;
    name?: string;
  };
}

// Generic event handler type with generic parameter and return type
export type EventHandler<E, R = void> = (event: E) => R;

// Utility type for handlers that might receive an event or direct value
export type ChangeHandler<T, R = void> = (value: T | React.ChangeEvent<HTMLElement>) => R; 