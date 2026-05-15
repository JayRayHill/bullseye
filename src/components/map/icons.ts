// Leaflet renders marker icons outside React's tree (into raw DOM that React
// never controls), so any class-based styling we use here needs to be self-
// contained. Inline SVG via L.divIcon is the safest path — it avoids the entire
// class of "Tailwind JIT pruned the class because it didn't see it in a TSX file"
// bugs, since the SVG is committed verbatim into a string literal.

import L from 'leaflet';

const teardrop = (color: string, size: 'sm' | 'lg') => {
  const w = size === 'sm' ? 24 : 28;
  const h = size === 'sm' ? 32 : 38;
  return `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="12" cy="12" r="4" fill="white"/>
  </svg>`;
};

const lostPin = (size: 'sm' | 'lg') => {
  const w = size === 'sm' ? 24 : 28;
  const h = size === 'sm' ? 32 : 38;
  return `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0z" fill="#6b7280" stroke="white" stroke-width="2"/>
    <path d="M9 9l6 6M15 9l-6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
};

function build(html: string, w: number, h: number) {
  return L.divIcon({
    html,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 4],
  });
}

export const CLOSED_ICON = build(teardrop('#16a34a', 'sm'), 24, 32);
export const CLOSED_ICON_HOVER = build(teardrop('#16a34a', 'lg'), 28, 38);
export const LEAD_ICON = build(teardrop('#f59e0b', 'sm'), 24, 32);
export const LEAD_ICON_HOVER = build(teardrop('#f59e0b', 'lg'), 28, 38);
export const LOST_ICON = build(lostPin('sm'), 24, 32);
export const LOST_ICON_HOVER = build(lostPin('lg'), 28, 38);

/** Cluster bubble. Sized by total markers inside the cluster, styled green to
 *  match the closed-customer palette. */
export function createClusterIcon(count: number): L.DivIcon {
  const sizeClass = count < 10 ? 'stm-cluster-sm' : count < 100 ? 'stm-cluster-md' : 'stm-cluster-lg';
  return L.divIcon({
    html: `<div class="stm-cluster ${sizeClass}">${count}</div>`,
    className: '',
    iconSize: [40, 40],
  });
}
