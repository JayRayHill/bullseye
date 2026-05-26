// Empty-state widget for the detail panel: when no customer is selected,
// surface the top closed customers ranked by how many uncontacted nearby
// leads they unlock. Turns "Click a pin" friction into a one-click daily
// to-do list — the single highest-leverage workflow improvement in the
// app, because it answers "where should I start?" before the rep has to
// figure it out themselves.
//
// Computation runs in a useMemo gated on [allCustomers, radiusMiles,
// sentHistory] so it doesn't re-rank on every render. At 1k closed
// customers × 8k open leads with bbox prefilter, this is well under
// 100ms — but we still cap to top 5 so the list stays scannable.

import { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../context/FiltersContext';
import { useSelection } from '../../context/SelectionContext';
import { useSentHistory } from '../../context/SentHistoryContext';
import { computeTopTargets } from '../../lib/leads/topTargets';

const TOP_N = 5;

export function TopTargets() {
  const { dataset } = useData();
  const { filters } = useFilters();
  const { setActive } = useSelection();
  const { isLeadBlocked, history } = useSentHistory();

  // history is in the dep array so the list refreshes when a campaign send
  // adds new entries — a customer whose only nearby leads were just
  // contacted should drop out of the top targets immediately, not wait
  // for a reload.
  const targets = useMemo(
    () => {
      if (!dataset) return [];
      return computeTopTargets(
        dataset.customers,
        filters.radiusMiles,
        isLeadBlocked,
        TOP_N
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataset, filters.radiusMiles, history]
  );

  return (
    <section
      role="region"
      aria-label="Top targets"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          Top targets
        </h2>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          within {filters.radiusMiles} mi
        </span>
      </header>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Closed customers with the most uncontacted nearby leads. Click any
        to start a campaign.
      </p>

      {targets.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
          No targets at this radius. Try expanding the radius slider or check
          back after a fresh upload.
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {targets.map((t, i) => {
            const cityState = [t.customer.city, t.customer.state]
              .filter(Boolean)
              .join(', ');
            return (
              <li key={t.customer.id}>
                <button
                  type="button"
                  onClick={() => setActive(t.customer.id)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-700 dark:hover:bg-brand-900/30"
                >
                  {/* Numbered badge — establishes the ranking visually */}
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900/60 dark:text-brand-200"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t.customer.business_name}
                    </span>
                    {cityState ? (
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {cityState}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                      {t.nearbyCount}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      nearby
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-slate-300 transition-colors group-hover:text-brand-500 dark:text-slate-600 dark:group-hover:text-brand-400"
                  >
                    →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
        Or click any green pin on the map.
      </p>
    </section>
  );
}
