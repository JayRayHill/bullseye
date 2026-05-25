// SettingsContext holds the rep's name + email signature + preferred template.
// Persisted in IndexedDB via usePersistedState — they live only on this
// browser, matching the rest of the app's privacy story.

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { RepSettings } from '../types';
import { DEFAULT_REP_SETTINGS } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { SCHEMA_VERSION } from '../lib/storage/keys';

const SETTINGS_KEY = 'stm:rep-settings:v1';

interface SettingsContextValue {
  settings: RepSettings;
  hydrated: boolean;
  /** True iff the rep has supplied at least a first name. Used to decide
   *  whether the campaign drawer should prompt for setup. */
  isConfigured: boolean;
  updateSettings: (patch: Partial<RepSettings>) => void;
  resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { value, setValue, hydrated, reset } = usePersistedState<RepSettings>(
    SETTINGS_KEY,
    DEFAULT_REP_SETTINGS,
    { version: SCHEMA_VERSION }
  );

  const updateSettings = useCallback(
    (patch: Partial<RepSettings>) => setValue((prev) => ({ ...prev, ...patch })),
    [setValue]
  );

  const ctx = useMemo<SettingsContextValue>(
    () => ({
      settings: value,
      hydrated,
      isConfigured: !!value.firstName.trim(),
      updateSettings,
      resetSettings: reset,
    }),
    [value, hydrated, updateSettings, reset]
  );

  return <SettingsContext.Provider value={ctx}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
