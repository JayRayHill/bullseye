// The right-side drawer that houses the campaign builder. It re-uses the
// already-running selection + nearby-leads pipeline: anchor = the currently
// active customer, leads = the subset within the active radius that are also
// in the campaign selection.
//
// If the rep opens the drawer with empty settings, we auto-prompt the
// SettingsDialog (the dialog is mounted at Shell level — we just signal up).
//
// Mount + slide pattern: we render the drawer DOM as soon as drawerOpen flips
// true, but apply the open transform on the next frame so the CSS transition
// animates from off-screen → on-screen. On close, we drop the transform first,
// then unmount after the transition finishes.

import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../context/FiltersContext';
import { useSelection } from '../../context/SelectionContext';
import { useCampaign } from '../../context/CampaignContext';
import { useSettings } from '../../context/SettingsContext';
import { useSentHistory } from '../../context/SentHistoryContext';
import { useNearbyLeads } from '../../hooks/useNearbyLeads';
import { SENT_COOLDOWN_DAYS } from '../../lib/email/sentHistory';
import { BullseyeLogo } from '../brand/BullseyeLogo';
import { TemplatePicker } from './TemplatePicker';
import { EmailPreview } from './EmailPreview';
import { SendActions } from './SendActions';

const TRANSITION_MS = 200;

export function CampaignDrawer({ onPromptSettings }: { onPromptSettings: () => void }) {
  const { dataset } = useData();
  const { filters } = useFilters();
  const { activeCustomerId } = useSelection();
  const { drawerOpen, closeDrawer, selectedLeadIds, clearSelection } = useCampaign();
  const { settings, isConfigured } = useSettings();
  const { isLeadBlocked } = useSentHistory();

  // Two-phase animation state: `mounted` controls DOM presence, `entered`
  // toggles the slid-in transform. Together they give us animated open/close
  // without depending on an animation library.
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (drawerOpen) {
      setMounted(true);
      // Allow the initial off-screen render to commit before applying the
      // open transform, so the browser actually animates the transition.
      const id = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(id);
    }
    setEntered(false);
    const id = window.setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => window.clearTimeout(id);
  }, [drawerOpen]);

  const { leads, active } = useNearbyLeads(
    dataset?.customers ?? [],
    activeCustomerId,
    filters.radiusMiles
  );

  // Defensive filter: even though the leads list disables checkboxes for
  // cooldowned leads, a multi-tab race could let a lead enter cooldown after
  // it was already selected. We drop those here and show a small notice.
  const { selectedLeads, excludedCount } = useMemo(() => {
    const matching = leads.filter((l) => selectedLeadIds.has(l.customer.id));
    const eligible = matching.filter((l) => !isLeadBlocked(l.customer));
    return {
      selectedLeads: eligible,
      excludedCount: matching.length - eligible.length,
    };
  }, [leads, selectedLeadIds, isLeadBlocked]);

  // Auto-prompt the SettingsDialog the first time the drawer opens with empty
  // settings. Runs once per drawer open.
  useEffect(() => {
    if (drawerOpen && !isConfigured) onPromptSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[1500] flex">
      {/* Scrim — fades in/out with the drawer. */}
      <button
        type="button"
        aria-label="Close campaign drawer"
        onClick={closeDrawer}
        className={`flex-1 bg-slate-900/40 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Outreach campaign"
        className={`flex h-full w-full max-w-[34rem] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 ${entered ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <BullseyeLogo size={28} />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Build campaign
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {active ? (
                  <>
                    Using <span className="font-medium text-brand-700 dark:text-brand-300">{active.business_name}</span> as your proof point.
                  </>
                ) : (
                  'Pick a closed customer on the map first.'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close drawer"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>

        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-600 dark:text-slate-400">
            Select a closed customer on the map first, then come back here.
          </div>
        ) : selectedLeads.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {excludedCount > 0 ? (
              <>
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                  All {excludedCount} selected lead{excludedCount === 1 ? '' : 's'} {excludedCount === 1 ? 'was' : 'were'} excluded — already emailed in the last {SENT_COOLDOWN_DAYS} days.
                </p>
                <p className="text-xs">
                  Pick different leads from the nearby-leads list. Cooldowned leads show an
                  &ldquo;✉ emailed&rdquo; badge.
                </p>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Clear selection
                </button>
              </>
            ) : (
              <p>No leads selected. Check the boxes in the nearby-leads list to add them.</p>
            )}
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Pick a template
                </h3>
                {!isConfigured ? (
                  <button
                    type="button"
                    onClick={onPromptSettings}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                  >
                    Set up rep settings →
                  </button>
                ) : null}
              </div>
              <div className="mt-2">
                <TemplatePicker />
              </div>
            </div>
            <EmailPreview
              firstLead={selectedLeads[0].customer}
              anchor={active}
              distanceMiles={selectedLeads[0].distanceMiles}
              settings={settings}
            />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Recipients ({selectedLeads.length})
              </h3>
              {excludedCount > 0 ? (
                <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                  {excludedCount} lead{excludedCount === 1 ? '' : 's'} excluded — already emailed
                  in the last {SENT_COOLDOWN_DAYS} days.
                </p>
              ) : null}
              <ul className="mt-2 max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white text-xs dark:border-slate-800 dark:bg-slate-950">
                {selectedLeads.map((l) => (
                  <li
                    key={l.customer.id}
                    className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 last:border-b-0 dark:border-slate-800"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {l.customer.business_name}
                      </span>
                      {l.customer.email ? (
                        <span className="ml-2 font-mono text-slate-600 dark:text-slate-400">
                          {l.customer.email}
                        </span>
                      ) : (
                        <span className="ml-2 text-amber-700 dark:text-amber-300">(no email)</span>
                      )}
                    </span>
                    <span className="shrink-0 text-slate-500 dark:text-slate-400">
                      {l.distanceMiles.toFixed(1)} mi
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={clearSelection}
                className="mt-2 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        {active && selectedLeads.length > 0 ? (
          <SendActions selectedLeads={selectedLeads} anchor={active} settings={settings} />
        ) : null}
      </aside>
    </div>
  );
}
