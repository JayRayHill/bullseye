// Small "Mark contacted" button shown on each nearby-lead row. Lets a rep
// record an out-of-band touch (phone, text, in-person) so the lead enters
// the same shared cooldown that an email send would. Shared via
// SentHistoryContext → Supabase when team mode is configured, so as soon
// as Sarah marks a lead "Called" the lead's pin turns pink for Marcus too.
//
// UX: click the button to reveal a small inline method picker. Pick a
// method → it records immediately and the picker collapses. No
// confirmation dialog — easy to undo from Settings → Sent history if
// someone misclicks.

import { useEffect, useRef, useState } from 'react';
import type { Customer, SendMethod } from '../../types';
import { useSentHistory } from '../../context/SentHistoryContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../common/ToastProvider';

interface MarkContactedButtonProps {
  customer: Customer;
  /** Optional anchor customer to attach to the record (when "Mark contacted"
   *  fires from inside a nearby-leads list with an active closed customer).
   *  Lets the Settings → sent history view show "called via Lone Star Foods". */
  anchor?: Customer;
  /** Hide the button entirely when the lead is already in cooldown. The
   *  list still shows the cooldown badge from elsewhere. */
  disabled?: boolean;
}

const METHODS: { method: SendMethod; label: string; icon: string }[] = [
  { method: 'phone', label: 'Called', icon: '📞' },
  { method: 'text', label: 'Texted', icon: '💬' },
  { method: 'in_person', label: 'Met in person', icon: '🤝' },
  { method: 'other', label: 'Other touch', icon: '✏️' },
];

export function MarkContactedButton({
  customer,
  anchor,
  disabled,
}: MarkContactedButtonProps) {
  const { recordSent } = useSentHistory();
  const { settings } = useSettings();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Click outside / Esc to close the picker.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onPick = async (method: SendMethod, label: string) => {
    setOpen(false);
    await recordSent({
      leads: [customer],
      anchor,
      method,
      recordedBy: settings.firstName,
    });
    toast.show(
      'info',
      `${label} ${customer.business_name}. Added to sent history.`
    );
  };

  if (disabled) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Mark this lead as contacted (phone, text, in-person…)"
        className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        {/* Phone-with-dots glyph — quick visual cue for "log a touch". */}
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.105a2.25 2.25 0 00-2.276.583l-.997.997a17.275 17.275 0 01-6.197-6.197l.997-.997a2.25 2.25 0 00.583-2.276L6.43 3.602A1.125 1.125 0 005.339 2.75H3.967A2.25 2.25 0 001.717 5v1.75z"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Mark contacted
          </div>
          {METHODS.map((m) => (
            <button
              key={m.method}
              type="button"
              role="menuitem"
              onClick={() => void onPick(m.method, m.label)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span aria-hidden="true" className="text-base leading-none">
                {m.icon}
              </span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
