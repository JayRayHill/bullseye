// Displays the recognized fields for the active customer at the top of the panel.
// We render in a forgiving way — every optional field is omitted if absent rather
// than rendered as an empty row.

import type { Customer } from '../../types';

function StatusBadge({ status }: { status: Customer['deal_status'] }) {
  const styles =
    status === 'closed'
      ? 'bg-brand-100 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100'
      : status === 'lost'
        ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
  const label = status === 'closed' ? 'Closed' : status === 'lost' ? 'Lost' : 'Open';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles}`}>{label}</span>;
}

export function ActiveCustomerCard({ customer }: { customer: Customer }) {
  const cityState = [customer.city, customer.state].filter(Boolean).join(', ');
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{customer.business_name}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {cityState ? `${cityState} ` : ''}
            <span className="font-mono text-xs text-slate-500 dark:text-slate-500">ZIP {customer.zip}</span>
          </p>
        </div>
        <StatusBadge status={customer.deal_status} />
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {customer.contact_name ? (
          <Row label="Contact" value={customer.contact_name} />
        ) : null}
        {customer.email ? <Row label="Email" value={customer.email} /> : null}
        {customer.phone ? <Row label="Phone" value={customer.phone} /> : null}
        {customer.address ? <Row label="Address" value={customer.address} /> : null}
        {customer.deal_value !== undefined ? (
          <Row label="Deal value" value={formatCurrency(customer.deal_value)} />
        ) : null}
        {customer.deal_close_date ? (
          <Row label="Closed on" value={formatDate(customer.deal_close_date)} />
        ) : null}
        {customer.last_contact_date ? (
          <Row label="Last contact" value={formatDate(customer.last_contact_date)} />
        ) : null}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    // min-w-0 lets the column shrink so long values (emails, addresses)
    // wrap inside their cell instead of bleeding into the next column.
    // break-words allows the browser to break long unbroken strings.
    <div className="min-w-0 text-sm">
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="break-words text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function formatCurrency(n: number): string {
  try {
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  } catch {
    return `$${n}`;
  }
}

function formatDate(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
