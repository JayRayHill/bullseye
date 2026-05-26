// Free-form rep notes attached to a customer. Auto-saves on blur and on a
// 600ms debounce while typing so reps can switch customers without
// losing what they were jotting. Keyed by leadIdentity (email-first,
// zip+name fallback) so notes follow the business across CSV re-uploads.

import { useEffect, useRef, useState } from 'react';
import type { Customer } from '../../types';
import { useNotes } from '../../context/NotesContext';

interface CustomerNotesProps {
  customer: Customer;
}

export function CustomerNotes({ customer }: CustomerNotesProps) {
  const { getNote, setNote } = useNotes();
  // Local input state so the textarea remains a controlled component the
  // user can type into without waiting for the persistence round-trip.
  const persisted = getNote(customer);
  const [draft, setDraft] = useState(persisted);

  // When the active customer changes (or the persisted note is updated
  // outside this component), reset the draft to match. Without this,
  // hopping between customers would carry over the previous draft text.
  useEffect(() => {
    setDraft(persisted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  // Debounced auto-save while typing. 600ms is short enough that reps
  // don't lose work if they tab away mid-thought, long enough to avoid
  // hammering IndexedDB on every keystroke.
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    // Skip the initial render's "save what was already persisted" no-op.
    if (draft === persisted) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setNote(customer, draft);
      saveTimer.current = null;
    }, 600);
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [draft, persisted, customer, setNote]);

  const onBlur = () => {
    // Flush immediately on blur so a quick tab-away still persists.
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (draft !== persisted) setNote(customer, draft);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label
          htmlFor={`customer-note-${customer.id}`}
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Notes
        </label>
        {draft.trim() ? (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            Saved locally · auto-syncs
          </span>
        ) : null}
      </div>
      <textarea
        id={`customer-note-${customer.id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={onBlur}
        placeholder="Anything worth remembering next time — buyer preferences, meeting notes, follow-up timing…"
        rows={3}
        className="mt-1 block w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
      />
    </div>
  );
}
