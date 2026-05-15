// Shows aggregate row counts and a collapsible list of skipped rows after a
// successful upload. The first 50 errors are listed; we cap to keep the panel
// usable when a user uploads a thousand-row mess.

import type { Dataset, UploadError } from '../../types';

export function UploadSummary({
  dataset,
  errors,
}: {
  dataset: Dataset;
  errors: UploadError[];
}) {
  const visible = errors.slice(0, 50);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">
          {dataset.totals.closed} closed
        </span>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
          {dataset.totals.notClosed} open leads
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
          {dataset.totals.lost} lost
        </span>
        {errors.length > 0 ? (
          <span className="rounded bg-red-100 px-2 py-0.5 text-red-900">
            {errors.length} skipped
          </span>
        ) : null}
      </div>
      {errors.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-slate-700">
            View skipped rows ({Math.min(50, errors.length)} of {errors.length})
          </summary>
          <ul className="mt-2 max-h-60 overflow-y-auto rounded border border-slate-100 bg-slate-50 p-2 text-xs text-slate-700">
            {visible.map((e, i) => (
              <li key={i} className="py-1">
                <span className="font-medium">Row {e.rowIndex + 2}:</span> {e.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
