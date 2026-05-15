// Privacy reassurance copy. Renders the same wording in two places (empty state
// and dropzone), so we centralize it here.

export const PRIVACY_BODY =
  "Your data stays on your device. This app processes files entirely in your browser and stores everything in your browser's local database. No data is sent to any server.";

export function PrivacyBanner({ className }: { className?: string }) {
  return (
    <div
      className={
        'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ' +
        (className ?? '')
      }
      role="note"
    >
      <strong className="font-semibold">Private by design.</strong> {PRIVACY_BODY}
    </div>
  );
}
