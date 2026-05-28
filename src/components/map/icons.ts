// Bullseye Offense pin language for MapLibre. We keep the SVG strings as pure
// functions and load each variant into the map via `map.addImage` so symbol
// layers can render them as native (GPU-accelerated) markers.
//
// Pin shapes:
//   - closed (brand): concentric rings — literal bullseye
//   - lost:           gray pin with X
//   - lead:           amber teardrop
//
// Hover variants are pre-registered too; the layer's icon-image expression
// switches by feature-state.

import type { Map as MapLibreMap } from 'maplibre-gl';

const BRAND_700 = '#0c5f3f';
const BRAND_300 = '#74d2a4';
const LOST_GRAY = '#6b7280';
const LOST_GRAY_LIGHT = '#9ca3af';
// Brand light-blue for open-lead pins. (History: amber #f59e0b →
// coral #ef8b55 → this baby blue.) Constant renamed to LEAD_BLUE to
// match the current color.
const LEAD_BLUE = '#bee4f3';
// Deeper blue from the same hue family, used for the lead pin's inner dot.
// The fill is pale enough that a white dot (like the closed/lost pins use)
// would vanish — this gives the teardrop a visible center while keeping
// the white outer stroke as the map-popping halo.
const LEAD_BLUE_DARK = '#3a9bd1';
// Soft brand pink for leads that have already been contacted (i.e. there's
// a sent-history entry within the cooldown window). Makes the "I've
// already emailed this one" state visible from the map without needing
// to open the nearby-leads list and read the cooldown badge.
const LEAD_CONTACTED_PINK = '#f59bb9';
const WHITE = '#ffffff';

// We render to a transparent 64×64 canvas for retina; report the logical size
// to addImage via pixelRatio: 2 so MapLibre treats the icon as 32px on screen.
const PIXEL_RATIO = 2;
const LOGICAL_SIZE = 32;
const RENDER_SIZE = LOGICAL_SIZE * PIXEL_RATIO; // 64

function bullseyeRings(hover: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGICAL_SIZE}" height="${LOGICAL_SIZE}" viewBox="0 0 32 32">
    ${hover ? `<circle cx="16" cy="16" r="15" fill="none" stroke="${BRAND_300}" stroke-width="3" opacity="0.85"/>` : ''}
    <circle cx="16" cy="16" r="14" fill="${BRAND_700}" stroke="${WHITE}" stroke-width="2"/>
    <circle cx="16" cy="16" r="9" fill="${WHITE}"/>
    <circle cx="16" cy="16" r="5" fill="${BRAND_700}"/>
    <circle cx="16" cy="16" r="1.6" fill="${WHITE}"/>
  </svg>`;
}

// Teardrop path natural extent is y=0..32. With a 2px stroke, the stroke
// half (1px) at y=0 actually renders at y=-1..1 — and y=-1 is OUTSIDE the
// 0..32 viewBox, so the top pixel of the stroke gets clipped (visible as a
// flat-cut pin top). Same story at the bottom. We shift the path down by 1
// and scale vertically by 30/32 so the stroke fits cleanly inside the
// viewBox top + bottom. Tiny ~6% vertical shrink — imperceptible.
const VERT_FIT = 30 / 32; // 0.9375

function lostPin(darkTile: boolean, hover: boolean): string {
  const fill = darkTile ? LOST_GRAY_LIGHT : LOST_GRAY;
  const scale = hover ? 1.1 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGICAL_SIZE}" height="${LOGICAL_SIZE}" viewBox="0 0 32 32">
    <g transform="translate(${(32 - 24 * scale) / 2}, 1) scale(${scale}, ${scale * VERT_FIT})">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0z" fill="${fill}" stroke="${WHITE}" stroke-width="2"/>
      <path d="M9 9l6 6M15 9l-6 6" stroke="${WHITE}" stroke-width="2" stroke-linecap="round"/>
    </g>
  </svg>`;
}

function leadPin(hover: boolean, contacted = false): string {
  const scale = hover ? 1.1 : 1;
  const fill = contacted ? LEAD_CONTACTED_PINK : LEAD_BLUE;
  // Pink (contacted) keeps the white dot for contrast; pale blue needs the
  // deeper-blue dot so the center reads against the light fill.
  const dot = contacted ? WHITE : LEAD_BLUE_DARK;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGICAL_SIZE}" height="${LOGICAL_SIZE}" viewBox="0 0 32 32">
    <g transform="translate(${(32 - 24 * scale) / 2}, 1) scale(${scale}, ${scale * VERT_FIT})">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0z" fill="${fill}" stroke="${WHITE}" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="${dot}"/>
    </g>
  </svg>`;
}

/** Image registry — name → SVG string. Exported for the lead HTML markers too. */
export const PIN_SVGS = {
  'pin-closed': bullseyeRings(false),
  'pin-closed-hover': bullseyeRings(true),
  'pin-lost': lostPin(false, false),
  'pin-lost-hover': lostPin(false, true),
  'pin-lost-dark': lostPin(true, false),
  'pin-lost-dark-hover': lostPin(true, true),
  'pin-lead': leadPin(false),
  'pin-lead-hover': leadPin(true),
  'pin-lead-contacted': leadPin(false, true),
  'pin-lead-contacted-hover': leadPin(true, true),
} as const;

export type PinName = keyof typeof PIN_SVGS;

/** Returns an HTMLImageElement for the given SVG string, resolved when loaded. */
function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.width = RENDER_SIZE;
    img.height = RENDER_SIZE;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    // Encoding via URI rather than base64 keeps the data URL human-readable
    // and avoids btoa unicode pitfalls.
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Register every pin variant on the map. Idempotent: existing images are
 *  skipped, so this is safe to call after style swaps (e.g. light → dark). */
export async function loadPinImages(map: MapLibreMap): Promise<void> {
  const entries = Object.entries(PIN_SVGS) as [PinName, string][];
  await Promise.all(
    entries.map(async ([name, svg]) => {
      if (map.hasImage(name)) return;
      const img = await svgToImage(svg);
      // pixelRatio 2 so MapLibre renders the 32-logical-px image at retina.
      if (!map.hasImage(name)) {
        map.addImage(name, img, { pixelRatio: PIXEL_RATIO });
      }
    })
  );
}
