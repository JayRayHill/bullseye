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
const LEAD_AMBER = '#f59e0b';
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

function lostPin(darkTile: boolean, hover: boolean): string {
  const fill = darkTile ? LOST_GRAY_LIGHT : LOST_GRAY;
  const scale = hover ? 1.1 : 1;
  // Teardrop with X. Logical canvas remains 24×32; we leave whitespace at the top
  // to avoid clipping. Hover variant scales up the path slightly.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGICAL_SIZE}" height="${LOGICAL_SIZE}" viewBox="0 0 32 32">
    <g transform="translate(${(32 - 24 * scale) / 2}, 0) scale(${scale})">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0z" fill="${fill}" stroke="${WHITE}" stroke-width="2"/>
      <path d="M9 9l6 6M15 9l-6 6" stroke="${WHITE}" stroke-width="2" stroke-linecap="round"/>
    </g>
  </svg>`;
}

function leadPin(hover: boolean): string {
  const scale = hover ? 1.1 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGICAL_SIZE}" height="${LOGICAL_SIZE}" viewBox="0 0 32 32">
    <g transform="translate(${(32 - 24 * scale) / 2}, 0) scale(${scale})">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0z" fill="${LEAD_AMBER}" stroke="${WHITE}" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="${WHITE}"/>
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
