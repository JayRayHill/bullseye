// Renders the sorted list of nearby open leads. Capped at 50 by default with a
// "Show more" button that reveals the rest via @tanstack/react-virtual — keeping
// the panel scannable in dense markets while still surfacing every result on demand.
//
// Each row also has a checkbox that toggles inclusion in the current campaign.
// Selection is held in CampaignContext (ephemeral, per-session).

import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NearbyLead } from '../../hooks/useNearbyLeads';
import { useSelection } from '../../context/SelectionContext';
import { useCampaign } from '../../context/CampaignContext';
import { useSentHistory } from '../../context/SentHistoryContext';
import { daysSince, cooldownExpiry } from '../../lib/email/sentHistory';
import { findTemplate } from '../../lib/email/templates';

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

  const { selectedLeadIds, selectLeads } = useCampaign();
  const { isLeadBlocked } = useSentHistory();
  // "Select all" only selects leads that have an email AND aren't currently
  // cooldowned. Cooldowned leads remain visible (so reps know they exist) but
  // are excluded from bulk-select and from being individually checked.
  const visibleSelectableIds = useMemo(
    () =>
      visible
        .filter((l) => !!l.customer.email && !isLeadBlocked(l.customer))
        .map((l) => l.customer.id),
    [visible, isLeadBlocked]
  );
  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selectedLeadIds.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleSelectableIds.some((id) => selectedLeadIds.has(id));

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        No open leads within {radiusMiles} miles. Try increasing the radius.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {leads.length} open lead{leads.length === 1 ? '' : 's'} within {radiusMiles} mi
        </h4>
        <div className="flex items-center gap-3 text-xs">
          {visibleSelectableIds.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleSelected;
                }}
                onChange={(e) => selectLeads(visibleSelectableIds, e.target.checked)}
                className="h-3.5 w-3.5 accent-brand-700 dark:accent-brand-500"
              />
              Select all
            </label>
          ) : null}
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-100"
            >
              Show {hiddenCount} more
            </button>
          ) : null}
        </div>
      </div>
      {showAll ? (
        <VirtualList leads={visible} />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
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
  const { selectedLeadIds, toggleLead } = useCampaign();
  const { lookup } = useSentHistory();
  const isHover = hoveredId === lead.customer.id;
  const cityState = [lead.customer.city, lead.customer.state].filter(Boolean).join(', ');
  const hasEmail = !!lead.customer.email;
  const isSelected = selectedLeadIds.has(lead.customer.id);

  // Look up dedup state. If the lead was emailed within the cooldown, disable
  // the checkbox and surface a small badge + descriptive tooltip.
  const sentEntry = lookup(lead.customer);
  const blocked = sentEntry ? daysSince(sentEntry.emailedAt) < 30 : false;
  const cooldownReason = blocked && sentEntry
    ? `Emailed ${daysSince(sentEntry.emailedAt)}d ago via ${findTemplate(sentEntry.templateId).name}. Cooldown ends ${cooldownExpiry(sentEntry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
    : null;
  const disabled = !hasEmail || blocked;
  const checkboxTooltip = !hasEmail
    ? 'No email on record'
    : blocked
      ? (cooldownReason ?? 'Already emailed recently')
      : 'Add to campaign';
  const checkboxAriaLabel = !hasEmail
    ? `${lead.customer.business_name} has no email and cannot be added to a campaign`
    : blocked
      ? `${lead.customer.business_name} already emailed; cooldown active`
      : `Add ${lead.customer.business_name} to campaign`;

  // Background priority: hover > selected > blocked > default
  let rowBg: string;
  if (isHover) {
    rowBg = 'bg-amber-50 dark:bg-amber-900/30';
  } else if (isSelected && !blocked) {
    rowBg = 'bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-900/30 dark:ring-brand-800';
  } else if (blocked) {
    rowBg = 'bg-slate-50 dark:bg-slate-900 opacity-70';
  } else {
    rowBg = 'hover:bg-slate-50 dark:hover:bg-slate-800/60';
  }

  return (
    <li
      className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${rowBg}`}
      onMouseEnter={() => setHovered(lead.customer.id)}
      onMouseLeave={() => setHovered(null)}
    >
      <input
        type="checkbox"
        checked={isSelected && !blocked}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onChange={() => toggleLead(lead.customer.id)}
        aria-label={checkboxAriaLabel}
        title={checkboxTooltip}
        className="h-3.5 w-3.5 shrink-0 accent-brand-700 disabled:opacity-30 dark:accent-brand-500"
      />
      <button
        type="button"
        className="flex w-full min-w-0 items-baseline justify-between gap-3 text-left"
        onClick={(e) => {
          e.stopPropagation();
          setActive(lead.customer.id);
        }}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-slate-900 dark:text-slate-100">{lead.customer.business_name}</span>
          {blocked && sentEntry ? (
            <span
              className="ml-2 inline-flex shrink-0 items-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-300"
              title={cooldownReason ?? undefined}
            >
              ✉ emailed {daysSince(sentEntry.emailedAt)}d
            </span>
          ) : null}
          {cityState ? <span className="ml-2 text-slate-600 dark:text-slate-400">{cityState}</span> : null}
        </span>
        <span className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">
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
      className="h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
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
