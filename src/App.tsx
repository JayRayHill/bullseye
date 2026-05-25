// Root component. Composes providers in order of dependency:
//   Toast → Data → Filters → Selection → Settings → Campaign → SentHistory → Upload.
// CampaignProvider depends on Settings (for the default template id) so it sits
// just below it via a tiny wrapper component that reads settings synchronously.
// SentHistoryProvider sits between Campaign and Upload so the campaign drawer
// and the leads list can both read/write the dedup log.

import { useCallback, type ReactNode } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { FiltersProvider } from './context/FiltersContext';
import { SelectionProvider } from './context/SelectionContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { CampaignProvider } from './context/CampaignContext';
import { SentHistoryProvider } from './context/SentHistoryContext';
import { ToastProvider, useToast } from './components/common/ToastProvider';
import { UploadProvider, useUpload } from './components/upload/UploadContext';
import { ColumnMappingForm } from './components/upload/ColumnMappingForm';
import { EmptyState } from './components/common/EmptyState';
import { Shell } from './components/layout/Shell';
import { loadSampleData, SAMPLE_MAPPING } from './lib/sample/loadSampleData';
import { autoDetectColumns } from './lib/parsing/autoDetectColumns';

function CampaignWithDefaultTemplate({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  return (
    <CampaignProvider defaultTemplateId={settings.defaultTemplateId}>
      {children}
    </CampaignProvider>
  );
}

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
            <SettingsProvider>
              <CampaignWithDefaultTemplate>
                <SentHistoryProvider>
                  <UploadProvider>
                    <AppRoot />
                  </UploadProvider>
                </SentHistoryProvider>
              </CampaignWithDefaultTemplate>
            </SettingsProvider>
          </SelectionProvider>
        </FiltersProvider>
      </DataProvider>
    </ToastProvider>
  );
}
