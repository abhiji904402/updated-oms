import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  X,
  Send,
  Image as ImageIcon,
  Phone,
  Copy,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Loader2
} from 'lucide-react';
import { Order } from '../types';
import { formatTo12Hour } from '../lib/timeUtils';
import { useOMS } from '../lib/store';

interface WhatsAppPopupProps {
  order: Order | null;
  onClose: () => void;
  onOpenQRScanner?: () => void;
}

export function buildWhatsAppConfirmationMessage(order: Order): string {
  const itemDetails = `${order.item_type || ''}${order.quantity ? ` (${order.quantity})` : ''}`;
  const delDate = order.delivery_date || order.order_date || 'Today';
  const rawTime = order.delivery_time_expected || order.order_time || '11:00 AM';
  const delTime = formatTo12Hour(rawTime) || rawTime;

  const totalVal = order.total_amount ?? 0;
  const advanceVal = order.advance_amount ?? 0;
  const remainingVal = order.remaining_balance ?? 0;

  let msg = `Thank you so much for your recent order from Broomies! Your order number is (${order.order_number}).\n\n`;
  msg += `We're thrilled to have the opportunity to serve you and hope you enjoy every delicious bite.\n\n`;
  msg += `Order Details:\n`;
  msg += `Item: ${itemDetails}\n`;
  if (order.name_on_cake) {
    msg += `Name on Cake: ${order.name_on_cake}\n`;
  }
  msg += `Total Amount: ₹${totalVal}\n`;
  msg += `Advance Paid: ₹${advanceVal}\n`;
  msg += `Remaining Balance: ₹${remainingVal}\n`;
  msg += `Delivery Date: ${delDate}\n`;
  msg += `Delivery Time: ${delTime}\n`;

  msg += `\nIf you have any queries or need further assistance, please feel free to get in touch with us at:\n`;
  msg += `9266424088\n`;
  msg += `If still query not solved call 9971860845\n\n`;
  msg += `Best wishes,\nThe Broomies Team`;

  return msg;
}

export function formatWhatsAppPhone(mobileNumber?: string): string {
  const raw = mobileNumber || '';
  let clean = raw.replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  } else if (clean.length > 10 && !clean.startsWith('91')) {
    clean = '91' + clean.slice(-10);
  }
  return clean;
}

export const WhatsAppPopup: React.FC<WhatsAppPopupProps> = ({ order, onClose, onOpenQRScanner }) => {
  const { isWhatsAppConnected, checkWhatsAppStatus, showNotification } = useOMS();
  const [messageText, setMessageText] = useState(() => order ? buildWhatsAppConfirmationMessage(order) : "");
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isDirectSending, setIsDirectSending] = useState<boolean>(false);
  const [localConnected, setLocalConnected] = useState<boolean>(isWhatsAppConnected);

  useEffect(() => {
    if (order) {
      setMessageText(buildWhatsAppConfirmationMessage(order));
    }
  }, [order]);

  // Check live status on popup open
  useEffect(() => {
    let isMounted = true;
    setIsChecking(true);
    checkWhatsAppStatus()
      .then((connected) => {
        if (isMounted) setLocalConnected(connected);
      })
      .finally(() => {
        if (isMounted) setIsChecking(false);
      });
    return () => {
      isMounted = false;
    };
  }, [checkWhatsAppStatus]);

  if (!order) return null;
  const cleanPhone = formatWhatsAppPhone(order.mobile_number);

  const handleSendManual = () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const waUrl = isMobile
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    onClose();
  };

  const handleDirectAutoSend = async () => {
    try {
      setIsDirectSending(true);
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: order.mobile_number,
          message: messageText,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          orderId: order.id,
          type: 'confirm'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`⚡ WhatsApp confirmation message dispatched directly to +${cleanPhone}!`);
        onClose();
      } else {
        alert(data.error || 'Failed to dispatch via connected WhatsApp socket. You can send manually via WhatsApp Web.');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message || 'Could not reach server'}`);
    } finally {
      setIsDirectSending(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    alert('Message copied to clipboard!');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="bg-[#0b0d14] border border-emerald-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-200 my-auto"
        >
          {/* Header (green themed) */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/90 to-[#0e121e] border-b border-emerald-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>Send WhatsApp Confirmation</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                    Order #{order.order_number}
                  </span>
                </h3>
                <p className="text-xs text-emerald-400 font-medium">
                  {localConnected
                    ? 'Official WhatsApp Linked — 1-Click Auto Dispatch Available'
                    : 'WhatsApp Not Linked — Manual WhatsApp Web Dispatch'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Connection Status Banner */}
            {localConnected ? (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-bold text-emerald-300 flex items-center gap-2">
                    <span>🟢 Official WhatsApp Linked & Active (All Devices)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40">
                      Already Logged In
                    </span>
                  </div>
                  <div className="text-emerald-200/80 leading-relaxed">
                    Aapka WhatsApp system me permanently linked hai. Aap yahan se direct <strong>Instant Auto-Send</strong> kar sakte hain, ya WhatsApp Web se open kar sakte hain.
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-bold text-amber-300">
                    ⚠️ Official WhatsApp Linked Nahi Hai (Manual Send Karein)
                  </div>
                  <div className="text-amber-200/90 leading-relaxed">
                    App me WhatsApp link na hone ki wajah se customer ko automatic message nahi gaya. Kripya neeche green button par click karke <strong>WhatsApp Web / App se manual message</strong> bhejein.
                  </div>
                </div>
              </div>
            )}

            {/* Recipient info line */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-slate-400">Recipient:</span>
                <span className="font-mono font-bold text-white">
                  +{cleanPhone || order.mobile_number || 'N/A'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                {order.customer_name} ({order.outlet})
              </span>
            </div>

            {/* Message Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Message Content Preview
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Editable</span>
              </div>
              <div className="bg-[#060810] border border-emerald-900/50 rounded-xl p-3.5 max-h-52 overflow-y-auto">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={7}
                  className="w-full bg-transparent text-xs font-mono text-emerald-200 leading-relaxed focus:outline-none resize-none whitespace-pre-wrap"
                />
              </div>
            </div>

            {/* Image thumbnail if item_image_url exists */}
            {order.item_image_url && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3">
                <img
                  src={order.item_image_url}
                  alt="Item Thumbnail"
                  className="w-12 h-12 object-cover rounded-lg border border-slate-700 bg-black shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Item Photo Attached</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Order photo is stored safely with the order
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              {localConnected ? (
                /* When WhatsApp IS linked */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDirectAutoSend}
                    disabled={isDirectSending}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  >
                    {isDirectSending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Direct Send via Linked WA</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendManual}
                    className="w-full py-2.5 px-3 rounded-xl border border-emerald-700/60 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open WhatsApp Web</span>
                  </button>
                </div>
              ) : (
                /* When WhatsApp IS NOT linked */
                <button
                  type="button"
                  onClick={handleSendManual}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-950/80 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98] animate-pulse"
                >
                  <Send className="w-4 h-4" />
                  <span>Send via WhatsApp Web / App (1-Click)</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Message</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs transition cursor-pointer text-center active:scale-[0.98]"
                >
                  Skip / Close
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
