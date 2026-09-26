import React from 'react';
import { 
  LayoutDashboard, 
  Utensils, 
  Truck, 
  MessageSquare, 
  PieChart, 
  FileSpreadsheet,
  Printer,
  Bell,
  LogOut,
  ChevronRight,
  PlusCircle,
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
  onOpenThermalModal,
  onOpenSheetModal
}) => {
  const { session, logout, isWhatsAppConnected } = useOMS();
  const currentRole = session?.role || 'admin';

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Central Dashboard', roles: ['admin'] },
    { id: 'outlet', icon: Utensils, label: 'Outlet Orders', roles: ['admin', 'outlet'] },
    { id: 'delivery', icon: Truck, label: 'Delivery Panel', roles: ['admin', 'delivery', 'rider'] },
    { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp Automation', roles: ['admin'], badge: isWhatsAppConnected ? 'Online' : 'Setup' },
    { id: 'analytics', icon: PieChart, label: 'Analytics & Revenue', roles: ['admin'] },
    { id: 'sheets', icon: FileSpreadsheet, label: 'Google Sheets Sync', roles: ['admin'] },
    { id: 'kot_print', icon: Printer, label: 'KOT Printing', roles: ['admin', 'outlet'] },
    { id: 'alerts', icon: Bell, label: 'Alerts & Delays', roles: ['admin'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(currentRole));

  const handleSelect = (id: string) => {
    setActiveTab(id);
    if (setIsOpenMobile) {
      setIsOpenMobile(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={() => setIsOpenMobile && setIsOpenMobile(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full
        transform transition-transform duration-200 ease-in-out
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-white text-xl font-black italic">B</span>
            </div>
            <div>
              <h1 className="font-bold text-white text-lg tracking-tight leading-tight">Broomies</h1>
              <p className="text-[10px] text-purple-400 font-bold tracking-widest uppercase">Bakery Official</p>
            </div>
          </div>

          {isOpenMobile && (
            <button 
              onClick={() => setIsOpenMobile && setIsOpenMobile(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Quick Action Button */}
        {onOpenAddModal && (
          <div className="px-4 pt-4">
            <button
              onClick={onOpenAddModal}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Order</span>
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
            Main Navigation
          </div>
          {filteredMenu.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`
                  w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all text-sm font-medium
                  ${isActive 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      item.badge === 'Online'
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 opacity-0 transition-all ${isActive ? 'opacity-100' : ''}`} />
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer with User info & Logout */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="px-3 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs">
            <div className="truncate">
              <p className="text-white font-semibold truncate">{session?.name || 'Admin User'}</p>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{currentRole}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          </div>

          <button 
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
