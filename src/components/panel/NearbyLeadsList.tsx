// Renders the sorted list of nearby open leads. Capped at 50 by default with a
// "Show more" button that reveals the rest via @tanstack/react-virtual — keeping
// the panel scannable in dense markets while still surfacing every result on demand.

import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NearbyLead } from '../../hooks/useNearbyLeads';
import { useSelection } from '../../context/SelectionContext';

const DEFAULT_CAP = 50;

export function NearbyLeadsList({
  leads,
  radiusMiles,
}: {
  leads: NearbyLead[];
  radiusMiles: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? leads : leads.slice(0, DEFAULT_CAP);
  const hiddenCount = leads.length - visible.length;

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No open leads within {radiusMiles} miles. Try increasing the radius.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-slate-900">
          {leads.length} open lead{leads.length === 1 ? '' : 's'} within {radiusMiles} mi
        </h4>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs font-medium text-blue-700 hover:text-blue-900"
          >
            Show {hiddenCount} more
          </button>
        ) : null}
      </div>
      {showAll ? (
        <VirtualList leads={visible} />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {visible.map((lead) => (
            <LeadRow key={lead.customer.id} lead={lead} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadRow({ lead }: { lead: NearbyLead }) {
  const { setActive, setHovered, hoveredId } = useSelection();
  const isHover = hoveredId === lead.customer.id;
  const cityState = [lead.customer.city, lead.customer.state].filter(Boolean).join(', ');
  return (
    <li
      className={
        'cursor-pointer px-3 py-2 text-sm transition-colors ' +
        (isHover ? 'bg-amber-50' : 'hover:bg-slate-50')
      }
      onMouseEnter={() => setHovered(lead.customer.id)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => setActive(lead.customer.id)}
    >
      <button
        type="button"
        className="flex w-full items-baseline justify-between gap-3 text-left"
        onClick={(e) => {
          e.stopPropagation();
          setActive(lead.customer.id);
        }}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-slate-900">{lead.customer.business_name}</span>
          {cityState ? <span className="ml-2 text-slate-600">{cityState}</span> : null}
        </span>
        <span className="shrink-0 font-mono text-xs text-slate-500">
          {lead.distanceMiles.toFixed(1)} mi
        </span>
      </button>
    </li>
  );
}

function VirtualList({ leads }: { leads: NearbyLead[] }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });
  return (
    <div
      ref={parentRef}
      className="h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const lead = leads[vi.index];
          return (
            <div
              key={lead.customer.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <LeadRow lead={lead} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
