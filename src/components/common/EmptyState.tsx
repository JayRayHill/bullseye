// Landing screen shown when no dataset is loaded. Two side-by-side
// entry points:
//   1. "Use the default list" — one-click load of the bundled HubSpot
//      seed dataset. SDRs skip the upload + mapping ritual entirely.
//   2. "Upload your own file" — the existing dropzone + mapping flow.
//
// The hero (logo + wordmark + tagline) stays at the top; the two CTAs
// are framed as siblings so neither feels secondary. The "How it
// works" strip lives below for first-time orientation.

import { useState } from 'react';
import { BullseyeLogo } from '../brand/BullseyeLogo';
import { ThemeToggle } from '../brand/ThemeToggle';
import { PrivacyBanner } from '../layout/PrivacyBanner';
import { UploadDropzone } from '../upload/UploadDropzone';
import { useData } from '../../context/DataContext';
import { useToast } from './ToastProvider';
import { loadDefaultDataset } from '../../lib/parsing/loadDefaultDataset';
import { showLoadingBar, hideLoadingBar } from '../../lib/loading';

export function EmptyState() {
  const { setDataset, setColumnMapping, setUploadErrors } = useData();
  const toast = useToast();
  const [loadingDefault, setLoadingDefault] = useState(false);

  const onUseDefault = async () => {
    if (loadingDefault) return;
    setLoadingDefault(true);
    showLoadingBar('Loading the default customer list…');
    try {
      const { dataset, errors } = await loadDefaultDataset();
      if (dataset.customers.length === 0) {
        toast.show(
          'error',
          'The default list parsed but every row was skipped. Try uploading your own file instead.'
        );
        return;
      }
      setDataset(dataset);
      // No explicit user-chosen mapping for the default path; the
      // detail-panel "Additional fields" view falls back to showing
      // every column when columnMapping is null/empty, which is what
      // we want for the seed dataset.
      setColumnMapping({});
      setUploadErrors(errors);
      toast.show(
        'info',
        `Loaded ${dataset.customers.length.toLocaleString()} customers from the default list` +
          (errors.length > 0 ? ` (${errors.length.toLocaleString()} skipped).` : '.')
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load the default list.';
      toast.show('error', message);
    } finally {
      setLoadingDefault(false);
      hideLoadingBar();
    }
  };

  return (
    // Tuned to fit fully above the fold on a standard ~768px laptop
    // viewport: tighter outer padding (py-5 vs py-12), smaller hero,
    // and a compact "How it works" row at the bottom. Same content
    // hierarchy as before — every section still present, just denser.
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:py-8">
      {/* Theme toggle floats top-right so first-time visitors can choose
          before loading any data. Once the Shell is mounted, the toggle
          lives in the main header instead. */}
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <header className="flex flex-col items-center gap-2 text-center">
        <BullseyeLogo size={52} animated />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Bullseye Offense
          </h1>
          <p className="mt-1 text-base text-brand-700 dark:text-brand-300 sm:text-lg">
            Every closed deal has a neighbor.
          </p>
        </div>
      </header>

      {/* Two CTAs side-by-side. The default-list card carries a
          brand-green fill so it visually dominates — it's the primary
          path for SDRs running off the shared list. The upload card
          stays neutral, framed as the alternative for reps who want
          to bring their own data. items-stretch + flex-1 inside each
          section keeps the two cards the same height so the rebalance
          reads as intentional. */}
      <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
        {/* Primary CTA — brand fill, inverted button for max contrast. */}
        <section className="flex flex-col justify-between gap-3 rounded-2xl bg-brand-700 p-5 text-white shadow-md dark:bg-brand-600">
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-100">
              For SDRs · Recommended
            </p>
            <h2 className="text-xl font-semibold tracking-tight">
              Use the default list
            </h2>
            <p className="text-sm leading-snug text-brand-50/95">
              Pre-loaded HubSpot list. No upload, no column mapping —
              click and get to work.
            </p>
          </div>
          <button
            type="button"
            onClick={onUseDefault}
            disabled={loadingDefault}
            className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-brand-800 shadow-sm transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70"
          >
            {loadingDefault ? 'Loading…' : 'Use the default list →'}
          </button>
        </section>

        {/* Secondary CTA — neutral framing for the "I have my own data"
            path. Visually quieter than the brand-green card next to it. */}
        <section className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Have your own data
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Upload a file
            </h2>
            <p className="text-sm leading-snug text-slate-600 dark:text-slate-400">
              Drop a CSV or XLSX and we&rsquo;ll auto-detect the columns.
            </p>
          </div>
          <UploadDropzone />
        </section>
      </div>

      <PrivacyBanner variant="inline" />

      <section
        aria-label="How it works"
        className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          How it works
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Step
            number={1}
            title="Load a customer list"
            body="Start with the default list or upload your own CSV / XLSX."
          />
          <Step
            number={2}
            title="Click a customer you closed"
            body="Their nearby leads who never closed light up on the map and in the side panel."
          />
          <Step
            number={3}
            title="Email their neighbors"
            body="Pick a template, hit Send via Gmail. Your closed customer becomes the proof point."
          />
        </ol>
      </section>
    </div>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white dark:bg-brand-500"
      >
        {number}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{body}</p>
      </div>
    </li>
  );
}

