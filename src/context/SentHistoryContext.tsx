// SentHistoryContext owns the record of which leads have been contacted —
// either by emailing (gmail/mailto), or via the "Mark contacted" UI for
// out-of-band touches (phone/text/in-person/other). Used by the cooldown
// system to hard-block re-contacting within 30 days.
//
// Two storage modes (transparent to callers):
//   - Supabase mode  — when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are
//                      set. Reads + writes go to the `sent_history` table,
//                      and a realtime subscription keeps every rep's
//                      browser in sync within ~500ms of any change. This
//                      is what enables team-wide cooldown ("Sarah called
//                      this lead yesterday — Marcus can't email today").
//   - Local mode     — when those vars aren't set. Falls back to
//                      usePersistedState (IndexedDB), same single-rep
//                      behavior as before. Useful for local dev and as
//                      a graceful fallback if Supabase is unreachable
//                      at startup.
//
// The internal cache is always `Record<lead_identity, latest_entry>`. When
// multiple contact events exist for the same lead in Supabase (Sarah today,
// Sarah again next month), the latest one wins for cooldown purposes.

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
import type { Customer, EmailTemplate, SendMethod, SentHistory, SentHistoryEntry } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { SCHEMA_VERSION } from '../lib/storage/keys';
import { leadIdentity } from '../lib/email/leadIdentity';
import { isInCooldown } from '../lib/email/sentHistory';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase/client';

const SENT_HISTORY_KEY = 'stm:sent-history:v1';

export interface RecordSendInput {
  leads: Customer[];
  /** Closed customer the contact was made about. Optional for manual contacts
   *  (Mark contacted from a lead row) where there's no anchor. */
  anchor?: Customer;
  /** Template used. Optional for manual contacts. */
  template?: EmailTemplate;
  method: SendMethod;
  /** Name of the rep recording this. Falls back to "anonymous" if absent. */
  recordedBy?: string;
}

interface SentHistoryContextValue {
  history: SentHistory;
  hydrated: boolean;
  recordSent: (input: RecordSendInput) => void | Promise<void>;
  clearOne: (identity: string) => void | Promise<void>;
  clearAll: () => Promise<void>;
  lookup: (customer: Customer) => SentHistoryEntry | undefined;
  isLeadBlocked: (customer: Customer) => boolean;
  /** True if writes are going to the shared Supabase backend (team mode).
   *  Useful for UI hints like "synced with team" or for the Settings dialog
   *  to mention shared state. */
  isShared: boolean;
}

const SentHistoryContext = createContext<SentHistoryContextValue | undefined>(undefined);

/** Map a Supabase `sent_history` row to the in-memory SentHistoryEntry shape. */
interface DbRow {
  id: string;
  lead_identity: string;
  lead_business_name: string;
  anchor_customer_name: string | null;
  template_id: string | null;
  send_method: SendMethod;
  recorded_by: string;
  emailed_at: string;
}

function rowToEntry(row: DbRow): SentHistoryEntry {
  return {
    identity: row.lead_identity,
    emailedAt: row.emailed_at,
    anchorCustomerName: row.anchor_customer_name ?? undefined,
    leadBusinessName: row.lead_business_name,
    templateId: row.template_id ?? undefined,
    sendMethod: row.send_method,
    recordedBy: row.recorded_by,
  };
}

/** Pick the most recent entry per lead_identity. */
function collapseToLatest(rows: DbRow[]): SentHistory {
  const out: SentHistory = {};
  for (const row of rows) {
    const entry = rowToEntry(row);
    const existing = out[entry.identity];
    if (!existing || new Date(entry.emailedAt) > new Date(existing.emailedAt)) {
      out[entry.identity] = entry;
    }
  }
  return out;
}

export function SentHistoryProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const isShared = isSupabaseConfigured;

  // Local-mode storage. Always declared (hooks must run unconditionally) but
  // only USED when Supabase isn't configured. usePersistedState's reset()
  // works for both modes — in shared mode, we'll TRUNCATE the table instead.
  const local = usePersistedState<SentHistory>(SENT_HISTORY_KEY, {}, { version: SCHEMA_VERSION });

  // Shared-mode in-memory cache. Mirrors Supabase but only the latest entry
  // per lead so cooldown checks are O(1).
  const [shared, setShared] = useState<SentHistory>({});
  const [sharedHydrated, setSharedHydrated] = useState(false);
  // Track current "recordedBy" for fallback if a write happens without it.
  // Updated from outside via the recordSent call site — kept here for the
  // clear-history flows that don't pass a rep name.
  const lastKnownRepRef = useRef<string>('anonymous');

  // ---- Bootstrap shared mode: initial fetch + realtime subscription ----
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const loadAll = async () => {
      const { data, error } = await supabase
        .from('sent_history')
        .select('*')
        .order('emailed_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        // Surface to console + toast. Cooldown system still works from an
        // empty local state, but the rep needs to know the team data
        // isn't loading.
        // eslint-disable-next-line no-console
        console.error('[sent-history] initial fetch failed:', error);
        window.dispatchEvent(
          new CustomEvent('bullseye:supabase-error', {
            detail: { op: 'sent_history.fetch', message: error.message },
          })
        );
        setSharedHydrated(true);
        return;
      }
      setShared(collapseToLatest((data ?? []) as DbRow[]));
      setSharedHydrated(true);
    };

    void loadAll();

    const channel = supabase
      .channel('sent_history_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sent_history' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const entry = rowToEntry(payload.new as DbRow);
            setShared((prev) => {
              const existing = prev[entry.identity];
              if (existing && new Date(existing.emailedAt) >= new Date(entry.emailedAt)) {
                // Older event reordered; keep the newer one in cache.
                return prev;
              }
              return { ...prev, [entry.identity]: entry };
            });
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as DbRow;
            // Re-fetch the latest entry for this lead (in case there were
            // multiple historical entries and we only deleted one).
            void supabase
              .from('sent_history')
              .select('*')
              .eq('lead_identity', oldRow.lead_identity)
              .order('emailed_at', { ascending: false })
              .limit(1)
              .then(({ data }) => {
                setShared((prev) => {
                  const next = { ...prev };
                  if (data && data.length > 0) {
                    next[oldRow.lead_identity] = rowToEntry(data[0] as DbRow);
                  } else {
                    delete next[oldRow.lead_identity];
                  }
                  return next;
                });
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

  // ---- Public mutators (dispatch to shared OR local based on config) ----

  const recordSent = useCallback(
    async (input: RecordSendInput) => {
      const recordedBy = input.recordedBy?.trim() || lastKnownRepRef.current || 'anonymous';
      lastKnownRepRef.current = recordedBy;
      const now = new Date().toISOString();

      if (supabase) {
        const rows = input.leads.map((lead) => ({
          lead_identity: leadIdentity(lead),
          lead_business_name: lead.business_name,
          anchor_customer_name: input.anchor?.business_name ?? null,
          template_id: input.template?.id ?? null,
          send_method: input.method,
          recorded_by: recordedBy,
          emailed_at: now,
        }));
        const { error } = await supabase.from('sent_history').insert(rows);
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[sent-history] insert failed:', error);
          // Surface to the rep too — silent failures were making team-mode
          // breakage invisible. Dispatching a window event so the toast can
          // be shown without coupling the context to the toast provider.
          window.dispatchEvent(
            new CustomEvent('bullseye:supabase-error', {
              detail: {
                op: 'sent_history.insert',
                message: error.message,
              },
            })
          );
          return;
        }
        // Optimistic cache update so the UI reacts immediately instead of
        // waiting for the realtime echo.
        setShared((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            next[row.lead_identity] = {
              identity: row.lead_identity,
              emailedAt: row.emailed_at,
              anchorCustomerName: row.anchor_customer_name ?? undefined,
              leadBusinessName: row.lead_business_name,
              templateId: row.template_id ?? undefined,
              sendMethod: row.send_method,
              recordedBy: row.recorded_by,
            };
          }
          return next;
        });
        return;
      }

      // Local mode
      local.setValue((prev) => {
        const next = { ...prev };
        for (const lead of input.leads) {
          const id = leadIdentity(lead);
          next[id] = {
            identity: id,
            emailedAt: now,
            anchorCustomerName: input.anchor?.business_name,
            leadBusinessName: lead.business_name,
            templateId: input.template?.id,
            sendMethod: input.method,
            recordedBy: recordedBy,
          };
        }
        return next;
      });
    },
    [supabase, local]
  );

  const clearOne = useCallback(
    async (identity: string) => {
      if (supabase) {
        const { error } = await supabase
          .from('sent_history')
          .delete()
          .eq('lead_identity', identity);
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[sent-history] delete failed:', error);
          return;
        }
        setShared((prev) => {
          const next = { ...prev };
          delete next[identity];
          return next;
        });
        return;
      }
      local.setValue((prev) => {
        if (!(identity in prev)) return prev;
        const next = { ...prev };
        delete next[identity];
        return next;
      });
    },
    [supabase, local]
  );

  const clearAll = useCallback(async () => {
    if (supabase) {
      // Delete every row. Using a where-clause that always matches lets us
      // pass RLS without needing a service role key.
      const { error } = await supabase.from('sent_history').delete().not('id', 'is', null);
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[sent-history] clearAll failed:', error);
        return;
      }
      setShared({});
      return;
    }
    await local.reset();
  }, [supabase, local]);

  // ---- Read helpers (memoized; cache changes drive re-renders) ----

  const history = isShared ? shared : local.value;
  const hydrated = isShared ? sharedHydrated : local.hydrated;

  const lookup = useCallback(
    (customer: Customer) => history[leadIdentity(customer)],
    [history]
  );

  const isLeadBlocked = useCallback(
    (customer: Customer) => {
      const entry = history[leadIdentity(customer)];
      return !!entry && isInCooldown(entry);
    },
    [history]
  );

  const value = useMemo<SentHistoryContextValue>(
    () => ({
      history,
      hydrated,
      recordSent,
      clearOne,
      clearAll,
      lookup,
      isLeadBlocked,
      isShared,
    }),
    [history, hydrated, recordSent, clearOne, clearAll, lookup, isLeadBlocked, isShared]
  );

  return <SentHistoryContext.Provider value={value}>{children}</SentHistoryContext.Provider>;
}

export function useSentHistory(): SentHistoryContextValue {
  const ctx = useContext(SentHistoryContext);
  if (!ctx) throw new Error('useSentHistory must be used inside SentHistoryProvider');
  return ctx;
}
