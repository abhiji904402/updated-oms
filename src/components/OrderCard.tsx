import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, PaymentType } from '../types';
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

export const OrderCard: React.FC<OrderCardProps> = React.memo(({ order, compact = false, onOpenDeliveryModal, onEditOrder, onViewOrder }) => {
  const {
    session,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    confirmRiderDelivery,
    partners,
    selectedOrderIds,
    toggleOrderSelection
  } = useOMS();

  const [showImageModal, setShowImageModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());

  // Live ticker for countdown timer (only for active orders)
  useEffect(() => {
    if (order.status === 'delivered' || order.status === 'cancelled') return;
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 15000); // refresh every 15 sec
    return () => clearInterval(timer);
  }, [order.status]);

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

  const renderPaymentDropdown = () => {
    const total = order.total_amount ?? 0;
    const advance = order.advance_amount ?? 0;
    const remaining = order.remaining_balance ?? 0;

    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] font-bold text-slate-400 uppercase">Payment:</span>
        <select
          value={order.payment_type || 'full'}
          onChange={(e) => {
            const newType = e.target.value as PaymentType;
            let updates: Partial<Order> = {
              payment_type: newType,
              payment_changed_by: session.name || session.role,
              payment_changed_at: new Date().toISOString()
            };
            if (newType === 'full') {
              updates.advance_amount = total;
              updates.remaining_balance = 0;
              updates.due_amount = 0;
            } else if (newType === 'due') {
              updates.advance_amount = 0;
              updates.remaining_balance = total;
              updates.due_amount = total;
            } else if (newType === 'part') {
              const adv = order.advance_amount && order.advance_amount < total ? order.advance_amount : Math.round(total / 2);
              updates.advance_amount = adv;
              updates.remaining_balance = Math.max(0, total - adv);
              updates.due_amount = Math.max(0, total - adv);
            }
            updateOrder(order.id, updates);
          }}
          className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 transition shadow-sm ${
            order.payment_type === 'full'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
              : order.payment_type === 'part'
              ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
              : 'bg-rose-950/90 text-rose-300 border-rose-500/50'
          }`}
        >
          <option value="full" className="bg-slate-900 text-emerald-300">Paid Full (₹{total.toLocaleString()})</option>
          <option value="part" className="bg-slate-900 text-amber-300">Partial Advance (Paid ₹{advance.toLocaleString()} | Due ₹{remaining.toLocaleString()})</option>
          <option value="due" className="bg-slate-900 text-rose-300">Pay On Delivery / Due (₹{remaining.toLocaleString()})</option>
          <option value="cash" className="bg-slate-900 text-slate-200">Cash</option>
          <option value="upi" className="bg-slate-900 text-slate-200">UPI</option>
          <option value="online" className="bg-slate-900 text-slate-200">Online</option>
        </select>
      </div>
    );
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
      <div className="ticket-wrapper my-1">
        <div
          onClick={() => {
            if (onViewOrder) {
              onViewOrder(order);
            } else if (onEditOrder) {
              onEditOrder(order);
            }
          }}
          className={`ticket cursor-pointer ${
            isSelected ? 'ring-2 ring-purple-500' : ''
          }`}
        >
          {/* Upper Ticket Main */}
          <div className="t-main">
            <div className="t-content space-y-3">
              {/* Header */}
              <div className="t-header">
                <div className="t-logo">
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path
                      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                  <span>BROOMIES</span>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOrderSelection(order.id)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-500 cursor-pointer"
                  />
                  <div className="t-type">#{order.order_number}</div>
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-lg bg-purple-950/90 text-purple-300 border border-purple-700/60 shadow-sm flex items-center gap-1 tracking-wider">
                    📍 {order.outlet || 'Sector 31'}
                  </span>
                </div>
              </div>

              {/* Title & Customer Subtitle */}
              <div>
                <div className="t-title flex items-center justify-between">
                  <span className="truncate">{order.customer_name}</span>
                </div>
                <div className="t-subtitle flex items-center justify-between text-xs mt-0.5">
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Phone className="w-3 h-3 text-purple-400" /> {order.mobile_number}
                  </span>
                  <a
                    href={formattedWhatsAppUrl(order.mobile_number, `Hi ${order.customer_name}, regarding your Broomies order #${order.order_number}...`)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1"
                  >
                    <MessageCircle className="w-3 h-3" /> WA
                  </a>
                </div>
              </div>

              {/* Quick Status, Countdown & Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-purple-900/30" onClick={(e) => e.stopPropagation()}>
                {/* Status Dropdown */}
                <select
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                  className={`text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${getStatusColor(order.status)}`}
                >
                  <option value="pending" className="bg-slate-900 text-rose-300">Pending</option>
                  <option value="processing" className="bg-slate-900 text-amber-300">Processing</option>
                  <option value="out_for_delivery" className="bg-slate-900 text-blue-300">Out for Delivery</option>
                  <option value="delivered" className="bg-slate-900 text-emerald-300">Delivered</option>
                  <option value="on_hold" className="bg-slate-900 text-purple-300">On Hold</option>
                  <option value="cancelled" className="bg-slate-900 text-slate-400">Cancelled</option>
                  <option value="missed" className="bg-slate-900 text-red-400">Missed</option>
                </select>

                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${countdown.badgeColorClass}`}>
                  {countdown.text}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (onViewOrder) onViewOrder(order);
                      else if (onEditOrder) onEditOrder(order);
                    }}
                    className="p-1 rounded bg-indigo-950 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-800/50 transition"
                    title="View Order"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {onEditOrder && (
                    <button
                      onClick={() => onEditOrder(order)}
                      className="p-1 rounded bg-purple-950 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-800/50 transition"
                      title="Edit Order"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => printThermalReceipts([order])}
                    className="p-1 rounded bg-slate-800 text-emerald-400 hover:bg-slate-700 transition"
                    title="Print Receipt"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  {session.role === 'admin' && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-1 rounded bg-slate-800 text-slate-400 hover:bg-rose-950 hover:text-rose-400 transition"
                      title="Delete Order"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Delete Confirm Banner */}
              {showDeleteConfirm && (
                <div className="p-2 bg-rose-950/90 border border-rose-800 rounded-lg flex items-center justify-between text-xs text-rose-200" onClick={(e) => e.stopPropagation()}>
                  <span>Delete Order #{order.order_number}?</span>
                  <div className="flex gap-1">
                    <button onClick={() => { deleteOrder(order.id); setShowDeleteConfirm(false); }} className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold">Yes</button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">No</button>
                  </div>
                </div>
              )}

              {/* Rider Delivery Confirmation Banner */}
              {order.rider_delivered && order.delivery_confirmation_pending && (
                <div className="p-2.5 bg-emerald-950 border border-emerald-500/80 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 text-emerald-300 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Rider Delivered (Pending Confirmation)</span>
                  </div>
                  <button
                    onClick={() => confirmRiderDelivery(order.id)}
                    className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase text-[10px]"
                  >
                    CONFIRM
                  </button>
                </div>
              )}

              {/* Details Grid (Ticket Detail Grid) */}
              <div className="t-details bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                <div className="t-detail-item">
                  <span className="t-label">Bakery Item</span>
                  <span className="t-value text-xs truncate font-bold text-slate-100 flex items-center gap-1">
                    {order.item_type} ({order.quantity})
                  </span>
                </div>

                <div className="t-detail-item">
                  <span className="t-label">Outlet</span>
                  <span className="t-value text-xs text-purple-300 font-bold">{order.outlet}</span>
                </div>

                <div className="t-detail-item">
                  <span className="t-label">Exp Delivery</span>
                  <span className="t-value text-xs text-indigo-300 font-mono">{timeInfo.expectedFormatted}</span>
                </div>

                <div className="t-detail-item">
                  <span className="t-label">Delay Status</span>
                  <span className={`t-value text-[11px] font-mono ${timeInfo.delayMinutes > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {timeInfo.delayText}
                  </span>
                </div>
              </div>

              {/* Image & Address if present */}
              {order.item_image_url && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImageModal(true);
                  }}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer hover:border-purple-500/50"
                >
                  <img src={order.item_image_url} alt={order.item_type} className="w-10 h-10 rounded-lg object-cover border border-slate-700" />
                  <span className="text-xs text-slate-300 font-medium">Click to view attached cake/item photo</span>
                  <Eye className="w-4 h-4 text-purple-400 ml-auto" />
                </div>
              )}

              {order.delivery_type === 'delivery' && (
                <div className="text-[11px] text-slate-400 bg-slate-950/50 p-2 rounded-lg border border-slate-800/80 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{order.address || 'No address provided'}</span>
                </div>
              )}

              {/* WhatsApp Quick Message Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] pt-1">
                <span className="text-slate-500 font-bold">WA Quick:</span>
                <a
                  href={formattedWhatsAppUrl(order.mobile_number, confirmMsg)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/60 whitespace-nowrap"
                >
                  Confirm
                </a>
                <a
                  href={formattedWhatsAppUrl(order.mobile_number, dispatchMsg)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="bg-blue-950/60 hover:bg-blue-900 text-blue-300 px-2 py-0.5 rounded border border-blue-800/60 whitespace-nowrap"
                >
                  Dispatch
                </a>
                {order.remaining_balance > 0 && (
                  <a
                    href={formattedWhatsAppUrl(order.mobile_number, reminderMsg)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="bg-amber-950/60 hover:bg-amber-900 text-amber-300 px-2 py-0.5 rounded border border-amber-800/60 whitespace-nowrap"
                  >
                    Reminder
                  </a>
                )}
              </div>

              {/* Payment Status Dropdown */}
              <div className="p-2 bg-slate-950/80 rounded-xl border border-purple-900/30">
                {renderPaymentDropdown()}
              </div>

              {/* Bill Numbers (Editable Adv Bill & Final Bill) */}
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-purple-900/40 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-purple-400" />
                    Bill Numbers (बिल नंबर)
                  </span>
                  <span className="text-[9px] text-slate-500">Directly Editable</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex items-center gap-1 bg-amber-950/30 border border-amber-800/40 rounded-lg p-1">
                    <span className="text-[10px] font-bold text-amber-400 shrink-0 font-sans">Adv Bill:</span>
                    <input
                      type="text"
                      placeholder="e.g. ADV-101"
                      defaultValue={order.advance_bill_number || ''}
                      key={`adv-${order.id}-${order.advance_bill_number}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (order.advance_bill_number || '')) {
                          updateOrder(order.id, { advance_bill_number: val });
                        }
                      }}
                      className="w-full bg-slate-900 text-amber-200 text-xs px-2 py-0.5 rounded border border-amber-800/60 focus:outline-none focus:border-amber-400 font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-1">
                    <span className="text-[10px] font-bold text-emerald-400 shrink-0 font-sans">Final Bill:</span>
                    <input
                      type="text"
                      placeholder="e.g. BILL-201"
                      defaultValue={order.final_bill_number || ''}
                      key={`final-${order.id}-${order.final_bill_number}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (order.final_bill_number || '')) {
                          updateOrder(order.id, { final_bill_number: val });
                        }
                      }}
                      className="w-full bg-slate-900 text-emerald-200 text-xs px-2 py-0.5 rounded border border-emerald-800/60 focus:outline-none focus:border-emerald-400 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Partner Selection */}
              <div className="pt-1 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1 text-slate-400">
                  <Truck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Partner:</span>
                </div>
                {session.role === 'admin' || session.role === 'outlet' ? (
                  <select
                    value={order.delivery_partner || ''}
                    onChange={(e) => updateOrderStatus(order.id, order.status, e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:border-purple-500 cursor-pointer"
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

            </div>

            {/* Perforation Line */}
            <div
              className="t-perforation"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                transform: 'translateY(50%)'
              }}
            >
              <div className="t-perf-line"></div>
            </div>
          </div>

          {/* Ticket Stub */}
          <div className="t-stub">
            <div className="t-barcode-container">
              <div className="t-barcode"></div>
              <div className="t-barcode-id">ORD-#{order.order_number}</div>
            </div>

            <div className="t-admit">
              <div className="t-admit-text">Total Amount</div>
              <div className="t-admit-num">₹{(order.total_amount ?? 0).toLocaleString()}</div>
            </div>
          </div>
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
});
