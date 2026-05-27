// Anchor resolution for the per-lead "Send email" flow.
//
// The campaign templates all reference a closed customer as the proof point
// ({{nearby_customer}}, {{distance}}, etc.). When a rep clicks "Send email"
// from an OPEN lead's active card, we need to pick a sensible closed
// customer to attach as the anchor.
//
// Priority (best → worst):
//   1. lastAnchorId — the closed customer the rep was viewing immediately
//      before they drilled into this lead. This is the "I came from Lone
//      Star Foods" context that motivated their click in the first place.
//   2. Nearest closed customer — fallback for when the rep reached this
//      lead some other way (header search, deep link, etc.) and there's
//      no prior anchor in session memory.
//
// Both fallbacks return undefined only when the dataset has zero closed
// customers — in which case "Send email" has no proof point to use and
// should be disabled at the UI level.

import type { Customer } from '../../types';
import { approxLatLngDelta, haversineMiles } from '../geo/haversine';

export function resolveAnchorForLead(
  lead: Customer,
  allCustomers: Customer[],
  lastAnchorId: string | null
): Customer | undefined {
  // 1. Prefer the rep's session anchor if it still exists and is still
  //    closed (defensive: dataset could've been replaced mid-session).
  if (lastAnchorId) {
    const stored = allCustomers.find(
      (c) => c.id === lastAnchorId && c.deal_status === 'closed'
    );
    if (stored) return stored;
  }

  // 2. Otherwise pick the geographically nearest closed customer. Same
  //    bbox-then-haversine pattern as useNearbyLeads / countNearby so
  //    "nearest" is consistent across the UI.
  let nearest: Customer | undefined;
  let nearestMiles = Infinity;
  // Use a generous initial bbox (200mi) to limit Haversine calls; if no
  // closed customer is within 200mi, widen progressively.
  for (const radius of [200, 500, 2500]) {
    const { dLat, dLng } = approxLatLngDelta(lead.lat, radius);
    for (const c of allCustomers) {
      if (c.deal_status !== 'closed') continue;
      if (Math.abs(c.lat - lead.lat) > dLat) continue;
      if (Math.abs(c.lng - lead.lng) > dLng) continue;
      const d = haversineMiles(lead.lat, lead.lng, c.lat, c.lng);
      if (d < nearestMiles) {
        nearest = c;
        nearestMiles = d;
      }
    }
    if (nearest) return nearest;
  }
  return undefined;
}
