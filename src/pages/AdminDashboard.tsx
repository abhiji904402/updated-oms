import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { Order, OrderStatus } from '../types';
import { OrderCard } from '../components/OrderCard';
import { Search, Filter, RefreshCw, Calendar, Sparkles } from 'lucide-react';

interface AdminDashboardProps {
  onViewOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onOpenAddModal: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onViewOrder,
  onEditOrder,
  onOpenAddModal
}) => {
  const { orders, isLoading, refreshOrders } = useOMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [outletFilter, setOutletFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
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
  }, [orders, searchQuery, statusFilter, outletFilter, dateFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const list = orders || [];
    const totalOrders = list.length;
    const pendingOrders = list.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;
    const deliveredOrders = list.filter((o) => o.status === 'delivered').length;
    const totalRevenue = list.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    return { totalOrders, pendingOrders, deliveredOrders, totalRevenue };
  }, [orders]);

  return (
    <div className="space-y-5">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-semibold block">Total Orders</span>
          <span className="text-xl sm:text-2xl font-black text-white font-mono">{metrics.totalOrders}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-amber-400 font-semibold block">Active / Pending</span>
          <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">{metrics.pendingOrders}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-semibold block">Delivered</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">{metrics.deliveredOrders}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-purple-400 font-semibold block">Total Sales</span>
          <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono">₹{metrics.totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 bg-[#0f1224] border border-indigo-950 rounded-2xl flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
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
            <option value="all">All Status</option>
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

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1224] border border-indigo-950 rounded-2xl">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-white">No Orders Found</h3>
          <p className="text-xs text-slate-400 mt-1">Try changing filters or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
