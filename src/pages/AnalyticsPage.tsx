import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { Order, OrderStatus } from '../types';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  FileText,
  FileSpreadsheet,
  Search,
  Filter,
  X,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  DollarSign
} from 'lucide-react';
import { getDeliveryTimeInfo, formatTo12Hour } from '../lib/timeUtils';
import { matchesOutlet } from '../lib/outletUtils';

export const AnalyticsPage = React.memo(() => {
  const { orders = [], session } = useOMS();
  const isOutletUser = session?.role === 'outlet';
  const assignedOutlet = session?.outlet || 'Sector 31';

  const safeOrders = useMemo(() => {
    const raw = orders || [];
    if (isOutletUser && assignedOutlet) {
      return raw.filter((o) => matchesOutlet(o.outlet, assignedOutlet));
    }
    return raw;
  }, [orders, isOutletUser, assignedOutlet]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(
    isOutletUser ? assignedOutlet : 'ALL'
  );

  React.useEffect(() => {
    if (isOutletUser && assignedOutlet) {
      setSelectedOutletFilter(assignedOutlet);
    }
  }, [isOutletUser, assignedOutlet]);

  const activeFiltersCount = (selectedDate ? 1 : 0) + (selectedOutletFilter !== 'ALL' ? 1 : 0) + (searchTerm ? 1 : 0);

  // Format date helper (DD-MM-YYYY)
  const formatDateDisp = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Base filtered orders by date tag & search
  const filteredOrders = useMemo(() => {
    return safeOrders.filter((o) => {
      // Date filter match
      if (selectedDate && o.delivery_date !== selectedDate) {
        return false;
      }
      // Outlet filter match
      if (selectedOutletFilter !== 'ALL' && !matchesOutlet(o.outlet, selectedOutletFilter)) {
        return false;
      }
      // Search term match
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesNum = (o.order_number || '').toString().toLowerCase().includes(term);
        const matchesOutlet = (o.outlet || '').toLowerCase().includes(term);
        const matchesItem = (o.item_type || '').toLowerCase().includes(term);
        const matchesCust = (o.customer_name || '').toLowerCase().includes(term);
        const matchesPhone = (o.mobile_number || '').toLowerCase().includes(term);
        if (!matchesNum && !matchesOutlet && !matchesItem && !matchesCust && !matchesPhone) {
          return false;
        }
      }
      return true;
    });
  }, [safeOrders, selectedDate, selectedOutletFilter, searchTerm]);

  // Overall statistics
  const totalOrdersCount = filteredOrders.length;
  const totalRevenue = useMemo(() => filteredOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0), [filteredOrders]);

  // Analytics table pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const totalPages = useMemo(() => Math.ceil(filteredOrders.length / PAGE_SIZE) || 1, [filteredOrders.length]);
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  // 1. Order Status (Date) Breakdown
  const statusCounts = useMemo(() => {
    let delivered = 0;
    let pending = 0;
    let processing = 0;
    let cancelled = 0;
    let deliveredValue = 0;

    filteredOrders.forEach((o) => {
      if (o.status === 'delivered') {
        delivered++;
        deliveredValue += o.total_amount || 0;
      } else if (o.status === 'cancelled') {
        cancelled++;
      } else if (o.status === 'processing' || o.status === 'out_for_delivery') {
        processing++;
      } else {
        pending++;
      }
    });

    const newOrders = pending + processing;
    return { delivered, pending, processing, cancelled, newOrders, deliveredValue };
  }, [filteredOrders]);

  const orderStatusPieData = [
    { name: 'Delivered', value: statusCounts.delivered, color: '#ec4899' },
    { name: 'New Orders', value: statusCounts.newOrders, color: '#8b5cf6' }
  ].filter(d => d.value > 0);

  // 2. Outlet Breakdown (Date)
  const outletBreakdownData = useMemo(() => {
    const outlets = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];
    const outletColors: Record<string, string> = {
      'Sector 31': '#8b5cf6',
      'Sector 35': '#f59e0b',
      'Sector 42': '#10b981',
      'Sector 88': '#ec4899'
    };

    const map: Record<string, { count: number; value: number }> = {
      'Sector 31': { count: 0, value: 0 },
      'Sector 35': { count: 0, value: 0 },
      'Sector 42': { count: 0, value: 0 },
      'Sector 88': { count: 0, value: 0 }
    };

    filteredOrders.forEach((o) => {
      const name = o.outlet || 'Sector 31';
      if (!map[name]) map[name] = { count: 0, value: 0 };
      map[name].count += 1;
      map[name].value += o.total_amount || 0;
    });

    const pieSlices = outlets.map((o) => ({
      name: o,
      value: map[o].count,
      color: outletColors[o] || '#3b82f6'
    })).filter(d => d.value > 0);

    return { map, pieSlices, outlets, outletColors };
  }, [filteredOrders]);

  // 3. Row 2 Pie Charts
  // a) Revenue by Outlet
  const revenueByOutletPie = useMemo(() => {
    return outletBreakdownData.outlets.map((o) => ({
      name: o,
      value: outletBreakdownData.map[o].value,
      color: outletBreakdownData.outletColors[o]
    })).filter(d => d.value > 0);
  }, [outletBreakdownData]);

  // b) Payment Status (Full Paid vs Due)
  const paymentStatusPie = useMemo(() => {
    let fullPaidCount = 0;
    let dueCount = 0;

    filteredOrders.forEach((o) => {
      if ((o.remaining_balance || 0) > 0) {
        dueCount++;
      } else {
        fullPaidCount++;
      }
    });

    return [
      { name: 'Full Paid', value: fullPaidCount, color: '#6366f1' },
      { name: 'Due', value: dueCount, color: '#a855f7' }
    ].filter(d => d.value > 0);
  }, [filteredOrders]);

  // c) Order Status Pie (Delivered vs Cancelled vs Pending)
  const generalStatusPie = useMemo(() => {
    let del = 0;
    let canc = 0;
    let oth = 0;
    filteredOrders.forEach((o) => {
      if (o.status === 'delivered') del++;
      else if (o.status === 'cancelled') canc++;
      else oth++;
    });

    return [
      { name: 'delivered', value: del, color: '#6366f1' },
      { name: 'cancelled', value: canc, color: '#a855f7' },
      { name: 'pending', value: oth, color: '#f59e0b' }
    ].filter(d => d.value > 0);
  }, [filteredOrders]);

  // 4. Outlet-wise Summary Table Data (Optimized O(N) single-pass)
  const outletSummaryRows = useMemo(() => {
    const map: Record<string, { total: number; del: number; pend: number; canc: number; due: number; rev: number }> = {};
    
    outletBreakdownData.outlets.forEach((outletName) => {
      map[outletName] = { total: 0, del: 0, pend: 0, canc: 0, due: 0, rev: 0 };
    });

    filteredOrders.forEach((o) => {
      const outletName = o.outlet || 'Sector 31';
      if (!map[outletName]) {
        map[outletName] = { total: 0, del: 0, pend: 0, canc: 0, due: 0, rev: 0 };
      }
      const item = map[outletName];
      item.total += 1;
      item.rev += o.total_amount || 0;
      if (o.status === 'delivered') {
        item.del += 1;
      } else if (o.status === 'cancelled') {
        item.canc += 1;
      } else {
        item.pend += 1;
      }
      if ((o.remaining_balance || 0) > 0) {
        item.due += 1;
      }
    });

    return outletBreakdownData.outlets.map((outletName) => ({
      outlet: outletName,
      ...map[outletName]
    }));
  }, [filteredOrders, outletBreakdownData.outlets]);

  // Export handlers
  const handleExportExcel = () => {
    const headers = [
      'Order #', 'Outlet', 'Item', 'Qty', 'Amount', 'Payment Type',
      'Remaining Balance', 'Status', 'Delivery Date', 'Delivery Time', 'Customer Name', 'Phone'
    ];
    const rows = filteredOrders.map((o) => [
      o.order_number,
      `"${o.outlet}"`,
      `"${o.item_type}"`,
      o.quantity,
      o.total_amount,
      o.payment_type,
      o.remaining_balance || 0,
      o.status,
      o.delivery_date,
      o.delivery_time_expected,
      `"${o.customer_name || ''}"`,
      `"${o.mobile_number || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Broomies_Report_${selectedDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto text-slate-100 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            {totalOrdersCount} orders | ₹{totalRevenue.toLocaleString('en-IN')} revenue
          </p>
        </div>

        {/* Top Right Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 rounded-xl bg-[#0f1426] hover:bg-indigo-950 border border-slate-700/80 text-white font-semibold text-xs shadow flex items-center gap-2 transition"
          >
            <FileText className="w-4 h-4 text-slate-300" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl bg-[#0f1426] hover:bg-indigo-950 border border-slate-700/80 text-white font-semibold text-xs shadow flex items-center gap-2 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-300" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b0e1b] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 shadow-inner"
          />
        </div>

        {/* Filters Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2.5 rounded-xl bg-[#0b0e1b] border border-slate-800 hover:border-purple-600/60 text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition"
        >
          <Filter className="w-4 h-4 text-purple-400" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-black">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Active Filter Pill (Delivery Date) */}
        {selectedDate && (
          <div className="flex items-center gap-2 bg-[#0d1226] border border-indigo-900/60 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-200 shadow-sm">
            <span>Delivery: {selectedDate}</span>
            <button
              onClick={() => setSelectedDate('')}
              className="text-slate-400 hover:text-white transition"
              title="Clear date filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Filter Pill (Outlet) */}
        {selectedOutletFilter !== 'ALL' && (
          <div className="flex items-center gap-2 bg-[#0d1226] border border-indigo-900/60 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-200 shadow-sm">
            <span>Outlet: {selectedOutletFilter}</span>
            <button
              onClick={() => setSelectedOutletFilter('ALL')}
              className="text-slate-400 hover:text-white transition"
              title="Clear outlet filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded Filter Box */}
      {showFilters && (
        <div className="bg-[#0b0e1b] border border-indigo-900/60 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Delivery Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-[#12162a] border border-indigo-950 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Filter Outlet</label>
            <select
              value={selectedOutletFilter}
              disabled={isOutletUser}
              onChange={(e) => setSelectedOutletFilter(e.target.value)}
              className="w-full bg-[#12162a] border border-indigo-950 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!isOutletUser && <option value="ALL">All Outlets</option>}
              <option value="Sector 31">Sector 31</option>
              <option value="Sector 35">Sector 35</option>
              <option value="Sector 42">Sector 42</option>
              <option value="Sector 88">Sector 88</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedDate('');
                setSelectedOutletFilter(isOutletUser ? assignedOutlet : 'ALL');
                setSearchTerm('');
              }}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* ROW 1: Order Status & Outlet Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Order Status (DATE) */}
        <div className="bg-[#0b0e1b] border border-indigo-950/90 rounded-2xl p-5 space-y-4 shadow-xl">
          <div>
            <h2 className="text-base font-extrabold text-rose-400">
              Order Status ({formatDateDisp(selectedDate) || 'All Dates'})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Date: {formatDateDisp(selectedDate) || 'All'} | Total Deliveries: {statusCounts.delivered} | New Orders: {statusCounts.newOrders}
            </p>
          </div>

          {/* Pie Chart */}
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatusPieData.length > 0 ? orderStatusPieData : [{ name: 'None', value: 1, color: '#334155' }]}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, value }) => `${value}`}
                >
                  {orderStatusPieData.map((entry, index) => (
                    <Cell key={`cell-status-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d1a', borderColor: '#1e293b', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Legend */}
          <div className="flex items-center justify-center gap-6 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-pink-500 rounded-sm inline-block" />
              <span>Delivered: {statusCounts.delivered}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-purple-500 rounded-sm inline-block" />
              <span>New: {statusCounts.newOrders}</span>
            </div>
          </div>

          {/* Embedded Table: Order Status Summary */}
          <div className="bg-[#060812] border border-indigo-950/70 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-pink-300">
              Order Status Summary ({formatDateDisp(selectedDate) || 'All'})
            </h3>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-3 text-slate-400 font-semibold border-b border-slate-800 pb-1.5">
                <div>Status</div>
                <div className="text-center">Count</div>
                <div className="text-right">Value</div>
              </div>

              {/* Delivered Row */}
              <div className="grid grid-cols-3 items-center text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" />
                  <span>Delivered</span>
                </div>
                <div className="text-center font-bold">{statusCounts.delivered}</div>
                <div className="text-right font-bold text-emerald-400">₹ {statusCounts.deliveredValue.toLocaleString('en-IN')}</div>
              </div>

              {/* New Orders Row */}
              <div className="grid grid-cols-3 items-center text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                  <span>New Orders (Arrived)</span>
                </div>
                <div className="text-center font-bold">{statusCounts.newOrders}</div>
                <div className="text-right text-slate-500">—</div>
              </div>

              {/* Total Orders Footer */}
              <div className="grid grid-cols-3 items-center pt-2 border-t border-slate-800 font-extrabold text-pink-300">
                <div>Total Orders</div>
                <div className="text-center">{totalOrdersCount}</div>
                <div className="text-right">₹ {totalRevenue.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Outlet Breakdown (DATE) */}
        <div className="bg-[#0b0e1b] border border-indigo-950/90 rounded-2xl p-5 space-y-4 shadow-xl">
          <div>
            <h2 className="text-base font-extrabold text-emerald-400">
              Outlet Breakdown ({formatDateDisp(selectedDate) || 'All Dates'})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Date: {formatDateDisp(selectedDate) || 'All'} | Total Deliveries: {statusCounts.delivered}
            </p>
          </div>

          {/* Pie Chart */}
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={outletBreakdownData.pieSlices.length > 0 ? outletBreakdownData.pieSlices : [{ name: 'None', value: 1, color: '#334155' }]}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {outletBreakdownData.pieSlices.map((entry, index) => (
                    <Cell key={`cell-outlet-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d1a', borderColor: '#1e293b', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Embedded Table: Outlet Wise Summary */}
          <div className="bg-[#060812] border border-indigo-950/70 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-emerald-300">
              Outlet Wise Summary ({formatDateDisp(selectedDate) || 'All'})
            </h3>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-3 text-slate-400 font-semibold border-b border-slate-800 pb-1.5">
                <div>Outlet</div>
                <div className="text-center">Deliveries</div>
                <div className="text-right">Value</div>
              </div>

              {outletBreakdownData.outlets.map((outletName) => {
                const data = outletBreakdownData.map[outletName];
                const color = outletBreakdownData.outletColors[outletName];

                return (
                  <div key={outletName} className="grid grid-cols-3 items-center text-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span>{outletName}</span>
                    </div>
                    <div className="text-center font-bold">{data.count}</div>
                    <div className="text-right font-bold text-slate-200">₹ {data.value.toLocaleString('en-IN')}</div>
                  </div>
                );
              })}

              {/* Footer Rows */}
              <div className="pt-2 border-t border-slate-800 space-y-1 font-extrabold text-emerald-400">
                <div className="flex items-center justify-between">
                  <span>Total Deliveries</span>
                  <span>{statusCounts.delivered}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Value</span>
                  <span>₹ {totalRevenue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: 3 Pie Charts Grid + Outlet-wise Summary Table */}
      <div className="space-y-6">
        {/* 3 Pie Charts in 3 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pie 1: Revenue by Outlet */}
          <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-white">Revenue by Outlet</h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueByOutletPie.length > 0 ? revenueByOutletPie : [{ name: 'None', value: 1, color: '#334155' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={65}
                    dataKey="value"
                    label={({ value }) => `₹${Math.round(value / 1000)}k`}
                  >
                    {revenueByOutletPie.map((entry, idx) => (
                      <Cell key={`cell-rev-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#090d1a', borderColor: '#1e293b' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-300 font-semibold">
              {outletBreakdownData.outlets.map((o) => (
                <div key={o} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: outletBreakdownData.outletColors[o] }} />
                  <span>{o}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pie 2: Payment Status */}
          <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-white">Payment Status</h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStatusPie.length > 0 ? paymentStatusPie : [{ name: 'None', value: 1, color: '#334155' }]}
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    dataKey="value"
                    label={({ value }) => `${value}`}
                  >
                    {paymentStatusPie.map((entry, idx) => (
                      <Cell key={`cell-pay-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#090d1a', borderColor: '#1e293b' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-[11px] text-slate-300 font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm inline-block" />
                <span>Full Paid</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm inline-block" />
                <span>Due</span>
              </div>
            </div>
          </div>

          {/* Pie 3: Order Status */}
          <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-white">Order Status</h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={generalStatusPie.length > 0 ? generalStatusPie : [{ name: 'None', value: 1, color: '#334155' }]}
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    dataKey="value"
                    label={({ value }) => `${value}`}
                  >
                    {generalStatusPie.map((entry, idx) => (
                      <Cell key={`cell-ordstat-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#090d1a', borderColor: '#1e293b' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-[11px] text-slate-300 font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm inline-block" />
                <span>delivered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm inline-block" />
                <span>cancelled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Outlet-wise Summary Table Card */}
        <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-base font-bold text-white">Outlet-wise Summary</h2>

          <div className="overflow-x-auto rounded-xl border border-indigo-950/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-indigo-950 bg-[#070913] text-indigo-300 text-xs font-semibold">
                  <th className="py-3 px-4">Outlet</th>
                  <th className="py-3 px-4 text-center">Total Orders</th>
                  <th className="py-3 px-4 text-center text-emerald-400">Delivered</th>
                  <th className="py-3 px-4 text-center text-amber-400">Pending</th>
                  <th className="py-3 px-4 text-center text-rose-400">Cancelled</th>
                  <th className="py-3 px-4 text-center text-purple-400">Due/Part</th>
                  <th className="py-3 px-4 text-right text-indigo-300">Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-950/60 text-xs font-semibold">
                {outletSummaryRows.map((row) => (
                  <tr key={row.outlet} className="hover:bg-indigo-950/30 transition">
                    <td className="py-3.5 px-4 text-white font-bold">{row.outlet}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-100 text-sm">{row.total}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="w-6 h-6 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 inline-flex items-center justify-center font-bold">
                        {row.del}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="w-6 h-6 rounded-full bg-amber-950/80 border border-amber-800 text-amber-400 inline-flex items-center justify-center font-bold">
                        {row.pend}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="w-6 h-6 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 inline-flex items-center justify-center font-bold">
                        {row.canc}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="w-6 h-6 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 inline-flex items-center justify-center font-bold">
                        {row.due}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-indigo-400 text-sm">
                      ₹{row.rev.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}

                {/* TOTAL Row */}
                <tr className="bg-[#070914] font-extrabold text-indigo-300 text-xs">
                  <td className="py-3.5 px-4 text-indigo-300 uppercase tracking-wider">TOTAL</td>
                  <td className="py-3.5 px-4 text-center text-indigo-300 text-sm">{totalOrdersCount}</td>
                  <td className="py-3.5 px-4 text-center text-emerald-400 text-sm">{statusCounts.delivered}</td>
                  <td className="py-3.5 px-4 text-center text-amber-400 text-sm">{statusCounts.pending + statusCounts.processing}</td>
                  <td className="py-3.5 px-4 text-center text-rose-400 text-sm">{statusCounts.cancelled}</td>
                  <td className="py-3.5 px-4 text-center text-purple-300 text-sm">
                    {filteredOrders.filter(o => (o.remaining_balance || 0) > 0).length}
                  </td>
                  <td className="py-3.5 px-4 text-right text-indigo-300 text-sm">
                    ₹{totalRevenue.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ROW 3: All Orders Table Card */}
      <div className="bg-[#0b0e1b] border border-indigo-950 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-white">All Orders</h2>
            <p className="text-xs text-slate-400">
              {filteredOrders.length} records | Total: ₹{totalRevenue.toLocaleString('en-IN')}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-bold">
            {filteredOrders.length} orders
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-indigo-950/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-indigo-950 bg-[#070913] text-indigo-300 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">OUTLET</th>
                <th className="py-3 px-3">CUSTOMER</th>
                <th className="py-3 px-3">ITEM & QTY</th>
                <th className="py-3 px-3">AMOUNT</th>
                <th className="py-3 px-3">PAYMENT</th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-3">DEL. DATE</th>
                <th className="py-3 px-3">EXP. TIME</th>
                <th className="py-3 px-3">ACT. TIME</th>
                <th className="py-3 px-3">DELAY</th>
                <th className="py-3 px-3">DELIVERY PARTNER</th>
                <th className="py-3 px-3">DELIVERED BY</th>
                <th className="py-3 px-3">PAYMENT AUDIT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-950/60 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-500">
                    No orders found matching criteria.
                  </td>
                </tr>
              ) : (
                pagedOrders.map((ord) => {
                  const isDue = (ord.remaining_balance || 0) > 0;
                  const timeInfo = getDeliveryTimeInfo(ord);
                  return (
                    <tr key={ord.id} className="hover:bg-indigo-950/30 transition">
                      {/* # Order Number */}
                      <td className="py-3 px-3 font-bold text-indigo-400 font-mono">
                        #{ord.order_number}
                      </td>
                      {/* OUTLET */}
                      <td className="py-3 px-3 text-slate-200 font-medium">
                        {ord.outlet}
                      </td>
                      {/* CUSTOMER */}
                      <td className="py-3 px-3 text-slate-200">
                        <div className="font-semibold">{ord.customer_name}</div>
                        <div className="text-[10px] text-slate-400">{ord.mobile_number}</div>
                      </td>
                      {/* ITEM & QTY */}
                      <td className="py-3 px-3 text-slate-200">
                        {ord.item_type} <span className="text-slate-400 font-normal">× {ord.quantity}</span>
                      </td>
                      {/* AMOUNT */}
                      <td className="py-3 px-3 font-bold text-white">
                        ₹{ord.total_amount}
                      </td>
                      {/* PAYMENT */}
                      <td className="py-3 px-3">
                        {isDue ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950/90 text-purple-300 border border-purple-800/80">
                            Due
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-800/80">
                            Full Paid
                          </span>
                        )}
                      </td>
                      {/* STATUS */}
                      <td className="py-3 px-3">
                        {ord.status === 'delivered' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-800/80">
                            Delivered
                          </span>
                        ) : ord.status === 'cancelled' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/90 text-rose-300 border border-rose-800/80">
                            Cancelled
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800/80 uppercase">
                            {ord.status}
                          </span>
                        )}
                      </td>
                      {/* DEL. DATE */}
                      <td className="py-3 px-3 text-slate-300 font-mono">
                        {ord.delivery_date}
                      </td>
                      {/* EXP. TIME */}
                      <td className="py-3 px-3 text-slate-300 font-mono font-bold">
                        {timeInfo.expectedFormatted}
                      </td>
                      {/* ACT. TIME */}
                      <td className="py-3 px-3 text-slate-200 font-mono font-bold">
                        {timeInfo.actualFormatted}
                      </td>
                      {/* DELAY */}
                      <td className="py-3 px-3 font-mono">
                        <span className={timeInfo.delayMinutes > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          {timeInfo.delayText}
                        </span>
                      </td>
                      {/* DELIVERY PARTNER */}
                      <td className="py-3 px-3 text-slate-200 font-medium">
                        {ord.delivery_partner || '—'}
                      </td>
                      {/* DELIVERED BY */}
                      <td className="py-3 px-3 text-slate-300">
                        {ord.delivered_by || (ord.status === 'delivered' ? (ord.delivery_partner || `${ord.outlet} Staff`) : '—')}
                      </td>
                      {/* PAYMENT AUDIT */}
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {ord.payment_changed_by ? (
                          <span>{ord.payment_changed_by} ({formatTo12Hour(ord.payment_changed_at || '')})</span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Analytics Table Pagination Controls */}
        {filteredOrders.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#080a14] border border-indigo-950 rounded-xl text-xs text-slate-300">
            <div>
              Showing <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
              <strong className="text-white">{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}</strong> of{' '}
              <strong className="text-purple-400">{filteredOrders.length}</strong> records
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
    </div>
  );
});
