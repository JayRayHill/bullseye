// Tiny cross-cutting loading-bar bus. Any code path that wants to show
// the global top-of-page progress bar dispatches a window event; the
// TopProgressBar component listens. We avoid threading a context through
// the upload flow because the loading bar is purely visual feedback —
// there's no business logic that needs to read or react to it, just
// "show this label" / "hide it."
//
// Usage:
//   showLoadingBar('Parsing your file…');
//   try { ...slow work... } finally { hideLoadingBar(); }

export const LOADING_EVENT = 'bullseye:loading';

export interface LoadingEventDetail {
  visible: boolean;
  label?: string;
}

export function showLoadingBar(label: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<LoadingEventDetail>(LOADING_EVENT, {
      detail: { visible: true, label },
    })
  );
}

export function hideLoadingBar(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<LoadingEventDetail>(LOADING_EVENT, {
      detail: { visible: false },
    })
  );
}
