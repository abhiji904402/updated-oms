import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass, Maximize2, Minus, Navigation, Plus, RotateCcw } from 'lucide-react';

// Reliable default CARTO dark tile raster style (No API key needed)
export const DEFAULT_MAP_STYLE: maplibregl.StyleSpecification = {
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
      attribution: '&copy; OpenStreetMap &copy; CARTO'
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

export const OSM_LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap'
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

interface MapContextType {
  map: maplibregl.Map | null;
  isLoaded: boolean;
  activeStyle: 'dark' | 'osm' | 'liberty';
  setActiveStyle: (style: 'dark' | 'osm' | 'liberty') => void;
  recenter: () => void;
}

const MapContext = createContext<MapContextType>({
  map: null,
  isLoaded: false,
  activeStyle: 'dark',
  setActiveStyle: () => {},
  recenter: () => {}
});

export const useMap = () => useContext(MapContext);

export interface MapMarkerData {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  subtitle?: string;
  color?: string;
  icon?: string;
  popupHtml?: string;
}

export interface MapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  pitch?: number;
  bearing?: number;
  className?: string;
  children?: React.ReactNode;
  markers?: MapMarkerData[];
  onMarkerClick?: (marker: MapMarkerData) => void;
  interactive?: boolean;
}

export const Map: React.FC<MapProps> = ({
  center = [77.3180, 28.4520], // Default center (NCR / Faridabad base)
  zoom = 11,
  pitch = 0,
  bearing = 0,
  className = 'w-full h-full min-h-[300px]',
  children,
  markers = [],
  onMarkerClick,
  interactive = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeStyle, setActiveStyle] = useState<'dark' | 'osm' | 'liberty'>('dark');
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

  const initialCenterRef = useRef<[number, number]>(center);
  const initialZoomRef = useRef<number>(zoom);

  const getStyleSpec = (type: 'dark' | 'osm' | 'liberty'): string | maplibregl.StyleSpecification => {
    if (type === 'liberty') return 'https://tiles.openfreemap.org/styles/liberty';
    if (type === 'osm') return OSM_LIGHT_STYLE;
    return DEFAULT_MAP_STYLE;
  };

  // Initialize MapLibre GL
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getStyleSpec(activeStyle),
      center: [center[0], center[1]] as [number, number],
      zoom: zoom,
      pitch: pitch,
      bearing: bearing,
      interactive: interactive
    });

    map.on('error', (e) => {
      console.warn('MapLibre error, switching style:', e);
      if (activeStyle === 'liberty') {
        setActiveStyle('dark');
      }
    });

    map.on('load', () => {
      setIsLoaded(true);
      map.resize();
      setTimeout(() => map.resize(), 200);
      setTimeout(() => map.resize(), 500);
    });

    mapRef.current = map;

    // Resize observer for responsive cards
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      Object.values(markersRef.current).forEach((m: maplibregl.Marker) => m.remove());
      markersRef.current = {};
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setIsLoaded(false);
    };
  }, [activeStyle]);

  // Center update
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      mapRef.current.flyTo({ center, zoom, duration: 800 });
    }
  }, [center, zoom, isLoaded]);

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Remove old markers
    Object.values(markersRef.current).forEach((m: maplibregl.Marker) => m.remove());
    markersRef.current = {};

    markers.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'custom-map-marker cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 hover:scale-110';
      
      const color = m.color || '#a855f7';
      const icon = m.icon || '📍';

      el.innerHTML = `
        <div style="background-color: ${color};" class="px-2.5 py-1 rounded-xl text-slate-950 font-black text-xs shadow-2xl flex items-center gap-1.5 border-2 border-white ring-2 ring-black/40">
          <span>${icon}</span>
          ${m.title ? `<span class="truncate max-w-[120px] text-[11px] font-bold">${m.title}</span>` : ''}
        </div>
      `;

      el.addEventListener('click', () => {
        if (onMarkerClick) onMarkerClick(m);
        map.flyTo({ center: [m.lng, m.lat], zoom: Math.max(map.getZoom(), 13), duration: 600 });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([m.lng, m.lat]);

      if (m.popupHtml || m.subtitle) {
        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
          m.popupHtml || `<div class="p-2 text-slate-900 font-bold text-xs">
            <div class="font-extrabold text-sm text-purple-900">${m.title || 'Location'}</div>
            <div class="text-[11px] text-slate-600 mt-0.5">${m.subtitle || ''}</div>
          </div>`
        );
        marker.setPopup(popup);
      }

      marker.addTo(map);
      markersRef.current[m.id] = marker;
    });
  }, [markers, isLoaded, onMarkerClick]);

  const recenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: initialCenterRef.current,
        zoom: initialZoomRef.current,
        pitch: pitch,
        duration: 1000
      });
    }
  };

  return (
    <MapContext.Provider value={{ map: mapRef.current, isLoaded, activeStyle, setActiveStyle, recenter }}>
      <div className={`relative overflow-hidden bg-slate-950 rounded-2xl ${className}`}>
        <div ref={containerRef} className="w-full h-full absolute inset-0" />
        {children}
      </div>
    </MapContext.Provider>
  );
};

export const MapControls: React.FC<{
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showStylePicker?: boolean;
}> = ({ position = 'top-right', showStylePicker = true }) => {
  const { map, activeStyle, setActiveStyle, recenter } = useMap();

  const handleZoomIn = () => map?.zoomIn();
  const handleZoomOut = () => map?.zoomOut();
  const handleResetNorth = () => map?.resetNorthPitch();

  const posClasses = {
    'top-right': 'top-3 right-3',
    'top-left': 'top-3 left-3',
    'bottom-right': 'bottom-3 right-3',
    'bottom-left': 'bottom-3 left-3'
  }[position];

  return (
    <div className={`absolute z-10 flex flex-col gap-2 ${posClasses}`}>
      <div className="flex flex-col bg-[#0b0e20]/90 backdrop-blur border border-indigo-900/80 rounded-xl overflow-hidden shadow-2xl">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-2 text-slate-300 hover:text-white hover:bg-purple-900/50 transition border-b border-indigo-950"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-2 text-slate-300 hover:text-white hover:bg-purple-900/50 transition border-b border-indigo-950"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={recenter}
          className="p-2 text-slate-300 hover:text-white hover:bg-purple-900/50 transition border-b border-indigo-950"
          title="Recenter Map"
        >
          <Navigation className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetNorth}
          className="p-2 text-slate-300 hover:text-white hover:bg-purple-900/50 transition"
          title="Reset Bearing"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {showStylePicker && (
        <div className="flex bg-[#0b0e20]/90 backdrop-blur border border-indigo-900/80 p-1 rounded-xl shadow-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveStyle('dark')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              activeStyle === 'dark' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setActiveStyle('osm')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              activeStyle === 'osm' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Light
          </button>
          <button
            type="button"
            onClick={() => setActiveStyle('liberty')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              activeStyle === 'liberty' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Vector
          </button>
        </div>
      )}
    </div>
  );
};
