// The detail panel below the map. Renders the active customer, their
// "additional fields" (preserved from the upload), and the nearby-leads list.
// The heading auto-focuses when a new customer is selected so screen readers
// announce the change and keyboard users can immediately tab into the leads list.

import { useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../context/FiltersContext';
import { useSelection } from '../../context/SelectionContext';
import { useNearbyLeads } from '../../hooks/useNearbyLeads';
import { ActiveCustomerCard } from './ActiveCustomerCard';
import { AdditionalFields } from './AdditionalFields';
import { NearbyLeadsList } from './NearbyLeadsList';

export function DetailPanel() {
  const { dataset, columnMapping } = useData();
  const { filters } = useFilters();
  const { activeCustomerId, clearSelection } = useSelection();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const { leads, active } = useNearbyLeads(
    dataset?.customers ?? [],
    activeCustomerId,
    filters.radiusMiles
  );

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
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
        Click a green or gray pin to see deal details and nearby open leads.
      </div>
    );
  }

  return (
    <section
      role="region"
      aria-live="polite"
      aria-label="Customer details"
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-sm font-medium uppercase tracking-wide text-slate-500 focus:outline-none"
        >
          Customer detail
        </h2>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
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
    </section>
  );
}
