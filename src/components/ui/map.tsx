import React, { useState, useEffect } from 'react';
import { Plus, Minus, Compass, Navigation } from 'lucide-react';
import { Map as GoogleMap, AdvancedMarker, useMap as useGoogleMap } from '@vis.gl/react-google-maps';

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

const MapController = ({ 
  centerLat, 
  centerLng, 
  zoom 
}: { 
  centerLat: number; 
  centerLng: number; 
  zoom: number; 
}) => {
  const map = useGoogleMap();
  useEffect(() => {
    if (map) {
      map.panTo({ lat: centerLat, lng: centerLng });
      map.setZoom(zoom);
    }
  }, [map, centerLat, centerLng, zoom]);
  return null;
};

export const Map: React.FC<MapProps> = ({
  center = [77.3180, 28.4520],
  zoom = 11,
  pitch = 0,
  bearing = 0,
  className = 'w-full h-full min-h-[300px]',
  children,
  markers = [],
  onMarkerClick,
  interactive = true
}) => {
  return (
    <div className={`relative overflow-hidden bg-slate-950 rounded-2xl ${className}`}>
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultZoom={zoom}
        defaultCenter={{ lat: center[1], lng: center[0] }}
        disableDefaultUI={true}
        gestureHandling={interactive ? 'auto' : 'none'}
        internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
        style={{ width: '100%', height: '100%' }}
      >
        <MapController centerLat={center[1]} centerLng={center[0]} zoom={zoom} />
        {children}
        {markers.map((m) => (
          <AdvancedMarker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            onClick={() => onMarkerClick?.(m)}
          >
            <div style={{ backgroundColor: m.color || '#a855f7' }} className="px-2.5 py-1 rounded-xl text-slate-950 font-black text-xs shadow-2xl flex items-center gap-1.5 border-2 border-white ring-2 ring-black/40">
              <span>{m.icon || '📍'}</span>
              {m.title && <span className="truncate max-w-[120px] text-[11px] font-bold">{m.title}</span>}
            </div>
          </AdvancedMarker>
        ))}
      </GoogleMap>
    </div>
  );
};

export const MapControls: React.FC<{
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showStylePicker?: boolean;
}> = ({ position = 'top-right', showStylePicker = true }) => {
  // We can leave this as a no-op or connect it to useGoogleMap()
  return null; 
};
