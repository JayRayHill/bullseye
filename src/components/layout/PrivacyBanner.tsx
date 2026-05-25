// Privacy reassurance copy. Renders the same wording in two places (empty
// state and dropzone), so we centralize it here.
//
// Two variants:
//   - card  (default): the boxed, slightly louder version
//   - inline:          a single-line, quiet variant used inside the empty state hero

export const PRIVACY_BODY =
  "Your data stays on your device. This app processes files entirely in your browser and stores everything in your browser's local database. No data is sent to any server.";

export function PrivacyBanner({
  className,
  variant = 'card',
}: {
  className?: string;
  variant?: 'card' | 'inline';
}) {
  if (variant === 'inline') {
    return (
      <p
        role="note"
        className={`text-center text-xs text-slate-500 dark:text-slate-400 ${className ?? ''}`}
      >
        <span className="mx-2">· Your data stays on your device ·</span>
        <span className="mx-2">Nothing is sent to any server ·</span>
      </p>
    );
  }
  return (
    <div
      role="note"
      className={`rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100 ${className ?? ''}`}
    >
      <strong className="font-semibold">Private by design.</strong> {PRIVACY_BODY}
    </div>
  );
}
