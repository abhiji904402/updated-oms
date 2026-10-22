import React from 'react';
import {
  LayoutGrid,
  Plus,
  Store,
  Truck,
  BarChart2,
  Bell,
  FileSpreadsheet,
  Printer,
  MessageSquare,
  KeyRound,
  LogOut,
  X
} from 'lucide-react';
import { useOMS } from '../lib/store';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpenMobile?: boolean;
  setIsOpenMobile?: (open: boolean) => void;
  onOpenAddModal?: () => void;
  onOpenThermalModal?: () => void;
  onOpenSheetModal?: () => void;
  onOpenPasswordModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile = false,
  setIsOpenMobile,
  onOpenAddModal,
  onOpenPasswordModal
}) => {
  const { session, logout, orders } = useOMS();
  const currentRole = session?.role || 'admin';

  const navItems = [
    {
      id: 'outlet',
      icon: Store,
      label: 'Outlet Reports',
      roles: ['admin', 'manager', 'outlet']
    },
    {
      id: 'delivery',
      icon: Truck,
      label: 'Delivery Partners',
      roles: ['admin', 'manager', 'delivery', 'rider']
    },
    {
      id: 'analytics',
      icon: BarChart2,
      label: 'Reports',
      roles: ['admin', 'manager', 'outlet']
    },
    {
      id: 'alerts',
      icon: Bell,
      label: 'Alerts',
      roles: ['admin', 'manager']
    },
    {
      id: 'sheets',
      icon: FileSpreadsheet,
      label: 'Google Sheets',
      roles: ['admin', 'manager']
    },
    {
      id: 'kot_print',
      icon: Printer,
      label: 'KOT Print',
      roles: ['admin', 'manager', 'outlet']
    },
    {
      id: 'whatsapp',
      icon: MessageSquare,
      label: 'WhatsApp Hub',
      roles: ['admin', 'manager'],
      isWhatsApp: true
    }
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(currentRole));

  const handleSelect = (id: string) => {
    setActiveTab(id);
    if (setIsOpenMobile) {
      setIsOpenMobile(false);
    }
  };

  const isDashboardActive = activeTab === 'dashboard' || activeTab === 'admin';

  return (
    <>
      {/* Backdrop for Auto-Hide Sidebar across all screen sizes */}
      {isOpenMobile && (
        <div
          onClick={() => setIsOpenMobile && setIsOpenMobile(false)}
          className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Auto-Hide Slide-Over Sidebar Container */}
      <aside
        className={`
          fixed top-0 inset-y-0 left-0 z-50
          w-72 bg-[#07080e] border-r border-white/10 flex flex-col h-screen shrink-0
          transform transition-transform duration-200 ease-in-out shadow-2xl
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Top Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-white p-0.5 shadow-[0_0_18px_rgba(139,92,246,0.6)] border border-purple-400/50 shrink-0">
              <img
                src="/logo.png"
                alt="Broomies"
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                }}
              />
            </div>
            <div>
              <h1 className="font-black text-white text-lg tracking-wider uppercase leading-none">
                BROOMIES
              </h1>
              <p className="text-[10px] text-purple-400 font-extrabold tracking-widest uppercase mt-1">
                BAKERY ORDER SYSTEM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpenMobile && setIsOpenMobile(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Scrollable Navigation */}
        <div className="flex-1 px-4 py-5 space-y-2.5 overflow-y-auto">
          {/* Primary Dashboard Pill Button */}
          {currentRole !== 'delivery' && (
            <button
              type="button"
              onClick={() => handleSelect('dashboard')}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-bold text-sm transition cursor-pointer ${
                isDashboardActive
                  ? 'bg-[#8b31ff] text-white shadow-[0_0_24px_rgba(139,49,255,0.55)]'
                  : 'bg-[#121424] hover:bg-[#191c32] text-slate-200'
              }`}
            >
              <LayoutGrid className="w-5 h-5 shrink-0" />
              <span>Dashboard</span>
            </button>
          )}

          {/* Primary + Add Order Pill Button */}
          {onOpenAddModal && currentRole !== 'delivery' && (
            <button
              type="button"
              onClick={() => {
                onOpenAddModal();
                if (setIsOpenMobile) setIsOpenMobile(false);
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-[#8b31ff] hover:bg-[#7c22f0] text-white font-bold text-sm shadow-[0_0_24px_rgba(139,49,255,0.45)] transition cursor-pointer"
            >
              <Plus className="w-5 h-5 shrink-0" />
              <span>Add Order</span>
            </button>
          )}

          {/* Secondary Navigation Items */}
          <div className="pt-2 space-y-1">
            {filteredNav.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-purple-950/70 text-white border border-purple-500/40'
                      : 'text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <item.icon
                      className={`w-5 h-5 shrink-0 ${
                        item.isWhatsApp ? 'text-emerald-400' : 'text-slate-300'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.isWhatsApp && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/60 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                      AUTO
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Action Cards: Passwords & Security + Logout System */}
          <div className="pt-3 space-y-2.5">
            {currentRole === 'admin' && onOpenPasswordModal && (
              <button
                type="button"
                onClick={() => {
                  onOpenPasswordModal();
                  if (setIsOpenMobile) setIsOpenMobile(false);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-purple-500/30 bg-[#100c1e]/90 hover:bg-purple-950/40 text-purple-200 font-bold text-sm transition cursor-pointer"
              >
                <KeyRound className="w-5 h-5 text-purple-400 shrink-0" />
                <span>Passwords &amp; Security</span>
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-rose-500/30 bg-[#160b14]/90 hover:bg-rose-950/40 text-rose-400 font-bold text-sm transition cursor-pointer"
            >
              <LogOut className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Logout System</span>
            </button>
          </div>
        </div>

        {/* System Live Footer */}
        <div className="p-4 border-t border-white/10 bg-[#07080e] space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">System Live:</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-950 border border-emerald-400 inline-block" />
              <span>Connected</span>
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Outlet: {session?.outlet || 'Sector 31'} | {(orders || []).length} total orders
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
