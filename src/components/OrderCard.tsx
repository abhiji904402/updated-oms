import React from 'react';
import { Order, OrderStatus } from '../types';
import { Cake, Phone, MapPin, Calendar, Clock, Eye, Edit2, CheckCircle2, Palette, Layers, Sparkle } from 'lucide-react';
import { useOMS } from '../lib/store';

interface OrderCardProps {
  order: Order;
  onView: (order: Order) => void;
  onEdit: (order: Order) => void;
}

export const AutoConfirmTimer: React.FC<{ actualDeliveryTime?: string | null }> = ({ actualDeliveryTime }) => {
  return <span className="text-xs text-slate-500">{actualDeliveryTime ? 'Delivered' : 'Pending'}</span>;
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, onView, onEdit }) => {
  const { updateOrder, showNotification } = useOMS();

  const handleMarkDelivered = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateOrder(order.id, {
      status: 'delivered',
      rider_delivered: true,
      actual_delivery_time: new Date().toISOString()
    });
    showNotification(`Order #${order.order_number} marked as Delivered!`);
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
      case 'out_for_delivery':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
      case 'ready':
        return 'bg-blue-950/80 text-blue-300 border-blue-700/60';
      case 'preparing':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60';
      default:
        return 'bg-purple-950/80 text-purple-300 border-purple-700/60';
    }
  };

  return (
    <div
      onClick={() => onView(order)}
      className="bg-[#0f1224] border border-indigo-950/70 hover:border-purple-500/50 rounded-2xl p-4 transition shadow-lg cursor-pointer flex flex-col justify-between group"
    >
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-800/60 font-mono text-purple-300 font-bold text-xs">
              #{order.order_number}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-800">
              {order.outlet}
            </span>
          </div>
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${getStatusBadge(order.status)}`}>
            {order.status}
          </span>
        </div>

        {/* Customer & Phone */}
        <div className="mb-2.5">
          <div className="font-bold text-white text-sm truncate">{order.customer_name}</div>
          <div className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3 text-slate-500" />
            <span>{order.mobile_number}</span>
          </div>
        </div>

        {/* Item & Cake Info */}
        <div className="p-2.5 bg-[#14182f] rounded-xl border border-indigo-900/40 space-y-1.5 mb-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5 truncate">
              <Cake className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span className="truncate">{order.item_type}</span>
            </span>
            <span className="text-[11px] text-purple-300 font-mono shrink-0">
              {order.quantity}
            </span>
          </div>

          {order.name_on_cake && (
            <div className="text-[11px] text-pink-300 truncate bg-pink-950/40 px-2 py-0.5 rounded border border-pink-900/40">
              ✍️ "{order.name_on_cake}"
            </div>
          )}

          {/* 3 New Fields badges on Card */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[10px]">
            {order.icing_color && (
              <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Palette className="w-2.5 h-2.5" />
                {order.icing_color}
              </span>
            )}
            <span className="bg-purple-950/80 text-purple-300 border border-purple-800/50 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Sparkle className="w-2.5 h-2.5" />
              {order.cake_style || 'Normal'}
            </span>
            {order.tiers && order.tiers !== '1' && (
              <span className="bg-amber-950/80 text-amber-300 border border-amber-800/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" />
                {order.tiers} Tiers
              </span>
            )}
          </div>
        </div>

        {/* Date & Time */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-purple-400" />
            {order.delivery_date}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-purple-400" />
            {order.delivery_time_expected}
          </span>
        </div>
      </div>

      {/* Footer Payment & Action Buttons */}
      <div className="pt-2 border-t border-indigo-950/80 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-500 block">Total</span>
          <span className="text-sm font-bold text-white font-mono">₹{order.total_amount}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView(order);
            }}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 rounded-lg transition"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(order);
            }}
            className="p-1.5 text-slate-400 hover:text-purple-300 bg-slate-900/60 hover:bg-slate-800 rounded-lg transition"
            title="Edit Order"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {order.status !== 'delivered' && (
            <button
              type="button"
              onClick={handleMarkDelivered}
              className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/50 rounded-lg transition"
              title="Mark Delivered"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
