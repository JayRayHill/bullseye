// Template tabs at the top of the campaign drawer. Switching tabs discards any
// in-drawer subject/body edits — by design, since edits are scoped to a chosen
// template.

import clsx from 'clsx';
import { EMAIL_TEMPLATES } from '../../lib/email/templates';
import { useCampaign } from '../../context/CampaignContext';

export function TemplatePicker() {
  const { activeTemplateId, setActiveTemplate } = useCampaign();
  return (
    <div role="tablist" aria-label="Email templates" className="flex flex-wrap gap-1">
      {EMAIL_TEMPLATES.map((t) => {
        const active = t.id === activeTemplateId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setActiveTemplate(t.id)}
            className={clsx(
              'flex-1 min-w-[8rem] rounded-md border px-3 py-2 text-left text-xs transition-colors',
              active
                ? 'border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-brand-900/40 dark:text-brand-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
            )}
          >
            <span className="block text-sm font-semibold">{t.name}</span>
            <span className={clsx('block text-xs', active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400')}>
              {t.blurb}
            </span>
          </button>
        );
      })}
    </div>
  );
}
