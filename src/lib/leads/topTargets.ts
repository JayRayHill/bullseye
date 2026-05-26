// Shared logic for "how many uncontacted leads does this closed customer
// unlock?" Used by:
//   - The closed-pin hover tooltip (single-anchor count).
//   - The top-targets widget on the detail panel's empty state
//     (top-N ranking across every closed customer).
//
// Both use the same bbox-then-haversine prefilter as useNearbyLeads so
// numbers stay consistent across the UI.

import type { Customer } from '../../types';
import { approxLatLngDelta, haversineMiles } from '../geo/haversine';

type IsLeadBlocked = (customer: Customer) => boolean;

/** Count of `not_closed` customers within radius of `anchor` whose lead
 *  identity is NOT in the sent-history cooldown. */
export function countNearbyUncontactedLeads(
  anchor: Customer,
  allCustomers: Customer[],
  radiusMiles: number,
  isLeadBlocked: IsLeadBlocked
): number {
  const { dLat, dLng } = approxLatLngDelta(anchor.lat, radiusMiles);
  let count = 0;
  for (const c of allCustomers) {
    if (c.deal_status !== 'not_closed') continue;
    if (c.id === anchor.id) continue;
    if (Math.abs(c.lat - anchor.lat) > dLat) continue;
    if (Math.abs(c.lng - anchor.lng) > dLng) continue;
    if (haversineMiles(anchor.lat, anchor.lng, c.lat, c.lng) > radiusMiles) continue;
    if (isLeadBlocked(c)) continue;
    count++;
  }
  return count;
}

export interface TopTargetEntry {
  customer: Customer;
  nearbyCount: number;
}

/** Top-N closed customers ranked by how many uncontacted nearby leads
 *  they unlock. Excludes anchors with zero unlocked leads — there's no
 *  point recommending those. */
export function computeTopTargets(
  allCustomers: Customer[],
  radiusMiles: number,
  isLeadBlocked: IsLeadBlocked,
  limit = 5
): TopTargetEntry[] {
  const results: TopTargetEntry[] = [];
  for (const anchor of allCustomers) {
    if (anchor.deal_status !== 'closed') continue;
    const nearbyCount = countNearbyUncontactedLeads(
      anchor,
      allCustomers,
      radiusMiles,
      isLeadBlocked
    );
    if (nearbyCount > 0) results.push({ customer: anchor, nearbyCount });
  }
  results.sort((a, b) => b.nearbyCount - a.nearbyCount);
  return results.slice(0, limit);
}
