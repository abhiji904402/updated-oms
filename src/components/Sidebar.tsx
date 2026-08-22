import React, { useState } from 'react';
import { useOMS } from '../lib/store';
import {
  LayoutDashboard,
  Store,
  Truck,
  BarChart3,
  Bell,
  FileSpreadsheet,
  Plus,
  X,
  Cake,
  Sparkles,
  Key,
  LogOut,
  Smartphone,
  Radio,
  MapPin,
  Download,
  HardDrive
} from 'lucide-react';
import { InstallAndroidAppModal } from './InstallAndroidAppModal';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  onOpenAddModal: () => void;
  onOpenThermalModal: () => void;
  onOpenSheetModal: () => void;
  onOpenPasswordModal?: () => void;
  onOpenVaultModal?: () => void;
}

export const Sidebar = React.memo<SidebarProps>(({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile,
  onOpenAddModal,
  onOpenThermalModal,
  onOpenSheetModal,
  onOpenPasswordModal,
  onOpenVaultModal
}) => {
  const { session, orders = [], alerts = [], logout, switchRole, partners = [] } = useOMS();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  const unreadAlertsCount = (alerts || []).filter((a) => !a.is_read).length;

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsOpenMobile(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 left-0 h-full w-64 bg-zinc-950 border-r border-zinc-800 z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full justify-between">
          <div>
            {/* Brand Header */}
            <div className="p-4 border-b border-indigo-950/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/app-icon.svg"
                  alt="Broomies Logo"
                  className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-purple-950/50 border border-purple-500/40 bg-slate-900"
                />
                <div>
                  <h1 className="font-extrabold text-lg text-white tracking-tight leading-none">
                    BROOMIES
                  </h1>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mt-1 block">
                    Bakery Order System
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpenMobile(false)}
                className="lg:hidden text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation List */}
            <div className="p-3 space-y-2.5">
              
              {/* If Rider/Delivery Role: Show Rider Profile Card & Delivery Portal */}
              {session.role === 'delivery' ? (
                <div className="space-y-3">
                  {/* Delivery Partner Profile Card inside Sidebar */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-indigo-800/60 shadow-xl space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-extrabold text-sm shadow">
                        <Truck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Rider Profile</div>
                        <div className="text-sm font-bold text-white truncate">{session.name}</div>
                        <div className="text-[11px] text-slate-400 font-medium">Delivery Partner</div>
                      </div>
                    </div>

                    {/* Partner Switcher Dropdown inside Sidebar */}
                    <div className="pt-2 border-t border-indigo-900/60 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Switch Rider Account:</label>
                      <select
                        value={session.deliveryPartnerId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const p = partners.find(p => p.id === val);
                          if (p) {
                            switchRole('delivery', undefined, p.id);
                          }
                        }}
                        className="w-full bg-[#12162a] border border-indigo-800/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-bold focus:outline-none cursor-pointer"
                      >
                        {partners.map((partner) => (
                          <option key={partner.id} value={partner.id} className="bg-slate-900 text-slate-200">
                            🛵 {partner.name} ({partner.vehicle})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTabClick('delivery')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold text-sm transition"
                  >
                    <Truck className="w-5 h-5 text-emerald-400" />
                    <span>Delivery Orders Queue</span>
                  </button>

                  {/* Install Android App Button in Sidebar */}
                  <button
                    onClick={() => {
                      setIsInstallModalOpen(true);
                      setIsOpenMobile(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-emerald-200 animate-bounce" />
                      <div className="text-left">
                        <div>Install Android App</div>
                        <div className="text-[10px] text-emerald-200 font-normal">Standalone APK Launcher</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono uppercase">
                      PWA v2.4
                    </span>
                  </button>
                </div>
              ) : session.role === 'outlet' ? (
                <div className="space-y-2.5">
                  {/* Outlet Branch Profile Badge */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/90 to-purple-950/90 border border-purple-800/60 shadow-xl mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 font-extrabold text-sm shrink-0">
                        <Store className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Outlet Manager</div>
                        <div className="text-sm font-extrabold text-white truncate">{session.outlet || 'Sector 31'}</div>
                      </div>
                    </div>
                  </div>

                  {/* 1. Dashboard */}
                  <button
                    onClick={() => handleTabClick('dashboard')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition ${
                      activeTab === 'dashboard' || activeTab === 'outlet'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5 text-purple-300" />
                    <span>Dashboard</span>
                  </button>

                  {/* 2. + Add Order Button */}
                  <button
                    onClick={() => {
                      onOpenAddModal();
                      setIsOpenMobile(false);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-900/50 flex items-center justify-start gap-3 transition active:scale-[0.98]"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Order</span>
                  </button>

                  {/* 3. Reports */}
                  <button
                    onClick={() => handleTabClick('analytics')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition ${
                      activeTab === 'analytics'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-5 h-5 text-purple-300" />
                    <span>Reports</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* 1. Dashboard */}
                  <button
                    onClick={() => handleTabClick('dashboard')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition ${
                      activeTab === 'dashboard'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    <span>Dashboard</span>
                  </button>

                  {/* 2. + Add Order Button */}
                  <button
                    onClick={() => {
                      onOpenAddModal();
                      setIsOpenMobile(false);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-900/50 flex items-center justify-start gap-3 transition active:scale-[0.98]"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Order</span>
                  </button>

                  {/* 3. Outlet Reports */}
                  <button
                    onClick={() => handleTabClick('outlet')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition ${
                      activeTab === 'outlet'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }`}
                  >
                    <Store className="w-5 h-5" />
                    <span>Outlet Reports</span>
                  </button>

                  {/* 4. Delivery Partners */}
                  <button
                    onClick={() => handleTabClick('delivery')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition ${
                      activeTab === 'delivery'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                    <span>Delivery Partners</span>
                  </button>

                  {/* 5. Reports */}
                  <button
                    onClick={() => handleTabClick('analytics')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition ${
                      activeTab === 'analytics'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-5 h-5" />
                    <span>Reports</span>
                  </button>

                  {/* 6. Alerts */}
                  <button
                    onClick={() => handleTabClick('alerts')}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-sm transition ${
                      activeTab === 'alerts'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5" />
                      <span>Alerts</span>
                    </div>
                    {unreadAlertsCount > 0 && (
                      <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {unreadAlertsCount}
                      </span>
                    )}
                  </button>

                  {/* 7. Google Sheets */}
                  <button
                    onClick={() => handleTabClick('sheets')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition ${
                      activeTab === 'sheets'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 font-bold'
                        : 'text-slate-300 hover:bg-indigo-950/50 hover:text-white'
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>Google Sheets</span>
                  </button>

                  {/* Local Storage Zero-Loss Vault & Backups */}
                  {onOpenVaultModal && (
                    <button
                      onClick={() => {
                        onOpenVaultModal();
                        setIsOpenMobile(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-sm text-emerald-300 hover:bg-emerald-950/40 hover:text-white border border-emerald-900/50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <HardDrive className="w-5 h-5 text-emerald-400" />
                        <span>Local Vault & Backups</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px]">
                        {orders.length}
                      </span>
                    </button>
                  )}

                  {/* Password Manager Button (For Admin) */}
                  {session.role === 'admin' && onOpenPasswordModal && (
                    <button
                      onClick={() => {
                        onOpenPasswordModal();
                        setIsOpenMobile(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm text-purple-300 hover:bg-purple-950/40 hover:text-white border border-purple-900/50 transition"
                    >
                      <Key className="w-5 h-5 text-purple-400" />
                      <span>Passwords & Security</span>
                    </button>
                  )}
                </>
              )}

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  setIsOpenMobile(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm text-rose-300 hover:bg-rose-950/40 hover:text-white border border-rose-900/50 transition"
              >
                <LogOut className="w-5 h-5 text-rose-400" />
                <span>Logout System</span>
              </button>

            </div>
          </div>

          {/* Footer info */}
          <div className="p-4 border-t border-indigo-950/80 bg-[#080911] text-xs text-slate-400">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-400">System Live:</span>
              <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Connected
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Outlet: {session.outlet || 'Sector 31'} | {orders.length} total orders
            </div>
          </div>
        </div>
      </aside>

      {/* Android App Install Modal */}
      <InstallAndroidAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        partnerName={session.name}
      />
    </>
  );
});
