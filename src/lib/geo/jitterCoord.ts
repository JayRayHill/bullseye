// Deterministic same-zip offset. Multiple customers in the same zip code share a
// centroid, which would stack their pins exactly on top of each other. We push each
// successive occurrence outward along a golden-angle spiral so all pins remain
// clickable, and because the offset is a pure function of the occurrence index it
// stays stable across reloads.

const GOLDEN_ANGLE_RAD = 137.508 * (Math.PI / 180);
const STEP_DEGREES = 0.003; // ~0.3 km per step at typical latitudes

export function jitterCoord(
  lat: number,
  lng: number,
  indexAtSameZip: number
): [number, number] {
  if (indexAtSameZip <= 0) return [lat, lng];
  const radius = STEP_DEGREES * Math.sqrt(indexAtSameZip);
  const angle = indexAtSameZip * GOLDEN_ANGLE_RAD;
  return [lat + radius * Math.cos(angle), lng + radius * Math.sin(angle)];
}
