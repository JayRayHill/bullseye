// Derived list: for the currently active customer, the set of `not_closed`
// customers within `radiusMiles`, sorted by distance ascending. Lost deals are
// intentionally excluded — they are visible on the map for territory context but
// are not follow-up targets.

import { useMemo } from 'react';
import type { Customer } from '../types';
import { approxLatLngDelta, haversineMiles } from '../lib/geo/haversine';

export interface NearbyLead {
  customer: Customer;
  distanceMiles: number;
}

export function useNearbyLeads(
  allCustomers: Customer[],
  activeId: string | null,
  radiusMiles: number
): { leads: NearbyLead[]; active: Customer | null } {
  return useMemo(() => {
    if (!activeId) return { leads: [], active: null };
    const active = allCustomers.find((c) => c.id === activeId) ?? null;
    if (!active) return { leads: [], active: null };
    const { dLat, dLng } = approxLatLngDelta(active.lat, radiusMiles);
    const out: NearbyLead[] = [];
    for (const c of allCustomers) {
      if (c.id === active.id) continue;
      if (c.deal_status !== 'not_closed') continue;
      // Bounding-box pre-filter skips trig for far candidates.
      if (Math.abs(c.lat - active.lat) > dLat) continue;
      if (Math.abs(c.lng - active.lng) > dLng) continue;
      const d = haversineMiles(active.lat, active.lng, c.lat, c.lng);
      if (d <= radiusMiles) out.push({ customer: c, distanceMiles: d });
    }
    out.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { leads: out, active };
  }, [allCustomers, activeId, radiusMiles]);
}
