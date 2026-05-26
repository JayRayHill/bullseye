// At-a-glance counter strip under the main header. Renders the loaded
// dataset's totals as brand-tinted chips so reps can see the shape of their
// territory without leaving the header.
//
// On data load the chip numbers tween from 0 to their final values via
// useCountUp — small detail but it's the first thing the rep's eye lands on
// after the header, and a count-up reads as "the app just calculated this
// for you" rather than "static label." Comma-formatting throughout because
// "1,119" looks meaningfully different from "1119" at a glance.

import type { Dataset } from '../../types';
import { useCountUp } from '../../hooks/useCountUp';

const nf = new Intl.NumberFormat('en-US');

export function StatsStrip({ dataset }: { dataset: Dataset }) {
  const { totals } = dataset;
  const totalCount = useCountUp(dataset.customers.length);
  const closedCount = useCountUp(totals.closed);
  const openCount = useCountUp(totals.notClosed);
  const lostCount = useCountUp(totals.lost);
  const invalidCount = useCountUp(totals.invalid);
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {/* tabular-nums keeps the number from jittering as digits change
              width during the count-up (1 → 11 → 111 jumps without this). */}
          <span className="tabular-nums">{nf.format(totalCount)}</span>{' '}
          customer{dataset.customers.length === 1 ? '' : 's'}
        </span>
        <Dot />
        <Chip color="brand">
          <span className="tabular-nums">{nf.format(closedCount)}</span> closed
        </Chip>
        <Chip color="lead">
          <span className="tabular-nums">{nf.format(openCount)}</span> open
          {' '}deal{totals.notClosed === 1 ? '' : 's'}
        </Chip>
        {totals.lost > 0 ? (
          <Chip color="lost">
            <span className="tabular-nums">{nf.format(lostCount)}</span> lost
          </Chip>
        ) : null}
        {totals.invalid > 0 ? (
          <Chip color="red">
            <span className="tabular-nums">{nf.format(invalidCount)}</span> skipped
          </Chip>
        ) : null}
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
