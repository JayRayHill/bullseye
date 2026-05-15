// Great-circle distance, miles. We use a small bounding-box pre-filter at the call
// site to skip the trig for far-away candidates; this function does the precise check.

const EARTH_RADIUS_MI = 3958.7613;

export function haversineMiles(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const sLat1 = Math.sin(dLat / 2);
  const sLng1 = Math.sin(dLng / 2);
  const a =
    sLat1 * sLat1 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * sLng1 * sLng1;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Approximate degrees-per-mile for a bounding-box pre-filter. Longitude compresses
 *  toward the poles, so we scale by cos(lat). Accurate enough for an "obviously
 *  too far" rejection — we re-check survivors with the exact Haversine. */
export function approxLatLngDelta(
  centerLat: number,
  miles: number
): { dLat: number; dLng: number } {
  const dLat = miles / 69;
  const dLng = miles / (69 * Math.max(0.05, Math.cos(centerLat * (Math.PI / 180))));
  return { dLat, dLng };
}
