import React from 'react';
import { useOMS } from '../lib/store';
import { Plus, Cake, FileText, Smartphone, Truck, Store, LayoutDashboard } from 'lucide-react';

interface HeaderProps {
  activeTab?: string;
  setActiveTab?: (t: string) => void;
  onOpenAddModal: () => void;
  onToggleMobileMenu?: () => void;
  onOpenPasswordModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenAddModal }) => {
  const { session, recentNotification } = useOMS();

  return (
    <header className="sticky top-0 z-40 bg-[#0c0f1e]/90 backdrop-blur-md border-b border-indigo-950/80 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-1.5">
                <span>BROOMIES</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60">
                  OMS
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Order Management & Multi-Outlet System</p>
            </div>
          </div>

          {/* Mobile Add Order Button */}
          <button
            onClick={onOpenAddModal}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Order</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'admin', label: 'All Orders', icon: LayoutDashboard },
            { id: 'outlet', label: 'Outlets', icon: Store },
            { id: 'delivery', label: 'Delivery', icon: Truck },
            { id: 'reports', label: 'Reports & PDF', icon: FileText },
            { id: 'whatsapp', label: 'WhatsApp Bot', icon: Smartphone }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === id
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-inner'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Desktop Add Order Button */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 transition transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add New Order</span>
          </button>
        </div>
      </div>

      {/* Global Notification Banner */}
      {recentNotification && (
        <div className="mt-2 p-2 bg-purple-950/80 border border-purple-500/60 rounded-xl text-center text-xs font-semibold text-purple-200 animate-fadeIn">
          {recentNotification}
        </div>
      )}
    </header>
  );
};
