import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { OrderCard } from '../components/OrderCard';
import { EditOrderModal } from '../components/EditOrderModal';
import { ViewOrderModal } from '../components/ViewOrderModal';
import { printThermalReceipts } from '../lib/thermalPrint';
import { exportToCSV, printPDFReport } from '../lib/exportUtils';
import { matchesOutlet } from '../lib/outletUtils';
import {
  isDeliveredMarked,
  isPaymentPending,
  sortOrdersByTab,
  computeTabCounts,
  DashboardTab,
  getNormalizedDateStr,
  isOrderForToday
} from '../lib/orderLogic';
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
  Map as MapIcon,
  Download,
  FileText,
  ShieldCheck,
  Check,
  RefreshCw,
  X
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenAddModal: () => void;
  onOpenThermalModal: () => void;
  onOpenDeliveryModal: (order: Order) => void;
  onOpenPasswordModal?: () => void;
}

export const AdminDashboard = React.memo<AdminDashboardProps>(({
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
    dateRangeFilter,
    selectedOrderIds = [],
    session,
    clearOrderSelection,
    confirmRiderDelivery,
    resequenceAllOrders
  } = useOMS();

  const isOutletUser = session?.role === 'outlet';
  const assignedOutlet = session?.outlet || 'Sector 31';

  const safeOrders = useMemo(() => {
    const raw = orders || [];
    if (isOutletUser && assignedOutlet) {
      return raw.filter((o) => matchesOutlet(o.outlet, assignedOutlet));
    }
    return raw;
  }, [orders, isOutletUser, assignedOutlet]);

  // Pending Rider Delivery Confirmations
  const pendingConfirmations = useMemo(() => {
    return safeOrders.filter((o) => Boolean(o.delivery_confirmation_pending));
  }, [safeOrders]);

  const [activeBoardView, setActiveBoardView] = useState<'kanban' | 'list' | 'map'>('list');
  const [activeTab, setActiveTab] = useState<DashboardTab>('today');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [isResequenceModalOpen, setIsResequenceModalOpen] = useState(false);
  const [isResequencing, setIsResequencing] = useState(false);
  const [resequenceStartNum, setResequenceStartNum] = useState(1);

  const handleExecuteResequence = async (startNum: number) => {
    setIsResequencing(true);
    await resequenceAllOrders(startNum);
    setIsResequencing(false);
    setIsResequenceModalOpen(false);
  };

  // Dates
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Compute Badge Counts for all 8 Tabs
  const counts = useMemo(() => {
    return computeTabCounts(safeOrders, todayStr, tomorrowStr);
  }, [safeOrders, todayStr, tomorrowStr]);

  // Tab definitions
  const tabs: { id: DashboardTab; label: string; icon: React.FC<{ className?: string }>; count: number | string; color: string }[] = [
    { id: 'all', label: 'ALL ORDERS', icon: ShoppingBag, count: counts.all, color: 'text-violet-400' },
    { id: 'today', label: 'TODAY ORDERS', icon: Calendar, count: counts.today, color: 'text-purple-400' },
    { id: 'tomorrow', label: 'TOMORROW ORDERS', icon: CalendarDays, count: counts.tomorrow, color: 'text-indigo-400' },
    { id: 'future', label: 'FUTURE ORDERS', icon: Clock3, count: counts.future, color: 'text-blue-400' },
    { id: 'delivered_history', label: 'DELIVERED HISTORY', icon: History, count: counts.delivered_history, color: 'text-emerald-400' },
    {
      id: 'pending_payment',
      label: 'PENDING PAYMENT',
      icon: CreditCard,
      count: counts.pending_payment_amount > 0 ? `₹${counts.pending_payment_amount.toLocaleString()}` : counts.pending_payment,
      color: 'text-amber-400'
    },
    { id: 'cancelled', label: 'CANCELLED', icon: Ban, count: counts.cancelled, color: 'text-rose-400' },
    { id: 'missed', label: 'MISSED', icon: AlertTriangle, count: counts.missed, color: 'text-orange-400' },
    { id: 'on_hold', label: 'ON HOLD', icon: PauseCircle, count: counts.on_hold, color: 'text-slate-400' }
  ];

  // Filtered Orders Logic based on Dashboard Tabs + Outlet / Search filters
  const filteredOrders = useMemo(() => {
    const raw = safeOrders.filter((o) => {
      // 1. Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = o.order_number.toString().includes(q);
        const matchName = o.customer_name.toLowerCase().includes(q);
        const matchPhone = o.mobile_number.includes(q);
        const matchItem = o.item_type.toLowerCase().includes(q);
        const matchAdvBill = (o.advance_bill_number || (o as any).adv_bill || '').toLowerCase().includes(q);
        const matchFinalBill = (o.final_bill_number || (o as any).final_bill || (o as any).bill_number || '').toLowerCase().includes(q);
        if (!matchNum && !matchName && !matchPhone && !matchItem && !matchAdvBill && !matchFinalBill) return false;
      }

      // 2. Outlet filter
      if (selectedOutletFilter !== 'ALL' && !matchesOutlet(o.outlet, selectedOutletFilter)) {
        return false;
      }

      // 3. Status Filter dropdown
      if (selectedStatusFilter !== 'ALL' && o.status !== selectedStatusFilter) {
        return false;
      }

      // 3.5 Date Range filter
      if (dateRangeFilter) {
        const delDate = getNormalizedDateStr(o.delivery_date) || getNormalizedDateStr(o.order_date);
        if (dateRangeFilter.start && delDate < dateRangeFilter.start) return false;
        if (dateRangeFilter.end && delDate > dateRangeFilter.end) return false;
      }

      // 4. Tab Specific Filter
      if (activeTab === 'all') {
        return true;
      }

      if (activeTab === 'today') {
        const delDate = getNormalizedDateStr(o.delivery_date) || getNormalizedDateStr(o.order_date);
        return (
          (delDate === todayStr || delDate <= todayStr) &&
          o.status !== 'cancelled' &&
          o.status !== 'on_hold' &&
          !isDeliveredMarked(o) &&
          o.status !== 'missed'
        );
      }

      if (activeTab === 'tomorrow') {
        const delDate = getNormalizedDateStr(o.delivery_date) || getNormalizedDateStr(o.order_date);
        return (
          delDate === tomorrowStr &&
          o.status !== 'cancelled' &&
          o.status !== 'on_hold' &&
          !isDeliveredMarked(o)
        );
      }

      if (activeTab === 'future') {
        const delDate = getNormalizedDateStr(o.delivery_date) || getNormalizedDateStr(o.order_date);
        return (
          delDate > tomorrowStr &&
          o.status !== 'cancelled' &&
          o.status !== 'on_hold' &&
          !isDeliveredMarked(o)
        );
      }

      if (activeTab === 'delivered_history') {
        return isDeliveredMarked(o);
      }

      if (activeTab === 'pending_payment') {
        return isDeliveredMarked(o) && isPaymentPending(o) && o.status !== 'cancelled';
      }

      if (activeTab === 'cancelled') {
        return o.status === 'cancelled';
      }

      if (activeTab === 'missed') {
        const normDelDate = getNormalizedDateStr(o.delivery_date);
        return (
          normDelDate !== '' &&
          normDelDate < todayStr &&
          !isDeliveredMarked(o) &&
          o.status !== 'cancelled'
        );
      }

      if (activeTab === 'on_hold') {
        return o.status === 'on_hold';
      }

      return true;
    });

    return sortOrdersByTab(raw, activeTab);
  }, [safeOrders, searchQuery, selectedOutletFilter, selectedStatusFilter, activeTab, todayStr, tomorrowStr]);

  // Reset pagination on filter or tab change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedOutletFilter, selectedStatusFilter, activeBoardView]);

  const PAGE_SIZE = 30;
  const totalPages = useMemo(() => Math.ceil(filteredOrders.length / PAGE_SIZE) || 1, [filteredOrders.length]);
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  // Date-grouped missed orders pass for Missed Tab
  const missedGroups = useMemo(() => {
    if (activeTab !== 'missed') return [];
    const map: Record<string, Order[]> = {};
    filteredOrders.forEach((o) => {
      const d = getNormalizedDateStr(o.delivery_date);
      if (!map[d]) map[d] = [];
      map[d].push(o);
    });

    // Sort dates DESC (most recently missed date first)
    const sortedDates = Object.keys(map).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateStr) => {
      // Within each date group, sort cards by delivery_time_expected ASC
      const groupOrders = [...map[dateStr]].sort((a, b) => {
        const timeA = a.delivery_time_expected || a.order_time || '00:00';
        const timeB = b.delivery_time_expected || b.order_time || '00:00';
        return timeA.localeCompare(timeB);
      });

      return {
        dateStr,
        orders: groupOrders
      };
    });
  }, [filteredOrders, activeTab]);

  // Map markers computation for Admin Map View
  const adminMapMarkers = useMemo(() => {
    if (activeBoardView !== 'map') return [];
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
  }, [activeBoardView, partners, filteredOrders, outletLocations]);

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
            {isOutletUser ? `${assignedOutlet} Outlet Dashboard` : 'Bakery Order Management Dashboard'}
            <span className="text-xs font-bold uppercase tracking-wider bg-purple-600/20 text-purple-400 px-2.5 py-1 rounded-full border border-purple-500/30">
              {isOutletUser ? assignedOutlet : 'Live'}
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

          {!isOutletUser && orders.length > 0 && (
            <button
              onClick={() => setIsResequenceModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-purple-200 font-bold text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer"
              title="Fix and re-number order sequence cleanly"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Fix Series</span>
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
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

      {/* Pending Rider Delivery Confirmations Banner */}
      {pendingConfirmations.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/80 border-2 border-amber-500/80 text-amber-200 text-xs shadow-2xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-black text-sm text-amber-300 uppercase tracking-wide">
              <span className="text-xl">🚚</span>
              <span>Pending Rider Delivery Confirmations ({pendingConfirmations.length})</span>
            </div>
            <button
              onClick={() => {
                pendingConfirmations.forEach((ord) => confirmRiderDelivery(ord.id));
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm All ({pendingConfirmations.length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {pendingConfirmations.map((ord) => (
              <div
                key={`conf-admin-${ord.id}`}
                className="p-3 rounded-xl bg-[#0e111d] border border-amber-500/50 flex items-center justify-between gap-3 shadow-md"
              >
                <div>
                  <div className="font-extrabold text-white text-xs">
                    Order #{ord.order_number} • {ord.customer_name || 'Customer'}
                  </div>
                  <div className="text-[11px] text-amber-300/90 mt-0.5">
                    Outlet: <strong>{ord.outlet}</strong> | Rider: <strong>{ord.delivered_by || ord.delivery_partner || 'Delivery Partner'}</strong>
                  </div>
                  {ord.delivery_photo_url && (
                    <div className="text-[10px] text-emerald-400 mt-0.5 font-semibold">
                      📷 Proof Photo Attached
                    </div>
                  )}
                </div>
                <button
                  onClick={() => confirmRiderDelivery(ord.id)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase shrink-0 transition cursor-pointer shadow"
                >
                  Confirm
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Payment Audit Banner */}
      {activeTab === 'pending_payment' && (
        <div className="p-4 bg-amber-950/80 border border-amber-500/70 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-xl">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-extrabold text-amber-300 text-sm">⚠️ Delivered orders with pending payment (Due / Part Payment)</p>
              <p className="text-amber-300/80 text-[11px] mt-0.5">
                Audit list for delivered orders where money is still owed. Marking an order "Paid Full" updates audit logs instantly and clears it from this list.
              </p>
            </div>
          </div>
          <div className="px-3.5 py-1.5 bg-amber-900/90 border border-amber-600/60 rounded-xl font-mono font-black text-amber-200 text-xs shrink-0 flex items-center gap-1.5">
            <span>Total Outstanding:</span>
            <span className="text-amber-100 text-sm">₹{(metrics.totalDue ?? 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Missed Orders Warning Banner */}
      {activeTab === 'missed' && (
        <div className="p-4 bg-orange-950/80 border border-orange-500/70 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-orange-200 shadow-xl">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
            <div>
              <p className="font-extrabold text-orange-300 text-sm">
                ⚠️ {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} whose delivery date has passed but are not yet marked as delivered
              </p>
              <p className="text-orange-300/80 text-[11px] mt-0.5">
                Review missed orders below to mark as delivered, move to on-hold, cancel, or reassign a delivery partner.
              </p>
            </div>
          </div>
          <div className="px-3.5 py-1.5 bg-orange-900/90 border border-orange-600/60 rounded-xl font-mono font-black text-orange-200 text-xs shrink-0 flex items-center gap-1.5">
            <span>Past Due Target:</span>
            <span className="text-orange-100 text-sm">{filteredOrders.length} Orders</span>
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
            const displayedColumnOrders = columnOrders.slice(0, 25);

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
                    <>
                      {displayedColumnOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onOpenDeliveryModal={onOpenDeliveryModal}
                          onViewOrder={setViewingOrder}
                          onEditOrder={setEditingOrder}
                        />
                      ))}
                      {columnOrders.length > 25 && (
                        <div className="p-3 text-center bg-indigo-950/40 border border-indigo-900/50 rounded-xl text-xs text-purple-300 font-medium">
                          Showing top 25 of {columnOrders.length} orders in {col.label}.
                          <button
                            onClick={() => setActiveBoardView('list')}
                            className="underline font-bold text-white ml-1.5 hover:text-purple-200"
                          >
                            Switch to List View to see all paginated orders
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View with Fast Pagination */
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-indigo-950 rounded-2xl text-slate-400 text-sm space-y-2 bg-[#0b0e1b]/50">
              {activeTab === 'missed' ? (
                <div className="space-y-1.5">
                  <div className="text-3xl mb-1">🎉</div>
                  <p className="text-emerald-400 font-extrabold text-base">No missed orders</p>
                  <p className="text-xs text-slate-400">Everything is on track! No past due orders requiring attention.</p>
                </div>
              ) : activeTab === 'pending_payment' ? (
                <div className="space-y-1.5">
                  <p className="text-emerald-400 font-extrabold text-base flex items-center justify-center gap-2">
                    <span>✅</span>
                    <span>All payments collected — no dues</span>
                  </p>
                  <p className="text-xs text-slate-400">Every delivered order has been fully paid for.</p>
                </div>
              ) : (
                <p>No matching orders found under this tab. Try selecting another tab or clearing search.</p>
              )}
            </div>
          ) : activeTab === 'missed' ? (
            /* Date-Grouped View for Missed Tab */
            <div className="space-y-6">
              {/* Export Bar for Missed Orders */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#0b0e1b] border border-orange-500/30 rounded-xl text-xs text-slate-300 shadow">
                <div className="flex items-center gap-2 font-bold text-orange-200">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Showing {filteredOrders.length} Missed {filteredOrders.length === 1 ? 'Order' : 'Orders'} grouped across {missedGroups.length} {missedGroups.length === 1 ? 'date' : 'dates'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportToCSV(filteredOrders, `Missed_Orders_${todayStr}`)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/80 hover:bg-emerald-900 text-emerald-300 font-bold flex items-center gap-1 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export CSV ({filteredOrders.length})</span>
                  </button>
                  <button
                    onClick={() => printPDFReport(filteredOrders, `Missed Orders Report - ${todayStr}`)}
                    className="px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-800/80 hover:bg-purple-900 text-purple-300 font-bold flex items-center gap-1 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>PDF Report ({filteredOrders.length})</span>
                  </button>
                </div>
              </div>

              {/* Grouped Dated Sections */}
              {missedGroups.map((group) => (
                <div key={group.dateStr} className="space-y-3">
                  {/* Dated Section Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e1226] border border-orange-500/30 rounded-xl text-xs font-bold text-orange-200 shadow-md">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                      <Calendar className="w-4 h-4 text-orange-400" />
                      <span>📅 {group.dateStr}</span>
                      <span className="text-xs font-semibold text-orange-300/80 font-mono">
                        ({group.orders.length} {group.orders.length === 1 ? 'order' : 'orders'})
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800/60">
                      Past Due Group
                    </span>
                  </div>

                  {/* Cards Grid for this date group */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onOpenDeliveryModal={onOpenDeliveryModal}
                        onViewOrder={setViewingOrder}
                        onEditOrder={setEditingOrder}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Pagination & Direct Filter Export Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#0b0e1b] border border-indigo-950/80 rounded-xl text-xs text-slate-300">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    Showing <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                    <strong className="text-white">
                      {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}
                    </strong>{' '}
                    of <strong className="text-purple-400">{filteredOrders.length}</strong> orders
                  </div>

                  {/* Export Filtered Data Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportToCSV(filteredOrders, `Filtered_Orders_${activeTab}`)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/80 hover:bg-emerald-900 text-emerald-300 font-bold flex items-center gap-1 transition"
                      title="Export current tab filtered orders to CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export CSV ({filteredOrders.length})</span>
                    </button>

                    <button
                      onClick={() => printPDFReport(filteredOrders, `Orders Report - ${activeTab.toUpperCase()}`)}
                      className="px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-800/80 hover:bg-purple-900 text-purple-300 font-bold flex items-center gap-1 transition"
                      title="Export current tab filtered orders to PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                      <span>PDF Report ({filteredOrders.length})</span>
                    </button>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
                    >
                      First
                    </button>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1 bg-purple-600/30 border border-purple-500/40 rounded-lg text-purple-200 font-extrabold">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
                    >
                      Next
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
                    >
                      Last
                    </button>
                  </div>
                )}
              </div>

              {/* Paginated Orders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pagedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpenDeliveryModal={onOpenDeliveryModal}
                    onViewOrder={setViewingOrder}
                    onEditOrder={setEditingOrder}
                  />
                ))}
              </div>

              {/* Pagination Bottom Bar */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#0b0e1b] border border-indigo-950/80 rounded-xl text-xs text-slate-300">
                  <div>
                    Page <strong className="text-white">{currentPage}</strong> of{' '}
                    <strong className="text-white">{totalPages}</strong>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
                    >
                      First
                    </button>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
                    >
                      Prev
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
                    >
                      Next
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="px-2.5 py-1 rounded-lg bg-[#12162a] border border-indigo-950 hover:bg-purple-900 disabled:opacity-40 disabled:hover:bg-[#12162a] font-bold"
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </>
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

      {/* Resequence / Fix Order Series Modal */}
      {isResequenceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101426] border border-purple-900/50 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-950/80 border border-purple-800 rounded-xl text-purple-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Fix & Reset Order ID Series</h3>
                  <p className="text-xs text-slate-400">Total {orders.length} orders in system</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResequenceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This tool sorts all {orders.length} orders in <strong className="text-purple-300">descending order based on Order Date &amp; Time</strong> (newest punched orders first) and updates all <strong className="text-purple-300">Order IDs sequentially</strong> without touching or modifying the <strong className="text-emerald-400">delivery_date</strong> field in any way.
            </p>

            {/* Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider">
                Choose Starting Order Number:
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResequenceStartNum(1)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    resequenceStartNum === 1
                      ? 'bg-purple-950/80 border-purple-500 text-white shadow'
                      : 'bg-[#151930] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-black">Start from #1</div>
                  <div className="text-[11px] text-slate-400">#1 to #{orders.length}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setResequenceStartNum(2160)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    resequenceStartNum === 2160
                      ? 'bg-purple-950/80 border-purple-500 text-white shadow'
                      : 'bg-[#151930] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-black">Start from #2160</div>
                  <div className="text-[11px] text-slate-400">#2160 to #{2160 + orders.length - 1}</div>
                </button>
              </div>

              {/* Custom start number input */}
              <div className="mt-3">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Or enter custom start number:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-purple-400">#</span>
                  <input
                    type="number"
                    min={1}
                    value={resequenceStartNum}
                    onChange={(e) => setResequenceStartNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-[#151930] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl p-3.5 text-xs text-purple-200">
              <div className="font-bold text-purple-300">Series Preview:</div>
              <div className="mt-1 font-mono text-sm font-black text-white">
                #{resequenceStartNum} ➔ #{resequenceStartNum + Math.max(0, orders.length - 1)}
              </div>
              <div className="text-[11px] text-purple-300/80 mt-1">
                All {orders.length} existing orders will be cleanly updated in local storage and Firestore.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResequenceModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResequencing}
                onClick={() => handleExecuteResequence(resequenceStartNum)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 flex items-center gap-2 transition cursor-pointer"
              >
                {isResequencing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{isResequencing ? 'Applying Series...' : 'Apply Series Re-Sequencing'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
