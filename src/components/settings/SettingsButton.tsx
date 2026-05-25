// Gear icon that lives in the header. Toggles the SettingsDialog open. The
// SettingsDialog itself is mounted at Shell level so it can also be opened
// programmatically by the campaign drawer.

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open settings"
      title="Settings"
      className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.325 4.317a1.5 1.5 0 013.35 0l.2 1.5a8.04 8.04 0 011.86 1.075l1.41-.575a1.5 1.5 0 011.93.66l1.05 1.82a1.5 1.5 0 01-.36 1.97l-1.18.95a8.05 8.05 0 010 2.15l1.18.95a1.5 1.5 0 01.36 1.97l-1.05 1.82a1.5 1.5 0 01-1.93.66l-1.41-.575a8.04 8.04 0 01-1.86 1.075l-.2 1.5a1.5 1.5 0 01-3.35 0l-.2-1.5a8.04 8.04 0 01-1.86-1.075l-1.41.575a1.5 1.5 0 01-1.93-.66l-1.05-1.82a1.5 1.5 0 01.36-1.97l1.18-.95a8.05 8.05 0 010-2.15l-1.18-.95a1.5 1.5 0 01-.36-1.97l1.05-1.82a1.5 1.5 0 011.93-.66l1.41.575A8.04 8.04 0 019.875 5.82l.45-1.5z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}
