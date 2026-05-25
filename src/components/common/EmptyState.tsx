// Landing screen shown when no dataset is loaded. Hero treatment: oversized
// logo, tagline, dropzone + sample CTA side-by-side, privacy as quiet inline
// bullets, and a 3-step "How it works" strip beneath.

import { BullseyeLogo } from '../brand/BullseyeLogo';
import { ThemeToggle } from '../brand/ThemeToggle';
import { PrivacyBanner } from '../layout/PrivacyBanner';
import { UploadDropzone } from '../upload/UploadDropzone';

export function EmptyState({ onTrySample }: { onTrySample: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:py-16">
      {/* Theme toggle floats top-right so first-time visitors can choose
          before loading any data. Once the Shell is mounted, the toggle
          lives in the main header instead. */}
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <header className="flex flex-col items-center gap-4 text-center">
        <BullseyeLogo size={64} />
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Bullseye Offense
          </h1>
          <p className="mt-2 text-lg text-brand-700 dark:text-brand-300 sm:text-xl">
            Every closed deal has a neighbor.
          </p>
        </div>
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400 sm:text-base">
          Upload your customer list. We&rsquo;ll plot your wins on a US map and surface the
          nearby prospects who never quite closed — then help you email them using your
          existing customer as social proof.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <UploadDropzone />
        <button
          type="button"
          onClick={onTrySample}
          className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-brand-400 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-600 dark:hover:bg-brand-900/30 sm:self-stretch"
        >
          Try sample data
        </button>
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
            title="Upload your CRM export"
            body="Drop a CSV or Excel file. Required columns: business name and zip. Status and close date are optional."
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

      <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <summary className="cursor-pointer font-medium text-slate-900 dark:text-slate-100">
          Expected file format
        </summary>
        <div className="mt-3 space-y-2">
          <p>
            Required columns: <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">business_name</code>{' '}
            and <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">zip</code> (5-digit US).
          </p>
          <p>
            <strong>How deals are classified:</strong> a row with a value in{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">deal_close_date</code> <em>or</em> a
            positive <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">deal_value</code> / REAL LTV is
            a closed customer (green). Without either signal, rows where{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">deal_status</code> is &ldquo;lost&rdquo;
            show in gray; everything else is treated as an open lead (amber).
          </p>
          <p>
            Recognized optional columns: deal_close_date, deal_status, contact_name, email, phone,
            address, city, state, deal_value, last_contact_date. Any other columns are preserved and
            shown in the detail panel.
          </p>
        </div>
      </details>
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
