// Shows aggregate row counts after an upload and explains WHY rows were
// skipped. The categorical counters live on dataset.totals (persisted), so
// the breakdown survives a page reload even if the per-row error list does
// not. When detailed per-row errors ARE available (just-uploaded), we surface
// the first 50 in a collapsible list so the user can see specific offenders.

import type { Dataset, UploadError } from '../../types';

export function UploadSummary({
  dataset,
  errors,
}: {
  dataset: Dataset;
  errors: UploadError[];
}) {
  const { totals, customers } = dataset;
  const kept = customers.length;
  const total = kept + totals.invalid;
  const visible = errors.slice(0, 50);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {kept.toLocaleString()} of {total.toLocaleString()} rows kept
        </span>
        {totals.invalid > 0 ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ({totals.invalid.toLocaleString()} skipped — see breakdown below)
          </span>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            (all rows imported successfully)
          </span>
        )}
      </div>

      {totals.invalid > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {totals.missingBusinessName > 0 ? (
              <SkipChip
                count={totals.missingBusinessName}
                label="missing business name"
                hint="Empty Company Name column for the row."
              />
            ) : null}
            {totals.invalidZip > 0 ? (
              <SkipChip
                count={totals.invalidZip}
                label="missing or invalid zip"
                hint="Empty Postal Code column, or value isn't a 5-digit US zip."
              />
            ) : null}
            {totals.unknownZip > 0 ? (
              <SkipChip
                count={totals.unknownZip}
                label="zip not in US database"
                hint="Looks like a 5-digit zip but isn't a known US ZIP code (e.g., a typo or a non-US postal code)."
              />
            ) : null}
          </div>

          {errors.length > 0 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                View skipped rows ({Math.min(50, errors.length).toLocaleString()} of {errors.length.toLocaleString()})
              </summary>
              <ul className="mt-2 max-h-60 overflow-y-auto rounded border border-slate-100 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                {visible.map((e, i) => (
                  <li key={i} className="py-1">
                    <span className="font-medium">Row {e.rowIndex + 2}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Per-row details aren&rsquo;t available after a page reload — re-upload the file to
              see specific offending rows.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

function SkipChip({
  count,
  label,
  hint,
}: {
  count: number;
  label: string;
  hint: string;
}) {
  return (
    <span
      title={hint}
      className="inline-flex items-baseline gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
    >
      <span className="font-semibold">{count.toLocaleString()}</span>
      <span>{label}</span>
    </span>
  );
}
