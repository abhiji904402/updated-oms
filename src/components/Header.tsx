import React, { useState, useEffect } from 'react';
import { useOMS } from '../lib/store';
import { exportToCSV, printPDFReport } from '../lib/exportUtils';
import {
  Menu,
  Search,
  Filter,
  Calendar,
  Download,
  FileText,
  X,
  CheckCircle2
} from 'lucide-react';

interface HeaderProps {
  activeTab?: string;
  setActiveTab?: (t: string) => void;
  onOpenAddModal: () => void;
  onToggleMobileMenu?: () => void;
  onOpenPasswordModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu
}) => {
  const {
    session,
    orders,
    refreshOrders,
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
    showNotification
  } = useOMS();

  const [localSearch, setLocalSearch] = useState(searchQuery || '');
  const isOutletUser = session?.role === 'outlet';

  // Sync external searchQuery changes
  useEffect(() => {
    setLocalSearch(searchQuery || '');
  }, [searchQuery]);

  // 160ms debounced search input to keep typing 60fps smooth
  useEffect(() => {
    const timer = setTimeout(() => {
      if (setSearchQuery && localSearch !== searchQuery) {
        setSearchQuery(localSearch);
      }
    }, 160);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, setSearchQuery]);

  const totalOrdersCount = (orders || []).length;

  const handleExportCSV = () => {
    exportToCSV(orders || [], 'broomies_orders.csv');
    showNotification('Orders exported to CSV successfully!');
  };

  const handleExportPDF = () => {
    printPDFReport(orders || [], `Broomies Orders Report (${totalOrdersCount} Orders)`);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#080911]/95 backdrop-blur-xl border-b border-white/10 px-3 sm:px-5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Zone: Hamburger Menu Toggle + Logo + BROOMIES + Search Input */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px] max-w-2xl">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="w-9 h-9 rounded-xl bg-[#111424] hover:bg-[#1a1f36] border border-slate-800 flex items-center justify-center text-slate-200 hover:text-white transition cursor-pointer shrink-0"
            title="Toggle Navigation Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-white p-0.5 shadow-[0_0_12px_rgba(139,92,246,0.5)] border border-purple-400/50">
              <img
                src="/logo.png"
                alt="Broomies"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                }}
              />
            </div>
            <span className="font-black text-white text-sm tracking-wider uppercase hidden sm:inline">
              BROOMIES
            </span>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 ml-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by Order #, Customer, Mobile, or Item..."
              className="w-full bg-[#0e1120] border border-slate-800/90 focus:border-purple-500/60 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  if (setSearchQuery) setSearchQuery('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Zone: All Outlets | All Statuses | Date Range | Live Sync | Export CSV | PDF Report */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Outlet Filter Dropdown */}
          {!isOutletUser && (
            <div className="flex items-center gap-1.5 bg-[#0e1120] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-bold">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedOutletFilter || 'ALL'}
                onChange={(e) => setSelectedOutletFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#0e1120] text-white">All Outlets</option>
                <option value="Sector 31" className="bg-[#0e1120] text-white">Sector 31</option>
                <option value="Sector 35" className="bg-[#0e1120] text-white">Sector 35</option>
                <option value="Sector 42" className="bg-[#0e1120] text-white">Sector 42</option>
                <option value="Sector 88" className="bg-[#0e1120] text-white">Sector 88</option>
              </select>
            </div>
          )}

          {/* Status Filter Dropdown */}
          <div className="flex items-center bg-[#0e1120] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-bold">
            <select
              value={selectedStatusFilter || 'ALL'}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#0e1120] text-white">All Statuses</option>
              <option value="pending" className="bg-[#0e1120] text-white">Pending</option>
              <option value="processing" className="bg-[#0e1120] text-white">Processing</option>
              <option value="out_for_delivery" className="bg-[#0e1120] text-white">Out for Delivery</option>
              <option value="delivered" className="bg-[#0e1120] text-white">Delivered</option>
              <option value="on_hold" className="bg-[#0e1120] text-white">On Hold</option>
              <option value="cancelled" className="bg-[#0e1120] text-white">Cancelled</option>
              <option value="missed" className="bg-[#0e1120] text-white">Missed</option>
            </select>
          </div>

          {/* Date Range Picker */}
          <div className="hidden md:flex items-center gap-1.5 bg-[#0e1120] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateRangeFilter?.start || ''}
              onChange={(e) =>
                setDateRangeFilter({
                  start: e.target.value,
                  end: dateRangeFilter?.end || ''
                })
              }
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-28"
            />
            <span className="text-slate-500">-</span>
            <input
              type="date"
              value={dateRangeFilter?.end || ''}
              onChange={(e) =>
                setDateRangeFilter({
                  start: dateRangeFilter?.start || '',
                  end: e.target.value
                })
              }
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-28"
            />
            {(dateRangeFilter?.start || dateRangeFilter?.end) && (
              <button
                type="button"
                onClick={() => setDateRangeFilter({ start: '', end: '' })}
                className="text-rose-400 hover:text-white ml-1"
                title="Clear Dates"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Live Sync Pill */}
          <button
            type="button"
            onClick={refreshOrders}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-400 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            title="Click to sync latest orders"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>Live Sync ({totalOrdersCount.toLocaleString('en-IN')})</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-[#121629] hover:bg-[#1a203a] border border-slate-700/80 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV ({totalOrdersCount})</span>
          </button>

          {/* PDF Report Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3 py-1.5 rounded-xl bg-[#121629] hover:bg-[#1a203a] border border-slate-700/80 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>PDF Report ({totalOrdersCount})</span>
          </button>
        </div>
      </div>

      {/* Global Notification Banner */}
      {recentNotification && (
        <div className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-950/95 via-indigo-950/95 to-purple-950/95 border border-purple-500/50 rounded-xl flex items-center justify-between text-xs font-bold text-purple-100 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{recentNotification}</span>
          </div>
          {dismissNotification && (
            <button
              type="button"
              onClick={dismissNotification}
              className="text-purple-300 hover:text-white p-0.5 ml-3 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
