import React from 'react';
import { useOMS } from '../lib/store';
import { Bell, AlertTriangle, CheckCircle2, Clock, Info, ShieldAlert } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const { alerts = [], orders = [] } = useOMS();

  const safeOrders = orders || [];
  const safeAlerts = alerts || [];

  // Find missed or delayed orders automatically
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const delayedOrders = safeOrders.filter((o) => {
    if (o.status === 'delivered' || o.status === 'cancelled') return false;
    const isPastDate = o.delivery_date < todayStr;
    return isPastDate;
  });

  const duePaymentOrders = safeOrders.filter((o) => o.remaining_balance > 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0e111d] p-5 rounded-2xl border border-indigo-950">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Operational Alerts & System Notifications
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live alerts on delayed deliveries, pending payments, and high volume warnings
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0e111d] border border-indigo-950 p-4 rounded-xl flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-400">{delayedOrders.length}</div>
            <div className="text-xs text-slate-400 font-medium">Overdue / Delayed Orders</div>
          </div>
        </div>

        <div className="bg-[#0e111d] border border-indigo-950 p-4 rounded-xl flex items-center gap-3">
          <div className="p-3 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400">{duePaymentOrders.length}</div>
            <div className="text-xs text-slate-400 font-medium">Uncollected Payment Alerts</div>
          </div>
        </div>

        <div className="bg-[#0e111d] border border-indigo-950 p-4 rounded-xl flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-purple-400">{alerts.length}</div>
            <div className="text-xs text-slate-400 font-medium">System Notifications</div>
          </div>
        </div>
      </div>

      {/* Active Alerts List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Bell className="w-5 h-5 text-purple-400" />
          Recent Alert Log
        </h2>

        {/* Delayed Orders Warnings */}
        {delayedOrders.map((o) => (
          <div
            key={`delayed-${o.id}`}
            className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-amber-300 text-sm">
                  Order #{o.order_number} ({o.item_type}) Overdue!
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Expected on {o.delivery_date} at {o.delivery_time_expected} • Outlet: {o.outlet} • Customer: {o.customer_name}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              Delayed
            </span>
          </div>
        ))}

        {/* Regular Alerts */}
        {safeAlerts.map((alt) => (
          <div
            key={alt.id}
            className="p-4 bg-[#0e111d] border border-indigo-950 rounded-xl flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-200 text-sm">{alt.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{alt.message}</div>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {alt.outlet ? `[${alt.outlet}]` : ''}
            </span>
          </div>
        ))}

        {delayedOrders.length === 0 && safeAlerts.length === 0 && (
          <div className="p-12 text-center bg-[#0e111d] border border-indigo-950 rounded-2xl text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <div className="font-bold text-slate-200">No Pending System Alerts</div>
            <div className="text-xs text-slate-500 mt-1">All orders are running on scheduled timeline.</div>
          </div>
        )}
      </div>
    </div>
  );
};
