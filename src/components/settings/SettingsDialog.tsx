// Settings modal. Opens from the header gear icon, also auto-prompted by the
// campaign drawer the first time the rep tries to build a campaign with no
// settings configured. Uses the native <dialog> element for built-in focus
// trapping and Escape-to-close behavior.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useSentHistory } from '../../context/SentHistoryContext';
import { useAuth } from '../../context/AuthContext';
import { EMAIL_TEMPLATES, findTemplate } from '../../lib/email/templates';
import { daysSince, SENT_COOLDOWN_DAYS } from '../../lib/email/sentHistory';

export function SettingsDialog({
  open,
  onClose,
  introMessage,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional banner shown above the form, e.g. when auto-prompted from the campaign drawer. */
  introMessage?: string;
}) {
  const { settings, updateSettings } = useSettings();
  const { history, clearOne, clearAll } = useSentHistory();
  const [firstName, setFirstName] = useState(settings.firstName);
  const [signature, setSignature] = useState(settings.signature);
  const [defaultTemplateId, setDefaultTemplateId] = useState(settings.defaultTemplateId);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Newest entries first so reps see what they just sent at the top.
  const historyEntries = useMemo(
    () =>
      Object.values(history).sort(
        (a, b) => new Date(b.emailedAt).getTime() - new Date(a.emailedAt).getTime()
      ),
    [history]
  );

  // Sync local form state when the dialog opens (so it always reflects the
  // latest persisted values).
  useEffect(() => {
    if (open) {
      setFirstName(settings.firstName);
      setSignature(settings.signature);
      setDefaultTemplateId(settings.defaultTemplateId);
    }
  }, [open, settings]);

  // Open/close the native dialog imperatively.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Intercept the native cancel event (Escape key) so we route through onClose.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
  }, [onClose]);

  const onSave = () => {
    updateSettings({
      firstName: firstName.trim(),
      signature,
      defaultTemplateId,
    });
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Rep settings"
      className="rounded-xl border border-slate-200 bg-white p-0 backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="w-[min(92vw,32rem)] p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your campaign settings</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          These power the merge fields in your outreach emails. Stored only on this device.
        </p>
        {introMessage ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            {introMessage}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="settings-firstname" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              First name <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="settings-firstname"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Marcus"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Used in the <code className="rounded bg-slate-100 px-1 dark:bg-slate-800 dark:text-slate-300">{'{{rep_first_name}}'}</code> merge field.
            </p>
          </div>

          <div>
            <label htmlFor="settings-signature" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Email signature
            </label>
            <textarea
              id="settings-signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={6}
              placeholder={'— Marcus Lee\nSales, Hot Cup Factory\n555-123-4567\nhotcupfactory.com'}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pasted verbatim at the bottom of every email via{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800 dark:text-slate-300">{'{{rep_signature}}'}</code>.
            </p>
          </div>

          <div>
            <label htmlFor="settings-template" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Default template
            </label>
            <select
              id="settings-template"
              value={defaultTemplateId}
              onChange={(e) => setDefaultTemplateId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {EMAIL_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-950/50">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sent history ({historyEntries.length} {historyEntries.length === 1 ? 'entry' : 'entries'})
            </summary>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Leads emailed within the last {SENT_COOLDOWN_DAYS} days are blocked from receiving
              another email. Remove an entry below to re-enable that lead.
            </p>
            {historyEntries.length === 0 ? (
              <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-white p-3 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                No emails sent yet.
              </p>
            ) : (
              <>
                <ul className="mt-3 max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-xs dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-950">
                  {historyEntries.map((entry) => {
                    const days = daysSince(entry.emailedAt);
                    // Manual contacts (phone/text/in-person/other) don't
                    // carry a template id — fall back to a human label
                    // derived from the send method so the row still has
                    // meaningful provenance text.
                    const tmplName = entry.templateId
                      ? findTemplate(entry.templateId).name
                      : entry.sendMethod === 'phone' ? 'Phone call'
                      : entry.sendMethod === 'text' ? 'Text message'
                      : entry.sendMethod === 'in_person' ? 'In-person'
                      : 'Manual touch';
                    const cooldownActive = days < SENT_COOLDOWN_DAYS;
                    return (
                      <li
                        key={entry.identity}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {entry.leadBusinessName}
                          </p>
                          <p className="truncate text-[11px] text-slate-600 dark:text-slate-400">
                            {days === 0 ? 'today' : `${days}d ago`} · {entry.sendMethod} ·{' '}
                            {tmplName} · re: {entry.anchorCustomerName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => clearOne(entry.identity)}
                          className="shrink-0 text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                          title={
                            cooldownActive
                              ? 'Remove this record; lead becomes eligible again.'
                              : 'Cooldown already expired; remove record from history.'
                          }
                        >
                          Mark unsent
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 flex items-center justify-end gap-2">
                  {confirmClearAll ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(false)}
                        className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await clearAll();
                          setConfirmClearAll(false);
                        }}
                        className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
                      >
                        Yes, clear all
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(true)}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Clear all history
                    </button>
                  )}
                </div>
              </>
            )}
          </details>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {/* Sign-out lives at the bottom-left so it's available but not
              competing with the primary save action. Clears the auth
              flag → the AuthGate routes the rep back to SignIn. */}
          <SignOutLink onClose={onClose} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!firstName.trim()}
              className="rounded-md bg-brand-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** Small sign-out link in the SettingsDialog footer. Confirms before
 *  clearing so a stray click doesn't accidentally lock the rep out. */
function SignOutLink({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth();
  const onClick = () => {
    const ok = window.confirm(
      'Sign out of Bullseye Offense? You’ll need the team password to get back in.'
    );
    if (!ok) return;
    onClose();
    signOut();
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-slate-500 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
    >
      Sign out
    </button>
  );
}
