import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { Order, OrderStatus } from '../types';
import { OrderCard } from '../components/OrderCard';
import { Search, Filter, RefreshCw, Calendar, Sparkles, LayoutDashboard, List, MapPin, Download, FileText, CheckCircle2 } from 'lucide-react';
import { exportToCSV } from '../lib/exportUtils';

interface AdminDashboardProps {
  onViewOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onOpenAddModal: () => void;
  onOpenThermalModal?: () => void;
  onOpenDeliveryModal?: (order: Order) => void;
  onOpenPasswordModal?: () => void;
  onOpenSheetModal?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onViewOrder,
  onEditOrder
}) => {
  const { orders, isLoading, refreshOrders, showNotification } = useOMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [outletFilter, setOutletFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'map'>('list');
  const [quickTab, setQuickTab] = useState<string>('today');

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      // Quick Tab Filter
      if (quickTab === 'today' && o.delivery_date !== todayStr && o.order_date !== todayStr) return false;
      if (quickTab === 'tomorrow' && o.delivery_date !== tomorrowStr && o.order_date !== tomorrowStr) return false;
      if (quickTab === 'future' && ((o.delivery_date || o.order_date || '') <= todayStr)) return false;
      if (quickTab === 'delivered' && o.status !== 'delivered') return false;
      if (quickTab === 'pending_payment' && ((o.remaining_balance || 0) <= 0 && o.payment_type !== 'due')) return false;
      if (quickTab === 'cancelled' && o.status !== 'cancelled') return false;
      if (quickTab === 'missed' && o.status !== 'missed') return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = String(o.order_number).includes(q);
        const matchCustomer = (o.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (o.mobile_number || '').includes(q);
        const matchItem = (o.item_type || '').toLowerCase().includes(q);
        const matchNameOnCake = (o.name_on_cake || '').toLowerCase().includes(q);
        const matchIcing = (o.icing_color || '').toLowerCase().includes(q);
        const matchStyle = (o.cake_style || '').toLowerCase().includes(q);
        if (!matchNumber && !matchCustomer && !matchPhone && !matchItem && !matchNameOnCake && !matchIcing && !matchStyle) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && o.status !== statusFilter) {
        return false;
      }

      // Outlet
      if (outletFilter !== 'all' && o.outlet !== outletFilter) {
        return false;
      }

      // Date
      if (dateFilter && o.delivery_date !== dateFilter) {
        return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, outletFilter, dateFilter, quickTab, todayStr, tomorrowStr]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const list = orders || [];
    return {
      today: list.filter(o => o.delivery_date === todayStr || o.order_date === todayStr).length,
      tomorrow: list.filter(o => o.delivery_date === tomorrowStr || o.order_date === tomorrowStr).length,
      future: list.filter(o => (o.delivery_date || o.order_date || '') > todayStr).length,
      delivered: list.filter(o => o.status === 'delivered').length,
      pendingPayment: list.filter(o => (o.remaining_balance || 0) > 0 || o.payment_type === 'due').length,
      cancelled: list.filter(o => o.status === 'cancelled').length,
      missed: list.filter(o => o.status === 'missed').length
    };
  }, [orders, todayStr, tomorrowStr]);

  // Financial Metrics
  const metrics = useMemo(() => {
    const list = orders || [];
    const tabSalesValue = list.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const collectedRevenue = list.reduce((sum, o) => sum + (Number(o.advance_amount) || 0), 0);
    const collectOnDelivery = list.reduce((sum, o) => sum + (Number(o.remaining_balance || o.due_amount) || 0), 0);
    const kitchenQueue = list.filter(o => o.status === 'preparing' || o.status === 'pending' || o.status === 'processing').length;
    return { tabSalesValue, collectedRevenue, collectOnDelivery, kitchenQueue, totalOrders: list.length };
  }, [orders]);

  const handleExportCSV = () => {
    exportToCSV(filteredOrders, 'broomies_orders.csv');
    showNotification('Orders exported to CSV successfully!');
  };

  return (
    <div className="space-y-5 px-4 sm:px-6 pt-4">
      {/* Top Header Bar with View Toggles & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            Bakery Order Management Dashboard
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">LIVE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Real-time outlet orders, delivery assignments, and kitchen pipeline</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#13162b] border border-indigo-950 rounded-xl p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'kanban' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'map' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Map View
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV ({metrics.totalOrders})
          </button>
        </div>
      </div>

      {/* Status Filter Pill Buttons Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setQuickTab('today')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${quickTab === 'today' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40' : 'bg-[#0f1224] border-indigo-950 text-slate-300 hover:bg-slate-900'}`}
        >
          <span>TODAY ORDERS</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px]">{tabCounts.today}</span>
        </button>

        <button
          onClick={() => setQuickTab('tomorrow')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${quickTab === 'tomorrow' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40' : 'bg-[#0f1224] border-indigo-950 text-slate-300 hover:bg-slate-900'}`}
        >
          <span>TOMORROW ORDERS</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px]">{tabCounts.tomorrow}</span>
        </button>

        <button
          onClick={() => setQuickTab('future')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${quickTab === 'future' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40' : 'bg-[#0f1224] border-indigo-950 text-slate-300 hover:bg-slate-900'}`}
        >
          <span>FUTURE ORDERS</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px]">{tabCounts.future}</span>
        </button>

        <button
          onClick={() => setQuickTab('delivered')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${quickTab === 'delivered' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-[#0f1224] border-indigo-950 text-slate-300 hover:bg-slate-900'}`}
        >
          <span>DELIVERED HISTORY</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px]">{tabCounts.delivered}</span>
        </button>

        <button
          onClick={() => setQuickTab('pending_payment')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${quickTab === 'pending_payment' ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/40' : 'bg-[#0f1224] border-indigo-950 text-slate-300 hover:bg-slate-900'}`}
        >
          <span>PENDING PAYMENT</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px]">{tabCounts.pendingPayment}</span>
        </button>

        <button
          onClick={() => setQuickTab('cancelled')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${quickTab === 'cancelled' ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-900/40' : 'bg-[#0f1224] border-indigo-950 text-slate-300 hover:bg-slate-900'}`}
        >
          <span>CANCELLED</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px]">{tabCounts.cancelled}</span>
        </button>

        <button
          onClick={() => setQuickTab('missed')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${quickTab === 'missed' ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40' : 'bg-[#0f1224] border-indigo-950 text-slate-300 hover:bg-slate-900'}`}
        >
          <span>MISSED</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px]">{tabCounts.missed}</span>
        </button>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase tracking-wider">Tab Sales Value</span>
            <span className="text-xl font-black text-white font-mono mt-1 block">₹{metrics.tabSalesValue.toLocaleString()}</span>
            <span className="text-[10px] text-purple-400 mt-0.5 block">Across {metrics.totalOrders} orders</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-300 font-bold font-mono">₹</div>
        </div>

        <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase tracking-wider">Collected Revenue</span>
            <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">₹{metrics.collectedRevenue.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-500 mt-0.5 block">Fully settled advance</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-300">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase tracking-wider">Collect On Delivery (Due)</span>
            <span className="text-xl font-black text-amber-400 font-mono mt-1 block">₹{metrics.collectOnDelivery.toLocaleString()}</span>
            <span className="text-[10px] text-amber-500 mt-0.5 block">Pending rider collection</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-300 font-bold">₹</div>
        </div>

        <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase tracking-wider">Kitchen Queue</span>
            <span className="text-xl font-black text-blue-400 font-mono mt-1 block">{metrics.kitchenQueue}</span>
            <span className="text-[10px] text-blue-500 mt-0.5 block">In preparation/dispatch</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-300 font-bold">Q</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 bg-[#0f1224] border border-indigo-950 rounded-2xl flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Order #, Customer, Cake name, Icing..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#13162b] border border-indigo-950 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Status Select */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#13162b] border border-indigo-950 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Outlet Select */}
        <select
          value={outletFilter}
          onChange={(e) => setOutletFilter(e.target.value)}
          className="bg-[#13162b] border border-indigo-950 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
        >
          <option value="all">All Outlets</option>
          <option value="Sector 31">Sector 31</option>
          <option value="Sector 35">Sector 35</option>
          <option value="Sector 42">Sector 42</option>
          <option value="Sector 88">Sector 88</option>
        </select>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-[#13162b] border border-indigo-950 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={refreshOrders}
          className="p-2 text-slate-400 hover:text-white bg-[#13162b] border border-indigo-950 rounded-xl transition"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Orders Display */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-[#0f1224] border border-indigo-950 rounded-2xl">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-white">No Orders Found for "{quickTab.replace('_', ' ').toUpperCase()}"</h3>
          <p className="text-xs text-slate-400 mt-1">Try changing your tab filter or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {filteredOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onView={onViewOrder}
              onEdit={onEditOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
};
