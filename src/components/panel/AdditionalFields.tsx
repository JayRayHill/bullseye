// Renders any uploaded columns that aren't part of the canonical set. We compare
// the row's keys against the columns currently mapped — anything unmapped (or
// mapped to a recognized field) is hidden; everything else surfaces here so users
// don't lose data just because we didn't know what to do with the column.

import type { Customer, ColumnMapping } from '../../types';

export function AdditionalFields({
  customer,
  mapping,
  headers,
}: {
  customer: Customer;
  mapping: ColumnMapping;
  headers: string[];
}) {
  const mappedHeaders = new Set(
    Object.values(mapping).filter((v): v is string => typeof v === 'string')
  );
  const extras = headers.filter((h) => !mappedHeaders.has(h) && customer.raw[h]);
  if (extras.length === 0) return null;
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <summary className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100">
        Additional fields ({extras.length})
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {extras.map((h) => (
          <div key={h}>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{h}</dt>
            <dd className="break-words text-slate-800 dark:text-slate-200">{customer.raw[h]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
