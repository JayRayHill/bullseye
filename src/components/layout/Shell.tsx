// Top-level layout used once a dataset is loaded. Renders header (with reset
// controls), filter bar + radius slider, the map, and the detail panel below.
// On mobile the map and panel stack vertically; on md+ the panel sits beside
// the map for context-while-browsing.

import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useFilteredCustomers } from '../../hooks/useFilteredCustomers';
import { useFilters } from '../../context/FiltersContext';
import { useSelection } from '../../context/SelectionContext';
import { FilterBar } from '../filters/FilterBar';
import { RadiusSlider } from '../controls/RadiusSlider';
import { TerritoryMap } from '../map/TerritoryMap';
import { DetailPanel } from '../panel/DetailPanel';
import { UploadSummary } from '../upload/UploadSummary';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useToast } from '../common/ToastProvider';
import { useFilters as _useFilters } from '../../context/FiltersContext';

export function Shell() {
  const { dataset, uploadErrors, clearDataset } = useData();
  const { filters } = useFilters();
  const { resetFilters } = _useFilters();
  const { clearSelection, activeCustomerId } = useSelection();
  const toast = useToast();
  const filtered = useFilteredCustomers(dataset?.customers ?? [], filters);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!dataset) return null;

  const activeHidden =
    activeCustomerId !== null && !filtered.some((c) => c.id === activeCustomerId);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
              Sales Territory Map
            </h1>
            <p className="text-xs text-slate-600">
              {dataset.customers.length} customer{dataset.customers.length === 1 ? '' : 's'} loaded
              from <span className="font-medium">{dataset.sourceFilename}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RadiusSlider />
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              Upload a different file
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4">
        <FilterBar />

        {uploadErrors.length > 0 ? (
          <UploadSummary dataset={dataset} errors={uploadErrors} />
        ) : null}

        {activeHidden ? (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          >
            The selected customer is currently hidden by your filters. Adjust filters or close
            the panel to dismiss this message.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="h-[60vh] min-h-[24rem] lg:h-[calc(100vh-14rem)]">
            <TerritoryMap customers={filtered} allCustomers={dataset.customers} />
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
          await clearDataset();
          resetFilters();
          toast.show('info', 'Dataset cleared. Upload a new file to continue.');
        }}
      />
    </div>
  );
}
