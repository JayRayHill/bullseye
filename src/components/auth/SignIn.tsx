// Sign-in screen rendered when no auth state exists in localStorage.
// Same hero treatment as the EmptyState (centered logo, wordmark,
// tagline) so the first-load experience feels intentional — the gate
// isn't a tacked-on afterthought, it's part of the app's identity.
//
// UX notes:
//   - Password field auto-focuses on mount.
//   - Enter submits via the form's onSubmit.
//   - Wrong password shows an inline error with a brief shake animation
//     so the failure is unmistakable. Doesn't clear the field — reps
//     can fix a typo without re-typing.
//   - Theme toggle floats top-right (matches EmptyState pattern) so
//     reps can pick light/dark before signing in.
//   - When the env var is missing in production, the form is disabled
//     and a config-error message explains what to do.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BullseyeLogo } from '../brand/BullseyeLogo';
import { ThemeToggle } from '../brand/ThemeToggle';

export function SignIn() {
  const { signIn, isMisconfigured } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMisconfigured) return;
    const ok = signIn(password);
    if (!ok) {
      setError('That password isn’t right. Check with your team lead.');
      // Trigger the shake animation by toggling the flag with a brief
      // off-state in between, so re-firing on the same incorrect attempt
      // still shakes.
      setShaking(false);
      requestAnimationFrame(() => setShaking(true));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-12 sm:py-20">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <header className="flex flex-col items-center gap-4 text-center">
        <BullseyeLogo size={64} animated />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Bullseye Offense
          </h1>
          <p className="mt-2 text-base text-brand-700 dark:text-brand-300 sm:text-lg">
            Every closed deal has a neighbor.
          </p>
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        onAnimationEnd={() => setShaking(false)}
        className={
          'flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ' +
          (shaking ? 'stm-shake' : '')
        }
      >
        <label
          htmlFor="signin-password"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Team password
        </label>
        <input
          ref={inputRef}
          id="signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          disabled={isMisconfigured}
          aria-invalid={!!error}
          aria-describedby={error ? 'signin-error' : undefined}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
          placeholder="••••••••"
        />

        {error ? (
          <p
            id="signin-error"
            role="alert"
            className="text-xs text-red-700 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isMisconfigured || !password}
          className="mt-1 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Sign in
        </button>

        {isMisconfigured ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            <p className="font-semibold">App not configured</p>
            <p className="mt-1">
              No <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">VITE_APP_PASSWORD</code>{' '}
              environment variable was set at build time. Add one in your
              Vercel project’s Environment Variables panel and redeploy.
            </p>
          </div>
        ) : null}
      </form>

      <p className="text-center text-xs text-slate-500 dark:text-slate-500">
        Internal tool. Your team lead has the password.
      </p>
    </div>
  );
}
