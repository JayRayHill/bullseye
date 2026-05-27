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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Customer, SendMethod } from '../../types';
import { useSentHistory } from '../../context/SentHistoryContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../common/ToastProvider';

interface MarkContactedButtonProps {
  /** Single customer or a list (for bulk-mark from a multi-select). */
  customer: Customer | Customer[];
  /** Optional anchor customer to attach to the record (when "Mark contacted"
   *  fires from inside a nearby-leads list with an active closed customer).
   *  Lets the Settings → sent history view show "called via Lone Star Foods". */
  anchor?: Customer;
  /** Hide the button entirely when the lead is already in cooldown. The
   *  list still shows the cooldown badge from elsewhere. */
  disabled?: boolean;
  /** Visual variant of the trigger:
   *  - "icon"   — small icon-only button (default; used inside lead-list rows).
   *  - "button" — full button with text + chevron (used in the active-customer
   *               card and the bulk-action sticky bar). */
  variant?: 'icon' | 'button';
  /** Label override for the "button" variant. Defaults to "Mark contacted"
   *  for one customer, "Mark N as contacted" for multiple. */
  label?: string;
}

// Stroke-icon set matching the rest of the app's icon language (the Settings
// gear, search magnifier, theme toggle). Emojis clashed visually — they have
// their own color and style that didn't fit the monochrome outline-icon
// vocabulary the rest of the UI uses.

function StrokeIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const PhoneIcon = () => (
  <StrokeIcon>
    <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.105a2.25 2.25 0 00-2.276.583l-.997.997a17.275 17.275 0 01-6.197-6.197l.997-.997a2.25 2.25 0 00.583-2.276L6.43 3.602A1.125 1.125 0 005.339 2.75H3.967A2.25 2.25 0 001.717 5v1.75z" />
  </StrokeIcon>
);

const ChatBubbleIcon = () => (
  <StrokeIcon>
    <path d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </StrokeIcon>
);

const UsersIcon = () => (
  <StrokeIcon>
    <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </StrokeIcon>
);

const PencilIcon = () => (
  <StrokeIcon>
    <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </StrokeIcon>
);

const METHODS: { method: SendMethod; label: string; icon: ReactNode }[] = [
  { method: 'phone', label: 'Called', icon: <PhoneIcon /> },
  { method: 'text', label: 'Texted', icon: <ChatBubbleIcon /> },
  { method: 'in_person', label: 'Met in person', icon: <UsersIcon /> },
  { method: 'other', label: 'Other touch', icon: <PencilIcon /> },
];

export function MarkContactedButton({
  customer,
  anchor,
  disabled,
  variant = 'icon',
  label,
}: MarkContactedButtonProps) {
  const { recordSent } = useSentHistory();
  const { settings } = useSettings();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Normalize single/multi into a list so the rest of the component doesn't
  // care which form the caller passed.
  const customers = Array.isArray(customer) ? customer : [customer];
  const count = customers.length;

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

  const onPick = async (method: SendMethod, methodLabel: string) => {
    setOpen(false);
    await recordSent({
      leads: customers,
      anchor,
      method,
      recordedBy: settings.firstName,
    });
    // Tailor the toast copy to single vs bulk so the rep sees what actually
    // happened.
    if (count === 1) {
      toast.show(
        'info',
        `${methodLabel} ${customers[0].business_name}. Added to sent history.`
      );
    } else {
      toast.show(
        'info',
        `${methodLabel} ${count} leads. All added to sent history.`
      );
    }
  };

  if (disabled || count === 0) return null;

  const buttonLabel =
    label ?? (count === 1 ? 'Mark contacted' : `Mark ${count} as contacted`);

  return (
    <div ref={ref} className="relative">
      {variant === 'icon' ? (
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
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.105a2.25 2.25 0 00-2.276.583l-.997.997a17.275 17.275 0 01-6.197-6.197l.997-.997a2.25 2.25 0 00.583-2.276L6.43 3.602A1.125 1.125 0 005.339 2.75H3.967A2.25 2.25 0 001.717 5v1.75z"
            />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <PhoneIcon />
          <span>{buttonLabel}</span>
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5l3 3 3-3" />
          </svg>
        </button>
      )}

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
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="text-slate-500 dark:text-slate-400">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
