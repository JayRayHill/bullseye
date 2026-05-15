// usePersistedState mirrors React.useState but reads its initial value from
// IndexedDB (async) and writes updates back, debounced. The `hydrated` flag is
// the cue for consumers to render a skeleton until the first read settles —
// without it, every consumer would briefly flash the default value before the
// stored value loaded.

import { useCallback, useEffect, useRef, useState } from 'react';
import { safeGet, safeSet, safeDelete } from '../lib/storage/persist';

export interface PersistedStateOptions<T> {
  version: number;
  migrate?: (oldData: unknown, oldVersion: number) => T | null;
  /** Milliseconds to wait after the last change before writing to IndexedDB. */
  writeDelayMs?: number;
}

export function usePersistedState<T>(
  key: string,
  initial: T,
  options: PersistedStateOptions<T>
): {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  reset: () => Promise<void>;
  hydrated: boolean;
} {
  const [value, setValueState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const writeTimer = useRef<number | null>(null);
  const lastWritten = useRef<T | undefined>(undefined);

  // One-time read on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { value: stored } = await safeGet<T>(key, options.version, options.migrate);
      if (cancelled) return;
      if (stored !== null && stored !== undefined) {
        setValueState(stored);
        lastWritten.current = stored;
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, options.version]);

  // Debounced write whenever the value changes after hydration. We compare against
  // the last written value to avoid an immediate echo write after hydration.
  useEffect(() => {
    if (!hydrated) return;
    if (lastWritten.current === value) return;
    if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
    const delay = options.writeDelayMs ?? 250;
    writeTimer.current = window.setTimeout(() => {
      lastWritten.current = value;
      void safeSet(key, value, options.version);
    }, delay);
    return () => {
      if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
    };
  }, [value, hydrated, key, options.version, options.writeDelayMs]);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setValueState((prev) =>
      typeof next === 'function' ? (next as (p: T) => T)(prev) : next
    );
  }, []);

  const reset = useCallback(async () => {
    if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
    lastWritten.current = initial;
    setValueState(initial);
    await safeDelete(key);
  }, [key, initial]);

  return { value, setValue, reset, hydrated };
}
