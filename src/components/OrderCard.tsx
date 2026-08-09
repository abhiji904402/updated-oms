import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { useOMS } from '../lib/store';
import { printThermalReceipts } from '../lib/thermalPrint';
import { getDeliveryTimeInfo, getCountdownInfo, formatTo12Hour } from '../lib/timeUtils';
import {
  Clock,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  Truck,
  CheckCircle,
  AlertCircle,
  Printer,
  MessageCircle,
  Camera,
  Key,
  DollarSign,
  ChevronRight,
  Eye,
  Trash2,
  Edit3,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

interface OrderCardProps {
  order: Order;
  compact?: boolean;
  onOpenDeliveryModal?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onViewOrder?: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, compact = false, onOpenDeliveryModal, onEditOrder, onViewOrder }) => {
  const {
    session,
    updateOrderStatus,
    deleteOrder,
    confirmRiderDelivery,
    partners,
    selectedOrderIds,
    toggleOrderSelection
  } = useOMS();

  const [showImageModal, setShowImageModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());

  // Live ticker for countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 10000); // refresh every 10 sec
    return () => clearInterval(timer);
  }, []);

  const isSelected = selectedOrderIds.includes(order.id);
  const timeInfo = getDeliveryTimeInfo(order);
  const countdown = getCountdownInfo(order, nowTime);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'processing':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'out_for_delivery':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'delivered':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'on_hold':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'cancelled':
        return 'bg-slate-700/50 text-slate-400 border-slate-600/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getPaymentBadge = () => {
    const total = order.total_amount ?? 0;
    const advance = order.advance_amount ?? 0;
    const remaining = order.remaining_balance ?? 0;
    switch (order.payment_type) {
      case 'full':
        return <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/30">PAID FULL (₹{total.toLocaleString()})</span>;
      case 'part':
        return <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/30">PARTIAL (Paid: ₹{advance.toLocaleString()} | Due: ₹{remaining.toLocaleString()})</span>;
      case 'due':
      case 'cash':
      case 'upi':
      case 'online':
      default:
        if (remaining > 0) {
          return <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-500/30">PAY ON DELIVERY (₹{remaining.toLocaleString()})</span>;
        }
        return <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/30">PAID FULL (₹{total.toLocaleString()})</span>;
    }
  };

  const formattedWhatsAppUrl = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const totalVal = order.total_amount ?? 0;
  const advanceVal = order.advance_amount ?? 0;
  const remainingVal = order.remaining_balance ?? 0;

  // WhatsApp Templates
  const itemDetails = `${order.item_type}${order.quantity ? ` (${order.quantity})` : ''}`;
  const delDate = order.delivery_date || 'Today';
  const delTime = order.delivery_time_expected || '11:00 am';

  const confirmMsg = `Thank you so much for your recent order from Broomies! Your order number is (${order.order_number}).

We're thrilled to have the opportunity to serve you and hope you enjoy every delicious bite.

Order Details:
Item: ${itemDetails}
Delivery Date: ${delDate}
Delivery Time: ${delTime}

If you have any queries or need further assistance, please feel free to get in touch with us at:
9266424088

If still query not solved call 9971860845

Best wishes,
The Broomies Team`;

  const dispatchMsg = `Hi ${order.customer_name},

Your order #${order.order_number} is out for delivery with rider ${order.delivery_partner || 'Broomies Express'}.

OTP for verification: ${order.otp || 'N/A'}

Thank you!
Broomies Team`;

  const reminderMsg = `Hi ${order.customer_name},

Friendly reminder for your Broomies Bakery order #${order.order_number}.

Remaining due amount: ₹${remainingVal.toLocaleString()}

Please pay via UPI/Cash on delivery.

Thank you!
Broomies Team`;

  return (
    <>
      <div
        onClick={() => {
          if (onViewOrder) {
            onViewOrder(order);
          } else if (onEditOrder) {
            onEditOrder(order);
          }
        }}
        className={`group relative rounded-2xl bg-slate-900/80 border transition-all duration-200 backdrop-blur-md overflow-hidden cursor-pointer ${
          isSelected ? 'border-rose-500/80 ring-2 ring-rose-500/20 bg-slate-900' : 'border-slate-800/90 hover:border-purple-500/50 hover:shadow-lg'
        }`}
      >
        {/* Top Header Row */}
        <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {/* Batch Select Checkbox */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleOrderSelection(order.id)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500/40 cursor-pointer"
            />
            
            <span className="text-base font-extrabold text-slate-100 tracking-tight">
              #{order.order_number}
            </span>

            {/* Status Change Dropdown Selector */}
            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
              <select
                value={order.status}
                onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 transition appearance-none pr-5 ${getStatusColor(order.status)}`}
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23CBD5E1%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center', backgroundSize: '8px auto' }}
              >
                <option value="pending" className="bg-slate-900 text-rose-300">Pending</option>
                <option value="processing" className="bg-slate-900 text-amber-300">Processing</option>
                <option value="out_for_delivery" className="bg-slate-900 text-blue-300">Out for Delivery</option>
                <option value="delivered" className="bg-slate-900 text-emerald-300">Delivered</option>
                <option value="on_hold" className="bg-slate-900 text-purple-300">On Hold</option>
                <option value="cancelled" className="bg-slate-900 text-slate-400">Cancelled</option>
                <option value="missed" className="bg-slate-900 text-red-400">Missed</option>
              </select>
            </div>

            {/* Countdown Badge */}
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black tracking-wide ${countdown.badgeColorClass}`}>
              {countdown.text}
            </span>
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* View Details Button */}
            <button
              onClick={() => {
                if (onViewOrder) onViewOrder(order);
                else if (onEditOrder) onEditOrder(order);
              }}
              title="View Full Order Details"
              className="p-1.5 rounded-lg bg-indigo-950/60 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-800/50 transition flex items-center gap-1 text-[11px] font-bold"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View</span>
            </button>

            {/* Edit Order Button */}
            {onEditOrder && (
              <button
                onClick={() => onEditOrder(order)}
                title="Edit Order Data"
                className="p-1.5 rounded-lg bg-purple-950/60 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-800/50 transition flex items-center gap-1 text-[11px] font-bold"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            {/* Thermal Print Button */}
            <button
              onClick={() => printThermalReceipts([order])}
              title="Print Thermal Receipt"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            {/* Admin Delete */}
            {session.role === 'admin' && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-rose-950 hover:text-rose-400 transition"
                title="Delete Order"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="p-3 bg-rose-950/90 border-b border-rose-800/60 flex items-center justify-between text-xs text-rose-200 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <span className="font-bold">Delete Order #{order.order_number}?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  deleteOrder(order.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-2.5 py-1 rounded bg-rose-600 text-white font-extrabold hover:bg-rose-500"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rider Delivery Confirmation Banner */}
        {order.rider_delivered && order.delivery_confirmation_pending && (
          <div className="p-3 bg-emerald-950 border-b border-emerald-500/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shadow-inner" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-emerald-300 font-extrabold">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Delivered by {order.delivered_by || order.delivery_partner || 'Delivery Partner'} (Pending Confirmation)</span>
            </div>
            <button
              onClick={() => confirmRiderDelivery(order.id)}
              className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black tracking-wider uppercase shadow-lg transition active:scale-95"
            >
              CONFIRM DELIVERY
            </button>
          </div>
        )}

        {/* Card Body */}
        <div className="p-4 space-y-3">
          {/* Item & Image Thumbnail */}
          <div className="flex items-start gap-3">
            {order.item_image_url ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImageModal(true);
                }}
                className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 flex-shrink-0 cursor-pointer group/img"
              >
                <img
                  src={order.item_image_url}
                  alt={order.item_type}
                  className="w-full h-full object-cover group-hover/img:scale-110 transition duration-300"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                  <Eye className="w-4 h-4 text-white" />
                </div>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center flex-shrink-0 text-slate-600">
                <ShoppingBag className="w-6 h-6" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-100 truncate leading-snug">
                {order.item_type}
              </h3>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Qty: <strong className="text-slate-200">{order.quantity}</strong></span>
                <span>•</span>
                <span className="text-rose-400 font-bold">₹{(order.total_amount ?? 0).toLocaleString()}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{formatTo12Hour(order.order_time) || formatTo12Hour(order.order_date)}</span>
                <span>({order.outlet})</span>
              </div>
            </div>
          </div>

          {/* Delivery & Delay Time Banner */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <Clock className="w-3 h-3 text-indigo-400" />
                Exp: <strong className="text-slate-200 font-mono">{timeInfo.expectedFormatted}</strong>
              </span>

              <span className="text-slate-400 flex items-center gap-1 font-medium">
                Act: <strong className={`font-mono ${order.status === 'delivered' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {timeInfo.actualFormatted}
                </strong>
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
              <span className="text-slate-400">Total Delay:</span>
              <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                timeInfo.delayMinutes > 0
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
              }`}>
                {timeInfo.delayMinutes > 0 ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" /> {timeInfo.delayText}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> On Time
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Customer & Address Details */}
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold truncate">
                <User className="w-3.5 h-3.5 text-rose-400" />
                <span>{order.customer_name}</span>
              </div>
              <a
                href={formattedWhatsAppUrl(order.mobile_number, `Hi ${order.customer_name}, regarding your Broomies Bakery order #${order.order_number}...`)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50"
              >
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </a>
            </div>

            <div className="text-slate-400 flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-500" />
              <span>{order.mobile_number}</span>
            </div>

            {order.informed_by && (
              <div className="text-[11px] text-purple-300 font-medium bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40 w-fit">
                Informed By (Staff): <strong className="text-purple-200">{order.informed_by}</strong>
              </div>
            )}

            {order.delivery_type === 'delivery' && (
              <div className="text-slate-400 flex items-start gap-1.5 pt-1 border-t border-slate-800/60">
                <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{order.address || 'No address provided'}</span>
              </div>
            )}

            {order.remarks && (
              <div className="text-[11px] italic text-amber-300/90 bg-amber-950/30 p-1.5 rounded border border-amber-900/30 mt-1">
                "{order.remarks}"
              </div>
            )}

            {/* WhatsApp Quick Actions */}
            <div className="pt-1.5 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-[10px]">
              <span className="text-slate-500 font-semibold flex items-center gap-1">
                <MessageCircle className="w-3 h-3 text-emerald-400" /> WA:
              </span>
              <a
                href={formattedWhatsAppUrl(order.mobile_number, confirmMsg)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/50 font-medium whitespace-nowrap"
              >
                Confirm
              </a>
              <a
                href={formattedWhatsAppUrl(order.mobile_number, dispatchMsg)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded border border-blue-800/50 font-medium whitespace-nowrap"
              >
                Dispatch
              </a>
              {order.remaining_balance > 0 && (
                <a
                  href={formattedWhatsAppUrl(order.mobile_number, reminderMsg)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded border border-amber-800/50 font-medium whitespace-nowrap"
                >
                  Payment Due
                </a>
              )}
            </div>

            {/* Payment Audit Log Info */}
            {order.payment_changed_by && (
              <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/40">
                <span>Payment Logged By: <strong className="text-slate-400">{order.payment_changed_by}</strong></span>
                <span>{order.payment_changed_at ? formatTo12Hour(order.payment_changed_at) : ''}</span>
              </div>
            )}

          </div>

          {/* Payment & OTP Row */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-2">
              {getPaymentBadge()}
            </div>

            {order.otp && (
              <div className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700">
                <Key className="w-3 h-3 text-amber-400" />
                <span>OTP: <strong>{order.otp}</strong></span>
              </div>
            )}
          </div>

          {/* Bill Numbers (Advance Bill # & Final Bill #) */}
          {(order.advance_bill_number || order.final_bill_number) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono">
              {order.advance_bill_number && (
                <span className="bg-amber-950/70 border border-amber-800/60 text-amber-300 px-2 py-0.5 rounded-md">
                  Adv Bill #: <strong className="text-amber-200">{order.advance_bill_number}</strong>
                </span>
              )}
              {order.final_bill_number && (
                <span className="bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 px-2 py-0.5 rounded-md">
                  Final Bill #: <strong className="text-emerald-200">{order.final_bill_number}</strong>
                </span>
              )}
            </div>
          )}

          {/* Delivery Partner Assignment */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Truck className="w-3.5 h-3.5 text-slate-500" />
              <span>Partner:</span>
            </div>

            {session.role === 'admin' || session.role === 'outlet' ? (
              <select
                value={order.delivery_partner || ''}
                onChange={(e) => updateOrderStatus(order.id, order.status, e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:border-rose-500"
              >
                <option value="">-- Unassigned --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-semibold text-slate-200">{order.delivery_partner || 'Unassigned'}</span>
            )}
          </div>

          {/* Proof of Delivery Image if delivered */}
          {order.delivery_photo_url && (
            <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-800/30 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Camera className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="text-[11px] text-emerald-300 truncate">
                Proof of Delivery Attached
              </div>
              <button
                onClick={() => setShowImageModal(true)}
                className="text-[10px] underline text-emerald-400 font-bold ml-auto"
              >
                View
              </button>
            </div>
          )}



        </div>
      </div>

      {/* Image Preview Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-100 text-sm">
                Image Preview - Order #{order.order_number}
              </h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            {order.delivery_photo_url && (
              <div>
                <div className="text-xs text-emerald-400 font-semibold mb-1">Delivery Confirmation Photo:</div>
                <img
                  src={order.delivery_photo_url}
                  alt="Delivery Proof"
                  className="w-full h-64 object-cover rounded-xl border border-slate-700"
                />
              </div>
            )}
            {order.item_image_url && (
              <div>
                <div className="text-xs text-rose-400 font-semibold mb-1">Bakery Item Image:</div>
                <img
                  src={order.item_image_url}
                  alt={order.item_type}
                  className="w-full h-64 object-cover rounded-xl border border-slate-700"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
