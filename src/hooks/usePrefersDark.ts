// Reactive read of the `prefers-color-scheme: dark` media query. Tailwind's
// `darkMode: 'media'` config handles styling automatically — this hook is for
// code that needs to make runtime decisions (e.g., picking a dark vs light
// Leaflet tile URL).

import { useEffect, useState } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

export function usePrefersDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDark;
}
