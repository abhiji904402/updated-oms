import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { Order, OutletName } from '../types';
import { OrderCard } from '../components/OrderCard';
import { Store, Plus } from 'lucide-react';

interface OutletDashboardProps {
  onViewOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onOpenAddModal: () => void;
}

const OUTLETS: OutletName[] = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

export const OutletDashboard: React.FC<OutletDashboardProps> = ({
  onViewOrder,
  onEditOrder,
  onOpenAddModal
}) => {
  const { orders } = useOMS();
  const [selectedOutlet, setSelectedOutlet] = useState<OutletName>('Sector 31');

  const outletOrders = useMemo(() => {
    return (orders || []).filter((o) => o.outlet === selectedOutlet);
  }, [orders, selectedOutlet]);

  return (
    <div className="space-y-5">
      {/* Outlet Selector Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {OUTLETS.map((name) => {
            const count = (orders || []).filter((o) => o.outlet === name).length;
            return (
              <button
                key={name}
                onClick={() => setSelectedOutlet(name)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedOutlet === name
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                    : 'bg-[#0f1224] text-slate-400 hover:text-white border border-indigo-950'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>{name}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/30 text-white/90">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Order for {selectedOutlet}</span>
        </button>
      </div>

      {/* Orders Grid */}
      {outletOrders.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1224] border border-indigo-950 rounded-2xl">
          <Store className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-white">No Orders for {selectedOutlet}</h3>
          <p className="text-xs text-slate-400 mt-1">Tap "+ New Order" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {outletOrders.map((o) => (
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
