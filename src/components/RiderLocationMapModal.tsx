import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Truck,
  Compass,
  Phone,
  ShieldCheck,
  Zap,
  Navigation,
} from 'lucide-react';
import { DeliveryPartner } from '../types';
import { useOMS } from '../lib/store';
import { SetOutletLocationModal } from './SetOutletLocationModal';

interface RiderLocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  partners: DeliveryPartner[];
  onSimulateMovement?: () => void;
}

const OUTLET_LOCATIONS = [
  { name: 'Sector 31 Outlet', address: 'Shop no. 4, Ch. Hetram Complex, Sector 31', lat: 28.4682, lng: 77.3060, color: '#10b981' },
  { name: 'Sector 35 Outlet', address: 'Shop No.9, Ashoka Enclave Part 3, Sector 35', lat: 28.4875, lng: 77.3082, color: '#f59e0b' },
  { name: 'Sector 42 Outlet', address: 'B-107, Greenfield Colony, Sector 42', lat: 28.4632, lng: 77.3015, color: '#3b82f6' },
  { name: 'Sector 88 Outlet', address: 'Shop 112, RPS Savana Rd, Sector 88', lat: 28.4118, lng: 77.3458, color: '#8b5cf6' }
];

// Inner component to use map hooks
const MapController = ({ 
  centerLat, 
  centerLng 
}: { 
  centerLat: number; 
  centerLng: number;
}) => {
  return null;
};

export const RiderLocationMapModal: React.FC<RiderLocationMapModalProps> = ({
  isOpen,
  onClose,
  partners,
  onSimulateMovement
}) => {
  const { outletLocations } = useOMS();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(partners[0]?.id || null);
  const [isSetOutletModalOpen, setIsSetOutletModalOpen] = useState(false);

  useEffect(() => {
    if (!selectedPartnerId && partners.length > 0) {
      setSelectedPartnerId(partners[0].id);
    }
  }, [partners, selectedPartnerId]);

  useEffect(() => {
    if (!isOpen || !onSimulateMovement) return;
    const interval = setInterval(() => {
      onSimulateMovement();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, onSimulateMovement]);

  if (!isOpen) return null;

  const activePartner = partners.find((p) => p.id === selectedPartnerId);
  const defaultLat = activePartner?.location?.lat || partners[0]?.location?.lat || 28.4520;
  const defaultLng = activePartner?.location?.lng || partners[0]?.location?.lng || 77.3180;

  const outlets = outletLocations && outletLocations.length > 0 ? outletLocations : OUTLET_LOCATIONS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-6xl max-h-[95vh] bg-[#0c0f1d] border border-indigo-900/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 sm:py-4 bg-gradient-to-r from-purple-950 via-[#11152a] to-indigo-950 border-b border-indigo-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Compass className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Live Fleet Tracking
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Real-time delivery partner locations & status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 overflow-hidden min-h-0">
          {/* Left Side: Rider List */}
          <div className="hidden lg:flex flex-col bg-[#0b0e1e] border-r border-indigo-900/40 min-h-0">
            <div className="p-4 border-b border-indigo-950">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                Active Partners ({partners.filter(p => p.location).length})
              </h3>
              <p className="text-[10px] text-slate-500">
                Select a rider to focus their location on the map.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {partners.map((p) => {
                const loc = p.location;
                if (!loc) return null;
                const isActive = selectedPartnerId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPartnerId(p.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-purple-900/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                        : 'bg-[#13172b] border-indigo-950/60 hover:border-indigo-800'
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
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white truncate flex items-center gap-1.5">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-bold truncate mt-0.5">
                          📍 {loc.address}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Side: Google Map Container */}
          <div className="lg:col-span-2 relative bg-[#060813] min-h-[380px] sm:min-h-[480px] p-3 sm:p-4 flex flex-col justify-between overflow-hidden">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-[#0c0f24]/90 backdrop-blur border border-indigo-900/60 p-3 rounded-2xl shadow-xl">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-extrabold text-white hidden sm:inline">Map View:</span>
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
              </div>
            </div>

            {/* Google Map Node */}
            <div className="relative z-10 my-3 flex-1 border border-indigo-950 rounded-2xl overflow-hidden shadow-2xl min-h-[320px] bg-slate-950 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Compass className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Map View Disabled</p>
              </div>
            </div>

            {activePartner && (
              <div className="relative z-10 bg-[#0c0f24]/95 border border-indigo-900/80 p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-white flex items-center gap-2">
                      <span>{activePartner.name}</span>
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                        LAT: {activePartner.location?.lat.toFixed(4) || '28.4520'} • LNG: {activePartner.location?.lng.toFixed(4) || '77.3180'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Vehicle: {activePartner.vehicle || 'Standard Bike'}
                    </div>
                  </div>
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
