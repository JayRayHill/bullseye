import { useEffect, useState } from 'react';

/** Returns a value that lags the input by `delayMs`. Used to debounce search
 *  input and slider drags before they trigger downstream re-renders or writes. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
