// Lightweight password gate for the whole app. Reads VITE_APP_PASSWORD
// at build time (set per-deployment in Vercel's Environment Variables
// panel) and gates the UI behind a sign-in screen. Unlock state lives
// in localStorage so reps don't have to re-enter the password on every
// page load.
//
// Threat model — this is "security theater" by design:
//   - The expected password is embedded in the built JS bundle (Vite
//     replaces import.meta.env.* at build time). Any determined visitor
//     could extract it by reading the bundle.
//   - The intent is to keep the URL out of arms-length browsing
//     (competitors, random web crawlers, screenshot leaks) — not to
//     defend against a motivated attacker. For an internal sales tool
//     whose data also stays client-side, this matches the actual
//     threat 99% of teams face. Upgrade to Vercel Pro password
//     protection or Cloudflare Access if the threat model demands more.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'bullseye:auth:v1';
// Dev fallback when no env var is set — keeps `npm run dev` working out
// of the box. In production builds (`npm run build` for Vercel), this
// fallback is NOT used; the env var must be set or we surface a config
// error on the sign-in screen.
const DEV_FALLBACK_PASSWORD = 'bullseye-dev';

/** The expected password, resolved at build time. Undefined if the env
 *  var was not provided. */
const EXPECTED_PASSWORD: string | undefined = import.meta.env.VITE_APP_PASSWORD;

interface AuthContextValue {
  isAuthed: boolean;
  /** True only when there's no configured password (env var unset in a
   *  production build). The sign-in screen surfaces this so reps don't
   *  hammer the input wondering why nothing works. */
  isMisconfigured: boolean;
  /** Tries the given password. Returns true on success. */
  signIn: (password: string) => boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'unlocked';
  } catch {
    return false;
  }
}

function getExpected(): string | undefined {
  if (EXPECTED_PASSWORD) return EXPECTED_PASSWORD;
  if (import.meta.env.DEV) return DEV_FALLBACK_PASSWORD;
  return undefined;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean>(() => readUnlocked());

  // If somehow localStorage was wiped externally (another tab, devtools)
  // re-evaluate when the window regains focus. Cheap insurance against
  // weird states.
  useEffect(() => {
    const onFocus = () => setIsAuthed(readUnlocked());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const signIn = useCallback((password: string): boolean => {
    const expected = getExpected();
    if (!expected) return false;
    if (password !== expected) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, 'unlocked');
    } catch {
      /* private-mode Safari may refuse writes; auth still works for the
         session, just won't persist. */
    }
    setIsAuthed(true);
    return true;
  }, []);

  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setIsAuthed(false);
  }, []);

  const isMisconfigured = !getExpected();

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthed, isMisconfigured, signIn, signOut }),
    [isAuthed, isMisconfigured, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
