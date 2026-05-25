// The main map, now powered by MapLibre GL with native (GPU) clustering.
//
// Why MapLibre over Leaflet:
//   - Vector tiles render crisply at every zoom, smooth pan/zoom on touch
//   - Source-level clustering scales to 100k+ markers without breaking a sweat
//   - Feature-state hover/active swaps are a single GPU draw, not React renders
//
// Tile style: OpenFreeMap (free, no API key, attribution-ready).
//   - Light: bright — full colorful OSM-style basemap (red/orange road
//            categories, blue water, green parks, terrain shading). The
//            most "classic map" feel of OpenFreeMap's offerings; spatial
//            context (highways, terrain) actively helps reps understand
//            where customers sit relative to each other.
//   - Dark:  dark — monochrome dark. (OpenFreeMap doesn't currently offer a
//            colorful dark variant; if reps want more color in dark mode,
//            we can switch to a paid provider like MapTiler.)
// Other OpenFreeMap styles available with a 1-line URL swap:
//   - positron   (cleanest, most minimal)
//   - liberty    (between positron and bright — atlas-like)
// To swap to MapTiler later, just point STYLE_URL_* at their style endpoints
// (which take ?key=YOUR_KEY in the URL).
//
// Layer architecture:
//   - `customers` source: GeoJSON of closed + lost customers, cluster: true
//     - cluster-circle layer  → brand-green bubble for clustered points
//     - cluster-count layer   → white number inside the bubble
//     - customer-pins layer   → unclustered bullseye / lost icons with
//                               feature-state-driven hover & active variants
//   - Nearby leads are HTML maplibregl.Marker instances rather than a layer.
//     They're a small (<50) dynamic set tied to the active selection — the
//     overhead of plain DOM markers is negligible and keeps the code simple.

import { useEffect, useMemo, useRef } from 'react';
import maplibregl, {
  type Map as MapLibreMap,
  type MapMouseEvent,
  type GeoJSONSource,
  Marker,
  Popup,
} from 'maplibre-gl';
import type { Customer } from '../../types';
import { useSelection } from '../../context/SelectionContext';
import { useCampaign } from '../../context/CampaignContext';
import { useNearbyLeads } from '../../hooks/useNearbyLeads';
import { useFilters } from '../../context/FiltersContext';
import { useTheme } from '../../context/ThemeContext';
import { loadPinImages, PIN_SVGS } from './icons';

const DEFAULT_CENTER: [number, number] = [-98.35, 39.5]; // MapLibre uses [lng, lat]
const DEFAULT_ZOOM = 3.5;

// OpenFreeMap styles. Free, no API key. Attribution baked into the style.
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/bright';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

const CUSTOMERS_SOURCE = 'customers';
const STATES_SOURCE = 'us-states';
const STATES_LAYER = 'us-state-borders';
const CLUSTER_LAYER = 'cluster-circles';
const CLUSTER_COUNT_LAYER = 'cluster-count';
const CUSTOMER_LAYER = 'customer-pins';

interface TerritoryMapProps {
  /** Customers passing the user's filters; closed + lost go in clusters. */
  customers: Customer[];
  /** Full customer list — needed for nearby-lead lookups, which ignore filters
   *  so the user does not lose context just because filters hid the leads. */
  allCustomers: Customer[];
}

export function TerritoryMap({ customers, allCustomers }: TerritoryMapProps) {
  const { filters } = useFilters();
  const { activeCustomerId, hoveredId, setActive, setHovered, clearSelection } = useSelection();
  // Alias to avoid name collision with SelectionContext.clearSelection — both
  // contexts expose a method by that name but they clear different things.
  const { clearSelection: clearCampaignSelection } = useCampaign();
  const { leads } = useNearbyLeads(allCustomers, activeCustomerId, filters.radiusMiles);
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleLoadedRef = useRef(false);
  const leadMarkersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  // Track the currently hovered/active feature-state ids so we can clear them
  // before applying a new one (otherwise stale state lingers across hovers).
  const stateRef = useRef<{ hovered: string | null; active: string | null }>({
    hovered: null,
    active: null,
  });

  // Subset rendered in clusters: only closed + lost customers (leads are HTML).
  const clusteredFeatures = useMemo(() => {
    return customers
      .filter((c) => c.deal_status === 'closed' || c.deal_status === 'lost')
      .map((c) => ({
        type: 'Feature' as const,
        id: c.id,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: {
          id: c.id,
          status: c.deal_status,
          business_name: c.business_name,
          city: c.city ?? '',
          state: c.state ?? '',
        },
      }));
  }, [customers]);

  // ---- 1. One-time map initialization ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isDark ? STYLE_DARK : STYLE_LIGHT,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    map.on('load', () => {
      void hydrateMap(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
      leadMarkersRef.current.forEach((m) => m.remove());
      leadMarkersRef.current = [];
    };
    // We intentionally do not include isDark here — the style swap is handled
    // in a separate effect below to preserve map state (center/zoom).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 2. Style swap when prefers-color-scheme changes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // setStyle wipes user-added sources/layers, so we re-hydrate after.
    styleLoadedRef.current = false;
    map.setStyle(isDark ? STYLE_DARK : STYLE_LIGHT);
    map.once('styledata', () => {
      void hydrateMap(map);
    });
  }, [isDark]);

  /** Add our source + layers + images on top of whichever style is loaded. */
  async function hydrateMap(map: MapLibreMap) {
    if (styleLoadedRef.current) return;
    await loadPinImages(map);

    // US state borders overlay — Positron tiles' state lines are nearly
    // invisible, especially in light mode. Adding our own thin line layer
    // sits between the basemap and the customer pins.
    if (!map.getSource(STATES_SOURCE)) {
      map.addSource(STATES_SOURCE, {
        type: 'geojson',
        data: '/us-states.geojson',
      });
    }
    if (!map.getLayer(STATES_LAYER)) {
      map.addLayer({
        id: STATES_LAYER,
        type: 'line',
        source: STATES_SOURCE,
        paint: {
          // Slate-600 light / warm gray dark. Slightly darker + thicker on
          // the colorful Bright basemap so state outlines still read
          // clearly through the terrain shading and road colors.
          'line-color': isDark ? '#5a4f51' : '#475569',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2],
          'line-opacity': isDark ? 0.55 : 0.75,
        },
      });
    }

    if (!map.getSource(CUSTOMERS_SOURCE)) {
      map.addSource(CUSTOMERS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
        promoteId: 'id',
      });
    }

    if (!map.getLayer(CLUSTER_LAYER)) {
      map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: CUSTOMERS_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': isDark ? '#1a8e60' : '#0c5f3f',
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 100, 28],
          'circle-stroke-width': 2,
          'circle-stroke-color': isDark ? '#0a1f17' : '#ffffff',
        },
      });
    }

    if (!map.getLayer(CLUSTER_COUNT_LAYER)) {
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: CUSTOMERS_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          // Font list is tried in order; whichever the active style's glyphs
          // endpoint provides first wins. Liberty ships Noto Sans, Positron
          // ships Noto Sans Bold too — keep both as fallbacks.
          'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      });
    }

    if (!map.getLayer(CUSTOMER_LAYER)) {
      // NOTE: MapLibre disallows feature-state in layout properties (icon-image
      // is a layout). We drive the icon entirely by the static `status`
      // property; the hover affordance is the cursor change + popup, and the
      // active affordance is the auto flyTo + detail panel opening.
      //
      // Anchor: bullseye is a symmetric circle so center is correct. The lost
      // teardrop's point is at the bottom of the SVG, so we anchor at bottom
      // so the point lands on the lat/lng (conventional pin behavior). Mixing
      // anchors in one layer requires a case expression.
      const lostIcon = isDark ? 'pin-lost-dark' : 'pin-lost';
      map.addLayer({
        id: CUSTOMER_LAYER,
        type: 'symbol',
        source: CUSTOMERS_SOURCE,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': [
            'case',
            ['==', ['get', 'status'], 'lost'],
            lostIcon,
            'pin-closed',
          ],
          'icon-anchor': [
            'case',
            ['==', ['get', 'status'], 'lost'],
            'bottom',
            'center',
          ],
          'icon-allow-overlap': true,
        },
      });
    }

    // Event handlers — attached once per hydration. setStyle wipes them along
    // with the layers, so we re-attach on every hydrate.
    map.on('click', CLUSTER_LAYER, onClusterClick);
    map.on('click', CUSTOMER_LAYER, onCustomerClick);
    map.on('mouseenter', CUSTOMER_LAYER, onCustomerMouseEnter);
    map.on('mouseleave', CUSTOMER_LAYER, onCustomerMouseLeave);
    map.on('mouseenter', CLUSTER_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', CLUSTER_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });

    styleLoadedRef.current = true;

    // Apply current data + selection state immediately.
    syncCustomerData(map);
    syncSelectionFeatureState(map);
  }

  function onClusterClick(e: MapMouseEvent) {
    const map = mapRef.current;
    if (!map) return;
    const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
    const clusterId = features[0]?.properties?.cluster_id;
    if (clusterId == null) return;
    const source = map.getSource(CUSTOMERS_SOURCE) as GeoJSONSource;
    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({
        center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
        zoom,
      });
    });
  }

  function onCustomerClick(e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
    const feature = e.features?.[0];
    const id = feature?.properties?.id as string | undefined;
    if (id) setActive(id);
  }

  function onCustomerMouseEnter(e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = 'pointer';
    const feature = e.features?.[0];
    if (!feature) return;
    const id = feature.properties?.id as string | undefined;
    if (!id) return;
    setHovered(id);
    showPopup(map, feature);
  }

  function onCustomerMouseLeave() {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = '';
    setHovered(null);
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }

  function showPopup(map: MapLibreMap, feature: maplibregl.MapGeoJSONFeature) {
    const props = feature.properties;
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    if (popupRef.current) popupRef.current.remove();
    const cityState = [props.city, props.state].filter(Boolean).join(', ');
    const statusLabel =
      props.status === 'closed' ? 'Closed' : props.status === 'lost' ? 'Lost' : 'Open';
    const html = `
      <div style="font-size: 12px; line-height: 1.4;">
        <div style="font-weight: 600;">${escapeHtml(String(props.business_name ?? ''))}</div>
        ${cityState ? `<div style="color: #475569;">${escapeHtml(cityState)}</div>` : ''}
        <div style="color: #64748b;">${statusLabel}</div>
      </div>`;
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      className: 'stm-popup',
    })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  }

  /** Push the latest clustered feature list into the source. */
  function syncCustomerData(map: MapLibreMap) {
    const src = map.getSource(CUSTOMERS_SOURCE) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: clusteredFeatures as GeoJSON.Feature[],
    });
  }

  /** Apply hover + active feature-state, clearing previous ids first. */
  function syncSelectionFeatureState(map: MapLibreMap) {
    const setState = (id: string | null, key: 'hovered' | 'active', value: boolean) => {
      if (!id) return;
      try {
        map.setFeatureState({ source: CUSTOMERS_SOURCE, id }, { [key]: value });
      } catch {
        /* feature may not be loaded yet — safe to skip */
      }
    };
    // Clear previous states
    if (stateRef.current.hovered && stateRef.current.hovered !== hoveredId) {
      setState(stateRef.current.hovered, 'hovered', false);
    }
    if (stateRef.current.active && stateRef.current.active !== activeCustomerId) {
      setState(stateRef.current.active, 'active', false);
    }
    // Apply current states
    setState(hoveredId, 'hovered', true);
    setState(activeCustomerId, 'active', true);
    stateRef.current = { hovered: hoveredId, active: activeCustomerId };
  }

  // ---- 3. Update source data when filtered customers change ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    syncCustomerData(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusteredFeatures]);

  // ---- 4. Mirror selection/hover to feature-state ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    syncSelectionFeatureState(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId, activeCustomerId]);

  // ---- 5. Fly to the active customer when selection changes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeCustomerId) return;
    const c = allCustomers.find((cust) => cust.id === activeCustomerId);
    if (!c) return;
    map.flyTo({
      center: [c.lng, c.lat],
      zoom: Math.max(map.getZoom(), 9),
      duration: 700,
      essential: true,
    });
  }, [activeCustomerId, allCustomers]);

  // ---- 6. HTML markers for the small dynamic lead set ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous markers each render — leads is a small set tied to selection.
    leadMarkersRef.current.forEach((m) => m.remove());
    leadMarkersRef.current = [];

    // If the rep just clicked an amber lead, that lead becomes the active
    // customer — but `useNearbyLeads` excludes the active customer from its
    // returned list, so its marker would otherwise disappear from the map.
    // Add a self-marker for the active not_closed customer so it stays
    // visible at the center of attention.
    const markersToShow = [...leads];
    if (activeCustomerId) {
      const activeCustomer = allCustomers.find((c) => c.id === activeCustomerId);
      if (
        activeCustomer &&
        activeCustomer.deal_status === 'not_closed' &&
        !markersToShow.some((l) => l.customer.id === activeCustomerId)
      ) {
        markersToShow.push({ customer: activeCustomer, distanceMiles: 0 });
      }
    }

    for (const lead of markersToShow) {
      // CRITICAL: maplibregl.Marker writes `transform: translate(x, y)` on the
      // element it's given to position the marker on the map. If we set a
      // transform on the SAME element, we clobber the positioning and the pin
      // jumps to (0, 0). So we wrap the SVG in an inner div and only scale
      // the inner — the outer element stays MapLibre's territory.
      const outer = document.createElement('div');
      const inner = document.createElement('div');
      inner.innerHTML = PIN_SVGS['pin-lead'];
      inner.style.cursor = 'pointer';
      inner.style.transformOrigin = 'center';
      inner.style.transition = 'transform 120ms ease-out';
      outer.appendChild(inner);
      inner.addEventListener('mouseenter', () => {
        inner.style.transform = 'scale(1.18)';
        setHovered(lead.customer.id);
      });
      inner.addEventListener('mouseleave', () => {
        inner.style.transform = '';
        setHovered(null);
      });
      inner.addEventListener('click', () => setActive(lead.customer.id));
      // Teardrop pins anchor at their POINT (bottom-center of the SVG) so the
      // tip sits on the lat/lng — like every other map app. With 'center'
      // anchoring the wide top of the teardrop hung above the location and
      // got clipped near the viewport edge.
      const marker = new maplibregl.Marker({ element: outer, anchor: 'bottom' })
        .setLngLat([lead.customer.lng, lead.customer.lat])
        .addTo(map);
      leadMarkersRef.current.push(marker);
    }

    return () => {
      leadMarkersRef.current.forEach((m) => m.remove());
      leadMarkersRef.current = [];
    };
  }, [leads, activeCustomerId, allCustomers, setActive, setHovered]);

  // ---- 7. Reset button: clear all selection AND return to default view ----
  function onReset() {
    const map = mapRef.current;
    // Clear both kinds of selection so the detail panel closes and the
    // "Build campaign" sticky bar disappears — "Reset" should feel like a
    // clean slate.
    clearSelection();
    clearCampaignSelection();
    if (!map) return;
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
  }

  return (
    <div className="relative h-full min-h-[24rem] w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full" aria-label="Customer map" role="region" />
      <button
        type="button"
        onClick={onReset}
        title="Clear selection and return to the default view"
        className="absolute right-3 top-3 z-10 rounded-md bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-800 shadow ring-1 ring-slate-200 backdrop-blur transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:bg-slate-900/95 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900"
      >
        Reset
      </button>
    </div>
  );
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
