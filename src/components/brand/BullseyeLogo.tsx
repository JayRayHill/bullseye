// The literal bullseye mark: three concentric rings in the brand green and
// white. Used everywhere we need to express the Bullseye Offense identity —
// header (~28px), empty-state hero (~56px), favicon (24px).
//
// The SVG uses solid hex values (no Tailwind classes inside) so it renders
// correctly inside Leaflet div-icons too, which live outside React's tree.

export function BullseyeLogo({
  size = 28,
  className,
  title = 'Bullseye Offense',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {/* outer ring */}
      <circle cx="16" cy="16" r="15" fill="#0c5f3f" />
      {/* middle white ring */}
      <circle cx="16" cy="16" r="10" fill="#ffffff" />
      {/* inner brand ring */}
      <circle cx="16" cy="16" r="6" fill="#0c5f3f" />
      {/* bullseye dot */}
      <circle cx="16" cy="16" r="2" fill="#ffffff" />
    </svg>
  );
}
