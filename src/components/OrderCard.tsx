import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, PaymentType } from '../types';
import {
  Phone,
  MapPin,
  Clock,
  Eye,
  Edit2,
  Printer,
  MessageCircle,
  Truck,
  Copy,
  Check,
  Cake,
  AlertTriangle,
  Layers,
  X
} from 'lucide-react';
import { useOMSCard } from '../lib/store';
import { getCountdownInfo, getDeliveryTimeInfo, formatTo12Hour } from '../lib/timeUtils';
import { getDeliveredByDisplayName } from '../lib/orderLogic';
import { printThermalReceipts } from '../lib/thermalPrint';
import { formatWhatsAppPhone, renderWhatsAppTemplate } from './WhatsAppPopup';

export interface OrderCardProps {
  order: Order;
  onView?: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onWhatsApp?: (order: Order) => void;
}

const DELAY_REASONS = [
  '1. Kitchen / Preparation Delay',
  '2. Cake Customization / Design Time',
  '3. Delivery Person Not Available',
  '4. Traffic / Weather / Route Issue',
  '5. Customer Requested Late Delivery',
  '6. Address / Contact Issue',
  '7. Outlet Rush / High Order Volume'
];

// Single shared 30s ticker across all mounted active OrderCards (avoids 30+ individual intervals)
const tickListeners = new Set<() => void>();
let sharedTickInterval: any = null;

function subscribeToSharedTick(cb: () => void) {
  tickListeners.add(cb);
  if (!sharedTickInterval && typeof window !== 'undefined') {
    sharedTickInterval = setInterval(() => {
      tickListeners.forEach((fn) => fn());
    }, 30000);
  }
  return () => {
    tickListeners.delete(cb);
    if (tickListeners.size === 0 && sharedTickInterval) {
      clearInterval(sharedTickInterval);
      sharedTickInterval = null;
    }
  };
}

export const AutoConfirmTimer: React.FC<{ actualDeliveryTime?: string | null }> = ({ actualDeliveryTime }) => {
  const [remainingText, setRemainingText] = useState<string>('');

  useEffect(() => {
    if (!actualDeliveryTime) {
      setRemainingText('30m SLA');
      return;
    }

    const updateTimer = () => {
      const delivMs = new Date(actualDeliveryTime).getTime();
      if (isNaN(delivMs)) {
        setRemainingText('30m SLA');
        return;
      }
      const deadline = delivMs + 30 * 60 * 1000;
      const diff = Math.max(0, deadline - Date.now());
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemainingText(`${mins}m ${secs.toString().padStart(2, '0')}s`);
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [actualDeliveryTime]);

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-700/60">
      <Clock className="w-2.5 h-2.5 animate-spin" />
      <span>Auto-confirm in {remainingText}</span>
    </span>
  );
};

export const OrderCard: React.FC<OrderCardProps> = React.memo(({ order, onView, onEdit, onWhatsApp }) => {
  const {
    updateOrder,
    updateOrderStatus,
    partners,
    selectedOrderIds,
    toggleOrderSelection,
    confirmRiderDelivery,
    session,
    showNotification
  } = useOMSCard();

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [advBillInput, setAdvBillInput] = useState(order.advance_bill_number && order.advance_bill_number !== 'N/A' ? order.advance_bill_number : '');
  const [finalBillInput, setFinalBillInput] = useState(order.final_bill_number && order.final_bill_number !== 'N/A' ? order.final_bill_number : '');
  const [previewImageOpen, setPreviewImageOpen] = useState(false);
  const [, setLiveTick] = useState(0);

  useEffect(() => {
    if (order.status === 'delivered' || order.status === 'cancelled') return;
    return subscribeToSharedTick(() => setLiveTick((t) => t + 1));
  }, [order.status]);

  useEffect(() => {
    setAdvBillInput(order.advance_bill_number && order.advance_bill_number !== 'N/A' ? order.advance_bill_number : '');
  }, [order.advance_bill_number]);

  useEffect(() => {
    setFinalBillInput(order.final_bill_number && order.final_bill_number !== 'N/A' ? order.final_bill_number : '');
  }, [order.final_bill_number]);

  const isSelected = Boolean(selectedOrderIds?.includes(order.id));
  const countdown = getCountdownInfo(order);
  const timeInfo = getDeliveryTimeInfo(order);
  const deliveredByDisplay = getDeliveredByDisplayName(order);

  const totalVal = Number(order.total_amount) || 0;
  const pType = String(order.payment_type || 'due').toLowerCase().trim();
  const isPaidFull = pType === 'full' || pType === 'full_paid' || pType === 'paid' || pType === 'cash' || pType === 'upi' || pType === 'online';
  const advanceVal = isPaidFull ? totalVal : (pType === 'due' ? 0 : (Number(order.advance_amount) || 0));
  const remainingVal = isPaidFull ? 0 : (pType === 'due' ? totalVal : Math.max(0, totalVal - advanceVal));

  const attachedPhoto = (order.item_image_url && !order.item_image_url.startsWith('[') ? order.item_image_url : '') ||
    (order.delivery_photo_url && !order.delivery_photo_url.startsWith('[') ? order.delivery_photo_url : '');

  const addressDisplay = order.delivery_type === 'pickup'
    ? 'In-Store Pickup'
    : (order.address || order.delivery_address || 'Local Delivery');

  const copyTextToClipboard = (text: string) => {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => {});
      return;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
  };

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.mobile_number) return;
    copyTextToClipboard(order.mobile_number);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 1800);
  };

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyTextToClipboard(addressDisplay);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 1800);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const nextStatus = e.target.value as OrderStatus;
    updateOrderStatus(order.id, nextStatus, order.delivery_partner);
  };

  const handlePaymentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const nextPay = e.target.value as PaymentType;
    const nowTimeStr = formatTo12Hour(new Date().toISOString());
    const changedBy = session?.name || 'Broomies Central Admin';
    const isFull = nextPay === 'full' || nextPay === 'cash' || nextPay === 'online' || nextPay === 'upi';
    const nextAdv = isFull ? totalVal : (nextPay === 'due' ? 0 : advanceVal);
    const nextRem = isFull ? 0 : (nextPay === 'due' ? totalVal : Math.max(0, totalVal - nextAdv));

    updateOrder(order.id, {
      payment_type: nextPay,
      advance_amount: nextAdv,
      remaining_balance: nextRem,
      due_amount: nextRem,
      payment_changed_by: changedBy,
      payment_changed_at: nowTimeStr
    });
  };

  const handleAdvBillBlur = () => {
    const trimmed = advBillInput.trim();
    if (trimmed !== (order.advance_bill_number || '')) {
      updateOrder(order.id, { advance_bill_number: trimmed });
    }
  };

  const handleFinalBillBlur = () => {
    const trimmed = finalBillInput.trim();
    if (trimmed !== (order.final_bill_number || '')) {
      updateOrder(order.id, { final_bill_number: trimmed });
    }
  };

  const handlePartnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const nextPartner = e.target.value;
    updateOrder(order.id, {
      delivery_partner: nextPartner || 'Unassigned',
      ...(nextPartner && (order.status === 'pending' || order.status === 'processing')
        ? { status: 'out_for_delivery' as OrderStatus }
        : {})
    });
  };

  const handleDelayReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const reason = e.target.value;
    updateOrder(order.id, { late_reason: reason });
  };

  const handlePrintSingle = (e: React.MouseEvent) => {
    e.stopPropagation();
    printThermalReceipts([order]);
  };

  const handleQuickWA = async (e: React.MouseEvent, type: 'confirm' | 'dispatch' | 'reminder' | 'pickup') => {
    e.stopPropagation();
    const cleanPhone = formatWhatsAppPhone(order.mobile_number);
    const msg = renderWhatsAppTemplate(type, order);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: order.mobile_number,
          message: msg,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          orderId: order.id,
          type
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.queued) {
          showNotification(`📦 Order #${order.order_number} ${type} message saved in Outbox (will auto-send when WhatsApp is linked)`);
        } else {
          showNotification(`⚡ WhatsApp ${type} message sent automatically to +${cleanPhone}!`);
        }
        return;
      }
    } catch {}

    if (onWhatsApp) {
      onWhatsApp(order);
    }
  };

  const getStatusSelectStyle = (status: OrderStatus) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60';
      case 'out_for_delivery':
        return 'bg-blue-950/90 text-blue-300 border-blue-500/60';
      case 'processing':
      case 'preparing':
      case 'ready':
        return 'bg-amber-950/90 text-amber-300 border-amber-500/60';
      case 'cancelled':
      case 'missed':
        return 'bg-slate-900 text-rose-400 border-rose-500/50';
      default:
        return 'bg-[#351329] text-rose-300 border-rose-500/50';
    }
  };

  return (
    <>
      <div
        onClick={() => onView && onView(order)}
        className="ticket-wrapper cursor-pointer select-none"
      >
        <div className={`ticket ${isSelected ? 'ring-2 ring-purple-500' : ''}`}>
          {/* TOP MAIN TICKET SECTION */}
          <div className="t-main">
            <div className="t-content space-y-3">
              {/* Row 1: BROOMIES Logo + Checkbox + #OrderNum + Outlet Pill */}
              <div className="flex items-center justify-between gap-2">
                <div className="t-logo">
                  <Layers className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="tracking-wider font-black text-white text-xs sm:text-sm">BROOMIES</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {toggleOrderSelection && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleOrderSelection(order.id)}
                      className="w-4 h-4 rounded bg-white border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      title="Select for Batch Thermal Print"
                    />
                  )}
                  <span className="t-type">#{order.order_number}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#231242] border border-purple-500/50 text-purple-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <span className="text-rose-400">📍</span>
                    <span>{order.outlet || 'SECTOR 31'}</span>
                  </span>
                </div>
              </div>

              {/* Row 2: Phone Number + Copy Button & Order # + WA Button */}
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-lg sm:text-xl font-black text-white tracking-tight font-mono">
                    {order.mobile_number || 'N/A'}
                  </span>
                  {order.mobile_number && (
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="px-2.5 py-0.5 rounded-lg bg-[#251346] hover:bg-purple-900 border border-purple-500/50 text-purple-300 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedPhone ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">
                    {order.customer_name && !order.customer_name.startsWith('Customer #')
                      ? `${order.customer_name} • Order #${order.order_number}`
                      : `Order #${order.order_number}`}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onWhatsApp) onWhatsApp(order);
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-400 text-[11px] font-extrabold inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>WA</span>
                  </button>
                </div>
              </div>

              {/* Row 3: Status Dropdown + Countdown Pill + Eye / Edit / Print Icons */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <select
                  value={order.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={handleStatusChange}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border cursor-pointer focus:outline-none ${getStatusSelectStyle(order.status)}`}
                >
                  <option value="pending" className="bg-slate-900 text-rose-300">PENDING</option>
                  <option value="processing" className="bg-slate-900 text-amber-300">PROCESSING</option>
                  <option value="out_for_delivery" className="bg-slate-900 text-blue-300">OUT FOR DELIVERY</option>
                  <option value="delivered" className="bg-slate-900 text-emerald-300">DELIVERED</option>
                  <option value="on_hold" className="bg-slate-900 text-purple-300">ON HOLD</option>
                  <option value="cancelled" className="bg-slate-900 text-slate-400">CANCELLED</option>
                  <option value="missed" className="bg-slate-900 text-rose-400">MISSED</option>
                </select>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 truncate ${
                    timeInfo.isOverdue
                      ? 'bg-[#3b1224] text-rose-300 border border-rose-500/50'
                      : countdown.badgeColorClass
                  }`}
                >
                  {timeInfo.isOverdue && <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />}
                  <span className="truncate">{countdown.text}</span>
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onView) onView(order);
                    }}
                    className="w-7 h-7 rounded-lg bg-[#141a38] hover:bg-indigo-900 border border-indigo-500/50 text-indigo-300 flex items-center justify-center transition cursor-pointer"
                    title="View Order"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEdit) onEdit(order);
                    }}
                    className="w-7 h-7 rounded-lg bg-[#241342] hover:bg-purple-900 border border-purple-500/50 text-purple-300 flex items-center justify-center transition cursor-pointer"
                    title="Edit Order"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintSingle}
                    className="w-7 h-7 rounded-lg bg-[#0c2924] hover:bg-emerald-900 border border-emerald-500/50 text-emerald-400 flex items-center justify-center transition cursor-pointer"
                    title="Print Thermal Receipt"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 4: BAKERY ITEM Box */}
              <div className="bg-[#0d1122]/95 border border-indigo-950/90 rounded-xl p-3 space-y-2.5">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-0.5">
                    BAKERY ITEM
                  </span>
                  <div className="text-sm font-black text-white leading-snug">
                    <span>{order.item_type || 'Bakery Cake'}</span>{' '}
                    {order.quantity && (
                      <span className="text-purple-300 font-extrabold">({order.quantity})</span>
                    )}
                  </div>
                </div>

                {/* CAKE NAME Banner */}
                <div className="px-3 py-1.5 rounded-lg bg-[#2b0f26] border border-pink-500/50 flex items-center gap-2 text-xs font-extrabold text-pink-300">
                  <Cake className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="truncate">
                    CAKE NAME: <strong className="text-white">&ldquo;{order.name_on_cake || '.'}&rdquo;</strong>
                  </span>
                </div>

                {/* 3-Column Footer inside Bakery Item Box: OUTLET | EXP DELIVERY | DELAY STATUS */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-950/80">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      OUTLET
                    </span>
                    <span className="text-xs font-black text-purple-200">
                      {order.outlet || 'Sector 31'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      EXP DELIVERY
                    </span>
                    <span className="text-xs font-extrabold font-mono text-indigo-300">
                      {formatTo12Hour(order.delivery_time_expected || order.order_time) || '06:00 PM'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      DELAY STATUS
                    </span>
                    <span
                      className={`text-xs font-extrabold font-mono ${
                        timeInfo.delayMinutes > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {timeInfo.delayMinutes > 0 ? `${timeInfo.delayMinutes} min Delay` : 'On Time'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 5: Attached Cake/Item Photo Banner */}
              {attachedPhoto && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImageOpen(true);
                  }}
                  className="bg-[#0d1122]/95 border border-indigo-950/90 hover:border-purple-500/50 rounded-xl p-2.5 flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={attachedPhoto}
                      alt="Attached Cake"
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-lg object-cover border border-slate-700 shrink-0 bg-slate-900"
                    />
                    <span className="text-xs font-bold text-slate-200 truncate">
                      Click to view attached cake/item photo
                    </span>
                  </div>
                  <Eye className="w-4 h-4 text-purple-400 shrink-0 mr-1" />
                </div>
              )}

              {/* Row 6: Location / Pickup Bar + Copy Button */}
              <div className="bg-[#0d1122]/95 border border-indigo-950/90 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-200 truncate" title={addressDisplay}>
                    {addressDisplay}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="px-2.5 py-1 rounded-lg bg-[#251346] hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition cursor-pointer"
                >
                  {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Row 7: WA Quick Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">WA Quick:</span>
                <button
                  type="button"
                  onClick={(e) => handleQuickWA(e, 'confirm')}
                  className="px-2.5 py-1 rounded-lg bg-[#0c2924] hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold transition cursor-pointer"
                >
                  Confirm
                </button>
                {String(order.delivery_type || '').toLowerCase().trim() === 'pickup' ? (
                  <button
                    type="button"
                    onClick={(e) => handleQuickWA(e, 'pickup')}
                    className="px-2.5 py-1 rounded-lg bg-[#241342] hover:bg-purple-900 border border-purple-500/50 text-purple-300 text-[11px] font-bold transition cursor-pointer"
                  >
                    🛍️ Ready for Pickup
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleQuickWA(e, 'dispatch')}
                    className="px-2.5 py-1 rounded-lg bg-[#122244] hover:bg-blue-900 border border-blue-500/50 text-blue-300 text-[11px] font-bold transition cursor-pointer"
                  >
                    Dispatch
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleQuickWA(e, 'reminder')}
                  className="px-2.5 py-1 rounded-lg bg-[#2e1e0f] hover:bg-amber-900 border border-amber-500/50 text-amber-300 text-[11px] font-bold transition cursor-pointer"
                >
                  Reminder
                </button>
              </div>

              {/* Row 8: PAYMENT Box with Audit Line */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0d1122]/95 border border-indigo-950/90 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">
                    PAYMENT:
                  </span>

                  <select
                    value={isPaidFull ? 'full' : pType === 'part' ? 'part' : 'due'}
                    onChange={handlePaymentTypeChange}
                    className={`flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase border cursor-pointer focus:outline-none ${
                      remainingVal > 0
                        ? 'bg-[#351123] border-rose-500/50 text-rose-200'
                        : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                    }`}
                  >
                    <option value="due" className="bg-slate-900 text-rose-300">
                      PAY ON DELIVERY / DUE (₹{totalVal.toLocaleString('en-IN')})
                    </option>
                    <option value="full" className="bg-slate-900 text-emerald-300">
                      PAID FULL (₹{totalVal.toLocaleString('en-IN')})
                    </option>
                    <option value="part" className="bg-slate-900 text-amber-300">
                      PARTIAL ADVANCE (Adv: ₹{advanceVal.toLocaleString('en-IN')})
                    </option>
                  </select>

                  <span
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold font-mono whitespace-nowrap border ${
                      remainingVal > 0
                        ? 'bg-[#351123] border-rose-500/50 text-rose-300'
                        : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                    }`}
                  >
                    {remainingVal > 0
                      ? `Due: ₹${remainingVal.toLocaleString('en-IN')}`
                      : `Paid: ₹${totalVal.toLocaleString('en-IN')}`}
                  </span>
                </div>

                <div className="text-[10px] font-mono text-slate-400">
                  <span className="text-purple-400 font-bold">Audit:</span>{' '}
                  <span>
                    By {order.payment_changed_by || 'Broomies Central Admin'} (
                    {formatTo12Hour(order.payment_changed_at || order.updated_at || order.order_time) || '06:00 PM'})
                  </span>
                </div>
              </div>

              {/* Row 9: BILL NUMBERS (बिल नंबर) Directly Editable Box */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0d1122]/95 border border-purple-500/30 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-purple-200 uppercase flex items-center gap-1.5">
                    <Edit2 className="w-3 h-3 text-purple-400" />
                    <span>BILL NUMBERS (बिल नंबर)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Directly Editable</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#090c18] border border-amber-500/50">
                    <span className="text-[10px] font-extrabold text-amber-400 whitespace-nowrap">Adv Bill:</span>
                    <input
                      type="text"
                      value={advBillInput}
                      onChange={(e) => setAdvBillInput(e.target.value)}
                      onBlur={handleAdvBillBlur}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdvBillBlur()}
                      placeholder="e.g. ADV-101"
                      className="w-full min-w-0 bg-transparent text-xs font-mono font-bold text-amber-200 placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#090c18] border border-emerald-500/50">
                    <span className="text-[10px] font-extrabold text-emerald-400 whitespace-nowrap">Final Bill:</span>
                    <input
                      type="text"
                      value={finalBillInput}
                      onChange={(e) => setFinalBillInput(e.target.value)}
                      onBlur={handleFinalBillBlur}
                      onKeyDown={(e) => e.key === 'Enter' && handleFinalBillBlur()}
                      placeholder="e.g. 8747"
                      className="w-full min-w-0 bg-transparent text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Row 10: Partner Selector Row */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-between gap-3 pt-0.5"
              >
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Partner:</span>
                </span>

                <select
                  value={order.delivery_partner && order.delivery_partner !== 'Unassigned' ? order.delivery_partner : ''}
                  onChange={handlePartnerChange}
                  className="bg-[#0d1122] border border-indigo-900/80 rounded-lg px-3 py-1.5 text-xs font-bold text-white min-w-[165px] focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="">-- Unassigned --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 11: DELAY REASON Dropdown (Only visible when delay > 30 mins) */}
              {timeInfo.delayMinutes > 30 && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="space-y-1.5 pt-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                      DELAY REASON ({timeInfo.delayMinutes}m Delay)
                    </span>
                    {order.late_reason && (
                      <span className="text-[10px] font-extrabold text-emerald-400">
                        SAVED ✓
                      </span>
                    )}
                  </div>

                  <select
                    value={order.late_reason || ''}
                    onChange={handleDelayReasonChange}
                    className="w-full bg-[#1f0e22] border border-rose-500/40 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-rose-400 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">
                      -- Select Delay Reason --
                    </option>
                    {DELAY_REASONS.map((r) => (
                      <option key={r} value={r} className="bg-slate-900 text-white">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rider Marked Delivered vs Pickup Action / Delivered History Stamp */}
              {order.status === 'delivered' && Boolean(order.delivery_confirmation_pending) && String(order.delivery_type || '').toLowerCase().trim() !== 'pickup' ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-gradient-to-r from-emerald-950/95 via-[#0f2922] to-amber-950/80 border-2 border-emerald-400/80 rounded-xl p-3 space-y-2 shadow-lg shadow-emerald-950/60 animate-pulse"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300 uppercase tracking-wide">
                      <span>🚴 Rider Marked Delivered</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-extrabold">
                      Pending Admin/Outlet Confirm
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-200 font-semibold flex items-center justify-between">
                    <span>Rider: <strong className="text-white">{deliveredByDisplay}</strong></span>
                    <span className="font-mono text-emerald-300">{timeInfo.actualFormatted}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => confirmRiderDelivery && confirmRiderDelivery(order.id)}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm Delivery (Move to History)</span>
                  </button>
                </div>
              ) : order.status !== 'delivered' && order.status !== 'cancelled' && String(order.delivery_type || '').toLowerCase().trim() === 'pickup' ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-1"
                >
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(order.id, 'delivered')}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-950/90 hover:bg-emerald-800 border border-emerald-500/60 text-emerald-300 hover:text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>🛍️ Mark Pickup Delivered (Move to History)</span>
                  </button>
                </div>
              ) : order.status === 'delivered' ? (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-emerald-300 truncate">
                    ✓ Delivered ({deliveredByDisplay})
                  </span>
                  <span className="font-mono font-bold text-emerald-200 shrink-0">
                    {order.delivery_date || order.order_date} • {timeInfo.actualFormatted}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* PERFORATION DIVIDER */}
          <div className="t-perforation">
            <div className="t-perf-line" />
          </div>

          {/* BOTTOM TICKET STUB: Barcode + ORD-# + TOTAL AMOUNT */}
          <div className="t-stub">
            <div className="t-barcode-container">
              <div className="t-barcode" />
              <div className="t-barcode-id">ORD-#{order.order_number}</div>
            </div>

            <div className="t-admit">
              <div className="t-admit-text">TOTAL AMOUNT</div>
              <div className="t-admit-num font-mono">
                ₹{totalVal.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Lightbox Modal when clicking attached photo */}
      {previewImageOpen && attachedPhoto && (
        <div
          onClick={() => setPreviewImageOpen(false)}
          className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-[#0e111d] border border-purple-500/40 rounded-2xl p-3 max-w-lg w-full shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-950">
              <span className="text-xs font-extrabold text-white">
                Order #{order.order_number} — {order.item_type}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImageOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={attachedPhoto}
              alt={order.item_type}
              referrerPolicy="no-referrer"
              className="w-full max-h-[75vh] object-contain rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </>
  );
}, (prevProps, nextProps) => {
  const a = prevProps.order;
  const b = nextProps.order;
  return (
    a === b ||
    (a.id === b.id &&
      a.updated_at === b.updated_at &&
      a.status === b.status &&
      a.payment_type === b.payment_type &&
      a.delivery_partner === b.delivery_partner &&
      Boolean(a.delivery_confirmation_pending) === Boolean(b.delivery_confirmation_pending) &&
      (a.advance_bill_number || '') === (b.advance_bill_number || '') &&
      (a.final_bill_number || '') === (b.final_bill_number || '') &&
      (a.late_reason || '') === (b.late_reason || '') &&
      Number(a.total_amount || 0) === Number(b.total_amount || 0) &&
      Number(a.advance_amount || 0) === Number(b.advance_amount || 0) &&
      Number(a.remaining_balance || 0) === Number(b.remaining_balance || 0) &&
      (a.customer_name || '') === (b.customer_name || '') &&
      (a.mobile_number || '') === (b.mobile_number || '') &&
      (a.item_type || '') === (b.item_type || '') &&
      (a.outlet || '') === (b.outlet || '') &&
      (a.delivery_date || '') === (b.delivery_date || '') &&
      (a.delivery_time_expected || '') === (b.delivery_time_expected || '') &&
      (a.delivered_by || '') === (b.delivered_by || ''))
  );
});

export default OrderCard;
