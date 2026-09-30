import React, { useState, useMemo } from 'react';
import { useOMS } from '../lib/store';
import { Order } from '../types';
import { OrderCard } from '../components/OrderCard';
import { Truck, PackageCheck, Clock } from 'lucide-react';

interface DeliveryDashboardProps {
  onViewOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
}

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({
  onViewOrder,
  onEditOrder
}) => {
  const { orders } = useOMS();
  const [filterType, setFilterType] = useState<'all' | 'delivery' | 'pickup'>('all');

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (filterType === 'delivery') return o.delivery_type === 'delivery';
      if (filterType === 'pickup') return o.delivery_type === 'pickup';
      return true;
    });
  }, [orders, filterType]);

  const deliveryStats = useMemo(() => {
    const list = orders || [];
    const totalDelivery = list.filter((o) => o.delivery_type === 'delivery').length;
    const totalPickup = list.filter((o) => o.delivery_type === 'pickup').length;
    const outForDelivery = list.filter((o) => o.status === 'out_for_delivery').length;
    const delivered = list.filter((o) => o.status === 'delivered').length;
    return { totalDelivery, totalPickup, outForDelivery, delivered };
  }, [orders]);

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-semibold block">Home Delivery</span>
          <span className="text-xl sm:text-2xl font-black text-white font-mono">{deliveryStats.totalDelivery}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-purple-400 font-semibold block">Store Pickup</span>
          <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono">{deliveryStats.totalPickup}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-amber-400 font-semibold block">Out for Delivery</span>
          <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">{deliveryStats.outForDelivery}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-semibold block">Delivered Orders</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">{deliveryStats.delivered}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: 'All Orders' },
          { id: 'delivery', label: 'Doorstep Delivery' },
          { id: 'pickup', label: 'Store Pickups' }
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilterType(id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterType === id
                ? 'bg-purple-600 text-white shadow'
                : 'bg-[#0f1224] text-slate-400 hover:text-white border border-indigo-950'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1224] border border-indigo-950 rounded-2xl">
          <Truck className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-white">No Delivery Orders Found</h3>
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
