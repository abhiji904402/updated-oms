import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOMS } from '../lib/store';
import { Order } from '../types';
import { matchesOutlet, formatOutletDisplayName } from '../lib/outletUtils';
import { formatTo12Hour } from '../lib/timeUtils';
import {
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  Camera,
  Key,
  X,
  AlertCircle,
  Truck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';

interface ConfirmDeliveryModalProps {
  manualOrderId?: string | null;
  onCloseManual?: () => void;
}

export const ConfirmDeliveryModal: React.FC<ConfirmDeliveryModalProps> = React.memo(({
  manualOrderId,
  onCloseManual
}) => {
  const { orders = [], session, confirmRiderDelivery } = useOMS();

  // Track dismissed order IDs in current browser session
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(new Set());
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const audioPlayedRef = useRef<Set<string>>(new Set());

  // Filter pending confirmation orders based on active user role and outlet
  const pendingOrders = useMemo(() => {
    if (session.role === 'delivery') return [];

    return (orders || []).filter((o) => {
      if (o.status !== 'delivered' || !o.delivery_confirmation_pending) return false;

      // Outlet managers only see their assigned outlet's orders
      if (session.role === 'outlet' && session.outlet) {
        return matchesOutlet(o.outlet, session.outlet);
      }
      return true;
    });
  }, [orders, session.role, session.outlet]);

  // Determine current order to display
  const currentOrder = useMemo(() => {
    if (manualOrderId) {
      const found = (orders || []).find((o) => o.id === manualOrderId);
      if (found) return found;
    }

    // Filter out dismissed orders for auto-popup
    const unDismissed = pendingOrders.filter((o) => !dismissedOrderIds.has(o.id));
    if (unDismissed.length === 0) return null;

    const safeIndex = Math.min(activeOrderIndex, unDismissed.length - 1);
    return unDismissed[safeIndex] || unDismissed[0] || null;
  }, [manualOrderId, pendingOrders, dismissedOrderIds, activeOrderIndex, orders]);

  // Play pleasant notification chime when a new pending delivery arrives
  useEffect(() => {
    if (!currentOrder) return;
    if (audioPlayedRef.current.has(currentOrder.id)) return;

    audioPlayedRef.current.add(currentOrder.id);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch {
      // Audio playback fails gracefully if user hasn't interacted yet
    }
  }, [currentOrder]);

  // 30-Minute Live Countdown Timer for the active order
  const [timeLeftStr, setTimeLeftStr] = useState<string>('30:00');
  const [progressPercent, setProgressPercent] = useState<number>(100);

  useEffect(() => {
    if (!currentOrder) return;

    const deliveryTime = new Date(currentOrder.actual_delivery_time || currentOrder.updated_at || Date.now()).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const totalDuration = 30 * 60 * 1000;
      const elapsed = Math.max(0, now - deliveryTime);
      const remaining = Math.max(0, totalDuration - elapsed);

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);

      const pct = Math.max(0, Math.min(100, (remaining / totalDuration) * 100));
      setProgressPercent(pct);

      if (remaining === 0) {
        setTimeLeftStr('Auto-confirming...');
      } else {
        setTimeLeftStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentOrder]);

  // Handlers
  const handleConfirm = (orderId: string) => {
    confirmRiderDelivery(orderId);
    if (manualOrderId && onCloseManual) {
      onCloseManual();
    }
  };

  const handleDismiss = () => {
    if (manualOrderId && onCloseManual) {
      onCloseManual();
      return;
    }
    if (currentOrder) {
      setDismissedOrderIds((prev) => new Set([...prev, currentOrder.id]));
    }
  };

  const handleConfirmAll = () => {
    pendingOrders.forEach((o) => confirmRiderDelivery(o.id));
    if (onCloseManual) onCloseManual();
  };

  if (!currentOrder) return null;

  const totalPendingCount = pendingOrders.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-xl bg-[#0b0e1d] border-2 border-amber-500/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delivery-title"
      >
        {/* Glowing Ambient Header Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-amber-950/50 to-transparent border-b border-amber-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shrink-0 animate-bounce">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Rider Delivered
                </span>
                <span className="text-xs font-bold text-slate-400">
                  Order #{currentOrder.order_number}
                </span>
                <span className="text-xs font-bold text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/60">
                  {formatOutletDisplayName(currentOrder.outlet)}
                </span>
              </div>
              <h2 id="confirm-delivery-title" className="text-base sm:text-lg font-black text-white mt-0.5">
                Delivery Confirmation Required
              </h2>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Dismiss / Review Later"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 30-Minute Auto-Confirm Countdown Banner */}
        <div className="px-4 sm:px-5 py-3 bg-amber-950/40 border-b border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-200 font-bold">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Auto-confirms in:</span>
            <span className="px-2 py-0.5 rounded-lg bg-amber-900/80 border border-amber-400/50 text-amber-100 font-mono font-black text-sm tracking-wide">
              {timeLeftStr}
            </span>
          </div>
          <div className="text-[11px] text-amber-300/80 font-medium">
            Auto-approved if not confirmed in 30 mins
          </div>
        </div>

        {/* Progress Bar of 30-minute Timer */}
        <div className="w-full bg-slate-900 h-1">
          <div
            className="bg-amber-400 h-1 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-200 text-xs">
          {/* Rider and Verification Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                Delivered By Rider
              </div>
              <div className="text-sm font-extrabold text-white">
                {currentOrder.delivered_by || currentOrder.delivery_partner || 'Assigned Rider'}
              </div>
              {currentOrder.actual_delivery_time && (
                <div className="text-[11px] text-slate-400">
                  Delivered at: <strong className="text-slate-200">{formatTo12Hour(currentOrder.actual_delivery_time)}</strong>
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                Security OTP
              </div>
              <div className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {currentOrder.otp ? `Verified (OTP: ${currentOrder.otp})` : 'OTP Verified by Rider'}
              </div>
              <div className="text-[11px] text-emerald-400/80 font-medium">
                Customer handover verified
              </div>
            </div>
          </div>

          {/* Customer & Address Details */}
          <div className="p-3.5 rounded-2xl bg-[#0e111d] border border-indigo-950 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <span className="font-extrabold text-white text-sm">
                  {currentOrder.customer_name || 'Customer'}
                </span>
              </div>
              {((currentOrder as any).customer_phone || currentOrder.mobile_number) && (
                <a
                  href={`tel:${(currentOrder as any).customer_phone || currentOrder.mobile_number}`}
                  className="px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-300 font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <Phone className="w-3 h-3" />
                  {(currentOrder as any).customer_phone || currentOrder.mobile_number}
                </a>
              )}
            </div>

            {(currentOrder.delivery_address || currentOrder.address) && (
              <div className="flex items-start gap-2 text-slate-300 pt-1 border-t border-slate-800/60">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{currentOrder.delivery_address || currentOrder.address}</span>
              </div>
            )}
          </div>

          {/* Items & Amount Summary */}
          <div className="p-3.5 rounded-2xl bg-[#0e111d] border border-indigo-950 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
                Ordered Items
              </div>
              <div className="font-bold text-white text-xs">
                {currentOrder.item_type || (currentOrder as any).items || 'Items'} (Qty: {currentOrder.quantity || 1})
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Total Amount</div>
              <div className="text-base font-black text-emerald-400">
                ₹{(currentOrder.total_amount ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {currentOrder.payment_type ? currentOrder.payment_type.toUpperCase() : 'PAID'}
              </div>
            </div>
          </div>

          {/* Delivery Proof Photo */}
          {currentOrder.delivery_photo_url ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Camera className="w-3.5 h-3.5" />
                  Delivery Proof Photo Attached
                </span>
                <button
                  type="button"
                  onClick={() => setIsPhotoExpanded(!isPhotoExpanded)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Maximize2 className="w-3 h-3" />
                  {isPhotoExpanded ? 'Minimize' : 'Click to Enlarge'}
                </button>
              </div>

              <div
                className={`relative rounded-2xl overflow-hidden border border-emerald-800/60 bg-black cursor-pointer group transition-all ${
                  isPhotoExpanded ? 'max-h-96' : 'max-h-48'
                }`}
                onClick={() => setIsPhotoExpanded(!isPhotoExpanded)}
              >
                <img
                  src={currentOrder.delivery_photo_url}
                  alt={`Delivery Proof for Order #${currentOrder.order_number}`}
                  className="w-full h-full object-contain mx-auto group-hover:scale-105 transition duration-300"
                />
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-[10px] text-white font-mono flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  Proof Photo
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-center text-xs">
              📷 No delivery proof photo was attached for this order
            </div>
          )}

          {/* Pagination when multiple orders pending */}
          {totalPendingCount > 1 && (
            <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-xs text-slate-400">
              <span>
                Pending Delivery <strong className="text-amber-300">{activeOrderIndex + 1}</strong> of <strong className="text-amber-300">{totalPendingCount}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveOrderIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeOrderIndex === 0}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveOrderIndex((prev) => Math.min(totalPendingCount - 1, prev + 1))}
                  disabled={activeOrderIndex >= totalPendingCount - 1}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition text-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="p-4 sm:p-5 bg-[#070913] border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
          >
            Review Later / Close
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {totalPendingCount > 1 && (
              <button
                type="button"
                onClick={handleConfirmAll}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-wider transition"
              >
                Confirm All ({totalPendingCount})
              </button>
            )}

            <button
              type="button"
              onClick={() => handleConfirm(currentOrder.id)}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              CONFIRM DELIVERY NOW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
ConfirmDeliveryModal.displayName = 'ConfirmDeliveryModal';
