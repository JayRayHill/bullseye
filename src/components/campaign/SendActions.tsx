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

  const recipientEmails = useMemo(
    () => selectedLeads.map((l) => l.customer.email).filter((e): e is string => !!e),
    [selectedLeads]
  );

  const onSendGmail = () => {
    if (recipientEmails.length === 0 || !selectedLeads[0]) return;
    const first = selectedLeads[0];
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
    // Record every recipient that actually had an email address. The rep can
    // clear false records in Settings if they abandoned the compose tab.
    const sentCustomers = selectedLeads
      .filter((l) => !!l.customer.email)
      .map((l) => l.customer);
    recordSent({ leads: sentCustomers, anchor, template, method: 'gmail' });
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
    if (selectedLeads.length === 0) return;
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
    });
  };

  const openMailtoForIndex = (i: number) => {
    const lead = selectedLeads[i];
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
    const justSent = selectedLeads[stepperIndex];
    if (justSent) recordIfUnseen(justSent);
    const next = stepperIndex + 1;
    if (next >= selectedLeads.length) {
      setStepperIndex(null);
      toast.show('info', `Stepped through ${selectedLeads.length} leads. Nice work.`);
      return;
    }
    setStepperIndex(next);
    openMailtoForIndex(next);
  };

  if (stepperIndex !== null) {
    const lead = selectedLeads[stepperIndex];
    const progressPct = ((stepperIndex + 1) / selectedLeads.length) * 100;
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
            Lead {stepperIndex + 1} of {selectedLeads.length}
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
              {stepperIndex + 1 >= selectedLeads.length ? 'Finish' : 'Next lead →'}
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

  const skipped = selectedLeads.length - recipientEmails.length;

  return (
    <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      {recipientEmails.length === 0 ? (
        <p className="text-xs text-amber-900 dark:text-amber-300">
          None of the selected leads have an email address on file. Add emails to your data and reselect.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {recipientEmails.length} recipient{recipientEmails.length === 1 ? '' : 's'} ready.
            {skipped > 0 ? ` (${skipped} skipped — no email on file.)` : null}
          </p>
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
