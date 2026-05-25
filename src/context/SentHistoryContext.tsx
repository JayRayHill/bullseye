// SentHistoryContext owns the per-browser record of which leads have been
// emailed, used by Phase 2.5 to hard-block re-emailing within the cooldown.
// Persisted in IndexedDB so it survives reloads and CSV re-uploads.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { Customer, EmailTemplate, SentHistory, SentHistoryEntry } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { SCHEMA_VERSION } from '../lib/storage/keys';
import { leadIdentity } from '../lib/email/leadIdentity';
import { isInCooldown } from '../lib/email/sentHistory';

const SENT_HISTORY_KEY = 'stm:sent-history:v1';

export interface RecordSendInput {
  leads: Customer[];
  anchor: Customer;
  template: EmailTemplate;
  method: 'gmail' | 'mailto';
}

interface SentHistoryContextValue {
  history: SentHistory;
  hydrated: boolean;
  recordSent: (input: RecordSendInput) => void;
  clearOne: (identity: string) => void;
  clearAll: () => Promise<void>;
  /** Returns the entry for a customer if one exists (regardless of cooldown). */
  lookup: (customer: Customer) => SentHistoryEntry | undefined;
  /** True iff the lead has an entry AND it's still within the cooldown window. */
  isLeadBlocked: (customer: Customer) => boolean;
}

const SentHistoryContext = createContext<SentHistoryContextValue | undefined>(undefined);

export function SentHistoryProvider({ children }: { children: ReactNode }) {
  const { value: history, setValue, hydrated, reset } = usePersistedState<SentHistory>(
    SENT_HISTORY_KEY,
    {},
    { version: SCHEMA_VERSION }
  );

  const recordSent = useCallback(
    (input: RecordSendInput) => {
      const now = new Date().toISOString();
      setValue((prev) => {
        const next = { ...prev };
        for (const lead of input.leads) {
          const id = leadIdentity(lead);
          next[id] = {
            identity: id,
            emailedAt: now,
            anchorCustomerName: input.anchor.business_name,
            leadBusinessName: lead.business_name,
            templateId: input.template.id,
            sendMethod: input.method,
          };
        }
        return next;
      });
    },
    [setValue]
  );

  const clearOne = useCallback(
    (identity: string) => {
      setValue((prev) => {
        if (!(identity in prev)) return prev;
        const next = { ...prev };
        delete next[identity];
        return next;
      });
    },
    [setValue]
  );

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
      clearAll: reset,
      lookup,
      isLeadBlocked,
    }),
    [history, hydrated, recordSent, clearOne, reset, lookup, isLeadBlocked]
  );

  return <SentHistoryContext.Provider value={value}>{children}</SentHistoryContext.Provider>;
}

export function useSentHistory(): SentHistoryContextValue {
  const ctx = useContext(SentHistoryContext);
  if (!ctx) throw new Error('useSentHistory must be used inside SentHistoryProvider');
  return ctx;
}
