import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { EmergencyJunction } from '../types';

interface EmergencyMapProps {
  ambulanceLocation?: { lat: number; lng: number };
  pickupLocation?: { lat: number; lng: number };
  destinationLocation?: { lat: number; lng: number; name?: string };
  primaryRoute?: [number, number][];
  alternateRoute?: [number, number][];
  activeRouteType?: 'primary' | 'alternate';
  junctions?: EmergencyJunction[];
  onJunctionAction?: (junctionId: string, status: string) => void;
  userRole?: string;
  height?: string;
}

export const EmergencyMap: React.FC<EmergencyMapProps> = ({
  ambulanceLocation,
  pickupLocation,
  destinationLocation,
  primaryRoute = [],
  alternateRoute = [],
  activeRouteType = 'primary',
  junctions = [],
  onJunctionAction,
  userRole,
  height = '500px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const ambulanceMarkerRef = useRef<L.Marker | null>(null);
  const primaryPolylineRef = useRef<L.Polyline | null>(null);
  const alternatePolylineRef = useRef<L.Polyline | null>(null);
  const junctionsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = ambulanceLocation
        ? [ambulanceLocation.lat, ambulanceLocation.lng]
        : [12.9716, 77.5946];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
      });

      // CartoDB Dark Matter tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      junctionsLayerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Ambulance Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !ambulanceLocation) return;

    const ambulanceIcon = L.divIcon({
      className: 'custom-ambulance-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 rounded-full bg-red-500/30 animate-ping"></div>
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white shadow-xl border-2 border-white font-bold text-xs">
            🚑
          </div>
          <div class="absolute -bottom-5 whitespace-nowrap bg-navy-950/90 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-500/40 shadow">
            AMBULANCE
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (ambulanceMarkerRef.current) {
      ambulanceMarkerRef.current.setLatLng([ambulanceLocation.lat, ambulanceLocation.lng]);
    } else {
      ambulanceMarkerRef.current = L.marker([ambulanceLocation.lat, ambulanceLocation.lng], {
        icon: ambulanceIcon,
        zIndexOffset: 1000
      }).addTo(map);
    }
  }, [ambulanceLocation]);

  // Update Destination Hospital Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !destinationLocation) return;

    const hospitalIcon = L.divIcon({
      className: 'custom-hospital-icon',
      html: `
        <div class="relative flex flex-col items-center">
          <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs">
            🏥
          </div>
          <div class="whitespace-nowrap bg-navy-950/90 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 shadow mt-1">
            ${destinationLocation.name || 'HOSPITAL'}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setLatLng([destinationLocation.lat, destinationLocation.lng]);
    } else {
      destinationMarkerRef.current = L.marker([destinationLocation.lat, destinationLocation.lng], {
        icon: hospitalIcon
      }).addTo(map);
    }
  }, [destinationLocation]);

  // Update Pickup Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !pickupLocation) return;

    const pickupIcon = L.divIcon({
      className: 'custom-pickup-icon',
      html: `
        <div class="relative flex flex-col items-center">
          <div class="w-7 h-7 rounded-full bg-amber-500 text-navy-950 flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs">
            📍
          </div>
          <div class="whitespace-nowrap bg-navy-950/90 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40 shadow mt-1">
            PICKUP
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setLatLng([pickupLocation.lat, pickupLocation.lng]);
    } else {
      pickupMarkerRef.current = L.marker([pickupLocation.lat, pickupLocation.lng], {
        icon: pickupIcon
      }).addTo(map);
    }
  }, [pickupLocation]);

  // Update Route Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Primary Route
    if (primaryPolylineRef.current) {
      map.removeLayer(primaryPolylineRef.current);
      primaryPolylineRef.current = null;
    }

    if (primaryRoute && primaryRoute.length > 0) {
      const isCurrentActive = activeRouteType === 'primary';
      primaryPolylineRef.current = L.polyline(primaryRoute, {
        color: isCurrentActive ? '#ef4444' : '#64748b',
        weight: isCurrentActive ? 6 : 4,
        opacity: isCurrentActive ? 0.9 : 0.4,
        dashArray: isCurrentActive ? undefined : '6, 8',
      }).addTo(map);
    }

    // Alternate Route
    if (alternatePolylineRef.current) {
      map.removeLayer(alternatePolylineRef.current);
      alternatePolylineRef.current = null;
    }

    if (alternateRoute && alternateRoute.length > 0) {
      const isCurrentActive = activeRouteType === 'alternate';
      alternatePolylineRef.current = L.polyline(alternateRoute, {
        color: isCurrentActive ? '#06b6d4' : '#a855f7',
        weight: isCurrentActive ? 6 : 4,
        opacity: isCurrentActive ? 0.95 : 0.7,
        dashArray: isCurrentActive ? undefined : '5, 8',
      }).addTo(map);
    }
  }, [primaryRoute, alternateRoute, activeRouteType]);

  // Update Junctions
  useEffect(() => {
    const group = junctionsLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    junctions.forEach((junc) => {
      let badgeColor = 'bg-slate-600 border-slate-400';
      let iconEmoji = '🚦';

      if (junc.status === 'cleared') {
        badgeColor = 'bg-emerald-500 border-emerald-300';
        iconEmoji = '✅';
      } else if (junc.status === 'not_cleared') {
        badgeColor = 'bg-red-500 border-red-300 animate-pulse';
        iconEmoji = '🛑';
      } else if (junc.status === 'unable_to_clear') {
        badgeColor = 'bg-amber-500 border-amber-300';
        iconEmoji = '⚠️';
      } else if (junc.status === 'assistance_required') {
        badgeColor = 'bg-purple-600 border-purple-300';
        iconEmoji = '🆘';
      } else if (junc.status === 'no_response') {
        badgeColor = 'bg-orange-500 border-orange-300 animate-bounce';
        iconEmoji = '⏱️';
      }

      const icon = L.divIcon({
        className: 'custom-junction-icon',
        html: `
          <div class="relative flex flex-col items-center">
            <div class="w-6 h-6 rounded-full ${badgeColor} text-white flex items-center justify-center text-[10px] shadow border font-bold">
              ${iconEmoji}
            </div>
            <div class="whitespace-nowrap bg-navy-950/95 text-slate-200 text-[9px] font-semibold px-1 py-0.2 rounded border border-slate-700 shadow mt-0.5">
              ${junc.code}
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([junc.lat, junc.lng], { icon });

      // Interactive Popup
      const popupHtml = `
        <div class="p-2 text-slate-900 min-w-[200px]">
          <div class="font-bold text-sm">${junc.name}</div>
          <div class="text-xs text-slate-500 font-mono">${junc.code} • ${junc.jurisdiction}</div>
          <div class="mt-2 text-xs">
            <span class="font-semibold">Status:</span>
            <span class="font-bold uppercase text-${junc.status === 'cleared' ? 'green-600' : 'red-600'}">
              ${junc.status.replace('_', ' ')}
            </span>
          </div>
          <div class="text-xs text-slate-600">Est. Distance: ${junc.distanceMeters || '~'}m</div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      group.addLayer(marker);
    });
  }, [junctions]);

  // Fit bounds to show route or markers
  const fitToContent = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = L.latLngBounds([]);
    if (ambulanceLocation) bounds.extend([ambulanceLocation.lat, ambulanceLocation.lng]);
    if (destinationLocation) bounds.extend([destinationLocation.lat, destinationLocation.lng]);
    if (pickupLocation) bounds.extend([pickupLocation.lat, pickupLocation.lng]);
    if (primaryRoute && primaryRoute.length > 0) {
      primaryRoute.forEach(pt => bounds.extend(pt));
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  useEffect(() => {
    // Initial fit
    const timer = setTimeout(fitToContent, 400);
    return () => clearTimeout(timer);
  }, [destinationLocation, pickupLocation]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-navy-800 shadow-2xl bg-navy-950">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />

      {/* Map Controls Overlay */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col space-y-2">
        <button
          onClick={fitToContent}
          className="px-3 py-1.5 bg-navy-900/90 hover:bg-navy-800 text-slate-200 text-xs font-semibold rounded-lg shadow-lg border border-navy-700/80 backdrop-blur-md transition flex items-center space-x-1"
          title="Fit view to route"
        >
          <span>🎯 Recenter Route</span>
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[400] bg-navy-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-navy-800 shadow-lg text-[11px] text-slate-300 flex items-center space-x-4">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span>Ambulance</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span>Hospital</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span>Clear Junction</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span>Blocked Junction</span>
        </div>
      </div>
    </div>
  );
};
