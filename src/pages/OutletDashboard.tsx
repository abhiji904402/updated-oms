import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { Order, OutletName } from '../types';
import { OrderCard } from '../components/OrderCard';
import { Store, Plus, Search, Printer, MapPin, CheckCircle2, Clock, BellRing, Download, Calendar } from 'lucide-react';
import { matchesOutlet } from '../lib/outletUtils';
import {
  getTodayDateStr,
  sortOrdersByDeliveryPriority,
  sortDeliveredOrdersRecentFirst,
  isOrderFinalDelivered,
  groupDeliveredOrdersByDate,
  exportOrdersToCSV
} from '../lib/timeUtils';
import { SetOutletLocationModal } from '../components/SetOutletLocationModal';

interface OutletDashboardProps {
  onViewOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onWhatsAppOrder?: (order: Order) => void;
  onOpenAddModal?: () => void;
  onOpenThermalModal?: () => void;
}

const OUTLETS: OutletName[] = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

export const OutletDashboard: React.FC<OutletDashboardProps> = ({
  onViewOrder,
  onEditOrder,
  onWhatsAppOrder,
  onOpenAddModal,
  onOpenThermalModal
}) => {
  const { orders, session, searchQuery, confirmRiderDelivery } = useOMS();
  const isOutletLocked = session?.role === 'outlet' && Boolean(session?.outlet);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletName>(session?.outlet || 'Sector 31');
  const [statusTab, setStatusTab] = useState<'all' | 'today' | 'active' | 'delivered'>('today');
  const [localSearch, setLocalSearch] = useState('');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const activeOutlet = isOutletLocked ? (session.outlet as OutletName) : selectedOutlet;
  const todayStr = getTodayDateStr();

  const unconfirmedBranchDeliveries = useMemo(() => {
    return (orders || []).filter(
      (o) =>
        matchesOutlet(o.outlet, activeOutlet) &&
        o.status === 'delivered' &&
        Boolean(o.delivery_confirmation_pending) &&
        String(o.delivery_type || '').toLowerCase().trim() !== 'pickup'
    );
  }, [orders, activeOutlet]);

  const outletOrders = useMemo(() => {
    const filtered = (orders || []).filter((o) => {
      if (!matchesOutlet(o.outlet, activeOutlet)) return false;

      if (statusTab === 'today') {
        const isToday = o.delivery_date === todayStr || (!o.delivery_date && o.order_date === todayStr);
        if (!isToday || isOrderFinalDelivered(o) || o.status === 'cancelled') return false;
      }
      if (statusTab === 'active' && (isOrderFinalDelivered(o) || o.status === 'cancelled')) return false;
      if (statusTab === 'delivered' && !isOrderFinalDelivered(o)) return false;

      const q = (localSearch || searchQuery || '').trim().toLowerCase();
      if (q) {
        const matchNum = String(o.order_number).includes(q);
        const matchCust = (o.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (o.mobile_number || '').includes(q);
        const matchItem = (o.item_type || '').toLowerCase().includes(q);
        const matchCake = (o.name_on_cake || '').toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchPhone && !matchItem && !matchCake) return false;
      }
      return true;
    });

    if (statusTab === 'delivered') {
      return sortDeliveredOrdersRecentFirst(filtered);
    }

    return sortOrdersByDeliveryPriority(filtered);
  }, [orders, activeOutlet, statusTab, localSearch, searchQuery, todayStr]);

  const stats = useMemo(() => {
    const allForBranch = (orders || []).filter((o) => matchesOutlet(o.outlet, activeOutlet));
    const activeCount = allForBranch.filter((o) => !isOrderFinalDelivered(o) && o.status !== 'cancelled').length;
    const deliveredCount = allForBranch.filter((o) => isOrderFinalDelivered(o)).length;
    const branchRevenue = allForBranch.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    return { total: allForBranch.length, activeCount, deliveredCount, branchRevenue };
  }, [orders, activeOutlet]);

  return (
    <div className="space-y-5 px-4 sm:px-6 pt-4 pb-12">
      {/* Outlet Selector Header */}
      <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {OUTLETS.map((name) => {
            if (isOutletLocked && !matchesOutlet(name, activeOutlet)) return null;
            const count = (orders || []).filter((o) => matchesOutlet(o.outlet, name)).length;
            const isSelected = matchesOutlet(activeOutlet, name);
            return (
              <button
                key={name}
                onClick={() => setSelectedOutlet(name)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/40 border border-purple-400/40'
                    : 'bg-[#13172e] text-slate-400 hover:text-white border border-indigo-950'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>{name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/30 text-white">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#13172e] hover:bg-indigo-950 text-indigo-300 border border-indigo-900/60 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-purple-400" />
            <span>Branch GPS</span>
          </button>

          {onOpenThermalModal && (
            <button
              onClick={onOpenThermalModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/60 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Batch Thermal Print</span>
            </button>
          )}

          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Order for {activeOutlet}</span>
            </button>
          )}
        </div>
      </div>

      {/* Branch KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-semibold uppercase">Branch Total Orders</span>
          <div className="text-2xl font-black text-white font-mono mt-1">{stats.total}</div>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl">
          <span className="text-[11px] text-amber-400 font-semibold uppercase flex items-center gap-1">
            <Clock className="w-3 h-3" /> In Kitchen / Active
          </span>
          <div className="text-2xl font-black text-amber-300 font-mono mt-1">{stats.activeCount}</div>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-semibold uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Completed / Delivered
          </span>
          <div className="text-2xl font-black text-emerald-300 font-mono mt-1">{stats.deliveredCount}</div>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-4 rounded-2xl">
          <span className="text-[11px] text-purple-400 font-semibold uppercase">Branch Revenue</span>
          <div className="text-2xl font-black text-purple-300 font-mono mt-1">₹{stats.branchRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Top Alert Banner when Rider marks branch orders Delivered */}
      {unconfirmedBranchDeliveries.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-950/95 via-[#0f2922] to-amber-950/90 border-2 border-emerald-400/80 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0 animate-bounce">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black uppercase tracking-wide text-emerald-300">
                🚴 {unconfirmedBranchDeliveries.length} {activeOutlet} Order{unconfirmedBranchDeliveries.length > 1 ? 's' : ''} Marked Delivered by Rider — Please Confirm
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {unconfirmedBranchDeliveries.map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => confirmRiderDelivery(ord.id)}
                    className="px-2.5 py-1 rounded-lg bg-[#091815] hover:bg-emerald-800 border border-emerald-500/50 text-emerald-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="font-mono text-white">#{ord.order_number}</span>
                    <span>({ord.delivered_by || ord.delivery_partner || 'Rider'})</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => unconfirmedBranchDeliveries.forEach((o) => confirmRiderDelivery(o.id))}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>Confirm All ({unconfirmedBranchDeliveries.length})</span>
          </button>
        </div>
      )}

      {/* Filter Tabs + Local Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Branch Orders' },
            { id: 'today', label: 'Today Schedule' },
            { id: 'active', label: 'Pending / Kitchen' },
            { id: 'delivered', label: 'Delivered History' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setStatusTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                statusTab === t.id
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-[#13172e] text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {statusTab === 'delivered' && outletOrders.length > 0 && (
            <button
              type="button"
              onClick={() => exportOrdersToCSV(outletOrders, `Broomies_${activeOutlet.replace(/\s+/g, '_')}_Delivered`)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={`Search in ${activeOutlet}...`}
              className="w-full bg-[#13172e] border border-indigo-950 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      {outletOrders.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1224] border border-indigo-950 rounded-2xl">
          <Store className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-white">No Orders Found for {activeOutlet}</h3>
          <p className="text-xs text-slate-400 mt-1">Switch filter tabs or create a new order for this outlet.</p>
        </div>
      ) : statusTab === 'delivered' ? (
        <div className="space-y-6">
          {groupDeliveredOrdersByDate(outletOrders).map((group) => (
            <div key={group.dateKey} className="space-y-3">
              <div className="bg-[#101729]/95 border border-emerald-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs sm:text-sm font-black text-white">{group.label}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold font-mono">
                    {group.orders.length} Delivered
                  </span>
                </div>
                <span className="text-xs font-extrabold font-mono text-emerald-300">
                  Total: ₹{group.totalRevenue.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {outletOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onView={onViewOrder}
              onEdit={onEditOrder}
              onWhatsApp={onWhatsAppOrder}
            />
          ))}
        </div>
      )}

      <SetOutletLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        defaultOutletId={activeOutlet}
      />
    </div>
  );
};

export default OutletDashboard;
