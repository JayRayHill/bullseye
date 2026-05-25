// Top-level filter bar. Composes search, status chips, state chips, and the
// deal-value range. Status chips toggle which deal types are shown; state chips
// allow multi-select; deal-value range uses two number inputs with explicit
// nullable behavior.

import { useMemo } from 'react';
import clsx from 'clsx';
import { useFilters } from '../../context/FiltersContext';
import type { DealStatus } from '../../types';
import { useData } from '../../context/DataContext';

// Status chips reuse the semantic pin palette so the filter visually maps to
// the map. Active state adds a thick brand-tinted ring. The Lost chip only
// renders when the loaded dataset actually contains lost rows — the current
// classifier never produces 'lost', so it stays hidden unless future data has it.
const STATUS_CHIPS: { value: DealStatus; label: string; idle: string; active: string }[] = [
  {
    value: 'closed',
    label: 'Closed',
    idle: 'bg-brand-50 text-brand-900 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-100 dark:hover:bg-brand-900/50',
    active: 'bg-brand-700 text-white shadow-sm dark:bg-brand-500',
  },
  {
    value: 'not_closed',
    label: 'Open',
    idle: 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/50',
    active: 'bg-amber-500 text-white shadow-sm dark:bg-amber-400 dark:text-slate-900',
  },
  {
    value: 'lost',
    label: 'Lost',
    idle: 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    active: 'bg-slate-700 text-white dark:bg-slate-500 dark:text-slate-100',
  },
];

export function FilterBar() {
  const { dataset } = useData();
  const { filters, setSearch, toggleState, toggleStatus, setDealValueRange, resetFilters } =
    useFilters();

  const availableStates = useMemo(() => {
    if (!dataset) return [];
    const s = new Set<string>();
    for (const c of dataset.customers) {
      if (c.state) s.add(c.state);
    }
    return [...s].sort();
  }, [dataset]);

  const filtersActive =
    filters.search ||
    filters.states.length ||
    filters.statuses.length ||
    filters.dealValueRange[0] !== null ||
    filters.dealValueRange[1] !== null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <input
        type="search"
        value={filters.search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search business or city"
        aria-label="Search by business name or city"
        className="min-w-[14rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      <div className="flex items-center gap-1" role="group" aria-label="Deal status filter">
        {STATUS_CHIPS.map((chip) => {
          // Hide the Lost chip when the dataset has no lost rows. Avoids
          // showing a filter category that can never apply.
          if (chip.value === 'lost' && (dataset?.totals.lost ?? 0) === 0) return null;
          const active = filters.statuses.includes(chip.value);
          return (
            <button
              key={chip.value}
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => toggleStatus(chip.value)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active ? chip.active : chip.idle
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {availableStates.length > 0 ? (
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            States {filters.states.length ? `(${filters.states.length})` : ''}
          </summary>
          <div className="absolute z-30 mt-2 grid max-h-64 w-48 grid-cols-3 gap-1 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {availableStates.map((st) => {
              const active = filters.states.includes(st);
              return (
                <button
                  key={st}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => toggleState(st)}
                  className={clsx(
                    'rounded px-2 py-1 text-center transition-colors',
                    active
                      ? 'bg-brand-700 text-white dark:bg-brand-500'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  )}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </details>
      ) : null}

      <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
        <span>$ min</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={filters.dealValueRange[0] ?? ''}
          onChange={(e) =>
            setDealValueRange([
              e.target.value === '' ? null : Number(e.target.value),
              filters.dealValueRange[1],
            ])
          }
          aria-label="Minimum deal value"
          className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <span>max</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={filters.dealValueRange[1] ?? ''}
          onChange={(e) =>
            setDealValueRange([
              filters.dealValueRange[0],
              e.target.value === '' ? null : Number(e.target.value),
            ])
          }
          aria-label="Maximum deal value"
          className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      {filtersActive ? (
        <button
          type="button"
          onClick={resetFilters}
          className="text-xs text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
