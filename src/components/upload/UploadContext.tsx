// Coordinates a multi-step upload flow: dropzone parses the file → mapping form
// renders → user confirms → normalization runs → DataContext is updated. We keep
// this in a small dedicated context so the dropzone and the mapping modal can
// communicate without prop-drilling and without polluting DataContext with
// transient in-flight state.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ColumnMapping, RawRow } from '../../types';
import type { ColumnAlternates } from '../../lib/parsing/autoDetectColumns';

export interface PendingUpload {
  filename: string;
  headers: string[];
  rows: RawRow[];
  autoMapping: ColumnMapping;
  /** Per-field secondary candidate columns (ranked by fill rate). Used by
   *  normalizeRow to recover values when the primary mapped column is empty
   *  for a specific row. */
  alternates: ColumnAlternates;
}

interface UploadContextValue {
  pending: PendingUpload | null;
  startMapping: (pending: PendingUpload) => void;
  cancelMapping: () => void;
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const startMapping = useCallback((p: PendingUpload) => setPending(p), []);
  const cancelMapping = useCallback(() => setPending(null), []);
  const value = useMemo(() => ({ pending, startMapping, cancelMapping }), [pending, startMapping, cancelMapping]);
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used inside UploadProvider');
  return ctx;
}
