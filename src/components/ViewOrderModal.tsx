import React from 'react';
import { Order, OrderStatus } from '../types';
import { useOMS } from '../lib/store';
import {
  X,
  Edit3,
  Printer,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  ShoppingBag,
  IndianRupee,
  Truck,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { getDeliveryTimeInfo, formatTo12Hour } from '../lib/timeUtils';

interface ViewOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onPrintThermal?: (order: Order) => void;
}

export const ViewOrderModal: React.FC<ViewOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onEdit,
  onPrintThermal
}) => {
  const { updateOrderStatus } = useOMS();
  if (!isOpen || !order) return null;

  const timeInfo = getDeliveryTimeInfo(order);

  const formattedWhatsAppUrl = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const totalVal = order.total_amount ?? 0;
  const pType = String(order.payment_type || '').toLowerCase().trim();
  const isPaidFull = pType === 'full' || pType === 'full_paid' || pType === 'paid' || pType === 'cash' || pType === 'upi' || pType === 'online';

  const advanceVal = isPaidFull ? totalVal : (pType === 'due' ? 0 : (order.advance_amount ?? 0));
  const remainingVal = isPaidFull ? 0 : (pType === 'due' ? totalVal : (order.remaining_balance ?? Math.max(0, totalVal - advanceVal)));

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

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#0e111d] border border-indigo-900/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 my-auto text-slate-100">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#12162a] border-b border-indigo-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-extrabold text-base">
              #{order.order_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Order #{order.order_number} Details
                </h2>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/50">
                  {order.outlet}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Created: {new Date(order.created_at).toLocaleDateString()} {formatTo12Hour(order.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(order);
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 flex items-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Order
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Delivery & Delay Analytics Banner */}
          <div className="p-4 rounded-2xl bg-[#090b16] border border-indigo-950 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              Delivery Time & Delay Tracker
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#12162a] border border-slate-800/80 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Expected Delivery Time</span>
                <div className="text-sm font-extrabold text-slate-100 font-mono flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  {timeInfo.expectedFormatted}
                </div>
                <div className="text-[10px] text-slate-400">Date: {order.delivery_date || order.order_date}</div>
              </div>

              <div className="p-3 rounded-xl bg-[#12162a] border border-slate-800/80 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Actual Delivery Time</span>
                <div className={`text-sm font-extrabold font-mono flex items-center gap-1 ${
                  order.status === 'delivered' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {timeInfo.actualFormatted}
                </div>
                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Status:</span>
                  <select
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                    className="bg-slate-900 border border-purple-500/50 text-purple-200 font-extrabold uppercase text-[10px] rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
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
              </div>

              <div className={`p-3 rounded-xl border space-y-1 ${
                timeInfo.delayMinutes > 0
                  ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                  : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
              }`}>
                <span className="text-[10px] uppercase font-bold opacity-80">Total Delay Time</span>
                <div className="text-sm font-extrabold font-mono flex items-center gap-1">
                  {timeInfo.delayMinutes > 0 ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                      <span>{timeInfo.delayText}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>On Time (0 min)</span>
                    </>
                  )}
                </div>
                <div className="text-[10px] opacity-80">
                  {timeInfo.delayMinutes > 0 ? `${timeInfo.delayMinutes} mins delay` : 'Delivered on schedule'}
                </div>
              </div>
            </div>
          </div>

          {/* Item & Pricing Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Item Details */}
            <div className="p-4 rounded-2xl bg-[#090b16] border border-indigo-950 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-indigo-400" />
                Item & Order Info
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Item Name / Description</span>
                  <p className="text-sm font-extrabold text-white mt-0.5">{order.item_type}</p>
                </div>

                <div className="flex justify-between py-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Quantity / Weight:</span>
                  <strong className="text-white font-mono">{order.quantity}</strong>
                </div>

                <div className="flex justify-between py-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Delivery Type:</span>
                  <strong className="text-purple-300 uppercase font-bold">{order.delivery_type}</strong>
                </div>

                {order.informed_by && (
                  <div className="flex justify-between py-1 border-t border-slate-800/60">
                    <span className="text-purple-400 font-semibold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" /> Informed By (Staff):
                    </span>
                    <strong className="text-purple-200">{order.informed_by}</strong>
                  </div>
                )}

                {order.remarks && (
                  <div className="pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400 text-[10px] uppercase block">Special Instructions / Remarks:</span>
                    <p className="text-slate-300 bg-slate-900/80 p-2 rounded-lg mt-1 italic text-[11px]">
                      "{order.remarks}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Info */}
            <div className="p-4 rounded-2xl bg-[#090b16] border border-indigo-950 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                Payment Breakup
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Total Amount:</span>
                  <strong className="text-white font-mono text-sm">₹{totalVal.toLocaleString()}</strong>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Advance Paid:</span>
                  <strong className="text-emerald-400 font-mono">₹{advanceVal.toLocaleString()}</strong>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Remaining Balance:</span>
                  <strong className={`font-mono ${remainingVal > 0 ? 'text-rose-400 font-extrabold' : 'text-emerald-400'}`}>
                    ₹{remainingVal.toLocaleString()}
                  </strong>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span className="uppercase font-bold text-indigo-300 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/50">
                    {order.payment_type}
                  </span>
                </div>

                {(order.advance_bill_number || (order as any).adv_bill) && (
                  <div className="flex justify-between py-1 border-t border-slate-800/60 text-amber-300">
                    <span>Adv. Bill No.:</span>
                    <strong className="font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50">{order.advance_bill_number || (order as any).adv_bill}</strong>
                  </div>
                )}

                {(order.final_bill_number || (order as any).final_bill || (order as any).bill_number) && (
                  <div className="flex justify-between py-1 border-t border-slate-800/60 text-emerald-300">
                    <span>Final Bill No.:</span>
                    <strong className="font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">{order.final_bill_number || (order as any).final_bill || (order as any).bill_number}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Delivery Partner Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Customer Contact */}
            <div className="p-4 rounded-2xl bg-[#090b16] border border-indigo-950 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-400" />
                Customer Contact
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Customer Name</span>
                  <p className="text-sm font-extrabold text-white mt-0.5">{order.customer_name || 'Walk-in Customer'}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {order.mobile_number}
                  </div>

                  <a
                    href={formattedWhatsAppUrl(order.mobile_number, confirmMsg)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                </div>

                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" /> Delivery Address:
                  </span>
                  <p className="text-slate-200 mt-1 font-medium bg-slate-950 p-2 rounded-xl text-[11px]">
                    {order.address || 'In-Store Pickup'}
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery Partner Info */}
            <div className="p-4 rounded-2xl bg-[#090b16] border border-indigo-950 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-400" />
                Assigned Delivery Partner
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-[#12162a] border border-indigo-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block">Rider Name</span>
                    <p className="text-sm font-extrabold text-purple-300 mt-0.5">
                      {order.delivery_partner || 'Not Assigned Yet'}
                    </p>
                  </div>
                  {order.otp && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-slate-400 block">Delivery OTP</span>
                      <span className="font-mono text-sm font-extrabold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/50">
                        {order.otp}
                      </span>
                    </div>
                  )}
                </div>

                {order.delivery_photo_url && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-slate-400 text-[10px] uppercase block mb-1">
                      Delivery Proof Photo:
                    </span>
                    <div className="rounded-xl overflow-hidden border border-emerald-500/50 h-32 relative">
                      <img
                        src={order.delivery_photo_url}
                        alt="Delivery Proof"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        Verified
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#12162a] border-t border-indigo-950 flex flex-wrap items-center justify-between gap-3">
          {onPrintThermal && (
            <button
              onClick={() => {
                onClose();
                onPrintThermal(order);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-800/60 font-bold text-xs flex items-center gap-2 transition"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              Thermal Print Receipt
            </button>
          )}

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={() => {
                onClose();
                onEdit(order);
              }}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 flex items-center gap-1.5 transition"
            >
              <Edit3 className="w-4 h-4" />
              Edit Data
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
