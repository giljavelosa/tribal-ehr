import { useState, useEffect } from 'react';

/**
 * Debounce a value by a given delay (in milliseconds).
 * Returns the debounced value which only updates after the caller
 * stops changing the input value for the specified delay period.
 *
 * Usage:
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebounce(search, 300);
 *   // use debouncedSearch in API queries
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
