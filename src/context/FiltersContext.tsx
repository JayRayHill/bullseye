// FiltersContext holds search/filter/radius state. Kept separate from DataContext
// because it changes often (slider drags, keystrokes) and we want filter consumers
// to re-render without disturbing the map's marker layer.

import { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react';
import type { DealStatus, Filters } from '../types';
import { DEFAULT_FILTERS } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { STORAGE_KEYS, SCHEMA_VERSION } from '../lib/storage/keys';

interface FiltersContextValue {
  filters: Filters;
  hydrated: boolean;
  setSearch: (next: string) => void;
  toggleState: (state: string) => void;
  toggleStatus: (status: DealStatus) => void;
  setDealValueRange: (range: [number | null, number | null]) => void;
  setRadiusMiles: (n: number) => void;
  resetFilters: () => void;
}

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined);

function toggleInArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const { value: filters, setValue, hydrated, reset } = usePersistedState<Filters>(
    STORAGE_KEYS.filters,
    DEFAULT_FILTERS,
    { version: SCHEMA_VERSION, writeDelayMs: 200 }
  );

  const setSearch = useCallback(
    (next: string) => setValue((prev) => ({ ...prev, search: next })),
    [setValue]
  );
  const toggleState = useCallback(
    (state: string) =>
      setValue((prev) => ({ ...prev, states: toggleInArray(prev.states, state) })),
    [setValue]
  );
  const toggleStatus = useCallback(
    (status: DealStatus) =>
      setValue((prev) => ({ ...prev, statuses: toggleInArray(prev.statuses, status) })),
    [setValue]
  );
  const setDealValueRange = useCallback(
    (range: [number | null, number | null]) =>
      setValue((prev) => ({ ...prev, dealValueRange: range })),
    [setValue]
  );
  const setRadiusMiles = useCallback(
    (n: number) =>
      setValue((prev) => ({ ...prev, radiusMiles: Math.max(10, Math.min(200, n)) })),
    [setValue]
  );
  const resetFilters = useCallback(() => {
    void reset();
  }, [reset]);

  const value = useMemo<FiltersContextValue>(
    () => ({
      filters,
      hydrated,
      setSearch,
      toggleState,
      toggleStatus,
      setDealValueRange,
      setRadiusMiles,
      resetFilters,
    }),
    [
      filters,
      hydrated,
      setSearch,
      toggleState,
      toggleStatus,
      setDealValueRange,
      setRadiusMiles,
      resetFilters,
    ]
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used inside FiltersProvider');
  return ctx;
}
