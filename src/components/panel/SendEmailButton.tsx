// "Send email" trigger on an open lead's active card. Opens the campaign
// drawer with this lead as the single recipient + a resolved closed
// customer as the proof-point anchor.
//
// Anchor resolution (handled by resolveAnchorForLead):
//   1. Prefer the rep's lastAnchorId — the closed customer they were
//      viewing immediately before drilling into this lead. Preserves the
//      "I came from Lone Star Foods" context.
//   2. Fall back to the geographically nearest closed customer. Works for
//      reps who reached this lead via the header search or some other
//      flow with no prior anchor in session memory.
//
// Hidden when:
//   - The lead has no email address (nothing to send to).
//   - The dataset has zero closed customers (no possible anchor).
//   - The lead is already in cooldown — they were contacted recently.
//   The "Mark contacted" button has the same cooldown gate, so the active
//   card's action row is empty in that case and the cooldown badge from
//   elsewhere communicates the state.

import type { Customer } from '../../types';
import { useData } from '../../context/DataContext';
import { useSelection } from '../../context/SelectionContext';
import { useCampaign } from '../../context/CampaignContext';
import { useSentHistory } from '../../context/SentHistoryContext';
import { resolveAnchorForLead } from '../../lib/leads/resolveAnchor';

interface SendEmailButtonProps {
  lead: Customer;
}

export function SendEmailButton({ lead }: SendEmailButtonProps) {
  const { dataset } = useData();
  const { lastAnchorId } = useSelection();
  const { openDrawerForLead } = useCampaign();
  const { isLeadBlocked } = useSentHistory();

  // Cheap guards — return null before touching the dataset for non-leads.
  if (!lead.email) return null;
  if (isLeadBlocked(lead)) return null;
  if (!dataset) return null;

  const anchor = resolveAnchorForLead(lead, dataset.customers, lastAnchorId);
  if (!anchor) return null;

  const onClick = () => {
    openDrawerForLead(lead.id, anchor.id);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Send email to ${lead.business_name} using ${anchor.business_name} as your proof point`}
      className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:bg-brand-600 dark:hover:bg-brand-500"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
      <span>Send email</span>
    </button>
  );
}
