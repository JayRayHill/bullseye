// Spherical-circle geometry for the radius preview overlay. Given a center
// lat/lng and a radius in miles, returns a GeoJSON Polygon whose ring is a
// circle on the WGS-84 sphere — i.e. every vertex is exactly `radiusMiles`
// from the center along a great-circle path. MapLibre renders the polygon
// in its tile projection, which produces a visually correct circle at any
// latitude within CONUS.
//
// 64 vertices is more than enough for a smooth-looking circle at any zoom;
// the perceived edge is dominated by line-width and anti-aliasing, not the
// vertex count.

// Same Earth radius value as src/lib/geo/haversine.ts — keeps the radius
// preview pixel-perfect aligned with the actual distance filter applied to
// nearby leads.
const EARTH_RADIUS_MI = 3958.7613;

export function geographicCirclePolygon(
  centerLng: number,
  centerLat: number,
  radiusMiles: number,
  points: number = 64
): GeoJSON.Polygon {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const distRad = radiusMiles / EARTH_RADIUS_MI;
  const lat0 = centerLat * toRad;
  const lng0 = centerLng * toRad;

  const ring: GeoJSON.Position[] = [];
  for (let i = 0; i <= points; i++) {
    // Walk bearings 0..2π and project the destination at `distRad` along
    // each. Inverse haversine in spherical coords.
    const bearing = (i / points) * 2 * Math.PI;
    const sinLat = Math.sin(lat0) * Math.cos(distRad)
      + Math.cos(lat0) * Math.sin(distRad) * Math.cos(bearing);
    const lat = Math.asin(sinLat);
    const lng = lng0 + Math.atan2(
      Math.sin(bearing) * Math.sin(distRad) * Math.cos(lat0),
      Math.cos(distRad) - Math.sin(lat0) * sinLat
    );
    ring.push([lng * toDeg, lat * toDeg]);
  }
  // GeoJSON polygons require the first and last vertex to match — our loop
  // above already includes both bearing 0 and bearing 2π, which are the
  // same point.
  return { type: 'Polygon', coordinates: [ring] };
}
