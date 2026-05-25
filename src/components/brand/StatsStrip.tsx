// At-a-glance counter strip under the main header. Renders the loaded
// dataset's totals as brand-tinted chips so reps can see the shape of their
// territory without leaving the header.

import type { Dataset } from '../../types';

export function StatsStrip({ dataset }: { dataset: Dataset }) {
  const { totals } = dataset;
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {dataset.customers.length} customer{dataset.customers.length === 1 ? '' : 's'}
        </span>
        <Dot />
        <Chip color="brand">{totals.closed} closed</Chip>
        <Chip color="lead">{totals.notClosed} open deal{totals.notClosed === 1 ? '' : 's'}</Chip>
        {totals.lost > 0 ? <Chip color="lost">{totals.lost} lost</Chip> : null}
        {totals.invalid > 0 ? <Chip color="red">{totals.invalid} skipped</Chip> : null}
        <span className="ml-auto truncate text-slate-500 dark:text-slate-500">
          from <span className="font-medium">{dataset.sourceFilename}</span>
        </span>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
      ·
    </span>
  );
}

function Chip({
  color,
  children,
}: {
  color: 'brand' | 'lost' | 'lead' | 'red';
  children: React.ReactNode;
}) {
  const map: Record<typeof color, string> = {
    brand:
      'bg-brand-50 text-brand-900 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-100 dark:ring-brand-800',
    lost:
      'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    lead:
      'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800',
    red:
      'bg-red-50 text-red-900 ring-red-200 dark:bg-red-900/30 dark:text-red-100 dark:ring-red-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${map[color]}`}>
      {children}
    </span>
  );
}
