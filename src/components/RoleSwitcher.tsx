import React, { useState } from 'react';
import { useOMS } from '../lib/store';
import { Role, OutletName } from '../types';
import { ShieldCheck, Store, Truck, ChevronDown } from 'lucide-react';

const OUTLETS: OutletName[] = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

export const RoleSwitcher: React.FC = () => {
  const { session, switchRole, partners } = useOMS();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletName>(session.outlet || OUTLETS[0]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(session.deliveryPartnerId || partners[0]?.id || '');

  const handleRoleSelect = (role: Role) => {
    switchRole(role, selectedOutlet, selectedPartnerId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 transition text-sm font-medium"
      >
        {session.role === 'admin' && <ShieldCheck className="w-4 h-4 text-rose-400" />}
        {session.role === 'outlet' && <Store className="w-4 h-4 text-amber-400" />}
        {session.role === 'delivery' && <Truck className="w-4 h-4 text-emerald-400" />}
        
        <div className="text-left leading-tight hidden sm:block">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Mode</div>
          <div className="text-xs font-bold text-slate-100">{session.name}</div>
        </div>
        
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-3 space-y-3 backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Select Dashboard Persona
          </div>

          <div className="space-y-1.5">
            {/* Admin Option */}
            <button
              onClick={() => handleRoleSelect('admin')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition ${
                session.role === 'admin'
                  ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                <div>
                  <div className="text-xs font-bold">Admin Central</div>
                  <div className="text-[11px] text-slate-400">Full control & analytics</div>
                </div>
              </div>
              {session.role === 'admin' && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
            </button>

            {/* Outlet Option */}
            <div className={`p-2.5 rounded-lg transition ${
              session.role === 'outlet'
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                : 'hover:bg-slate-800/60 text-slate-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => handleRoleSelect('outlet')}
                  className="flex items-center gap-2 text-xs font-bold text-left w-full"
                >
                  <Store className="w-4 h-4 text-amber-400" />
                  <div>
                    <div>Outlet Dashboard</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      {session.role === 'outlet' ? 'Locked to assigned branch' : 'Kitchen & dispatch view'}
                    </div>
                  </div>
                </button>
              </div>

              <select
                value={session.role === 'outlet' ? session.outlet : selectedOutlet}
                disabled={session.role === 'outlet'}
                onChange={(e) => setSelectedOutlet(e.target.value as OutletName)}
                className="w-full text-xs bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {OUTLETS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {/* Delivery Option */}
            <div className={`p-2.5 rounded-lg transition ${
              session.role === 'delivery'
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                : 'hover:bg-slate-800/60 text-slate-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => handleRoleSelect('delivery')}
                  className="flex items-center gap-2 text-xs font-bold text-left w-full"
                >
                  <Truck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div>Delivery App</div>
                    <div className="text-[11px] text-slate-400 font-normal">Mobile OTP & photo proof</div>
                  </div>
                </button>
              </div>

              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-slate-200"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.vehicle})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
