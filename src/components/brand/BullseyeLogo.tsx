// The literal bullseye mark: three concentric rings in the brand green and
// white. Used everywhere we need to express the Bullseye Offense identity —
// header (~28px), empty-state hero (~56px), favicon (24px).
//
// The SVG uses solid hex values (no Tailwind classes inside) so it renders
// correctly inside Leaflet div-icons too, which live outside React's tree.
//
// `animated` opts the rings into a staggered scale-in on mount (outer ring
// first, then middle, then inner, then dot — each with a subtle overshoot).
// We gate it with a module-level flag so it only ever fires once per page
// session — re-renders of the header logo don't re-animate. The flag is
// reset on full page reload, which is correct: a fresh visit deserves a
// fresh brand moment.

let hasPlayedLogoIntro = false;

export function BullseyeLogo({
  size = 28,
  className,
  title = 'Bullseye Offense',
  animated = false,
}: {
  size?: number;
  className?: string;
  title?: string;
  animated?: boolean;
}) {
  const shouldAnimate = animated && !hasPlayedLogoIntro;
  if (shouldAnimate) hasPlayedLogoIntro = true;
  const ringClass = shouldAnimate ? 'stm-bullseye-ring' : undefined;
  const svg = (
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
      <circle
        cx="16"
        cy="16"
        r="15"
        fill="#0c5f3f"
        className={ringClass}
        style={shouldAnimate ? { animationDelay: '0ms' } : undefined}
      />
      {/* middle white ring */}
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="#ffffff"
        className={ringClass}
        style={shouldAnimate ? { animationDelay: '140ms' } : undefined}
      />
      {/* inner brand ring */}
      <circle
        cx="16"
        cy="16"
        r="6"
        fill="#0c5f3f"
        className={ringClass}
        style={shouldAnimate ? { animationDelay: '280ms' } : undefined}
      />
      {/* bullseye dot */}
      <circle
        cx="16"
        cy="16"
        r="2"
        fill="#ffffff"
        className={ringClass}
        style={shouldAnimate ? { animationDelay: '420ms' } : undefined}
      />
    </svg>
  );
  return svg;
}
