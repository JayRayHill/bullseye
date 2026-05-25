// Renders the active template with merge fields filled in against the FIRST
// selected lead. A small "Edit" toggle swaps the rendered preview for textareas
// so the rep can tweak subject and body before sending; edits live in
// CampaignContext and persist for the current campaign only.

import { useState } from 'react';
import type { Customer, RepSettings } from '../../types';
import { findTemplate } from '../../lib/email/templates';
import { fillMergeFields } from '../../lib/email/mergeFields';
import { useCampaign } from '../../context/CampaignContext';

export function EmailPreview({
  firstLead,
  anchor,
  distanceMiles,
  settings,
}: {
  firstLead: Customer;
  anchor: Customer;
  distanceMiles: number;
  settings: RepSettings;
}) {
  const {
    activeTemplateId,
    customizedSubject,
    customizedBody,
    setCustomizedSubject,
    setCustomizedBody,
    resetCustomizations,
  } = useCampaign();
  const [editing, setEditing] = useState(false);

  const template = findTemplate(activeTemplateId);
  const filled = fillMergeFields(
    {
      subject: customizedSubject ?? template.subject,
      body: customizedBody ?? template.body,
    },
    { lead: firstLead, anchor, distanceMiles, settings, mode: 'perLead' }
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Preview — personalized for {firstLead.business_name}
        </p>
        <div className="flex items-center gap-2 text-xs">
          {(customizedSubject !== null || customizedBody !== null) && !editing ? (
            <button
              type="button"
              onClick={resetCustomizations}
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Reset
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-100"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>
      {editing ? (
        <div className="space-y-3 p-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Subject</label>
            <input
              type="text"
              value={customizedSubject ?? template.subject}
              onChange={(e) => setCustomizedSubject(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Body</label>
            <textarea
              value={customizedBody ?? template.body}
              onChange={(e) => setCustomizedBody(e.target.value)}
              rows={10}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Merge fields: <code className="dark:text-slate-300">{'{{lead_first_name}}'}</code>,{' '}
              <code className="dark:text-slate-300">{'{{lead_business}}'}</code>, <code className="dark:text-slate-300">{'{{nearby_customer}}'}</code>,{' '}
              <code className="dark:text-slate-300">{'{{nearby_customer_city}}'}</code>, <code className="dark:text-slate-300">{'{{distance}}'}</code>,{' '}
              <code className="dark:text-slate-300">{'{{rep_first_name}}'}</code>, <code className="dark:text-slate-300">{'{{rep_signature}}'}</code>.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 p-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{filled.subject}</p>
          <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-sans text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {filled.body}
          </pre>
        </div>
      )}
    </div>
  );
}
