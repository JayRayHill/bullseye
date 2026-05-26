// Sticky indeterminate progress bar at the top of the viewport. Driven by
// the LOADING_EVENT custom event so any file-parsing or row-normalizing
// code can call showLoadingBar / hideLoadingBar without prop drilling.
//
// Indeterminate (not %-based) on purpose: PapaParse exposes per-chunk
// callbacks but SheetJS XLSX parsing is opaque, and the rep doesn't
// actually care about precision — they care that "something is
// happening." A continuous sliding-chunk animation answers that question
// honestly.

import { useEffect, useState } from 'react';
import { LOADING_EVENT, type LoadingEventDetail } from '../../lib/loading';

export function TopProgressBar() {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');

  useEffect(() => {
    const onLoading = (e: Event) => {
      const detail = (e as CustomEvent<LoadingEventDetail>).detail;
      setVisible(detail.visible);
      if (detail.visible && detail.label) setLabel(detail.label);
      // Don't clear the label on hide — we leave it set so any brief
      // animation tail or focus shift doesn't flash an empty pill.
    };
    window.addEventListener(LOADING_EVENT, onLoading);
    return () => window.removeEventListener(LOADING_EVENT, onLoading);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center"
    >
      <div className="relative h-[6px] w-full overflow-hidden bg-brand-200/70 shadow-sm dark:bg-brand-900/60">
        <div className="stm-top-progress-chunk absolute inset-y-0 w-2/5 rounded-full bg-brand-700 dark:bg-brand-400" />
      </div>
      {label ? (
        <div className="mt-2 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur dark:bg-slate-100/90 dark:text-slate-900">
          {label}
        </div>
      ) : null}
    </div>
  );
}
