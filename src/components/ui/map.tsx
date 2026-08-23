import React from 'react';

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
  center?: [number, number];
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
  className = 'w-full h-full min-h-[300px]'
}) => {
  return (
    <div className={`relative overflow-hidden bg-slate-950 rounded-2xl flex items-center justify-center text-slate-500 ${className}`}>
      <p>Map View Disabled</p>
    </div>
  );
};

export const MapControls: React.FC<any> = () => null;
