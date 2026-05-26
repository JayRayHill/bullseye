// Root component. Composes providers in order of dependency:
//   Toast → Data → Filters → Selection → Settings → Campaign → SentHistory → Notes → Upload.
// CampaignProvider depends on Settings (for the default template id) so it sits
// just below it via a tiny wrapper component that reads settings synchronously.
// SentHistoryProvider sits between Campaign and Notes so the campaign drawer
// and the leads list can both read/write the dedup log. NotesProvider is
// independent — sits anywhere below DataProvider — but we nest it close to
// the other per-customer persistence providers for cohesion.

import { type ReactNode } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { FiltersProvider } from './context/FiltersContext';
import { SelectionProvider } from './context/SelectionContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { CampaignProvider } from './context/CampaignContext';
import { SentHistoryProvider } from './context/SentHistoryContext';
import { NotesProvider } from './context/NotesContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/common/ToastProvider';
import { UploadProvider } from './components/upload/UploadContext';
import { ColumnMappingForm } from './components/upload/ColumnMappingForm';
import { EmptyState } from './components/common/EmptyState';
import { Shell } from './components/layout/Shell';

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

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <>
      {dataset ? <Shell /> : <EmptyState />}
      <ColumnMappingForm />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DataProvider>
          <FiltersProvider>
            <SelectionProvider>
              <SettingsProvider>
                <CampaignWithDefaultTemplate>
                  <SentHistoryProvider>
                    <NotesProvider>
                      <UploadProvider>
                        <AppRoot />
                      </UploadProvider>
                    </NotesProvider>
                  </SentHistoryProvider>
                </CampaignWithDefaultTemplate>
              </SettingsProvider>
            </SelectionProvider>
          </FiltersProvider>
        </DataProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
