// The main map: tile layer, customer markers (closed + lost) inside a cluster
// group, and nearby-lead markers rendered outside the cluster while a customer
// is active. We deliberately keep leads out of the cluster — they are transient
// and tied to selection, so mixing them in causes flicker as selection changes.

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster';
import type L from 'leaflet';
import type { Customer } from '../../types';
import {
  CLOSED_ICON,
  CLOSED_ICON_HOVER,
  LEAD_ICON,
  LEAD_ICON_HOVER,
  LOST_ICON,
  LOST_ICON_HOVER,
  createClusterIcon,
} from './icons';
import { useSelection } from '../../context/SelectionContext';
import { useNearbyLeads } from '../../hooks/useNearbyLeads';
import { useFilters } from '../../context/FiltersContext';

const DEFAULT_CENTER: [number, number] = [39.5, -98.35];
const DEFAULT_ZOOM = 4;

function FlyToActive({ customers }: { customers: Customer[] }) {
  const map = useMap();
  const { activeCustomerId } = useSelection();
  useEffect(() => {
    if (!activeCustomerId) return;
    const c = customers.find((cust) => cust.id === activeCustomerId);
    if (!c) return;
    const targetZoom = Math.max(map.getZoom(), 8);
    map.flyTo([c.lat, c.lng], targetZoom, { duration: 0.6 });
  }, [activeCustomerId, customers, map]);
  return null;
}

function ResetControl() {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)}
      className="absolute right-3 top-3 z-[400] rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow ring-1 ring-slate-200 hover:bg-slate-50"
    >
      Reset view
    </button>
  );
}

interface MapMarkerProps {
  customer: Customer;
}

function ClosedMarker({ customer }: MapMarkerProps) {
  const { setActive, setHovered, hoveredId, activeCustomerId } = useSelection();
  const isHover = hoveredId === customer.id || activeCustomerId === customer.id;
  const icon =
    customer.deal_status === 'lost'
      ? isHover
        ? LOST_ICON_HOVER
        : LOST_ICON
      : isHover
        ? CLOSED_ICON_HOVER
        : CLOSED_ICON;
  return (
    <Marker
      position={[customer.lat, customer.lng]}
      icon={icon}
      eventHandlers={{
        click: () => setActive(customer.id),
        mouseover: () => setHovered(customer.id),
        mouseout: () => setHovered(null),
      }}
      keyboard={false}
    >
      <Tooltip direction="top" offset={[0, -28]}>
        <div className="text-xs">
          <div className="font-semibold">{customer.business_name}</div>
          {customer.city || customer.state ? (
            <div className="text-slate-600">
              {[customer.city, customer.state].filter(Boolean).join(', ')}
            </div>
          ) : null}
          <div className="text-slate-500">
            {customer.deal_status === 'closed' ? 'Closed' : customer.deal_status === 'lost' ? 'Lost' : 'Open'}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}

function LeadMarker({ customer }: MapMarkerProps) {
  const { setActive, setHovered, hoveredId } = useSelection();
  const isHover = hoveredId === customer.id;
  return (
    <Marker
      position={[customer.lat, customer.lng]}
      icon={isHover ? LEAD_ICON_HOVER : LEAD_ICON}
      eventHandlers={{
        click: () => setActive(customer.id),
        mouseover: () => setHovered(customer.id),
        mouseout: () => setHovered(null),
      }}
      keyboard={false}
    >
      <Tooltip direction="top" offset={[0, -28]}>
        <div className="text-xs">
          <div className="font-semibold">{customer.business_name}</div>
          {customer.city || customer.state ? (
            <div className="text-slate-600">
              {[customer.city, customer.state].filter(Boolean).join(', ')}
            </div>
          ) : null}
          <div className="text-slate-500">Open lead</div>
        </div>
      </Tooltip>
    </Marker>
  );
}

export function TerritoryMap({
  customers,
  allCustomers,
}: {
  /** Customers passing the user's filters; closed + lost go in clusters. */
  customers: Customer[];
  /** Full customer list — needed for nearby-lead lookups, which ignore filters
   *  so the user does not lose context just because filters hid the leads. */
  allCustomers: Customer[];
}) {
  const { filters } = useFilters();
  const { activeCustomerId } = useSelection();
  const { leads } = useNearbyLeads(allCustomers, activeCustomerId, filters.radiusMiles);

  // Split into clustered (closed/lost) vs lead set. The cluster group only
  // contains closed/lost markers; leads layer is flat on top.
  const clustered = useMemo(
    () => customers.filter((c) => c.deal_status === 'closed' || c.deal_status === 'lost'),
    [customers]
  );

  return (
    <div className="relative h-full min-h-[24rem] w-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full rounded-lg"
        aria-label="Customer map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup
          chunkedLoading
          removeOutsideVisibleBounds
          iconCreateFunction={(cluster: L.MarkerCluster) => createClusterIcon(cluster.getChildCount())}
        >
          {clustered.map((c) => (
            <ClosedMarker key={c.id} customer={c} />
          ))}
        </MarkerClusterGroup>
        {leads.map((l) => (
          <LeadMarker key={l.customer.id} customer={l.customer} />
        ))}
        <FlyToActive customers={allCustomers} />
        <ResetControl />
      </MapContainer>
    </div>
  );
}
