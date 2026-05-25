// Three-state segmented control for theme preference: Light / Dark / System.
// We surface all three at once (rather than a single cycling button) so the
// active option is obvious and reaching any other state is a single click.
//
// Icons: sun (light), moon (dark), monitor (system). Active option gets the
// brand-green fill; the others sit quiet.

import type { ReactElement } from 'react';
import clsx from 'clsx';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';

const OPTIONS: { value: ThemePreference; label: string; icon: ReactElement }[] = [
  {
    value: 'light',
    label: 'Light mode',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark mode',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'Match system',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className={clsx(
              'inline-flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400',
              active
                ? 'bg-brand-700 text-white dark:bg-brand-500'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
            )}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
