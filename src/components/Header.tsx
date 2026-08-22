import React from 'react';
import { useOMS } from '../lib/store';
import { exportToCSV, printPDFReport } from '../lib/exportUtils';
import { matchesOutlet } from '../lib/outletUtils';
import { getNormalizedDateStr } from '../lib/orderLogic';
import {
  Search,
  Download,
  FileText,
  Menu,
  Bell,
  CheckCircle2,
  Filter,
  Sparkles,
  Calendar,
  LogOut,
  Key,
  X,
  HardDrive
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenAddModal: () => void;
  onOpenPasswordModal?: () => void;
  onOpenSheetModal?: () => void;
  onOpenVaultModal?: () => void;
}

export const Header = React.memo<HeaderProps>(({
  onToggleMobileMenu,
  onOpenAddModal,
  onOpenPasswordModal,
  onOpenSheetModal,
  onOpenVaultModal
}) => {
  const {
    orders,
    session,
    logout,
    searchQuery,
    setSearchQuery,
    selectedOutletFilter,
    setSelectedOutletFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    dateRangeFilter,
    setDateRangeFilter,
    recentNotification,
    dismissNotification,
    sheetConfig,
    isFirestoreQuotaExceeded
  } = useOMS();

  // Outlets list
  const outlets = ['ALL', 'Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];
  const statuses = ['ALL', 'pending', 'processing', 'out_for_delivery', 'delivered', 'on_hold', 'cancelled'];

  // Dynamically filter orders based on current top header filters (outlet, status, search, date)
  const filteredHeaderOrders = React.useMemo(() => {
    return orders.filter((o) => {
      // 1. Outlet Filter
      const activeOutlet = session.role === 'outlet' ? session.outlet : selectedOutletFilter;
      if (activeOutlet && activeOutlet !== 'ALL') {
        if (!matchesOutlet(o.outlet, activeOutlet)) return false;
      }

      // 2. Status Filter
      if (selectedStatusFilter && selectedStatusFilter !== 'ALL') {
        if (o.status !== selectedStatusFilter) return false;
      }

      // 3. Search Query Filter
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = o.order_number.toString().includes(q);
        const matchCust = (o.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (o.mobile_number || '').includes(q);
        const matchItem = (o.item_type || '').toLowerCase().includes(q);
        const matchOutlet = (o.outlet || '').toLowerCase().includes(q);
        const matchAddr = (o.address || '').toLowerCase().includes(q);
        const matchRider = (o.delivery_partner || '').toLowerCase().includes(q);
        const matchAdvBill = (o.advance_bill_number || (o as any).adv_bill || '').toLowerCase().includes(q);
        const matchFinalBill = (o.final_bill_number || (o as any).final_bill || (o as any).bill_number || '').toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchPhone && !matchItem && !matchOutlet && !matchAddr && !matchRider && !matchAdvBill && !matchFinalBill) {
          return false;
        }
      }

      // 4. Date Range Filter
      if (dateRangeFilter) {
        const delDate = getNormalizedDateStr(o.delivery_date) || getNormalizedDateStr(o.order_date);
        if (dateRangeFilter.start && delDate < dateRangeFilter.start) return false;
        if (dateRangeFilter.end && delDate > dateRangeFilter.end) return false;
      }

      return true;
    });
  }, [orders, session, selectedOutletFilter, selectedStatusFilter, searchQuery, dateRangeFilter]);

  return (
    <header className="sticky top-0 z-30 bg-zinc-950 border-b border-zinc-800 px-4 py-3 shadow-md">
      {/* Toast Banner for Real-time Notifications */}
      {recentNotification && (
        <div className="mb-2 p-2 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            <span className="font-semibold">{recentNotification}</span>
          </div>
          <button
            onClick={dismissNotification}
            className="text-emerald-400 hover:text-white font-bold text-sm px-1"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Left Section: Mobile Menu Toggle & Search Bar */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-1">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Logo Badge */}
          <div className="flex items-center gap-2 lg:hidden shrink-0">
            <img
              src="/app-icon.svg"
              alt="Broomies Logo"
              className="w-8 h-8 rounded-lg object-cover border border-purple-500/40 bg-slate-950 shadow-md"
            />
            <span className="font-extrabold text-xs text-white tracking-tight hidden sm:inline">BROOMIES</span>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order #, Customer, Mobile, or Item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950/80 border border-slate-700/70 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/80 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Middle Filters: Outlet & Status dropdowns (Hidden for Delivery Riders) */}
        {session.role !== 'delivery' && (
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <select
                value={session.role === 'outlet' ? session.outlet : selectedOutletFilter}
                disabled={session.role === 'outlet'}
                onChange={(e) => setSelectedOutletFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none pr-1 py-1 cursor-pointer font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {session.role !== 'outlet' && <option value="ALL" className="bg-slate-900 text-slate-200">All Outlets</option>}
                {outlets.filter(o => o !== 'ALL').map((o) => (
                  <option key={o} value={o} className="bg-slate-900 text-slate-200">{o}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none px-2 py-1 cursor-pointer capitalize font-medium"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">All Statuses</option>
                {statuses.filter(s => s !== 'ALL').map((s) => (
                  <option key={s} value={s} className="bg-slate-900 text-slate-200 capitalize">{s}</option>
                ))}
              </select>
            </div>

            {/* Date Range Filter Pickers */}
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
              <input
                type="date"
                value={dateRangeFilter?.start || ''}
                onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, start: e.target.value })}
                className="bg-transparent text-slate-200 text-xs focus:outline-none w-28 font-medium cursor-pointer"
                title="Filter From Date"
              />
              <span className="text-slate-500 font-bold">-</span>
              <input
                type="date"
                value={dateRangeFilter?.end || ''}
                onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, end: e.target.value })}
                className="bg-transparent text-slate-200 text-xs focus:outline-none w-28 font-medium cursor-pointer"
                title="Filter To Date"
              />
              {(dateRangeFilter?.start || dateRangeFilter?.end) && (
                <button
                  onClick={() => setDateRangeFilter({ start: '', end: '' })}
                  className="px-1.5 py-0.5 text-[10px] bg-rose-950/80 border border-rose-800/60 text-rose-300 hover:text-white rounded font-bold transition"
                  title="Clear Date Filter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Right Section: Export Actions, Password Settings & Logout */}
        <div className="flex items-center justify-end gap-2 w-full lg:w-auto">
          {/* 24/7 Live Cloud Sync Indicator Badge (Admin & Outlet) */}
          {session.role !== 'delivery' && (
            <button
              onClick={onOpenSheetModal}
              title="Real-time Live Cloud Sync is ACTIVE across all devices and Google Sheets. Click to configure."
              className="px-3 py-1.5 rounded-xl border transition text-xs font-bold flex items-center gap-1.5 shadow-sm bg-emerald-950/70 hover:bg-emerald-900/80 border-emerald-500/50 text-emerald-300"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>LIVE CLOUD SYNC</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </button>
          )}

          {/* Local Storage Zero-Loss Vault Button */}
          {session.role !== 'delivery' && onOpenVaultModal && (
            <button
              onClick={onOpenVaultModal}
              title="Local Disk Vault & 100% Zero Data-Loss Backup (IndexedDB + Storage Folders). Click to download or restore backup."
              className="px-3 py-1.5 rounded-xl border transition text-xs font-bold flex items-center gap-1.5 shadow-sm bg-purple-950/70 hover:bg-purple-900/80 border-purple-500/50 text-purple-300"
            >
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">LOCAL VAULT</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-800 text-[10px] text-purple-200">
                {orders.length}
              </span>
            </button>
          )}

          {/* Rider Mode Indicator Badge */}
          {session.role === 'delivery' && (
            <div className="px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-800/60 text-purple-300 text-xs font-extrabold flex items-center gap-1.5">
              <span>🛵 Rider Mode</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}


          {/* Export CSV (Admin & Outlet only) */}
          {session.role !== 'delivery' && (
            <button
              onClick={() => {
                if (filteredHeaderOrders.length === 0) {
                  alert('No matching orders found to export for the current filters.');
                  return;
                }
                exportToCSV(filteredHeaderOrders, `Filtered_Orders_${new Date().toISOString().split('T')[0]}.csv`);
              }}
              title={`Export ${filteredHeaderOrders.length} Filtered CSV Records`}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 transition text-xs font-medium flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden xl:inline">Export CSV ({filteredHeaderOrders.length})</span>
            </button>
          )}

          {/* Export PDF Report (Admin & Outlet only) */}
          {session.role !== 'delivery' && (
            <button
              onClick={() => {
                if (filteredHeaderOrders.length === 0) {
                  alert('No matching orders found to export for the current filters.');
                  return;
                }
                const outletName = session.role === 'outlet' ? session.outlet : selectedOutletFilter;
                const subtitle = outletName !== 'ALL' ? ` - ${outletName}` : '';
                printPDFReport(filteredHeaderOrders, `Broomies Bakery - Filtered Orders Report${subtitle} (${filteredHeaderOrders.length} Records)`);
              }}
              title={`Generate PDF Summary for ${filteredHeaderOrders.length} Filtered Records`}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 transition text-xs font-medium flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="hidden xl:inline">PDF Report ({filteredHeaderOrders.length})</span>
            </button>
          )}

          {/* Logout Button */}
          <button
            onClick={logout}
            title="Logout"
            className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 hover:text-white transition text-xs font-bold flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
});
