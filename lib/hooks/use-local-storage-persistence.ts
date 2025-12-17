'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to persist form state to localStorage
 * Automatically saves on change and restores on mount
 * 
 * @param key - localStorage key (should be unique per form/page)
 * @param state - Current state object to persist
 * @param options - Configuration options
 */
export function useLocalStoragePersistence<T extends Record<string, any>>(
  key: string,
  state: T,
  options: {
    enabled?: boolean;
    onRestore?: (restored: T) => void;
    onSave?: (saved: T) => void;
    excludeKeys?: (keyof T)[];
    maxAge?: number; // Max age in milliseconds (default: 7 days)
    shouldSave?: () => boolean; // Optional function to control when to save
  } = {}
) {
  const {
    enabled = true,
    onRestore,
    onSave,
    excludeKeys = [],
    maxAge = 7 * 24 * 60 * 60 * 1000, // 7 days default
    shouldSave,
  } = options;

  const isInitialMount = useRef(true);
  const lastSavedState = useRef<string | null>(null);

  // Restore state on mount
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      
      // Check if data is expired
      if (parsed.timestamp && Date.now() - parsed.timestamp > maxAge) {
        localStorage.removeItem(key);
        return;
      }

      // Filter out excluded keys
      const restored = { ...parsed.data };
      excludeKeys.forEach((excludedKey) => {
        delete restored[excludedKey];
      });

      if (Object.keys(restored).length > 0) {
        onRestore?.(restored);
      }
    } catch (error) {
      // Corrupted data - remove it
      console.warn(`Failed to restore localStorage data for key "${key}":`, error);
      localStorage.removeItem(key);
    }
  }, [key, enabled, maxAge, excludeKeys, onRestore]);

  // Save state on change (debounced)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Filter out excluded keys and create a clean state object
    const stateToSave: Partial<T> = {};
    Object.keys(state).forEach((key) => {
      if (!excludeKeys.includes(key as keyof T)) {
        stateToSave[key as keyof T] = state[key];
      }
    });

    // Only save if state actually changed
    const stateString = JSON.stringify(stateToSave);
    if (stateString === lastSavedState.current) return;

    // Check if saving should be prevented via shouldSave callback
    if (shouldSave && !shouldSave()) {
      return;
    }

    try {
      const dataToStore = {
        data: stateToSave,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(dataToStore));
      lastSavedState.current = stateString;
      onSave?.(stateToSave as T);
    } catch (error) {
      // localStorage might be full or disabled
      console.warn(`Failed to save localStorage data for key "${key}":`, error);
    }
  }, [state, key, enabled, excludeKeys, onSave, shouldSave]);

  // Clear function
  const clear = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
      lastSavedState.current = null;
    } catch (error) {
      console.warn(`Failed to clear localStorage data for key "${key}":`, error);
    }
  }, [key]);

  return { clear };
}

/**
 * Utility to clear all setup-related localStorage data
 */
export function clearAllSetupData() {
  if (typeof window === 'undefined') return;
  
  const keys = [
    'threadbot:agent:create',
    'threadbot:setup:notion',
    'threadbot:setup:telegram',
    'threadbot:setup:schedule',
    'threadbot:settings',
  ];

  keys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear localStorage key "${key}":`, error);
    }
  });
}

