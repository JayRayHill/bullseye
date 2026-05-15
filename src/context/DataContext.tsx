// DataContext owns the parsed dataset, the last-used column mapping, and the
// upload errors from the most recent ingestion. The dataset and mapping are
// persisted in IndexedDB; upload errors are not (they are re-derivable from the
// source file). We split this from filters and selection so the heavy "all
// customers" object does not trigger re-renders on every keystroke.

import { createContext, useContext, useMemo, useCallback, useState, type ReactNode } from 'react';
import type { ColumnMapping, Dataset, UploadError } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { STORAGE_KEYS, SCHEMA_VERSION } from '../lib/storage/keys';

interface DataContextValue {
  dataset: Dataset | null;
  columnMapping: ColumnMapping;
  uploadErrors: UploadError[];
  hydrated: boolean;
  setDataset: (next: Dataset) => void;
  setColumnMapping: (next: ColumnMapping) => void;
  setUploadErrors: (next: UploadError[]) => void;
  clearDataset: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const datasetState = usePersistedState<Dataset | null>(STORAGE_KEYS.dataset, null, {
    version: SCHEMA_VERSION,
  });
  const mappingState = usePersistedState<ColumnMapping>(STORAGE_KEYS.columnMapping, {}, {
    version: SCHEMA_VERSION,
  });
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);

  const clearDataset = useCallback(async () => {
    await datasetState.reset();
    setUploadErrors([]);
  }, [datasetState]);

  const value = useMemo<DataContextValue>(
    () => ({
      dataset: datasetState.value,
      columnMapping: mappingState.value,
      uploadErrors,
      hydrated: datasetState.hydrated && mappingState.hydrated,
      setDataset: datasetState.setValue,
      setColumnMapping: mappingState.setValue,
      setUploadErrors,
      clearDataset,
    }),
    [datasetState, mappingState, uploadErrors, clearDataset]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
