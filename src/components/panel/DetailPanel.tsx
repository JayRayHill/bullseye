// The detail panel below the map. Renders the active customer, their
// "additional fields" (preserved from the upload), and the nearby-leads list.
// The heading auto-focuses when a new customer is selected so screen readers
// announce the change and keyboard users can immediately tab into the leads list.

import { useEffect, useMemo, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../context/FiltersContext';
import { useSelection } from '../../context/SelectionContext';
import { useCampaign } from '../../context/CampaignContext';
import { useSentHistory } from '../../context/SentHistoryContext';
import { useNearbyLeads } from '../../hooks/useNearbyLeads';
import { ActiveCustomerCard } from './ActiveCustomerCard';
import { AdditionalFields } from './AdditionalFields';
import { NearbyLeadsList } from './NearbyLeadsList';

export function DetailPanel() {
  const { dataset, columnMapping } = useData();
  const { filters } = useFilters();
  const { activeCustomerId, clearSelection } = useSelection();
  const { selectedLeadIds, openDrawer } = useCampaign();
  const { isLeadBlocked } = useSentHistory();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const { leads, active } = useNearbyLeads(
    dataset?.customers ?? [],
    activeCustomerId,
    filters.radiusMiles
  );

  // Only count leads that aren't cooldowned — the sticky bar should match what
  // the campaign drawer will actually let the rep send to.
  const selectionCount = useMemo(() => {
    let count = 0;
    for (const lead of leads) {
      if (selectedLeadIds.has(lead.customer.id) && !isLeadBlocked(lead.customer)) {
        count++;
      }
    }
    return count;
  }, [leads, selectedLeadIds, isLeadBlocked]);

  // Move focus to the heading on selection change for screen readers + keyboard.
  useEffect(() => {
    if (active && headingRef.current) headingRef.current.focus();
  }, [active]);

  // Escape clears the selection.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, clearSelection]);

  if (!active || !dataset) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Click a green or gray pin on the map to see deal details and nearby open leads.
      </div>
    );
  }

  return (
    <section
      // `key` re-fires the CSS mount animation when the active customer
      // changes, not just when the panel first appears. The cinematic
      // intent is "each new selection feels like a new panel" — which
      // matches the radius-circle / staggered-pin choreography on the map.
      key={active.id}
      role="region"
      aria-live="polite"
      aria-label="Customer details"
      className="stm-panel-enter space-y-4 rounded-xl border border-slate-200 border-l-4 border-l-brand-700 bg-white p-5 shadow-sm dark:border-slate-800 dark:border-l-brand-500 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xs font-semibold uppercase tracking-wide text-brand-700 focus:outline-none dark:text-brand-300"
        >
          Customer detail
        </h2>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close detail panel"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>
      <ActiveCustomerCard customer={active} />
      <AdditionalFields customer={active} mapping={columnMapping} headers={dataset.headers} />
      <NearbyLeadsList leads={leads} radiusMiles={filters.radiusMiles} />
      {selectionCount > 0 ? (
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 border-t border-brand-100 bg-brand-50/90 px-5 py-3 backdrop-blur dark:border-brand-900 dark:bg-brand-950/80">
          <button
            type="button"
            onClick={openDrawer}
            className="flex w-full items-center justify-between rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <span>
              Build campaign ({selectionCount} selected)
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
