// Wraps the UploadSummary content in a native <dialog> modal so reps can
// inspect skip-reason breakdown on demand without it taking up vertical
// real estate on the main view. Triggered by clicking the "X skipped"
// chip in the StatsStrip.

import { useEffect, useRef } from 'react';
import type { Dataset, UploadError } from '../../types';
import { UploadSummary } from './UploadSummary';

interface UploadDetailsDialogProps {
  open: boolean;
  dataset: Dataset;
  errors: UploadError[];
  onClose: () => void;
}

export function UploadDetailsDialog({
  open,
  dataset,
  errors,
  onClose,
}: UploadDetailsDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);

  // Standard show/close pattern matching ConfirmDialog. The native dialog
  // element gives us focus trapping, scrim, and Escape-to-close for free.
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Import details
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Why some rows were skipped from {dataset.sourceFilename}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>
      <div className="p-5">
        <UploadSummary dataset={dataset} errors={errors} />
      </div>
    </dialog>
  );
}
