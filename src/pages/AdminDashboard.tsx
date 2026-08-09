import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { OrderCard } from '../components/OrderCard';
import { EditOrderModal } from '../components/EditOrderModal';
import { ViewOrderModal } from '../components/ViewOrderModal';
import { printThermalReceipts } from '../lib/thermalPrint';
import { sortOrdersByDeliveryPriority } from '../lib/timeUtils';
import { matchesOutlet, isOrderForToday } from '../lib/outletUtils';
import { Order, OrderStatus } from '../types';
import { Map, MapControls, MapMarkerData } from '../components/ui/map';
import { Card } from '../components/ui/card';
import {
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle,
  Plus,
  Printer,
  Calendar,
  AlertTriangle,
  XCircle,
  PauseCircle,
  CalendarDays,
  History,
  CreditCard,
  Ban,
  Clock3,
  Key,
  Radio,
  Trash2,
  MapPin,
  Map as MapIcon
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenAddModal: () => void;
  onOpenThermalModal: () => void;
  onOpenDeliveryModal: (order: Order) => void;
  onOpenPasswordModal?: () => void;
}

export type DashboardTab =
  | 'today'
  | 'tomorrow'
  | 'future'
  | 'delivered_history'
  | 'pending_payment'
  | 'cancelled'
  | 'missed'
  | 'on_hold';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenAddModal,
  onOpenThermalModal,
  onOpenDeliveryModal,
  onOpenPasswordModal
}) => {
  const {
    orders = [],
    partners = [],
    outletLocations = [],
    searchQuery,
    selectedOutletFilter,
    selectedStatusFilter,
    selectedOrderIds = [],
    clearOrderSelection
  } = useOMS();

  const safeOrders = orders || [];

  const [activeBoardView, setActiveBoardView] = useState<'kanban' | 'list' | 'map'>('list');
  const [activeTab, setActiveTab] = useState<DashboardTab>('today');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Dates
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Helper: check if order is fully delivered & confirmed by outlet/admin
  const isFullyDelivered = (o: Order) => o.status === 'delivered' && !o.delivery_confirmation_pending;

  // Compute Badge Counts for all 8 Tabs
  const counts = useMemo(() => {
    return {
      today: safeOrders.filter(
        (o) =>
          (o.delivery_date === todayStr || o.order_date === todayStr) &&
          o.status !== 'cancelled' &&
          !isFullyDelivered(o) &&
          o.status !== 'missed' &&
          o.delivery_date >= todayStr
      ).length,
      tomorrow: safeOrders.filter(
        (o) =>
          (o.delivery_date === tomorrowStr || o.order_date === tomorrowStr) &&
          o.status !== 'cancelled' &&
          !isFullyDelivered(o)
      ).length,
      future: safeOrders.filter(
        (o) =>
          (o.delivery_date > tomorrowStr || o.order_date > tomorrowStr) &&
          o.status !== 'cancelled' &&
          !isFullyDelivered(o)
      ).length,
      delivered_history: safeOrders.filter((o) => isFullyDelivered(o)).length,
      pending_payment: safeOrders.filter(
        (o) => o.payment_type === 'due' || (o.remaining_balance && o.remaining_balance > 0) || o.payment_status === 'pending' || o.payment_status === 'due'
      ).length,
      cancelled: safeOrders.filter((o) => o.status === 'cancelled').length,
      missed: safeOrders.filter(
        (o) =>
          o.status === 'missed' ||
          (o.delivery_date < todayStr && !isFullyDelivered(o) && o.status !== 'cancelled')
      ).length,
      on_hold: safeOrders.filter((o) => o.status === 'on_hold').length
    };
  }, [safeOrders, todayStr, tomorrowStr]);

  // Tab definitions
  const tabs: { id: DashboardTab; label: string; icon: React.FC<{ className?: string }>; count: number; color: string }[] = [
    { id: 'today', label: 'TODAY ORDERS', icon: Calendar, count: counts.today, color: 'text-purple-400' },
    { id: 'tomorrow', label: 'TOMORROW ORDERS', icon: CalendarDays, count: counts.tomorrow, color: 'text-indigo-400' },
    { id: 'future', label: 'FUTURE ORDERS', icon: Clock3, count: counts.future, color: 'text-blue-400' },
    { id: 'delivered_history', label: 'DELIVERED HISTORY', icon: History, count: counts.delivered_history, color: 'text-emerald-400' },
    { id: 'pending_payment', label: 'PENDING PAYMENT', icon: CreditCard, count: counts.pending_payment, color: 'text-amber-400' },
    { id: 'cancelled', label: 'CANCELLED', icon: Ban, count: counts.cancelled, color: 'text-rose-400' },
    { id: 'missed', label: 'MISSED', icon: AlertTriangle, count: counts.missed, color: 'text-orange-400' },
    { id: 'on_hold', label: 'ON HOLD', icon: PauseCircle, count: counts.on_hold, color: 'text-slate-400' }
  ];

  // Filtered Orders Logic based on 8 Dashboard Tabs + Outlet / Search filters
  const filteredOrders = useMemo(() => {
    const raw = safeOrders.filter((o) => {
      // 1. Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNum = o.order_number.toString().includes(q);
        const matchName = o.customer_name.toLowerCase().includes(q);
        const matchPhone = o.mobile_number.includes(q);
        const matchItem = o.item_type.toLowerCase().includes(q);
        if (!matchNum && !matchName && !matchPhone && !matchItem) return false;
      }

      // 2. Outlet filter
      if (selectedOutletFilter !== 'ALL' && !matchesOutlet(o.outlet, selectedOutletFilter)) {
        return false;
      }

      // 3. Status Filter dropdown
      if (selectedStatusFilter !== 'ALL' && o.status !== selectedStatusFilter) {
        return false;
      }

      // 4. Tab Specific Filter
      if (activeTab === 'today') {
        const isToday = isOrderForToday(o, todayStr);
        return (
          isToday &&
          o.status !== 'cancelled' &&
          !isFullyDelivered(o) &&
          o.status !== 'missed' &&
          o.delivery_date >= todayStr
        );
      }

      if (activeTab === 'tomorrow') {
        const isTomorrow = o.delivery_date === tomorrowStr || o.order_date === tomorrowStr;
        return isTomorrow && o.status !== 'cancelled' && !isFullyDelivered(o);
      }

      if (activeTab === 'future') {
        const isFuture = o.delivery_date > tomorrowStr || o.order_date > tomorrowStr;
        return isFuture && o.status !== 'cancelled' && !isFullyDelivered(o);
      }

      if (activeTab === 'delivered_history') {
        return isFullyDelivered(o);
      }

      if (activeTab === 'pending_payment') {
        return (
          o.payment_type === 'due' ||
          (o.remaining_balance && o.remaining_balance > 0) ||
          o.payment_status === 'pending' ||
          o.payment_status === 'due'
        );
      }

      if (activeTab === 'cancelled') {
        return o.status === 'cancelled';
      }

      if (activeTab === 'missed') {
        return (
          o.status === 'missed' ||
          (o.delivery_date < todayStr && o.status !== 'delivered' && o.status !== 'cancelled')
        );
      }

      if (activeTab === 'on_hold') {
        return o.status === 'on_hold';
      }

      return true;
    });

    return sortOrdersByDeliveryPriority(raw);
  }, [safeOrders, searchQuery, selectedOutletFilter, selectedStatusFilter, activeTab, todayStr, tomorrowStr]);

  // Map markers computation for Admin Map View
  const adminMapMarkers = useMemo(() => {
    const list: MapMarkerData[] = (outletLocations || []).map((outlet) => ({
      id: `outlet-${outlet.id}`,
      title: outlet.name,
      subtitle: outlet.address,
      lat: outlet.lat,
      lng: outlet.lng,
      color: outlet.color || '#10b981',
      icon: '🏬'
    }));

    (partners || []).forEach((p) => {
      if (p.location) {
        list.push({
          id: `rider-${p.id}`,
          title: `${p.name} (Rider)`,
          subtitle: `${p.vehicle || 'Bike'} • ${p.status === 'on_delivery' ? 'On Trip' : 'Available'} • ${p.location.speed || 0} km/h`,
          lat: p.location.lat,
          lng: p.location.lng,
          color: p.status === 'on_delivery' ? '#f59e0b' : '#10b981',
          icon: '🛵'
        });
      }
    });

    filteredOrders.slice(0, 30).forEach((o) => {
      const offsetLat = 28.4520 + ((o.order_number * 17) % 60) * 0.001 - 0.03;
      const offsetLng = 77.3180 + ((o.order_number * 31) % 60) * 0.001 - 0.03;

      list.push({
        id: `ord-${o.id}`,
        title: `Order #${o.order_number}`,
        subtitle: `${o.customer_name} • ₹${o.total_amount} • Status: ${o.status.toUpperCase()}`,
        lat: offsetLat,
        lng: offsetLng,
        color: o.status === 'delivered' ? '#10b981' : o.status === 'out_for_delivery' ? '#3b82f6' : '#a855f7',
        icon: '🎂'
      });
    });

    return list;
  }, [partners, filteredOrders, outletLocations]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalPaid = filteredOrders.reduce((sum, o) => sum + (o.advance_amount || 0), 0);
    const totalDue = filteredOrders.reduce((sum, o) => sum + (o.remaining_balance || 0), 0);

    const pendingCount = filteredOrders.filter((o) => o.status === 'pending').length;
    const processingCount = filteredOrders.filter((o) => o.status === 'processing').length;
    const outForDeliveryCount = filteredOrders.filter((o) => o.status === 'out_for_delivery').length;
    const deliveredCount = filteredOrders.filter((o) => o.status === 'delivered').length;

    return {
      totalRevenue,
      totalPaid,
      totalDue,
      pendingCount,
      processingCount,
      outForDeliveryCount,
      deliveredCount
    };
  }, [filteredOrders]);

  const columns: { status: OrderStatus; label: string; color: string; count: number }[] = [
    { status: 'pending', label: 'Pending Orders', color: 'border-purple-500 text-purple-400', count: metrics.pendingCount },
    { status: 'processing', label: 'In Preparation', color: 'border-amber-500 text-amber-400', count: metrics.processingCount },
    { status: 'out_for_delivery', label: 'Out for Delivery', color: 'border-blue-500 text-blue-400', count: metrics.outForDeliveryCount },
    { status: 'delivered', label: 'Delivered', color: 'border-emerald-500 text-emerald-400', count: metrics.deliveredCount }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Bakery Order Management Dashboard
            <span className="text-xs font-bold uppercase tracking-wider bg-purple-600/20 text-purple-400 px-2.5 py-1 rounded-full border border-purple-500/30">
              Live
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time outlet orders, delivery assignments, and kitchen pipeline
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Kanban vs List vs Map toggle */}
          <div className="bg-[#0f1220] border border-indigo-950 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setActiveBoardView('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeBoardView === 'kanban'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setActiveBoardView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeBoardView === 'list'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setActiveBoardView('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                activeBoardView === 'map'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
          </div>

          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            + New Order
          </button>
        </div>
      </div>

      {/* 8 DASHBOARD TABS BAR matching exact user requirements */}
      <div className="bg-[#0c0f1d] border border-indigo-950/80 rounded-2xl p-2.5 shadow-xl overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                    : 'bg-[#101323] text-slate-300 hover:bg-indigo-950/60 hover:text-white border border-indigo-950'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.color}`} />
                <span>{tab.label}</span>
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-black ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-950 text-purple-300 border border-purple-500/20'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics High-level Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#0b0e1b] border border-indigo-950/80 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Tab Sales Value</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ₹{(metrics.totalRevenue ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Across {filteredOrders.length} orders</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0b0e1b] border border-indigo-950/80 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Collected Revenue</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            ₹{(metrics.totalPaid ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-500/80 font-medium">Fully settled advance</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0b0e1b] border border-indigo-950/80 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Collect on Delivery (Due)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            ₹{(metrics.totalDue ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-500/80 font-medium">Pending rider collection</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0b0e1b] border border-indigo-950/80 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Kitchen Queue</span>
            <ShoppingBag className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">
            {metrics.pendingCount + metrics.processingCount}
          </div>
          <div className="text-[11px] text-slate-500">In preparation/dispatch</div>
        </div>
      </div>

      {/* Batch Select Controls if active */}
      {selectedOrderIds.length > 0 && (
        <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/50 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
            <span className="font-bold text-purple-200">
              {selectedOrderIds.length} Order(s) Selected for Batch Action
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenThermalModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Thermal Receipts
            </button>
            <button
              onClick={clearOrderSelection}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Board View: Map, Kanban or List */}
      {activeBoardView === 'map' ? (
        <Card className="h-[540px] p-0 overflow-hidden border border-indigo-900/80 bg-[#0c0f24]">
          <div className="p-4 bg-[#090c1b] border-b border-indigo-950 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600/20 border border-purple-500/40 rounded-xl text-purple-300">
                <MapPin className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  Admin Spatial Live Map View
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    MapLibre GPS Active
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Showing Outlets, Riders, and {filteredOrders.length} Tab Orders on Map
                </p>
              </div>
            </div>
          </div>

          <div className="h-[460px] w-full relative">
            <Map center={[77.3100, 28.4520]} zoom={12} markers={adminMapMarkers}>
              <MapControls position="top-right" />
            </Map>
          </div>
        </Card>
      ) : activeBoardView === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map((col) => {
            const columnOrders = filteredOrders.filter((o) => o.status === col.status);

            return (
              <div key={col.status} className="space-y-3">
                {/* Column Header */}
                <div
                  className={`p-3 rounded-xl bg-[#0a0d1a] border ${col.color} border-l-4 flex items-center justify-between`}
                >
                  <span className="font-extrabold text-xs tracking-tight uppercase">
                    {col.label}
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-indigo-950 text-slate-200">
                    {columnOrders.length}
                  </span>
                </div>

                {/* Orders Stack */}
                <div className="space-y-3 min-h-[350px]">
                  {columnOrders.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-indigo-950 rounded-2xl text-slate-500 text-xs">
                      No orders in {col.label.toLowerCase()}
                    </div>
                  ) : (
                    columnOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onOpenDeliveryModal={onOpenDeliveryModal}
                        onViewOrder={setViewingOrder}
                        onEditOrder={setEditingOrder}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-indigo-950 rounded-2xl text-slate-500 text-sm">
              No matching orders found under this tab. Try selecting another tab or clearing search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onOpenDeliveryModal={onOpenDeliveryModal}
                  onViewOrder={setViewingOrder}
                  onEditOrder={setEditingOrder}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
    </div>
  );
};
