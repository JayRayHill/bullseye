// ThemeContext owns the light/dark/system preference and keeps the `dark`
// class on <html> in sync. The class itself is bootstrapped synchronously by
// a small inline script in index.html so there's no flash of wrong theme on
// first paint; this provider takes over once React mounts.
//
// Storage: localStorage (synchronous, mirrors the bootstrap script) under the
// key `bullseye:theme`. Values: 'light' | 'dark' | 'system'. Absent = system.
//
// Effective theme is what every consumer should actually paint with — the
// concrete light/dark value after resolving 'system' against the OS query.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'bullseye:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readSaved(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* swallow — privacy-mode browsers, etc. */
  }
  return 'system';
}

function resolveEffective(pref: ThemePreference): EffectiveTheme {
  if (pref === 'light' || pref === 'dark') return pref;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

interface ThemeContextValue {
  theme: ThemePreference;
  effectiveTheme: EffectiveTheme;
  setTheme: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readSaved());
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() =>
    resolveEffective(readSaved())
  );

  // Apply the `dark` class to <html> + persist whenever the preference changes.
  useEffect(() => {
    const next = resolveEffective(theme);
    setEffectiveTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* swallow */
    }
  }, [theme]);

  // When the OS preference changes AND the user is on 'system', recompute.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(DARK_QUERY);
    const handler = () => {
      if (theme !== 'system') return;
      const next: EffectiveTheme = mql.matches ? 'dark' : 'light';
      setEffectiveTheme(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => setThemeState(next), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, effectiveTheme, setTheme }),
    [theme, effectiveTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
