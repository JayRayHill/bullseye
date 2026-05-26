// NotesContext owns the rep's free-form notes attached to specific customers.
// Same dual-mode pattern as SentHistoryContext:
//   - Supabase mode  — when env vars are set, notes live in the
//                      `customer_notes` table and sync across the team in
//                      realtime. Reps see each other's annotations.
//   - Local mode     — fallback when Supabase isn't configured. Notes stay
//                      in IndexedDB per-browser, as originally shipped.
//
// Notes are keyed by leadIdentity (email-first, zip+name fallback) so they
// follow the business across CSV re-uploads regardless of which rep
// uploaded what.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Customer } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { SCHEMA_VERSION } from '../lib/storage/keys';
import { leadIdentity } from '../lib/email/leadIdentity';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase/client';

const NOTES_KEY = 'bullseye:customer-notes:v1';

export interface CustomerNoteEntry {
  identity: string;
  body: string;
  updatedAt: string;
  customerName: string;
  lastEditedBy?: string;
}

export type CustomerNotes = Record<string, CustomerNoteEntry>;

interface NotesContextValue {
  notes: CustomerNotes;
  hydrated: boolean;
  getNote: (customer: Customer) => string;
  hasNote: (customer: Customer) => boolean;
  /** Save (or clear, if body is empty after trim) the note for a customer.
   *  `editedBy` is the rep's name from Settings — stamped on the row so
   *  other reps can see who wrote what. */
  setNote: (customer: Customer, body: string, editedBy?: string) => void | Promise<void>;
  clearNote: (customer: Customer) => void | Promise<void>;
  clearAll: () => Promise<void>;
  isShared: boolean;
}

interface DbRow {
  id: string;
  lead_identity: string;
  body: string;
  customer_name: string;
  last_edited_by: string;
  updated_at: string;
}

function rowToEntry(row: DbRow): CustomerNoteEntry {
  return {
    identity: row.lead_identity,
    body: row.body,
    updatedAt: row.updated_at,
    customerName: row.customer_name,
    lastEditedBy: row.last_edited_by,
  };
}

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const isShared = isSupabaseConfigured;

  const local = usePersistedState<CustomerNotes>(NOTES_KEY, {}, { version: SCHEMA_VERSION });

  const [shared, setShared] = useState<CustomerNotes>({});
  const [sharedHydrated, setSharedHydrated] = useState(false);
  const lastKnownRepRef = useRef<string>('anonymous');

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const loadAll = async () => {
      const { data, error } = await supabase.from('customer_notes').select('*');
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[notes] initial fetch failed:', error);
        setSharedHydrated(true);
        return;
      }
      const map: CustomerNotes = {};
      for (const row of (data ?? []) as DbRow[]) {
        map[row.lead_identity] = rowToEntry(row);
      }
      setShared(map);
      setSharedHydrated(true);
    };

    void loadAll();

    const channel = supabase
      .channel('customer_notes_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_notes' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const entry = rowToEntry(payload.new as DbRow);
            setShared((prev) => ({ ...prev, [entry.identity]: entry }));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as DbRow;
            setShared((prev) => {
              const next = { ...prev };
              delete next[oldRow.lead_identity];
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const setNote = useCallback(
    async (customer: Customer, body: string, editedBy?: string) => {
      const id = leadIdentity(customer);
      const trimmed = body.trim();
      const recordedBy = editedBy?.trim() || lastKnownRepRef.current || 'anonymous';
      lastKnownRepRef.current = recordedBy;

      if (supabase) {
        if (!trimmed) {
          // Empty body — delete the row to keep the store tidy.
          const { error } = await supabase
            .from('customer_notes')
            .delete()
            .eq('lead_identity', id);
          if (error) {
            // eslint-disable-next-line no-console
            console.error('[notes] delete-on-empty failed:', error);
            return;
          }
          setShared((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          return;
        }
        const now = new Date().toISOString();
        const { error } = await supabase.from('customer_notes').upsert(
          {
            lead_identity: id,
            body: trimmed,
            customer_name: customer.business_name,
            last_edited_by: recordedBy,
            updated_at: now,
          },
          { onConflict: 'lead_identity' }
        );
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[notes] upsert failed:', error);
          return;
        }
        // Optimistic cache update.
        setShared((prev) => ({
          ...prev,
          [id]: {
            identity: id,
            body: trimmed,
            updatedAt: now,
            customerName: customer.business_name,
            lastEditedBy: recordedBy,
          },
        }));
        return;
      }

      // Local mode
      local.setValue((prev) => {
        const next = { ...prev };
        if (!trimmed) {
          if (id in next) delete next[id];
          return next;
        }
        next[id] = {
          identity: id,
          body: trimmed,
          updatedAt: new Date().toISOString(),
          customerName: customer.business_name,
          lastEditedBy: recordedBy,
        };
        return next;
      });
    },
    [supabase, local]
  );

  const clearNote = useCallback(
    async (customer: Customer) => {
      const id = leadIdentity(customer);
      if (supabase) {
        const { error } = await supabase.from('customer_notes').delete().eq('lead_identity', id);
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[notes] clearNote failed:', error);
          return;
        }
        setShared((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      local.setValue((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [supabase, local]
  );

  const clearAll = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.from('customer_notes').delete().not('id', 'is', null);
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[notes] clearAll failed:', error);
        return;
      }
      setShared({});
      return;
    }
    await local.reset();
  }, [supabase, local]);

  const notes = isShared ? shared : local.value;
  const hydrated = isShared ? sharedHydrated : local.hydrated;

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
      clearAll,
      isShared,
    }),
    [notes, hydrated, getNote, hasNote, setNote, clearNote, clearAll, isShared]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used inside NotesProvider');
  return ctx;
}
