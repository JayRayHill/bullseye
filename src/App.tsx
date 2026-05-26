// Root component. Composes providers in order of dependency:
//   Theme → Auth → Toast → Data → Filters → Selection → Settings → Campaign
//                                                   → SentHistory → Notes → Upload.
// AuthProvider sits as high as possible so the SignIn gate doesn't need
// any of the data-layer providers loaded. Everything below the gate
// only renders once the rep is signed in.

import { type ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { FiltersProvider } from './context/FiltersContext';
import { SelectionProvider } from './context/SelectionContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { CampaignProvider } from './context/CampaignContext';
import { SentHistoryProvider } from './context/SentHistoryContext';
import { NotesProvider } from './context/NotesContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/common/ToastProvider';
import { TopProgressBar } from './components/common/TopProgressBar';
import { SupabaseErrorToast } from './components/common/SupabaseErrorToast';
import { UploadProvider } from './components/upload/UploadContext';
import { ColumnMappingForm } from './components/upload/ColumnMappingForm';
import { EmptyState } from './components/common/EmptyState';
import { Shell } from './components/layout/Shell';
import { SignIn } from './components/auth/SignIn';

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

/** Renders the SignIn gate when not authed; otherwise lets the full
 *  provider stack mount. TopProgressBar lives at the very top so it
 *  works during sign-in too (theoretical — sign-in itself has no slow
 *  work — but cheap insurance). */
function AuthGate() {
  const { isAuthed } = useAuth();
  if (!isAuthed) {
    return (
      <>
        <SignIn />
        <TopProgressBar />
      </>
    );
  }
  return (
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
      <TopProgressBar />
      <SupabaseErrorToast />
    </ToastProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}
