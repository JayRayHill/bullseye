// Root component. Composes providers in order of dependency: Toast → Data →
// Filters → Selection → Upload. The branch between EmptyState and Shell is
// driven entirely by whether a dataset is loaded; the column-mapping modal
// renders on top of either when an upload is in progress.

import { useCallback } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { FiltersProvider } from './context/FiltersContext';
import { SelectionProvider } from './context/SelectionContext';
import { ToastProvider, useToast } from './components/common/ToastProvider';
import { UploadProvider, useUpload } from './components/upload/UploadContext';
import { ColumnMappingForm } from './components/upload/ColumnMappingForm';
import { EmptyState } from './components/common/EmptyState';
import { Shell } from './components/layout/Shell';
import { loadSampleData, SAMPLE_MAPPING } from './lib/sample/loadSampleData';
import { autoDetectColumns } from './lib/parsing/autoDetectColumns';

function AppRoot() {
  const { dataset, hydrated } = useData();
  const { startMapping } = useUpload();
  const toast = useToast();

  const onTrySample = useCallback(async () => {
    try {
      const { headers, rows } = await loadSampleData();
      const auto = autoDetectColumns(headers);
      // Our authored mapping takes precedence; auto-detection fills any gaps.
      const mapping = { ...auto, ...SAMPLE_MAPPING };
      startMapping({
        filename: 'sample-data.csv',
        headers,
        rows,
        autoMapping: mapping,
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Failed to load sample data.';
      toast.show('error', m);
    }
  }, [startMapping, toast]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <>
      {dataset ? <Shell /> : <EmptyState onTrySample={onTrySample} />}
      <ColumnMappingForm />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <FiltersProvider>
          <SelectionProvider>
            <UploadProvider>
              <AppRoot />
            </UploadProvider>
          </SelectionProvider>
        </FiltersProvider>
      </DataProvider>
    </ToastProvider>
  );
}
