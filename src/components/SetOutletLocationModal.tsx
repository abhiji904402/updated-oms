import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Check, Radio, Edit3, Compass } from 'lucide-react';
import { useOMS } from '../lib/store';
import { OutletLocation } from '../types';

interface SetOutletLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOutletId?: string;
}

export const SetOutletLocationModal: React.FC<SetOutletLocationModalProps> = ({
  isOpen,
  onClose,
  defaultOutletId = 'Sector 31'
}) => {
  const { outletLocations, updateOutletLocation } = useOMS();

  const [selectedOutletId, setSelectedOutletId] = useState<string>(defaultOutletId);
  const [address, setAddress] = useState<string>('');
  const [lat, setLat] = useState<number>(28.4446);
  const [lng, setLng] = useState<number>(77.3138);
  const [color, setColor] = useState<string>('#10b981');
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Sync state when selected outlet or modal open changes
  useEffect(() => {
    if (isOpen) {
      const target = outletLocations.find((o) => o.id === selectedOutletId) || outletLocations[0];
      if (target) {
        setAddress(target.address || '');
        setLat(target.lat || 28.4446);
        setLng(target.lng || 77.3138);
        setColor(target.color || '#10b981');
      }
    }
  }, [isOpen, selectedOutletId, outletLocations]);

  if (!isOpen) return null;

  const currentOutletObj = outletLocations.find((o) => o.id === selectedOutletId);

  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      alert('GPS is not supported by your browser');
      return;
    }
    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGettingGps(false);
        const newLat = Number(pos.coords.latitude.toFixed(6));
        const newLng = Number(pos.coords.longitude.toFixed(6));
        setLat(newLat);
        setLng(newLng);
        setAddress(`Live Device Location (${newLat}, ${newLng})`);
      },
      (err) => {
        setIsGettingGps(false);
        alert(`Could not fetch device GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateOutletLocation(selectedOutletId, {
      id: selectedOutletId,
      name: currentOutletObj?.name || `${selectedOutletId} Outlet`,
      address: address.trim() || 'Faridabad Base',
      lat: Number(lat),
      lng: Number(lng),
      color
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0c0f1d] border border-indigo-900/60 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-950 via-[#11152a] to-indigo-950 border-b border-indigo-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <MapPin className="w-5 h-5 text-purple-400 animate-bounce" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Set Outlet Map Location
              </h2>
              <p className="text-xs text-slate-400">
                Update exact GPS coordinates & address for map markers
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

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Select Outlet */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              Select Outlet to Configure
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'].map((id) => {
                const isActive = selectedOutletId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedOutletId(id)}
                    className={`p-3 rounded-2xl border text-xs font-bold text-left transition flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-lg ring-1 ring-purple-500/50'
                        : 'bg-[#13172b] border-indigo-950/80 text-slate-400 hover:border-indigo-800 hover:text-slate-200'
                    }`}
                  >
                    <span>{id} Outlet</span>
                    {isActive && <Check className="w-4 h-4 text-purple-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Action: Device GPS */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-900/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Compass className="w-5 h-5 text-indigo-400 animate-spin-slow" />
              <div>
                <p className="text-xs font-bold text-slate-200">Set from Live GPS Device</p>
                <p className="text-[11px] text-slate-400">Fetch current phone/PC coordinates</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGetCurrentGps}
              disabled={isGettingGps}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Navigation className={`w-3.5 h-3.5 ${isGettingGps ? 'animate-spin' : ''}`} />
              <span>{isGettingGps ? 'Locating...' : 'Get GPS'}</span>
            </button>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Full Outlet Address
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter exact shop number, street, sector, landmark, Faridabad..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#13172b] border border-indigo-950 focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 resize-none"
              required
            />
          </div>

          {/* Lat & Lng Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Latitude (Lat)
              </label>
              <input
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#13172b] border border-indigo-950 focus:border-purple-500 focus:outline-none text-xs text-amber-300 font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Longitude (Lng)
              </label>
              <input
                type="number"
                step="0.000001"
                value={lng}
                onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#13172b] border border-indigo-950 focus:border-purple-500 focus:outline-none text-xs text-amber-300 font-mono font-bold"
                required
              />
            </div>
          </div>

          {/* Map marker accent color */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Map Marker Pin Color
            </label>
            <div className="flex items-center gap-3">
              {['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                    color === c ? 'border-white scale-110 shadow-lg ring-2 ring-purple-500' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-indigo-950">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-xl transition flex items-center gap-2 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300 animate-bounce" />
                  <span>Location Saved!</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>Save Outlet Location</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
