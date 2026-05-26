// The "send" footer. Two paths:
//
// 1. Send via Gmail — opens one or more Gmail compose tabs with the BCC list.
//    The body is rendered in `genericLead` mode so per-lead tokens collapse
//    (one body goes to every recipient).
//
// 2. Open mailto, one at a time — surfaces a stepper. Each click opens the
//    next lead's mailto: with FULL per-lead personalization. The rep returns
//    after sending and clicks "Next" to advance.

import { useMemo, useRef, useState } from 'react';
import type { Customer, RepSettings } from '../../types';
import type { NearbyLead } from '../../hooks/useNearbyLeads';
import { findTemplate } from '../../lib/email/templates';
import { fillMergeFields } from '../../lib/email/mergeFields';
import {
  buildGmailComposeUrls,
  buildMailtoUrl,
  GMAIL_BCC_LIMIT,
} from '../../lib/email/composeUrls';
import { useCampaign } from '../../context/CampaignContext';
import { useSentHistory } from '../../context/SentHistoryContext';
import { useToast } from '../common/ToastProvider';
import { isValidEmail } from '../../lib/email/validation';

interface SendActionsProps {
  selectedLeads: NearbyLead[];
  anchor: Customer;
  settings: RepSettings;
}

export function SendActions({ selectedLeads, anchor, settings }: SendActionsProps) {
  const { activeTemplateId, customizedSubject, customizedBody } = useCampaign();
  const { recordSent } = useSentHistory();
  const toast = useToast();
  const [stepperIndex, setStepperIndex] = useState<number | null>(null);
  // Track which leads we've already recorded in the current stepper run so a
  // Re-open doesn't double-record and a Next on the same lead is idempotent.
  const recordedRef = useRef<Set<string>>(new Set());

  const template = findTemplate(activeTemplateId);
  const composedTemplate = {
    subject: customizedSubject ?? template.subject,
    body: customizedBody ?? template.body,
  };

  // Pre-flight categorization — each selected lead falls into exactly one
  // bucket so the rep gets a clear "X going, Y skipped (why)" breakdown
  // BEFORE the send happens. Replaces the older flat "X recipients ready"
  // message that hid the reasons rows were dropped.
  const preflight = useMemo(() => {
    const valid: NearbyLead[] = [];
    const invalidFormat: NearbyLead[] = [];
    const missingEmail: NearbyLead[] = [];
    for (const lead of selectedLeads) {
      const raw = lead.customer.email?.trim();
      if (!raw) {
        missingEmail.push(lead);
      } else if (!isValidEmail(raw)) {
        invalidFormat.push(lead);
      } else {
        valid.push(lead);
      }
    }
    return { valid, invalidFormat, missingEmail };
  }, [selectedLeads]);

  const recipientEmails = useMemo(
    () =>
      preflight.valid
        .map((l) => l.customer.email)
        .filter((e): e is string => !!e),
    [preflight]
  );

  const onSendGmail = () => {
    if (recipientEmails.length === 0 || !preflight.valid[0]) return;
    const first = preflight.valid[0];
    const filled = fillMergeFields(composedTemplate, {
      lead: first.customer,
      anchor,
      distanceMiles: first.distanceMiles,
      settings,
      mode: 'genericLead',
    });
    const batches = buildGmailComposeUrls({
      bcc: recipientEmails,
      subject: filled.subject,
      body: filled.body,
    });
    for (const batch of batches) {
      window.open(batch.url, '_blank', 'noopener');
    }
    // Record only the leads we actually opened in Gmail (valid emails). Reps
    // can clear false records in Settings if they abandoned a compose tab.
    const sentCustomers = preflight.valid.map((l) => l.customer);
    recordSent({
      leads: sentCustomers,
      anchor,
      template,
      method: 'gmail',
      recordedBy: settings.firstName,
    });
    if (batches.length > 1) {
      toast.show(
        'info',
        `Opened ${batches.length} Gmail tabs (Gmail caps each send at ${GMAIL_BCC_LIMIT} recipients).`
      );
    } else {
      toast.show('info', `Opened Gmail with ${recipientEmails.length} recipients in BCC.`);
    }
  };

  const onStartMailtoStepper = () => {
    // Stepper only walks the leads with deliverable emails — no point opening
    // a mailto with a blank/garbage `to:` field.
    if (preflight.valid.length === 0) return;
    recordedRef.current = new Set();
    setStepperIndex(0);
    openMailtoForIndex(0);
  };

  /** Record the given lead as sent unless we've already recorded it in this
   *  stepper session (covers Re-open clicks and accidental double-Next). */
  const recordIfUnseen = (lead: NearbyLead) => {
    if (recordedRef.current.has(lead.customer.id)) return;
    recordedRef.current.add(lead.customer.id);
    recordSent({
      leads: [lead.customer],
      anchor,
      template,
      method: 'mailto',
      recordedBy: settings.firstName,
    });
  };

  const openMailtoForIndex = (i: number) => {
    const lead = preflight.valid[i];
    if (!lead || !lead.customer.email) return;
    const filled = fillMergeFields(composedTemplate, {
      lead: lead.customer,
      anchor,
      distanceMiles: lead.distanceMiles,
      settings,
      mode: 'perLead',
    });
    const url = buildMailtoUrl({
      to: lead.customer.email,
      subject: filled.subject,
      body: filled.body,
    });
    // Tiny delay before opening helps avoid double-popup blocks if the user
    // clicked rapidly after a previous send.
    window.setTimeout(() => {
      window.location.href = url;
    }, 50);
  };

  const onNext = () => {
    if (stepperIndex === null) return;
    // Record the lead we just sent before advancing. If the rep skipped past
    // someone without actually sending, they can clear it from Settings.
    const justSent = preflight.valid[stepperIndex];
    if (justSent) recordIfUnseen(justSent);
    const next = stepperIndex + 1;
    if (next >= preflight.valid.length) {
      setStepperIndex(null);
      toast.show('info', `Stepped through ${preflight.valid.length} leads. Nice work.`);
      return;
    }
    setStepperIndex(next);
    openMailtoForIndex(next);
  };

  if (stepperIndex !== null) {
    const lead = preflight.valid[stepperIndex];
    const progressPct = ((stepperIndex + 1) / preflight.valid.length) * 100;
    return (
      <div className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
        {/* Progress bar across the top of the stepper. */}
        <div className="h-1 w-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
          <div
            className="h-1 bg-brand-700 transition-[width] duration-200 dark:bg-brand-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Lead {stepperIndex + 1} of {preflight.valid.length}
          </p>
          <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
            {lead?.customer.business_name} —{' '}
            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{lead?.customer.email}</span>
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Sent it? Click <strong>Next lead</strong>. Skipping is fine.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openMailtoForIndex(stepperIndex)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Re-open this email
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {stepperIndex + 1 >= preflight.valid.length ? 'Finish' : 'Next lead →'}
            </button>
            <button
              type="button"
              onClick={() => setStepperIndex(null)}
              className="ml-auto text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-flight summary — show before the send buttons so reps know exactly
  // what they're about to do. The breakdown explains every dropped lead so
  // surprises ("why did Gmail only get 8 of 12?") disappear.
  const totalSelected = selectedLeads.length;
  const noneSendable = preflight.valid.length === 0;

  return (
    <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Pre-flight check
        </p>
        <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
          {noneSendable ? (
            <>
              <span className="font-semibold">0 of {totalSelected}</span> ready to send.
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums">{preflight.valid.length}</span>
              {' '}of <span className="tabular-nums">{totalSelected}</span> ready to send.
            </>
          )}
        </p>
        {preflight.invalidFormat.length > 0 || preflight.missingEmail.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
            {preflight.missingEmail.length > 0 ? (
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-0.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-slate-400" />
                <span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                    {preflight.missingEmail.length}
                  </span>{' '}
                  skipped — no email on file
                </span>
              </li>
            ) : null}
            {preflight.invalidFormat.length > 0 ? (
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-0.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
                <span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                    {preflight.invalidFormat.length}
                  </span>{' '}
                  skipped — invalid email format
                  {preflight.invalidFormat.length <= 3 ? (
                    <span className="ml-1 text-slate-500 dark:text-slate-500">
                      ({preflight.invalidFormat
                        .map((l) => l.customer.business_name)
                        .join(', ')})
                    </span>
                  ) : null}
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {noneSendable ? (
        <p className="text-xs text-amber-900 dark:text-amber-300">
          None of the selected leads have a deliverable email address. Add or fix emails in your data and reselect.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSendGmail}
              className="rounded-md bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              Send via Gmail (BCC)
            </button>
            <button
              type="button"
              onClick={onStartMailtoStepper}
              className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open mailto, one at a time
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gmail BCC sends one body to everyone — per-lead names collapse to &ldquo;your business&rdquo; etc.
            Mailto fully personalizes each email but opens one window at a time.
          </p>
        </>
      )}
    </div>
  );
}
