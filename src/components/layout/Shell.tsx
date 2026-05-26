// Top-level layout used once a dataset is loaded. Renders header (logo +
// wordmark + tagline + stats strip), filter bar + radius slider, the map, and
// the detail panel beside it.
//
// Shell also owns the SettingsDialog mount and the CampaignDrawer mount so
// they can be opened from anywhere in the tree (e.g. the campaign drawer
// auto-prompts the settings dialog).

import { lazy, Suspense, useCallback, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useFilteredCustomers } from '../../hooks/useFilteredCustomers';
import { useFilters } from '../../context/FiltersContext';
import { useSelection } from '../../context/SelectionContext';
import { useCampaign } from '../../context/CampaignContext';
import { FilterBar } from '../filters/FilterBar';
import { RadiusSlider } from '../controls/RadiusSlider';
// MapLibre is heavy (~700 KB). Lazy-load the map so the empty state and
// upload flow don't pay for it.
const TerritoryMap = lazy(() =>
  import('../map/TerritoryMap').then((m) => ({ default: m.TerritoryMap }))
);
import { DetailPanel } from '../panel/DetailPanel';
import { UploadSummary } from '../upload/UploadSummary';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useToast } from '../common/ToastProvider';
import { SettingsButton } from '../settings/SettingsButton';
import { SettingsDialog } from '../settings/SettingsDialog';
import { CampaignDrawer } from '../campaign/CampaignDrawer';
import { BullseyeLogo } from '../brand/BullseyeLogo';
import { StatsStrip } from '../brand/StatsStrip';
import { ThemeToggle } from '../brand/ThemeToggle';

export function Shell() {
  const { dataset, uploadErrors, clearDataset } = useData();
  const { filters, resetFilters } = useFilters();
  const { clearSelection, activeCustomerId } = useSelection();
  const { clearSelection: clearCampaign } = useCampaign();
  const toast = useToast();
  const filtered = useFilteredCustomers(dataset?.customers ?? [], filters);

  const [confirmClear, setConfirmClear] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsIntro, setSettingsIntro] = useState<string | undefined>(undefined);

  const promptSettingsFromCampaign = useCallback(() => {
    setSettingsIntro(
      "Before sending, fill in your first name and signature. We use these to personalize every email."
    );
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsIntro(undefined);
  }, []);

  if (!dataset) return null;

  const activeHidden =
    activeCustomerId !== null && !filtered.some((c) => c.id === activeCustomerId);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BullseyeLogo size={32} animated />
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-lg">
                Bullseye Offense
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Every closed deal has a neighbor.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RadiusSlider />
            <ThemeToggle />
            <SettingsButton onClick={() => setSettingsOpen(true)} />
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Replace file
            </button>
          </div>
        </div>
        <StatsStrip dataset={dataset} />
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4">
        <FilterBar />

        {/* Show the upload summary whenever there's a known skip count in
            the persisted dataset, not just when ephemeral per-row errors
            are still in memory. This way the rep sees the breakdown even
            after a page reload — the per-row list collapses but the
            categorical counts remain. */}
        {dataset.totals.invalid > 0 ? (
          <UploadSummary dataset={dataset} errors={uploadErrors} />
        ) : null}

        {activeHidden ? (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
          >
            The selected customer is currently hidden by your filters. Adjust filters or close
            the panel to dismiss this message.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="h-[60vh] min-h-[24rem] lg:h-[calc(100vh-14rem)]">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  Loading map…
                </div>
              }
            >
              <TerritoryMap customers={filtered} allCustomers={dataset.customers} />
            </Suspense>
          </div>
          <div className="lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
            <DetailPanel />
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={confirmClear}
        title="Replace the current dataset?"
        description="This clears your loaded customers from this browser. Filters will be reset."
        confirmLabel="Clear and upload new"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          clearSelection();
          clearCampaign();
          await clearDataset();
          resetFilters();
          toast.show('info', 'Dataset cleared. Upload a new file to continue.');
        }}
      />

      <SettingsDialog open={settingsOpen} onClose={closeSettings} introMessage={settingsIntro} />
      <CampaignDrawer onPromptSettings={promptSettingsFromCampaign} />
    </div>
  );
}
