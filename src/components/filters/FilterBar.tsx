// Top-level filter bar. Composes search, status chips, state chips, and the
// deal-value range. Status chips toggle which deal types are shown; state chips
// allow multi-select; deal-value range uses two number inputs with explicit
// nullable behavior.

import { useMemo } from 'react';
import { useFilters } from '../../context/FiltersContext';
import type { DealStatus } from '../../types';
import { useData } from '../../context/DataContext';

const STATUS_CHIPS: { value: DealStatus; label: string; classes: string }[] = [
  {
    value: 'closed',
    label: 'Closed',
    classes: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200',
  },
  {
    value: 'not_closed',
    label: 'Open',
    classes: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
  },
  {
    value: 'lost',
    label: 'Lost',
    classes: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
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
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <input
        type="search"
        value={filters.search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search business or city"
        aria-label="Search by business name or city"
        className="min-w-[14rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <div className="flex items-center gap-1" role="group" aria-label="Deal status filter">
        {STATUS_CHIPS.map((chip) => {
          const active = filters.statuses.includes(chip.value);
          return (
            <button
              key={chip.value}
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => toggleStatus(chip.value)}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition ' +
                (active ? `ring-2 ring-offset-1 ${chip.classes} ring-current` : chip.classes)
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {availableStates.length > 0 ? (
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
            States {filters.states.length ? `(${filters.states.length})` : ''}
          </summary>
          <div className="absolute z-30 mt-2 grid max-h-64 w-48 grid-cols-3 gap-1 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg">
            {availableStates.map((st) => {
              const active = filters.states.includes(st);
              return (
                <button
                  key={st}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => toggleState(st)}
                  className={
                    'rounded px-2 py-1 text-center ' +
                    (active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
                  }
                >
                  {st}
                </button>
              );
            })}
          </div>
        </details>
      ) : null}

      <div className="flex items-center gap-1 text-xs text-slate-700">
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
          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
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
          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
      </div>

      {filtersActive ? (
        <button
          type="button"
          onClick={resetFilters}
          className="text-xs text-slate-600 underline hover:text-slate-900"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
