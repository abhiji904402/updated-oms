import React, { useState, useMemo, useEffect } from 'react';
import { useOMS } from '../lib/store';
import { OrderCard } from '../components/OrderCard';
import { EditOrderModal } from '../components/EditOrderModal';
import { ViewOrderModal } from '../components/ViewOrderModal';
import { getDeliveryTimeInfo, sortOrdersByDeliveryPriority } from '../lib/timeUtils';
import { printThermalReceipts } from '../lib/thermalPrint';
import { matchesOutlet } from '../lib/outletUtils';
import { OutletName, OrderStatus, Order, DeliveryType, PaymentType } from '../types';
import {
  Store,
  Filter,
  Clock,
  CheckCircle,
  ChefHat,
  Search,
  X,
  Package,
  DollarSign,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  List,
  Grid,
  Building2,
  RefreshCw
} from 'lucide-react';

const OUTLETS: OutletName[] = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

export const OutletDashboard = React.memo(() => {
  const { orders = [], session, switchRole, updateOrder, updateOrderStatus } = useOMS();

  const isOutletUser = session?.role === 'outlet';
  const assignedOutlet = session?.outlet || 'Sector 31';

  const safeOrders = useMemo(() => {
    const raw = orders || [];
    if (isOutletUser && assignedOutlet) {
      return raw.filter((o) => matchesOutlet(o.outlet, assignedOutlet));
    }
    return raw;
  }, [orders, isOutletUser, assignedOutlet]);

  // Selected Outlet (Defaults to assigned outlet for outlet user, or ALL for admin)
  const [selectedOutlet, setSelectedOutlet] = useState<string>(
    isOutletUser ? assignedOutlet : 'ALL'
  );

  // Sync selected outlet if role changes or is outlet user
  React.useEffect(() => {
    if (isOutletUser && session?.outlet) {
      setSelectedOutlet(session.outlet);
    }
  }, [isOutletUser, session?.outlet]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);

  // Smart Filters
  const [filterOrderDate, setFilterOrderDate] = useState<string>('');
  const [filterDeliveryDate, setFilterDeliveryDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');
  const [filterDeliveryType, setFilterDeliveryType] = useState<string>('ALL');

  // View Mode: Table vs Grid
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const isFullyDelivered = (o: Order) => o.status === 'delivered' && !o.delivery_confirmation_pending;

  // Outlet Metrics per outlet
  const outletMetrics = useMemo(() => {
    const map: Record<string, { name: string; totalCount: number; totalRevenue: number; pendingCount: number; doneCount: number }> = {};
    OUTLETS.forEach((o) => {
      map[o] = { name: o, totalCount: 0, totalRevenue: 0, pendingCount: 0, doneCount: 0 };
    });

    safeOrders.forEach((o) => {
      const name = o.outlet || 'Sector 31';
      if (!map[name]) {
        map[name] = { name, totalCount: 0, totalRevenue: 0, pendingCount: 0, doneCount: 0 };
      }
      const item = map[name];
      item.totalCount += 1;
      item.totalRevenue += o.total_amount || 0;
      if (o.status === 'pending' || o.status === 'processing' || o.status === 'out_for_delivery' || o.delivery_confirmation_pending) {
        item.pendingCount += 1;
      }
      if (isFullyDelivered(o)) {
        item.doneCount += 1;
      }
    });

    return OUTLETS.map((o) => map[o]);
  }, [safeOrders]);

  // Total All Outlets Summary
  const grandMetrics = useMemo(() => {
    const totalCount = safeOrders.length;
    const totalRevenue = safeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const pendingCount = safeOrders.filter(
      (o) => o.status === 'pending' || o.status === 'processing' || o.status === 'out_for_delivery' || o.delivery_confirmation_pending
    ).length;
    const doneCount = safeOrders.filter((o) => isFullyDelivered(o)).length;

    return { totalCount, totalRevenue, pendingCount, doneCount };
  }, [safeOrders]);

  // Filter Active Count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterOrderDate) count++;
    if (filterDeliveryDate) count++;
    if (filterStatus !== 'ALL') count++;
    if (filterPaymentStatus !== 'ALL') count++;
    if (filterDeliveryType !== 'ALL') count++;
    return count;
  }, [filterOrderDate, filterDeliveryDate, filterStatus, filterPaymentStatus, filterDeliveryType]);

  // Filtered Orders Logic
  const filteredOrders = useMemo(() => {
    const raw = safeOrders.filter((o) => {
      // 1. Outlet Filter
      if (selectedOutlet !== 'ALL' && !matchesOutlet(o.outlet, selectedOutlet)) {
        return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = o.order_number.toString().includes(q);
        const matchCust = (o.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (o.mobile_number || '').includes(q);
        const matchItem = (o.item_type || '').toLowerCase().includes(q);
        const matchAddr = (o.address || '').toLowerCase().includes(q);
        const matchRider = (o.delivery_partner || '').toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchPhone && !matchItem && !matchAddr && !matchRider) {
          return false;
        }
      }

      // 3. Order Date Filter
      if (filterOrderDate && o.order_date !== filterOrderDate) {
        return false;
      }

      // 4. Delivery Date Filter
      if (filterDeliveryDate && o.delivery_date !== filterDeliveryDate) {
        return false;
      }

      // 5. Status Filter
      if (filterStatus !== 'ALL') {
        if (o.status !== filterStatus) {
          return false;
        }
      }

      // 6. Payment Status Filter
      if (filterPaymentStatus !== 'ALL') {
        const remaining = o.remaining_balance ?? 0;
        const total = o.total_amount ?? 0;
        const advance = o.advance_amount ?? 0;

        if (filterPaymentStatus === 'paid') {
          if (remaining > 0 || o.payment_type === 'due') return false;
        } else if (filterPaymentStatus === 'due') {
          if (remaining <= 0 && o.payment_type !== 'due') return false;
        } else if (filterPaymentStatus === 'partial') {
          if (advance <= 0 || remaining <= 0) return false;
        }
      }

      // 7. Delivery Type Filter
      if (filterDeliveryType !== 'ALL') {
        if (o.delivery_type !== filterDeliveryType) {
          return false;
        }
      }

      return true;
    });

    return sortOrdersByDeliveryPriority(raw);
  }, [
    safeOrders,
    selectedOutlet,
    searchQuery,
    filterOrderDate,
    filterDeliveryDate,
    filterStatus,
    filterPaymentStatus,
    filterDeliveryType
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOutlet, searchQuery, filterOrderDate, filterDeliveryDate, filterStatus, filterPaymentStatus, filterDeliveryType, viewMode]);

  const totalPages = useMemo(() => Math.ceil(filteredOrders.length / PAGE_SIZE) || 1, [filteredOrders.length]);
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  // Reset Smart Filters
  const handleClearFilters = () => {
    setFilterOrderDate('');
    setFilterDeliveryDate('');
    setFilterStatus('ALL');
    setFilterPaymentStatus('ALL');
    setFilterDeliveryType('ALL');
    setSearchQuery('');
  };



  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-400" />
            Outlet Reports & Kitchen Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            View performance, order queues, and export accurate filterable reports by outlet
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0d1020] border border-indigo-950 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Table Report View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Report Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid Order Cards View"
            >
              <Grid className="w-4 h-4" />
              <span className="hidden sm:inline">Order Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Outlet User Restricted Banner */}
      {isOutletUser && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Outlet Staff Portal ({assignedOutlet}):</strong> You are logged in as Outlet role for <strong>{assignedOutlet}</strong>. Access to other branch reports and bulk actions is restricted.
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 shrink-0">
            Locked to {assignedOutlet}
          </span>
        </div>
      )}

      {/* OUTLET CARDS OVERVIEW (Matching User Screenshot Layout) */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
          <span>Outlet Performance Summary</span>
          <span className="text-purple-400 font-normal">
            {isOutletUser ? `Viewing ${assignedOutlet} Branch Only` : 'Click card to filter orders'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* ALL OUTLETS CARD */}
          {!isOutletUser && (
            <div
              onClick={() => {
                setSelectedOutlet('ALL');
              }}
              className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 shadow-xl ${
                selectedOutlet === 'ALL'
                  ? 'bg-[#13102d] border-purple-500 ring-2 ring-purple-500/30'
                  : 'bg-[#0e111d] border-indigo-950 hover:border-purple-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">🏬</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ALL
                </span>
              </div>

              <div className="font-extrabold text-white text-base">All Outlets</div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-indigo-950">
                <span className="text-slate-400 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-purple-400" />
                  {grandMetrics.totalCount}
                </span>
                <span className="font-black text-emerald-400">
                  ₹{grandMetrics.totalRevenue.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span className="text-amber-400 font-semibold">Pending: {grandMetrics.pendingCount}</span>
                <span className="text-emerald-400 font-semibold">Done: {grandMetrics.doneCount}</span>
              </div>
            </div>
          )}

          {/* INDIVIDUAL OUTLET CARDS */}
          {outletMetrics.filter(m => !isOutletUser || matchesOutlet(m.name, assignedOutlet)).map((met) => {
            const isAssigned = isOutletUser && met.name === assignedOutlet;
            const isDisabledForUser = isOutletUser && met.name !== assignedOutlet;

            return (
              <div
                key={met.name}
                onClick={() => {
                  if (isDisabledForUser) {
                    alert(`Access Restricted: As outlet staff for ${assignedOutlet}, you cannot view reports for ${met.name}.`);
                    return;
                  }
                  setSelectedOutlet(met.name);
                }}
                className={`p-4 rounded-2xl border transition space-y-2 shadow-xl ${
                  isDisabledForUser
                    ? 'opacity-40 bg-[#0a0c16] border-slate-900 cursor-not-allowed'
                    : selectedOutlet === met.name
                    ? 'bg-[#13102d] border-purple-500 ring-2 ring-purple-500/30 cursor-pointer'
                    : 'bg-[#0e111d] border-indigo-950 hover:border-purple-500/40 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">
                    {met.name.includes('31') ? '🏪' : met.name.includes('42') ? '🏢' : met.name.includes('35') ? '🏣' : '🏡'}
                  </span>
                  {selectedOutlet === met.name && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Active
                    </span>
                  )}
                  {isDisabledForUser && (
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Locked</span>
                  )}
                </div>

                <div className="font-extrabold text-white text-base">{met.name}</div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-indigo-950">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                    {met.totalCount}
                  </span>
                  <span className="font-black text-emerald-400">
                    ₹{met.totalRevenue.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <span className="text-amber-400 font-semibold">Pending: {met.pendingCount}</span>
                  <span className="text-emerald-400 font-semibold">Done: {met.doneCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER TOOLBAR & ORDER LIST SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2 w-full sm:w-auto">
            <span>{selectedOutlet === 'ALL' ? 'All Outlets Orders' : `${selectedOutlet} Orders`}</span>
            <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
              {filteredOrders.length} records
            </span>
          </h2>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0e111d] border border-indigo-950 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Smart Filters Trigger Button */}
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                activeFilterCount > 0
                  ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-950/50'
                  : 'bg-[#0e111d] border-indigo-950 text-slate-300 hover:text-white'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-purple-950 text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ACTIVE FILTERS CHIPS */}
        {(activeFilterCount > 0 || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-[#0a0d18] border border-indigo-950 rounded-xl text-xs">
            <span className="text-slate-400 font-semibold">Active Filters:</span>

            {filterOrderDate && (
              <span className="bg-purple-950 text-purple-300 px-2.5 py-1 rounded-lg border border-purple-800 flex items-center gap-1">
                Order Date: {filterOrderDate}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-white" onClick={() => setFilterOrderDate('')} />
              </span>
            )}

            {filterDeliveryDate && (
              <span className="bg-purple-950 text-purple-300 px-2.5 py-1 rounded-lg border border-purple-800 flex items-center gap-1">
                Delivery Date: {filterDeliveryDate}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-white" onClick={() => setFilterDeliveryDate('')} />
              </span>
            )}

            {filterStatus !== 'ALL' && (
              <span className="bg-purple-950 text-purple-300 px-2.5 py-1 rounded-lg border border-purple-800 flex items-center gap-1">
                Status: {filterStatus}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-white" onClick={() => setFilterStatus('ALL')} />
              </span>
            )}

            {filterPaymentStatus !== 'ALL' && (
              <span className="bg-purple-950 text-purple-300 px-2.5 py-1 rounded-lg border border-purple-800 flex items-center gap-1">
                Payment: {filterPaymentStatus}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-white" onClick={() => setFilterPaymentStatus('ALL')} />
              </span>
            )}

            {filterDeliveryType !== 'ALL' && (
              <span className="bg-purple-950 text-purple-300 px-2.5 py-1 rounded-lg border border-purple-800 flex items-center gap-1">
                Type: {filterDeliveryType}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-white" onClick={() => setFilterDeliveryType('ALL')} />
              </span>
            )}

            <button
              onClick={handleClearFilters}
              className="text-rose-400 hover:text-rose-300 font-bold ml-auto text-xs underline"
            >
              Clear All
            </button>
          </div>
        )}

        {/* TABULAR REPORT VIEW */}
        {viewMode === 'table' ? (
          filteredOrders.length === 0 ? (
            <div className="p-12 text-center bg-[#0e111d] border border-dashed border-indigo-950 rounded-2xl text-slate-400 text-xs">
              No matching orders found for the selected outlet and filter criteria.
            </div>
          ) : (
            <div className="bg-[#0e111d] border border-indigo-950 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#080a14] border-b border-indigo-950 text-slate-400 uppercase font-extrabold tracking-wider">
                    <tr>
                      <th className="p-3.5">Order #</th>
                      <th className="p-3.5">Outlet</th>
                      <th className="p-3.5">Customer & Phone</th>
                      <th className="p-3.5">Item & Qty</th>
                      <th className="p-3.5 text-indigo-300">Expected Time</th>
                      <th className="p-3.5 text-emerald-300">Actual Time</th>
                      <th className="p-3.5 text-rose-300">Total Delay (Mins)</th>
                      <th className="p-3.5">Total (₹)</th>
                      <th className="p-3.5">Due (₹)</th>
                      <th className="p-3.5">Payment Status</th>
                      <th className="p-3.5">Bill Numbers</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-950/80 text-slate-200">
                    {pagedOrders.map((o) => {
                      const remaining = o.remaining_balance ?? 0;
                      const timeInfo = getDeliveryTimeInfo(o);
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setViewingOrder(o)}
                          className="hover:bg-[#12162a] transition cursor-pointer group"
                        >
                          <td className="p-3.5 font-black text-white text-base sm:text-lg font-mono group-hover:text-purple-300 transition">
                            #{o.order_number}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold text-[11px]">
                              {o.outlet}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-white">{o.customer_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{o.mobile_number}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-200">{o.item_type}</div>
                            <div className="text-[10px] text-purple-400">Qty: x{o.quantity} ({o.delivery_type})</div>
                          </td>
                          <td className="p-3.5 font-mono text-indigo-200 font-bold">
                            {timeInfo.expectedFormatted}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-emerald-400">
                            {timeInfo.actualFormatted}
                          </td>
                          <td className="p-3.5 font-mono font-bold">
                            {timeInfo.delayMinutes > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/50">
                                {timeInfo.delayMinutes} mins delay
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                                On Time
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-black text-emerald-400">
                            ₹{(o.total_amount ?? 0).toLocaleString()}
                          </td>
                          <td className="p-3.5 font-bold">
                            {remaining > 0 ? (
                              <span className="text-rose-400">₹{remaining.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-500">₹0</span>
                            )}
                          </td>
                          <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={o.payment_type || 'full'}
                              onChange={(e) => {
                                const newType = e.target.value as PaymentType;
                                const total = o.total_amount ?? 0;
                                let updates: Partial<Order> = {
                                  payment_type: newType,
                                  payment_changed_by: session?.name || session?.role,
                                  payment_changed_at: new Date().toISOString()
                                };
                                if (newType === 'full') {
                                  updates.advance_amount = total;
                                  updates.remaining_balance = 0;
                                  updates.due_amount = 0;
                                } else if (newType === 'due') {
                                  updates.advance_amount = 0;
                                  updates.remaining_balance = total;
                                  updates.due_amount = total;
                                } else if (newType === 'part') {
                                  const adv = o.advance_amount && o.advance_amount < total ? o.advance_amount : Math.round(total / 2);
                                  updates.advance_amount = adv;
                                  updates.remaining_balance = Math.max(0, total - adv);
                                  updates.due_amount = Math.max(0, total - adv);
                                }
                                updateOrder(o.id, updates);
                              }}
                              className={`text-[11px] font-black uppercase px-2 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500 transition ${
                                o.payment_type === 'full'
                                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                                  : o.payment_type === 'part'
                                  ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                                  : 'bg-rose-950/90 text-rose-300 border-rose-500/50'
                              }`}
                            >
                              <option value="full" className="bg-slate-900 text-emerald-300">PAID FULL</option>
                              <option value="part" className="bg-slate-900 text-amber-300">PARTIAL</option>
                              <option value="due" className="bg-slate-900 text-rose-300">DUE / POD</option>
                              <option value="cash" className="bg-slate-900 text-slate-200">CASH</option>
                              <option value="upi" className="bg-slate-900 text-slate-200">UPI</option>
                              <option value="online" className="bg-slate-900 text-slate-200">ONLINE</option>
                            </select>
                          </td>
                          <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-1 w-28 text-xs font-mono">
                              <input
                                type="text"
                                placeholder="Adv Bill #"
                                defaultValue={o.advance_bill_number || ''}
                                key={`adv-${o.id}-${o.advance_bill_number}`}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val !== (o.advance_bill_number || '')) {
                                    updateOrder(o.id, { advance_bill_number: val });
                                  }
                                }}
                                className="bg-slate-950 border border-amber-800/60 text-amber-200 text-[10px] px-1.5 py-0.5 rounded focus:outline-none focus:border-amber-400 font-mono font-bold"
                              />
                              <input
                                type="text"
                                placeholder="Final Bill #"
                                defaultValue={o.final_bill_number || ''}
                                key={`final-${o.id}-${o.final_bill_number}`}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val !== (o.final_bill_number || '')) {
                                    updateOrder(o.id, { final_bill_number: val });
                                  }
                                }}
                                className="bg-slate-950 border border-emerald-800/60 text-emerald-200 text-[10px] px-1.5 py-0.5 rounded focus:outline-none focus:border-emerald-400 font-mono font-bold"
                              />
                            </div>
                          </td>
                          <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={o.status}
                              onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderStatus)}
                              className="bg-slate-950 border border-indigo-900 text-purple-200 font-extrabold uppercase text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500 cursor-pointer"
                            >
                              <option value="pending" className="bg-slate-900 text-rose-300">Pending</option>
                              <option value="processing" className="bg-slate-900 text-amber-300">Processing</option>
                              <option value="out_for_delivery" className="bg-slate-900 text-blue-300">Out for Delivery</option>
                              <option value="delivered" className="bg-slate-900 text-emerald-300">Delivered</option>
                              <option value="on_hold" className="bg-slate-900 text-purple-300">On Hold</option>
                              <option value="cancelled" className="bg-slate-900 text-slate-400">Cancelled</option>
                              <option value="missed" className="bg-slate-900 text-red-400">Missed</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Summary Footer */}
                  <tfoot className="bg-[#080a14] border-t-2 border-indigo-900 text-xs font-bold text-slate-200">
                    <tr>
                      <td colSpan={7} className="p-3.5 text-right font-black uppercase text-purple-400">
                        Total ({filteredOrders.length} Orders)
                      </td>
                      <td className="p-3.5 font-black text-emerald-400 text-sm">
                        ₹{filteredOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-black text-rose-400 text-sm">
                        ₹{filteredOrders.reduce((acc, o) => acc + (o.remaining_balance || 0), 0).toLocaleString()}
                      </td>
                      <td colSpan={3} className="p-3.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Table Pagination Bar */}
              {filteredOrders.length > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#080a14] border-t border-indigo-950 text-xs text-slate-300">
                  <div>
                    Showing <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                    <strong className="text-white">{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}</strong> of{' '}
                    <strong className="text-purple-400">{filteredOrders.length}</strong> orders
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 font-bold"
                    >
                      First
                    </button>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 font-bold"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1 bg-purple-600/30 border border-purple-500/40 rounded-lg text-purple-200 font-extrabold">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 font-bold"
                    >
                      Next
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 font-bold"
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* GRID VIEW (Order Cards) */
          <div className="space-y-4">
            {filteredOrders.length > 0 && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#0d1020] border border-indigo-950 rounded-xl text-xs text-slate-300">
                <div>
                  Showing <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                  <strong className="text-white">{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}</strong> of{' '}
                  <strong className="text-purple-400">{filteredOrders.length}</strong> orders
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 font-bold"
                  >
                    First
                  </button>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 font-bold"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1 bg-purple-600/30 border border-purple-500/40 rounded-lg text-purple-200 font-extrabold">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 font-bold"
                  >
                    Next
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 font-bold"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-[#0e111d] border border-dashed border-indigo-950 rounded-2xl text-slate-400 text-xs">
                  No matching orders found.
                </div>
              ) : (
                pagedOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onViewOrder={setViewingOrder}
                    onEditOrder={setEditingOrder}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* View Order Modal */}
      <ViewOrderModal
        order={viewingOrder}
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        onEdit={(ord) => {
          setViewingOrder(null);
          setEditingOrder(ord);
        }}
        onPrintThermal={(ord) => printThermalReceipts([ord])}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        order={editingOrder}
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
      />

      {/* SMART FILTERS MODAL (Matching User Screenshot Exactly) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0d1a] border border-indigo-900 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-indigo-950 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Filter className="w-5 h-5 text-purple-400" />
                Smart Filters
              </h3>
              <button
                onClick={handleClearFilters}
                className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 transition"
              >
                <X className="w-3.5 h-3.5" /> Clear All
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Order Date */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Order Date
                </label>
                <input
                  type="date"
                  value={filterOrderDate}
                  onChange={(e) => setFilterOrderDate(e.target.value)}
                  className="w-full bg-[#11152a] border border-indigo-900/80 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={filterDeliveryDate}
                  onChange={(e) => setFilterDeliveryDate(e.target.value)}
                  className="w-full bg-[#11152a] border border-indigo-900/80 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              {/* Order Status */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-[#11152a] border border-indigo-900/80 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing (In Kitchen)</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="missed">Missed</option>
                </select>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Payment Status
                </label>
                <select
                  value={filterPaymentStatus}
                  onChange={(e) => setFilterPaymentStatus(e.target.value)}
                  className="w-full bg-[#11152a] border border-indigo-900/80 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Payments</option>
                  <option value="paid">Paid Full (No Balance)</option>
                  <option value="due">Pending / Pay On Delivery</option>
                  <option value="partial">Partial Advance Paid</option>
                </select>
              </div>

              {/* Delivery Type */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Delivery Type
                </label>
                <select
                  value={filterDeliveryType}
                  onChange={(e) => setFilterDeliveryType(e.target.value)}
                  className="w-full bg-[#11152a] border border-indigo-900/80 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="delivery">Home Delivery</option>
                  <option value="pickup">Store Pickup</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-indigo-950">
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 transition"
              >
                Apply Filters ({filteredOrders.length} results)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
