import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  Truck,
  Radio,
  Compass,
  RefreshCw,
  Phone,
  ShieldCheck,
  Zap,
  Store,
  Navigation,
  Layers,
  Map as MapIcon
} from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DeliveryPartner } from '../types';
import { useOMS } from '../lib/store';
import { SetOutletLocationModal } from './SetOutletLocationModal';

interface RiderLocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  partners: DeliveryPartner[];
  onSimulateMovement?: () => void;
}

// Outlet Base Locations (Faridabad Precise Outlets)
const OUTLET_LOCATIONS = [
  {
    name: 'Sector 31 Outlet',
    address: 'Shop no. 4, Ch. Hetram Complex, near Anupam Sweets, Sector 31, Faridabad, Haryana 121003',
    lat: 28.4682,
    lng: 77.3060,
    color: '#10b981'
  },
  {
    name: 'Sector 35 Outlet',
    address: 'Shop No.9, Ground Floor, Shopping Center In, Ashoka Enclave Part 3, Subash Nagar, Sector 35, Faridabad, Haryana 121003',
    lat: 28.4875,
    lng: 77.3082,
    color: '#f59e0b'
  },
  {
    name: 'Sector 42 Outlet',
    address: 'B-107, Greenfield Colony, Mall Road, Sector 42, Faridabad',
    lat: 28.4632,
    lng: 77.3015,
    color: '#3b82f6'
  },
  {
    name: 'Sector 88 Outlet',
    address: 'Shop 112, RPS Savana Rd, RPS City, Sector 88, Faridabad, Haryana 121002',
    lat: 28.4118,
    lng: 77.3458,
    color: '#8b5cf6'
  }
];

// Predefined reliable map tile styles
const CARTO_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

type StyleType = 'carto_dark' | 'openfreemap' | 'osm';

export const RiderLocationMapModal: React.FC<RiderLocationMapModalProps> = ({
  isOpen,
  onClose,
  partners,
  onSimulateMovement
}) => {
  const { outletLocations } = useOMS();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(partners[0]?.id || null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeStyle, setActiveStyle] = useState<StyleType>('carto_dark');
  const [isSetOutletModalOpen, setIsSetOutletModalOpen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

  useEffect(() => {
    if (!selectedPartnerId && partners.length > 0) {
      setSelectedPartnerId(partners[0].id);
    }
  }, [partners, selectedPartnerId]);

  // Automatic live GPS movement interval while tracking modal is open
  useEffect(() => {
    if (!isOpen || !onSimulateMovement) return;
    const interval = setInterval(() => {
      onSimulateMovement();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, onSimulateMovement]);

  // Function to resolve style specification or URL
  const getStyleSpec = (type: StyleType): string | maplibregl.StyleSpecification => {
    if (type === 'openfreemap') {
      return 'https://tiles.openfreemap.org/styles/liberty';
    }
    if (type === 'osm') {
      return OSM_STYLE;
    }
    return CARTO_DARK_STYLE;
  };

  // Initialize MapLibre GL JS
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Destroy existing map instance if any
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const defaultLat = partners[0]?.location?.lat || 28.4520;
    const defaultLng = partners[0]?.location?.lng || 77.3180;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getStyleSpec(activeStyle),
      center: [defaultLng, defaultLat],
      zoom: 12.5,
      pitch: 20,
    });

    // Handle map load and fallback if vector style fails
    map.on('error', (e) => {
      console.warn('MapLibre error encountered:', e);
      // If active style was openfreemap and failed, fallback to CARTO Dark
      if (activeStyle === 'openfreemap') {
        console.info('Falling back to CARTO Dark Matter raster style...');
        setActiveStyle('carto_dark');
      }
    });

    // Add Navigation & Zoom Controls
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    map.on('load', () => {
      setMapLoaded(true);
      handleResize();
      // Additional resize triggers to handle modal animations & container layout
      setTimeout(handleResize, 100);
      setTimeout(handleResize, 300);
      setTimeout(handleResize, 600);
    });

    mapRef.current = map;

    return () => {
      // Cleanup markers
      Object.values(markersRef.current).forEach((marker: maplibregl.Marker) => marker.remove());
      markersRef.current = {};
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapLoaded(false);
    };
  }, [isOpen, activeStyle]);

  // Render / Update Outlet & Rider Markers on MapLibre
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isOpen) return;

    // Clear existing markers on re-render to avoid duplicates
    Object.values(markersRef.current).forEach((marker: maplibregl.Marker) => marker.remove());
    markersRef.current = {};

    // 1. Add / Update Outlet Markers
    (outletLocations || OUTLET_LOCATIONS).forEach((outlet) => {
      const outletKey = `outlet-${outlet.name}`;
      const el = document.createElement('div');
      el.className = 'outlet-marker-container cursor-pointer transform -translate-x-1/2 -translate-y-1/2';
      el.innerHTML = `
        <div style="background-color: ${outlet.color};" class="px-2.5 py-1 rounded-xl text-slate-950 font-black text-[11px] shadow-2xl flex items-center gap-1 border-2 border-white">
          <span>🏬</span>
          <span>${outlet.name}</span>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25, className: 'custom-maplibre-popup' }).setHTML(`
        <div class="p-2 text-slate-900 font-bold text-xs max-w-[220px]">
          <div class="font-extrabold text-sm text-purple-900">${outlet.name}</div>
          <div class="text-[10px] text-slate-600 mt-0.5 leading-snug">${outlet.address}</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([outlet.lng, outlet.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current[outletKey] = marker;
    });

    // 2. Add / Update Rider Markers
    partners.forEach((partner) => {
      const loc = partner.location || { lat: 28.45, lng: 77.32, speed: 0, address: 'Faridabad' };
      const riderKey = `rider-${partner.id}`;
      const isSelected = partner.id === selectedPartnerId;
      const statusColor = partner.status === 'on_delivery' ? '#f59e0b' : '#10b981';

      const el = document.createElement('div');
      el.id = `marker-${partner.id}`;
      el.className = 'rider-marker-node cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-300';
      
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-2 rounded-full opacity-40 animate-ping" style="background-color: ${statusColor};"></div>
          <div class="p-2 rounded-2xl shadow-2xl backdrop-blur flex items-center gap-2 border-2 ${isSelected ? 'ring-4 ring-purple-500 bg-purple-950 text-white border-purple-400 scale-110' : 'bg-slate-950 text-slate-100 border-indigo-900'}">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs" style="background-color: ${statusColor}; color: #0f172a;">
              🛵
            </div>
            <div class="text-left pr-1">
              <div class="text-[11px] font-black leading-tight text-white">${partner.name}</div>
              <div class="text-[9px] font-mono font-bold text-emerald-400">${loc.speed ? `${loc.speed} km/h` : 'Stopped'}</div>
            </div>
          </div>
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedPartnerId(partner.id);
        map.flyTo({
          center: [loc.lng, loc.lat],
          zoom: 14.5,
          speed: 1.2
        });
      });

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="color: #0f172a; padding: 6px; font-family: system-ui;">
          <div style="font-weight: 800; font-size: 13px;">${partner.name}</div>
          <div style="font-size: 11px; color: #475569;">Vehicle: ${partner.vehicle || 'Bike'}</div>
          <div style="font-size: 11px; color: #059669; font-weight: 700; margin-top: 4px;">📍 ${loc.address || 'Faridabad NCR'}</div>
          <div style="margin-top: 6px;">
            <a href="tel:${partner.phone}" style="display: inline-block; background-color: #10b981; color: white; padding: 4px 10px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 11px;">📞 Call Rider</a>
          </div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current[riderKey] = marker;
    });
  }, [partners, selectedPartnerId, isOpen, mapLoaded, activeStyle, outletLocations]);

  if (!isOpen) return null;

  const activePartner = partners.find((p) => p.id === selectedPartnerId) || partners[0];

  const handlePartnerClick = (p: DeliveryPartner) => {
    setSelectedPartnerId(p.id);
    const loc = p.location || { lat: 28.4520, lng: 77.3180 };
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [loc.lng, loc.lat],
        zoom: 14.5,
        speed: 1.2
      });
    }
  };

  const handleCenterMap = () => {
    if (!mapRef.current) return;
    if (activePartner?.location) {
      mapRef.current.flyTo({
        center: [activePartner.location.lng, activePartner.location.lat],
        zoom: 14.5,
        speed: 1.2
      });
    } else {
      mapRef.current.flyTo({
        center: [77.3180, 28.4520],
        zoom: 12.5
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b0e1e] border border-indigo-900/80 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-scale-in">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/90 via-[#0d1127] to-indigo-950/90 border-b border-indigo-900/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg">
              <Radio className="w-5 h-5 text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Delivery Partner Live GPS Tracking
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-extrabold text-[10px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  MAPLIBRE LIVE GPS ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Track live locations, speed, and active delivery routes in real-time
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-indigo-950 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          {/* Left Side: Partner List */}
          <div className="p-3 sm:p-4 bg-[#080a17] border-r border-indigo-950 space-y-3 overflow-y-auto max-h-[280px] lg:max-h-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Riders ({partners.length})
              </span>
              <button
                onClick={() => {
                  setIsSimulating(true);
                  if (onSimulateMovement) onSimulateMovement();
                  setTimeout(() => setIsSimulating(false), 800);
                }}
                className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-950/50 border border-purple-800/60 px-2.5 py-1 rounded-lg transition"
              >
                <RefreshCw className={`w-3 h-3 ${isSimulating ? 'animate-spin' : ''}`} />
                <span>Sync GPS</span>
              </button>
            </div>

            <div className="space-y-2">
              {partners.map((p) => {
                const isSel = p.id === selectedPartnerId;
                const loc = p.location || { lat: 28.45, lng: 77.32, address: 'Faridabad Sector 31', speed: 0, updated_at: '' };

                return (
                  <button
                    key={p.id}
                    onClick={() => handlePartnerClick(p)}
                    className={`w-full p-3 rounded-2xl text-left transition border flex items-center justify-between gap-3 ${
                      isSel
                        ? 'bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border-purple-500/80 shadow-lg shadow-purple-950/40 ring-2 ring-purple-500/30'
                        : 'bg-[#0f1328] hover:bg-[#151a36] border-indigo-950 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${
                          p.status === 'on_delivery'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          <Truck className="w-5 h-5" />
                        </div>
                        <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0b0e1e] ${
                          p.status === 'on_delivery' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                        }`} />
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white truncate flex items-center gap-1.5">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {p.vehicle || 'Delivery Bike'}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-bold truncate mt-0.5">
                          📍 {loc.address}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-purple-300 font-mono">
                        {loc.speed ? `${loc.speed} km/h` : 'Stopped'}
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                        p.status === 'on_delivery' ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
                      }`}>
                        {p.status === 'on_delivery' ? 'On Trip' : 'Available'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Side: Maplibre GL Map Container */}
          <div className="lg:col-span-2 relative bg-[#060813] min-h-[380px] sm:min-h-[480px] p-3 sm:p-4 flex flex-col justify-between overflow-hidden">
            {/* Top Overlay Bar & Map Style Switcher */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-[#0c0f24]/90 backdrop-blur border border-indigo-900/60 p-3 rounded-2xl shadow-xl">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400 animate-spin-slow" />
                <span className="text-xs font-extrabold text-white hidden sm:inline">Map View:</span>
                
                {/* Style Selector Tabs */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-indigo-950">
                  <button
                    onClick={() => setActiveStyle('carto_dark')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                      activeStyle === 'carto_dark'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🌙 Dark Map
                  </button>
                  <button
                    onClick={() => setActiveStyle('osm')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                      activeStyle === 'osm'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🗺️ OpenStreetMap
                  </button>
                  <button
                    onClick={() => setActiveStyle('openfreemap')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                      activeStyle === 'openfreemap'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🚀 OpenFreeMap
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSetOutletModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-[11px] shadow-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-300" />
                  Set Outlet Location
                </button>

                <button
                  onClick={handleCenterMap}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 border border-purple-600/50 text-purple-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Center Rider
                </button>

                {activePartner && (
                  <a
                    href={`tel:${activePartner.phone}`}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </a>
                )}
              </div>
            </div>

            {/* MapLibre DOM Node Container */}
            <div className="relative z-10 my-3 flex-1 border border-indigo-950 rounded-2xl overflow-hidden shadow-2xl min-h-[320px] bg-slate-950">
              <div ref={mapContainerRef} className="w-full h-full min-h-[320px] absolute inset-0" />
            </div>

            {/* Bottom Status Card */}
            {activePartner && (
              <div className="relative z-10 bg-[#0c0f24]/95 border border-indigo-900/80 p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-white flex items-center gap-2">
                      <span>{activePartner.name} ({activePartner.login_id})</span>
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                        LAT: {activePartner.location?.lat.toFixed(4) || '28.4520'} • LNG: {activePartner.location?.lng.toFixed(4) || '77.3180'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Vehicle: {activePartner.vehicle || 'Standard Bike'} • Total Deliveries Completed: <strong>{activePartner.total_deliveries}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-purple-300 bg-purple-950/80 border border-purple-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    Live Map active
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SetOutletLocationModal
        isOpen={isSetOutletModalOpen}
        onClose={() => setIsSetOutletModalOpen(false)}
      />
    </div>
  );
};
