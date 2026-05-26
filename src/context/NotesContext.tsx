// NotesContext owns the rep's free-form notes attached to specific
// customers. Persisted in IndexedDB so notes survive reloads AND CSV
// re-uploads (we key by leadIdentity, not the row-derived customer.id).
//
// Use cases:
//   - "Met them at NRA show, interested in 16oz cups"
//   - "Their buyer prefers email over phone"
//   - "Send follow-up after Q1 budget cycle"
//
// Anything the rep would otherwise scribble in a separate doc.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { Customer } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { SCHEMA_VERSION } from '../lib/storage/keys';
import { leadIdentity } from '../lib/email/leadIdentity';

const NOTES_KEY = 'bullseye:customer-notes:v1';

export interface CustomerNoteEntry {
  identity: string;
  body: string;
  updatedAt: string;
  customerName: string; // captured so notes are recognizable after data swaps
}

export type CustomerNotes = Record<string, CustomerNoteEntry>;

interface NotesContextValue {
  notes: CustomerNotes;
  hydrated: boolean;
  /** Returns the note body for a customer, or '' if none exists. */
  getNote: (customer: Customer) => string;
  /** Whether this customer has a non-empty note attached. */
  hasNote: (customer: Customer) => boolean;
  /** Save (or clear, if body is empty after trim) the note for a customer. */
  setNote: (customer: Customer, body: string) => void;
  /** Delete the note for a specific customer. */
  clearNote: (customer: Customer) => void;
  /** Wipe every note (used by Settings → "Clear all notes"). */
  clearAll: () => Promise<void>;
}

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const { value: notes, setValue, hydrated, reset } = usePersistedState<CustomerNotes>(
    NOTES_KEY,
    {},
    { version: SCHEMA_VERSION }
  );

  const setNote = useCallback(
    (customer: Customer, body: string) => {
      const id = leadIdentity(customer);
      const trimmed = body.trim();
      setValue((prev) => {
        const next = { ...prev };
        if (!trimmed) {
          // Empty body = delete entry. Keeps the store tidy.
          if (id in next) delete next[id];
          return next;
        }
        next[id] = {
          identity: id,
          body: trimmed,
          updatedAt: new Date().toISOString(),
          customerName: customer.business_name,
        };
        return next;
      });
    },
    [setValue]
  );

  const clearNote = useCallback(
    (customer: Customer) => {
      const id = leadIdentity(customer);
      setValue((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [setValue]
  );

  const getNote = useCallback(
    (customer: Customer) => notes[leadIdentity(customer)]?.body ?? '',
    [notes]
  );

  const hasNote = useCallback(
    (customer: Customer) => !!notes[leadIdentity(customer)]?.body,
    [notes]
  );

  const value = useMemo<NotesContextValue>(
    () => ({
      notes,
      hydrated,
      getNote,
      hasNote,
      setNote,
      clearNote,
      clearAll: reset,
    }),
    [notes, hydrated, getNote, hasNote, setNote, clearNote, reset]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used inside NotesProvider');
  return ctx;
}
