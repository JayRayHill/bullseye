// Landing screen shown when no dataset is loaded. Houses the upload dropzone,
// a "Try sample data" shortcut, and the privacy copy.

import { PrivacyBanner } from '../layout/PrivacyBanner';
import { UploadDropzone } from '../upload/UploadDropzone';

export function EmptyState({ onTrySample }: { onTrySample: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Sales Territory Map
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Upload a CSV or Excel file of customers. We&rsquo;ll plot closed deals on a US map and
          surface nearby open leads within a radius you choose.
        </p>
      </header>

      <PrivacyBanner />

      <UploadDropzone />

      <div className="flex flex-col items-center gap-2 text-sm text-slate-600">
        <span>Don&rsquo;t have a file handy?</span>
        <button
          type="button"
          onClick={onTrySample}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Try sample data
        </button>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-medium text-slate-900">
          Expected file format
        </summary>
        <div className="mt-3 space-y-2">
          <p>
            Required columns: <code className="rounded bg-slate-100 px-1 py-0.5">business_name</code>{' '}
            and <code className="rounded bg-slate-100 px-1 py-0.5">zip</code> (5-digit US).
          </p>
          <p>
            <strong>How deals are classified:</strong> a row with a value in{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5">deal_close_date</code> is a closed
            customer (green). Without a close date, rows where{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5">deal_status</code> is &ldquo;lost&rdquo;
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
