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

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSentHistory } from '../../context/SentHistoryContext';
import { geographicCirclePolygon } from '../../lib/geo/circleGeometry';
import { countNearbyUncontactedLeads } from '../../lib/leads/topTargets';
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
const RADIUS_SOURCE = 'radius-preview';
const RADIUS_FILL_LAYER = 'radius-preview-fill';
const RADIUS_LINE_LAYER = 'radius-preview-line';

// 3D tilt: stored angle (degrees) and persistence key. 52° is a meaningful
// perspective without going so far that the map runs out of tiles near the
// horizon. localStorage so the rep's preference survives reloads — same
// pattern the theme toggle uses.
const PITCH_STORAGE_KEY = 'bullseye:map-pitch';
const PITCH_TILTED_DEG = 52;
const PITCH_FLAT_DEG = 0;
const PITCH_EASE_MS = 700;

function loadInitialPitch(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PITCH_STORAGE_KEY) === 'tilted';
  } catch {
    return false;
  }
}

// Visibility opacities (high = visible, low = invisible). Light mode keeps
// the circle very gentle; dark mode bumps both stroke and fill slightly so
// it reads against the warm Dark Matter tiles. The circle stays visible
// the whole time a customer is selected — it's the territory boundary, not
// a transient hint, so it shouldn't time out and surprise the user when
// they pan/zoom to inspect it.
const RADIUS_OPACITY = {
  light: { fill: 0.08, line: 0.65 },
  dark:  { fill: 0.14, line: 0.8 },
} as const;

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
  // Used to decide whether each lead pin should render as the standard
  // coral teardrop or the pink "already contacted" variant. Reads from the
  // SentHistoryContext which tracks per-rep sends with a 30-day cooldown.
  const { isLeadBlocked } = useSentHistory();
  const isDark = effectiveTheme === 'dark';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleLoadedRef = useRef(false);
  const leadMarkersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  // 3D tilt — persisted preference. We use lazy state init so the value is
  // read from localStorage exactly once on mount.
  const [isTilted, setIsTilted] = useState<boolean>(loadInitialPitch);
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
      // Apply the persisted pitch immediately so a tilted-mode rep doesn't
      // see a "flat → tilt" pop on every reload.
      pitch: isTilted ? PITCH_TILTED_DEG : PITCH_FLAT_DEG,
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
          // Pulls from the warm slate scale (slate-600 / slate-500) so the
          // map outlines share a color family with the rest of the chrome —
          // input borders, slider tracks, dividers.
          'line-color': isDark ? '#737070' : '#525050',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2],
          'line-opacity': isDark ? 0.65 : 0.75,
        },
      });
    }

    // Radius preview overlay — translucent circle around the active customer
    // that visualizes the search radius. Layers go in BEFORE the customer
    // pins so the circle sits beneath them (pins stay clickable above).
    // Initial opacity is 0; the radius-visibility effect bumps it when the
    // rep selects a customer or moves the slider. The paint-property
    // transition makes the change ease smoothly (~220ms).
    if (!map.getSource(RADIUS_SOURCE)) {
      map.addSource(RADIUS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer(RADIUS_FILL_LAYER)) {
      map.addLayer({
        id: RADIUS_FILL_LAYER,
        type: 'fill',
        source: RADIUS_SOURCE,
        paint: {
          'fill-color': '#0c5f3f',
          'fill-opacity': 0,
          'fill-opacity-transition': { duration: 220, delay: 0 },
        },
      });
    }
    if (!map.getLayer(RADIUS_LINE_LAYER)) {
      map.addLayer({
        id: RADIUS_LINE_LAYER,
        type: 'line',
        source: RADIUS_SOURCE,
        paint: {
          'line-color': isDark ? '#74d2a4' : '#0c5f3f',
          'line-width': 1.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0,
          'line-opacity-transition': { duration: 220, delay: 0 },
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
          // Smooth zoom-driven size changes (cluster recompute can jump
          // sizes; the transition keeps motion intentional).
          'circle-radius-transition': { duration: 150, delay: 0 },
          // Used by the "drop in" effect on fresh data load — initial set to
          // [0, -36] then animated to [0, 0] over 600ms. Transition value
          // belongs on the layer; the trigger lives in the data-load effect.
          'circle-translate-transition': { duration: 600, delay: 0 },
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
        paint: {
          // Drop-in transition for fresh data loads — see the data-load
          // effect below for the [0, -36] → [0, 0] sequence. 600ms ease.
          'icon-translate-transition': { duration: 600, delay: 0 },
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
    // For closed customers, add a line showing how many uncontacted
    // nearby leads they unlock at the current radius. Lets reps visually
    // survey for high-impact anchors without clicking each pin. Skipped
    // for lost and open pins since those aren't anchors to begin with.
    let nearbyLine = '';
    if (props.status === 'closed') {
      const id = props.id as string | undefined;
      const anchor = id ? allCustomers.find((c) => c.id === id) : undefined;
      if (anchor) {
        const count = countNearbyUncontactedLeads(
          anchor,
          allCustomers,
          filters.radiusMiles,
          isLeadBlocked
        );
        nearbyLine =
          count === 0
            ? `<div style="color: #94a3b8;">No uncontacted leads within ${filters.radiusMiles} mi</div>`
            : `<div style="color: #0c5f3f; font-weight: 600;">${count} uncontacted nearby</div>`;
      }
    }
    const html = `
      <div style="font-size: 12px; line-height: 1.4;">
        <div style="font-weight: 600;">${escapeHtml(String(props.business_name ?? ''))}</div>
        ${cityState ? `<div style="color: #475569;">${escapeHtml(cityState)}</div>` : ''}
        <div style="color: #64748b;">${statusLabel}</div>
        ${nearbyLine}
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

  // ---- 3a. Pin drop on FRESH data hydration. Detect the empty-to-populated
  // transition (page reload, file upload, replace-file) and offset the
  // pins above their final positions for one frame, then animate them
  // down via the icon-translate / circle-translate transitions configured
  // on the layers. Filter changes don't re-trigger this — the ref stays
  // `true` as long as there's any data, so reps don't get a pin-drop
  // every time they toggle a state chip. ----
  const hasPinnedDataRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    const hasData = allCustomers.length > 0;
    if (hasData && !hasPinnedDataRef.current) {
      // Lift pins above their final position, then on the next frame
      // animate them down. MapLibre interpolates via the
      // *-translate-transition configured on each layer.
      map.setPaintProperty(CUSTOMER_LAYER, 'icon-translate', [0, -36]);
      map.setPaintProperty(CLUSTER_LAYER, 'circle-translate', [0, -36]);
      requestAnimationFrame(() => {
        const m = mapRef.current;
        if (!m || !styleLoadedRef.current) return;
        m.setPaintProperty(CUSTOMER_LAYER, 'icon-translate', [0, 0]);
        m.setPaintProperty(CLUSTER_LAYER, 'circle-translate', [0, 0]);
      });
    }
    hasPinnedDataRef.current = hasData;
  }, [allCustomers]);

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

  // ---- 5b. Radius preview circle — translucent overlay showing the
  // current search radius around the active customer. Visible the entire
  // time a customer is selected; cleared on deselect. The slider live-
  // updates the polygon so the circle grows/shrinks in place as the rep
  // drags. No auto-fade — the circle is the active customer's territory
  // boundary, and reps need to pan/zoom around it without it vanishing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    const source = map.getSource(RADIUS_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;

    // No active customer → clear the circle immediately + hide.
    if (!activeCustomerId) {
      source.setData({ type: 'FeatureCollection', features: [] });
      map.setPaintProperty(RADIUS_FILL_LAYER, 'fill-opacity', 0);
      map.setPaintProperty(RADIUS_LINE_LAYER, 'line-opacity', 0);
      return;
    }

    const active = allCustomers.find((c) => c.id === activeCustomerId);
    if (!active) return;

    // Update the circle geometry to match current center + radius.
    const polygon = geographicCirclePolygon(
      active.lng,
      active.lat,
      filters.radiusMiles
    );
    source.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: polygon }],
    });

    // Show with the theme-appropriate opacity. Stays visible until the
    // active customer is cleared.
    const op = isDark ? RADIUS_OPACITY.dark : RADIUS_OPACITY.light;
    map.setPaintProperty(RADIUS_FILL_LAYER, 'fill-opacity', op.fill);
    map.setPaintProperty(RADIUS_LINE_LAYER, 'line-opacity', op.line);
  }, [activeCustomerId, allCustomers, filters.radiusMiles, isDark]);

  // ---- 6. HTML markers for the small dynamic lead set ----
  // Tracks the last active customer this effect saw, so we know whether the
  // current render is a FRESH selection (apply staggered entrance) vs. a
  // slider drag that just refreshed the lead set for the same customer
  // (skip the stagger — reps want responsive slider feedback, not animation
  // on every tick).
  const lastStaggeredForRef = useRef<string | null>(null);
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

    const isFreshSelection = lastStaggeredForRef.current !== activeCustomerId;
    lastStaggeredForRef.current = activeCustomerId;

    for (let i = 0; i < markersToShow.length; i++) {
      const lead = markersToShow[i];
      // CRITICAL: maplibregl.Marker writes `transform: translate(x, y)` on the
      // element it's given to position the marker on the map. If we set a
      // transform on the SAME element, we clobber the positioning and the pin
      // jumps to (0, 0). So we wrap the SVG in an inner div and only scale
      // the inner — the outer element stays MapLibre's territory.
      const outer = document.createElement('div');
      const inner = document.createElement('div');
      // Already-contacted leads (sent within the cooldown window) get the
      // pink variant so the rep can see at a glance which neighbors they've
      // already touched without inspecting every list row.
      const alreadyContacted = isLeadBlocked(lead.customer);
      inner.innerHTML = alreadyContacted
        ? PIN_SVGS['pin-lead-contacted']
        : PIN_SVGS['pin-lead'];
      inner.style.cursor = 'pointer';
      inner.style.transformOrigin = 'center';
      inner.style.transition = 'transform 120ms ease-out';
      // Stagger fade-in for FRESH selections only — leads are already sorted
      // by distance ascending (nearest first) so the visual sweep reads as
      // "scanning outward from the active customer." Tuned snappy:
      // 22ms per pin (was 40ms) keeps the rolling cadence visible without
      // dragging; cap at 650ms so even a 50-pin batch finishes well inside
      // the user's attention window after a click.
      if (isFreshSelection) {
        inner.classList.add('stm-lead-pin-enter');
        inner.style.animationDelay = `${Math.min(i * 22, 650)}ms`;
      }
      outer.appendChild(inner);
      inner.addEventListener('mouseenter', () => {
        inner.style.transform = 'scale(1.18)';
        setHovered(lead.customer.id);
        // Show the same name/city/status tooltip the bullseye pins show.
        // Offset 36 puts the popup above the pin's TOP (pin is anchored at
        // its bottom point, extends ~32px up, +4 for breathing room).
        if (popupRef.current) popupRef.current.remove();
        const cityState = [lead.customer.city, lead.customer.state]
          .filter(Boolean)
          .join(', ');
        const statusLine = alreadyContacted
          ? `<div style="color: #2d7fb0;">Already contacted</div>`
          : `<div style="color: #64748b;">Open</div>`;
        const html = `
          <div style="font-size: 12px; line-height: 1.4;">
            <div style="font-weight: 600;">${escapeHtml(lead.customer.business_name)}</div>
            ${cityState ? `<div style="color: #475569;">${escapeHtml(cityState)}</div>` : ''}
            ${statusLine}
          </div>`;
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 36,
          className: 'stm-popup',
        })
          .setLngLat([lead.customer.lng, lead.customer.lat])
          .setHTML(html)
          .addTo(map);
      });
      inner.addEventListener('mouseleave', () => {
        inner.style.transform = '';
        setHovered(null);
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
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
  }, [leads, activeCustomerId, allCustomers, setActive, setHovered, isLeadBlocked]);

  // ---- 6b. Ease the camera pitch when the 3D toggle flips. easeTo with
  // duration > 0 means MapLibre interpolates smoothly between angles, so
  // the rep sees the world "lift up" instead of teleporting.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      pitch: isTilted ? PITCH_TILTED_DEG : PITCH_FLAT_DEG,
      duration: PITCH_EASE_MS,
    });
    try {
      window.localStorage.setItem(
        PITCH_STORAGE_KEY,
        isTilted ? 'tilted' : 'flat'
      );
    } catch {
      /* localStorage can throw in private-mode Safari; ignore */
    }
  }, [isTilted]);

  function toggleTilt() {
    setIsTilted((t) => !t);
  }

  // ---- 7. Reset button: clear all selection AND return to default view ----
  function onReset() {
    const map = mapRef.current;
    // Clear both kinds of selection so the detail panel closes and the
    // "Build campaign" sticky bar disappears — "Reset" should feel like a
    // clean slate. Pitch goes back to whatever the rep's persisted
    // preference is — don't override that on Reset.
    clearSelection();
    clearCampaignSelection();
    if (!map) return;
    map.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: isTilted ? PITCH_TILTED_DEG : PITCH_FLAT_DEG,
      duration: 600,
    });
  }

  return (
    <div className="relative h-full min-h-[24rem] w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full" aria-label="Customer map" role="region" />
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTilt}
          title={isTilted ? 'Switch to flat (2D) view' : 'Switch to tilted (3D) view'}
          aria-pressed={isTilted}
          className={
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium shadow ring-1 backdrop-blur transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ' +
            (isTilted
              ? 'bg-brand-700 text-white ring-brand-800 hover:bg-brand-800 dark:bg-brand-600 dark:ring-brand-700 dark:hover:bg-brand-500'
              : 'bg-white/95 text-slate-800 ring-slate-200 hover:bg-white dark:bg-slate-900/95 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900')
          }
        >
          {/* Subtle perspective glyph — flat parallelogram when in 2D
              (representing the tilted ground plane the click will reveal),
              square when in 3D (the flat-view target). */}
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            {isTilted ? (
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            ) : (
              <path
                d="M2 11 L6 4 L14 4 L10 11 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            )}
          </svg>
          {isTilted ? '2D' : '3D'}
        </button>
        <button
          type="button"
          onClick={onReset}
          title="Clear selection and return to the default view"
          className="rounded-md bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-800 shadow ring-1 ring-slate-200 backdrop-blur transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:bg-slate-900/95 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900"
        >
          Reset
        </button>
      </div>
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
