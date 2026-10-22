import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { Order } from '../types';
import { OrderCard } from '../components/OrderCard';
import { RiderLocationMapModal } from '../components/RiderLocationMapModal';
import { SetOutletLocationModal } from '../components/SetOutletLocationModal';
import {
  Calendar,
  Clock,
  Sparkles,
  Map,
  Printer,
  ChevronLeft,
  ChevronRight,
  History,
  CreditCard,
  Ban,
  AlertTriangle,
  PauseCircle,
  CheckCircle2,
  Download,
  Send,
  BellRing
} from 'lucide-react';
import {
  getTodayDateStr,
  getTomorrowDateStr,
  sortOrdersByDeliveryPriority,
  sortDeliveredOrdersRecentFirst,
  isOrderFinalDelivered,
  groupDeliveredOrdersByDate,
  exportOrdersToCSV
} from '../lib/timeUtils';
import { matchesOutlet } from '../lib/outletUtils';
import { isPaymentPending } from '../lib/orderLogic';
import { renderWhatsAppTemplate } from '../components/WhatsAppPopup';

interface AdminDashboardProps {
  onViewOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onWhatsAppOrder?: (order: Order) => void;
  onOpenAddModal: () => void;
  onOpenThermalModal?: () => void;
  onOpenDeliveryModal?: (order: Order) => void;
  onOpenPasswordModal?: () => void;
  onOpenSheetModal?: () => void;
}

const PAGE_SIZE = 30;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onViewOrder,
  onEditOrder,
  onWhatsAppOrder,
  onOpenThermalModal
}) => {
  const {
    orders,
    partners,
    session,
    searchQuery,
    selectedOutletFilter,
    selectedStatusFilter,
    dateRangeFilter,
    selectedOrderIds,
    clearOrderSelection,
    confirmRiderDelivery,
    showNotification
  } = useOMS();

  const isOutletUser = session?.role === 'outlet';
  const assignedOutlet = session?.outlet || 'Sector 31';

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [quickTab, setQuickTab] = useState<string>('today');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isFleetMapOpen, setIsFleetMapOpen] = useState<boolean>(false);
  const [isSetOutletOpen, setIsSetOutletOpen] = useState<boolean>(false);
  const [isSendingBulkReminder, setIsSendingBulkReminder] = useState<boolean>(false);

  const todayStr = getTodayDateStr();
  const tomorrowStr = getTomorrowDateStr();

  // Base orders scoped by outlet if outlet user or top header outlet filter
  const baseOrders = useMemo(() => {
    const raw = orders || [];
    return raw.filter((o) => {
      if (isOutletUser && assignedOutlet && !matchesOutlet(o.outlet, assignedOutlet)) {
        return false;
      }
      if (!isOutletUser && selectedOutletFilter && selectedOutletFilter !== 'ALL' && !matchesOutlet(o.outlet, selectedOutletFilter)) {
        return false;
      }
      if (selectedStatusFilter && selectedStatusFilter !== 'ALL' && o.status !== selectedStatusFilter) {
        return false;
      }
      if (dateRangeFilter?.start && (o.delivery_date || o.order_date || '') < dateRangeFilter.start) {
        return false;
      }
      if (dateRangeFilter?.end && (o.delivery_date || o.order_date || '') > dateRangeFilter.end) {
        return false;
      }
      return true;
    });
  }, [orders, isOutletUser, assignedOutlet, selectedOutletFilter, selectedStatusFilter, dateRangeFilter]);

  // Single-pass O(N) computation of all tab counts & pending payment rupee sum
  const tabCounts = useMemo(() => {
    let today = 0;
    let tomorrow = 0;
    let future = 0;
    let delivered = 0;
    let pendingPaymentCount = 0;
    let pendingPaymentAmount = 0;
    let cancelled = 0;
    let missed = 0;
    let onHold = 0;

    for (let i = 0; i < baseOrders.length; i++) {
      const o = baseOrders[i];
      const finalDeliv = isOrderFinalDelivered(o);
      const isCanc = o.status === 'cancelled';
      const delivDate = o.delivery_date || '';

      if (finalDeliv) {
        delivered++;
      } else if (!isCanc) {
        if (delivDate === todayStr || (!delivDate && o.order_date === todayStr)) {
          today++;
        } else if (delivDate === tomorrowStr) {
          tomorrow++;
        } else if (delivDate > tomorrowStr) {
          future++;
        }
      }

      if (isPaymentPending(o)) {
        pendingPaymentCount++;
        const totalVal = Number(o.total_amount) || 0;
        const pType = String(o.payment_type || 'due').toLowerCase().trim();
        const adv = pType === 'due' ? 0 : (Number(o.advance_amount) || 0);
        const due = Number(o.remaining_balance ?? o.due_amount ?? (pType === 'due' ? totalVal : Math.max(0, totalVal - adv))) || 0;
        pendingPaymentAmount += due;
      }

      if (isCanc) cancelled++;
      else if (o.status === 'missed') missed++;
      else if (o.status === 'on_hold') onHold++;
    }

    return {
      today,
      tomorrow,
      future,
      delivered,
      pendingPaymentCount,
      pendingPaymentAmount,
      cancelled,
      missed,
      onHold
    };
  }, [baseOrders, todayStr, tomorrowStr]);

  const filteredOrders = useMemo(() => {
    const filtered = baseOrders.filter((o) => {
      // Quick Tab Filter
      if (quickTab === 'today') {
        const isToday = o.delivery_date === todayStr || (!o.delivery_date && o.order_date === todayStr);
        if (!isToday || isOrderFinalDelivered(o) || o.status === 'cancelled') return false;
      } else if (quickTab === 'tomorrow') {
        if (o.delivery_date !== tomorrowStr || isOrderFinalDelivered(o) || o.status === 'cancelled') return false;
      } else if (quickTab === 'future') {
        if ((o.delivery_date || '') <= tomorrowStr || isOrderFinalDelivered(o) || o.status === 'cancelled') return false;
      } else if (quickTab === 'delivered') {
        if (!isOrderFinalDelivered(o)) return false;
      } else if (quickTab === 'pending_payment') {
        if (!isPaymentPending(o)) return false;
      } else if (quickTab === 'cancelled') {
        if (o.status !== 'cancelled') return false;
      } else if (quickTab === 'missed') {
        if (o.status !== 'missed') return false;
      } else if (quickTab === 'on_hold') {
        if (o.status !== 'on_hold') return false;
      }

      // Global Search
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = String(o.order_number).includes(q);
        const matchCustomer = (o.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (o.mobile_number || '').includes(q);
        const matchItem = (o.item_type || '').toLowerCase().includes(q);
        const matchNameOnCake = (o.name_on_cake || '').toLowerCase().includes(q);
        const matchOutlet = (o.outlet || '').toLowerCase().includes(q);
        if (!matchNumber && !matchCustomer && !matchPhone && !matchItem && !matchNameOnCake && !matchOutlet) {
          return false;
        }
      }

      return true;
    });

    if (quickTab === 'delivered' || quickTab === 'pending_payment' || quickTab === 'cancelled' || quickTab === 'missed') {
      return sortDeliveredOrdersRecentFirst(filtered);
    }

    return sortOrdersByDeliveryPriority(filtered);
  }, [baseOrders, searchQuery, quickTab, todayStr, tomorrowStr]);

  // Unconfirmed Rider Deliveries waiting for Admin/Outlet confirmation
  const unconfirmedRiderOrders = useMemo(() => {
    return baseOrders.filter(
      (o) =>
        o.status === 'delivered' &&
        Boolean(o.delivery_confirmation_pending) &&
        String(o.delivery_type || '').toLowerCase().trim() !== 'pickup'
    );
  }, [baseOrders]);

  const handleConfirmAllRiderDeliveries = () => {
    unconfirmedRiderOrders.forEach((o) => {
      confirmRiderDelivery(o.id);
    });
  };

  const handleSendBulkPaymentReminders = async () => {
    const dueOrders = baseOrders.filter(isPaymentPending);
    if (dueOrders.length === 0) return;
    setIsSendingBulkReminder(true);
    let sent = 0;
    try {
      for (const ord of dueOrders.slice(0, 25)) {
        const msg = renderWhatsAppTemplate('reminder', ord);
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: ord.mobile_number,
            message: msg,
            orderNumber: ord.order_number,
            customerName: ord.customer_name,
            orderId: ord.id,
            type: 'reminder'
          })
        });
        sent++;
      }
      showNotification(`⚡ Sent ${sent} WhatsApp Payment Reminders via Linked WhatsApp / Outbox!`);
    } catch {
      showNotification('Could not dispatch bulk payment reminders');
    } finally {
      setIsSendingBulkReminder(false);
    }
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  const deliveredDateGroups = useMemo(() => {
    if (quickTab !== 'delivered') return [];
    return groupDeliveredOrdersByDate(paginatedOrders);
  }, [quickTab, paginatedOrders]);

  const filterTabs = [
    {
      id: 'today',
      label: 'TODAY ORDERS',
      badge: String(tabCounts.today),
      icon: Calendar,
      iconColor: 'text-purple-300'
    },
    {
      id: 'tomorrow',
      label: 'TOMORROW ORDERS',
      badge: String(tabCounts.tomorrow),
      icon: Calendar,
      iconColor: 'text-indigo-400'
    },
    {
      id: 'future',
      label: 'FUTURE ORDERS',
      badge: String(tabCounts.future),
      icon: Clock,
      iconColor: 'text-sky-400'
    },
    {
      id: 'delivered',
      label: 'DELIVERED HISTORY',
      badge: String(tabCounts.delivered),
      icon: History,
      iconColor: 'text-emerald-400'
    },
    {
      id: 'pending_payment',
      label: 'PENDING PAYMENT',
      badge: `₹${tabCounts.pendingPaymentAmount.toLocaleString('en-IN')}`,
      icon: CreditCard,
      iconColor: 'text-amber-400'
    },
    {
      id: 'cancelled',
      label: 'CANCELLED',
      badge: String(tabCounts.cancelled),
      icon: Ban,
      iconColor: 'text-rose-400'
    },
    {
      id: 'missed',
      label: 'MISSED',
      badge: String(tabCounts.missed),
      icon: AlertTriangle,
      iconColor: 'text-amber-400'
    },
    {
      id: 'on_hold',
      label: 'ON HOLD',
      badge: String(tabCounts.onHold),
      icon: PauseCircle,
      iconColor: 'text-purple-400'
    }
  ];

  return (
    <div className="space-y-5 px-4 sm:px-6 lg:px-8 pt-6 pb-12 max-w-[1600px] mx-auto">
      {/* Top Subheader Row: Title + LIVE Badge on Left, Kanban / List View / Map View Switcher on Right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Bakery Order Management Dashboard
            </h1>
            <span className="px-3 py-0.5 rounded-full bg-[#241242] border border-purple-500/50 text-purple-300 text-xs font-extrabold uppercase tracking-wider">
              LIVE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time outlet orders, delivery assignments, and kitchen pipeline
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {selectedOrderIds && selectedOrderIds.length > 0 && onOpenThermalModal && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenThermalModal}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Selected ({selectedOrderIds.length})</span>
              </button>
              <button
                type="button"
                onClick={clearOrderSelection}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Segmented View Switcher: Kanban | List View | Map View */}
          <div className="inline-flex items-center bg-[#101322] border border-indigo-950/90 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[#8b31ff] text-white shadow-[0_0_15px_rgba(139,49,255,0.5)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Kanban
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#8b31ff] text-white shadow-[0_0_15px_rgba(139,49,255,0.5)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              List View
            </button>

            <button
              type="button"
              onClick={() => setIsFleetMapOpen(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <Map className="w-3.5 h-3.5 text-slate-400" />
              <span>Map View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Pills Container matching Screenshot 2 */}
      <div className="bg-[#0d0f1d]/90 border border-indigo-950/80 p-2.5 rounded-2xl flex items-center gap-2.5 overflow-x-auto">
        {filterTabs.map((tab) => {
          const isActive = quickTab === tab.id;
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setQuickTab(tab.id);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider whitespace-nowrap transition shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#8b31ff] text-white border-2 border-white shadow-[0_0_22px_rgba(139,49,255,0.55)]'
                  : 'bg-[#121528]/90 hover:bg-[#191d36] text-slate-200 border border-indigo-950/90'
              }`}
            >
              <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : tab.iconColor}`} />
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold font-mono ${
                  isActive
                    ? 'bg-purple-900/80 text-white'
                    : 'bg-[#231442] text-purple-300'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Top Alert Banner when Rider marks orders Delivered */}
      {unconfirmedRiderOrders.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-950/95 via-[#0f2922] to-amber-950/90 border-2 border-emerald-400/80 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 shadow-xl shadow-emerald-950/60">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0 animate-bounce">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-emerald-300">
                  🚴 {unconfirmedRiderOrders.length} Order{unconfirmedRiderOrders.length > 1 ? 's' : ''} Marked Delivered by Rider — Awaiting Confirmation
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-extrabold">
                  Verify to Move to History &amp; Send Customer WA
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {unconfirmedRiderOrders.slice(0, 6).map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => confirmRiderDelivery(ord.id)}
                    className="px-2.5 py-1 rounded-lg bg-[#091815] hover:bg-emerald-800 border border-emerald-500/50 text-emerald-200 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                    title="Click to confirm this order delivery"
                  >
                    <span className="font-mono text-white">#{ord.order_number}</span>
                    <span className="text-emerald-300">({ord.delivered_by || ord.delivery_partner || 'Rider'})</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {quickTab !== 'today' && (
              <button
                type="button"
                onClick={() => {
                  setQuickTab('today');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                View in Today Orders
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirmAllRiderDeliveries}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm All ({unconfirmedRiderOrders.length}) &amp; Move to History</span>
            </button>
          </div>
        </div>
      )}

      {/* Action Bar for DELIVERED HISTORY (Date-Wise Export) or PENDING PAYMENT (1-Click Bulk Reminder) */}
      {quickTab === 'delivered' && filteredOrders.length > 0 && (
        <div className="bg-[#0f1626] border border-emerald-500/30 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-emerald-300 font-bold">
            <History className="w-4 h-4 text-emerald-400" />
            <span>
              Sorted by Most Recently Delivered First (Date-Wise Grouping Active • {filteredOrders.length} Total Delivered)
            </span>
          </div>
          <button
            type="button"
            onClick={() => exportOrdersToCSV(filteredOrders, 'Broomies_Delivered_History')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Delivered Excel / CSV ({filteredOrders.length})</span>
          </button>
        </div>
      )}

      {quickTab === 'pending_payment' && filteredOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/60 via-[#151226] to-emerald-950/50 border border-amber-500/40 rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>
                Pending Payment Queue ({filteredOrders.length} Orders • Total Due: ₹{tabCounts.pendingPaymentAmount.toLocaleString('en-IN')})
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Dispatch customized WhatsApp Payment Reminders to all pending balance customers in 1 click.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendBulkPaymentReminders}
            disabled={isSendingBulkReminder}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 shrink-0 disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {isSendingBulkReminder
                ? 'Sending Reminders...'
                : `1-Click Bulk WhatsApp Reminder (${Math.min(25, filteredOrders.length)})`}
            </span>
          </button>
        </div>
      )}

      {/* Orders Display */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-[#0d0f1d]/80 border border-indigo-950/80 rounded-2xl">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-white">
            No Orders in &ldquo;{filterTabs.find((t) => t.id === quickTab)?.label || 'Current View'}&rdquo;
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Switch to &ldquo;DELIVERED HISTORY&rdquo; ({tabCounts.delivered} orders) or another tab above to view orders.
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { title: 'Pending / New', statuses: ['pending', 'on_hold'], color: 'border-purple-500/40 text-purple-300' },
            { title: 'In Kitchen / Ready', statuses: ['processing', 'preparing', 'ready'], color: 'border-sky-500/40 text-sky-300' },
            { title: 'Out for Delivery', statuses: ['out_for_delivery'], color: 'border-amber-500/40 text-amber-300' },
            { title: 'Delivered', statuses: ['delivered'], color: 'border-emerald-500/40 text-emerald-300' }
          ].map((col) => {
            const colOrders = filteredOrders.filter((o) => col.statuses.includes(o.status));
            return (
              <div key={col.title} className="bg-[#0d1021] border border-indigo-950 rounded-2xl p-3 space-y-3">
                <div className={`flex items-center justify-between pb-2 border-b ${col.color} font-extrabold text-xs uppercase tracking-wider`}>
                  <span>{col.title}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white">{colOrders.length}</span>
                </div>
                <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                  {colOrders.slice(0, 25).map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onView={onViewOrder}
                      onEdit={onEditOrder}
                      onWhatsApp={onWhatsAppOrder}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : quickTab === 'delivered' ? (
        <>
          <div className="space-y-6">
            {deliveredDateGroups.map((group) => (
              <div key={group.dateKey} className="space-y-3.5">
                <div className="sticky top-0 z-10 bg-[#101729]/95 backdrop-blur-md border border-emerald-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs sm:text-sm font-black text-white tracking-wide">
                      {group.label}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[11px] font-extrabold font-mono">
                      {group.orders.length} Delivered
                    </span>
                  </div>
                  <div className="text-xs font-extrabold font-mono text-emerald-300">
                    Total: ₹{group.totalRevenue.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {group.orders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onView={onViewOrder}
                      onEdit={onEditOrder}
                      onWhatsApp={onWhatsAppOrder}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-[#0f1224] border border-indigo-950 px-4 py-3 rounded-2xl text-xs">
              <span className="text-slate-400">
                Showing <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong>–
                <strong className="text-white">{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}</strong> of{' '}
                <strong className="text-purple-300">{filteredOrders.length}</strong> orders
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-[#13162b] border border-indigo-900/60 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-white px-2">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-[#13162b] border border-indigo-900/60 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginatedOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onView={onViewOrder}
                onEdit={onEditOrder}
                onWhatsApp={onWhatsAppOrder}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-[#0f1224] border border-indigo-950 px-4 py-3 rounded-2xl text-xs">
              <span className="text-slate-400">
                Showing <strong className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</strong>–
                <strong className="text-white">{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)}</strong> of{' '}
                <strong className="text-purple-300">{filteredOrders.length}</strong> orders
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-[#13162b] border border-indigo-900/60 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-white px-2">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-[#13162b] border border-indigo-900/60 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Fleet Map & Set Outlet Modals */}
      <RiderLocationMapModal
        isOpen={isFleetMapOpen}
        onClose={() => setIsFleetMapOpen(false)}
        partners={partners || []}
      />

      <SetOutletLocationModal
        isOpen={isSetOutletOpen}
        onClose={() => setIsSetOutletOpen(false)}
      />
    </div>
  );
};

export default AdminDashboard;
