// Renders the column mapping UI shown after a file is parsed. Required fields
// are at the top; optional fields are collapsed by default. The preview at the
// bottom shows how the first 5 rows look under the current mapping so the user
// can validate before committing.

import { useEffect, useMemo, useState } from 'react';
import type { CanonicalField, ColumnMapping } from '../../types';
import { REQUIRED_FIELDS, OPTIONAL_FIELDS } from '../../lib/parsing/autoDetectColumns';
import { PreviewTable } from './PreviewTable';
import { useUpload } from './UploadContext';
import { useData } from '../../context/DataContext';
import { useZipCoords, loadZipCoords } from '../../hooks/useZipCoords';
import { normalizeRows } from '../../lib/parsing/normalizeRow';
import { useToast } from '../common/ToastProvider';

const FIELD_LABELS: Record<CanonicalField, string> = {
  business_name: 'Business name',
  zip: 'Zip code',
  deal_status: 'Deal status (lost flag)',
  deal_close_date: 'Recent deal close date',
  contact_name: 'Contact name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  city: 'City',
  state: 'State',
  deal_value: 'Deal value',
  last_contact_date: 'Last contact date',
};

export function ColumnMappingForm() {
  const { pending, cancelMapping } = useUpload();
  const { setDataset, setColumnMapping, setUploadErrors } = useData();
  const { zipCoords, loading: coordsLoading, error: coordsError } = useZipCoords();
  const toast = useToast();
  const [mapping, setMapping] = useState<ColumnMapping>(pending?.autoMapping ?? {});
  const [busy, setBusy] = useState(false);

  // If the user uploads a new file mid-mapping, reset.
  useEffect(() => {
    setMapping(pending?.autoMapping ?? {});
  }, [pending]);

  // Kick off zip coords load eagerly so confirm is snappy.
  useEffect(() => {
    void loadZipCoords().catch(() => {
      /* error surfaces via useZipCoords */
    });
  }, []);

  const requiredOk = useMemo(
    () => REQUIRED_FIELDS.every((f) => mapping[f]),
    [mapping]
  );

  if (!pending) return null;

  const onConfirm = async () => {
    if (!requiredOk) return;
    if (coordsError) {
      toast.show('error', `Could not load US zip data: ${coordsError}`);
      return;
    }
    if (!zipCoords) {
      // Coords still loading — wait for them.
      try {
        await loadZipCoords();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not load US zip data.';
        toast.show('error', msg);
        return;
      }
    }
    const coords = zipCoords ?? (await loadZipCoords());
    setBusy(true);
    try {
      const { dataset, errors } = normalizeRows(
        pending.rows,
        pending.headers,
        mapping,
        coords,
        pending.filename
      );
      if (dataset.customers.length === 0) {
        toast.show(
          'error',
          `No valid rows. Every row was skipped (${errors.length} errors). Check your column mapping.`
        );
        return;
      }
      setDataset(dataset);
      setColumnMapping(mapping);
      setUploadErrors(errors);
      cancelMapping();
      toast.show(
        'info',
        `Loaded ${dataset.customers.length} customer${dataset.customers.length === 1 ? '' : 's'}` +
          (errors.length > 0 ? ` (${errors.length} skipped).` : '.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Column mapping"
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900">
        <header className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Map your columns</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              We tried to auto-detect each column from{' '}
              <span className="font-medium">{pending.filename}</span>. Adjust if anything looks
              wrong, then load the data.
            </p>
          </div>
          <button
            type="button"
            onClick={cancelMapping}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Cancel upload"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Required</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REQUIRED_FIELDS.map((field) => (
              <FieldSelector
                key={field}
                field={field}
                headers={pending.headers}
                value={mapping[field] ?? null}
                required
                onChange={(v) => setMapping((m) => ({ ...m, [field]: v }))}
              />
            ))}
          </div>

          <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">
            <strong className="font-semibold">Classification:</strong> a row with a positive deal
            value / REAL LTV is a closed customer (green). Everything else is treated as an open
            deal (amber) — a form fill we haven&rsquo;t closed yet. Close date and deal status are
            shown in the detail panel for context but don&rsquo;t change the pin color.
          </p>

          <details className="mt-5 rounded-lg border border-slate-200 p-3 dark:border-slate-800" open>
            <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
              Optional fields
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {OPTIONAL_FIELDS.map((field) => (
                <FieldSelector
                  key={field}
                  field={field}
                  headers={pending.headers}
                  value={mapping[field] ?? null}
                  onChange={(v) => setMapping((m) => ({ ...m, [field]: v }))}
                />
              ))}
            </div>
          </details>

          <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Preview (first 5 rows)
          </h3>
          <PreviewTable rows={pending.rows} mapping={mapping} />
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {coordsLoading ? 'Loading US zip database…' : null}
            {coordsError ? `Zip data error: ${coordsError}` : null}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelMapping}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!requiredOk || busy || coordsLoading || !!coordsError}
              className="rounded-md bg-brand-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {busy ? 'Loading…' : 'Load data'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FieldSelector({
  field,
  headers,
  value,
  onChange,
  required,
}: {
  field: CanonicalField;
  headers: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  required?: boolean;
}) {
  const id = `field-${field}`;
  const missing = required && !value;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
        {FIELD_LABELS[field]}
        {required ? <span className="ml-1 text-red-600 dark:text-red-400">*</span> : null}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={
          'block w-full rounded-md border bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-950 dark:text-slate-100 ' +
          (missing
            ? 'border-red-400 dark:border-red-500'
            : 'border-slate-300 dark:border-slate-700')
        }
      >
        <option value="">{required ? '— select —' : '— unmapped —'}</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}
