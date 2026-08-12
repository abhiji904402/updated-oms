import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Image as ImageIcon, Phone } from 'lucide-react';
import { Order } from '../types';
import { formatTo12Hour } from '../lib/timeUtils';

interface WhatsAppPopupProps {
  order: Order | null;
  onClose: () => void;
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

export const WhatsAppPopup: React.FC<WhatsAppPopupProps> = ({ order, onClose }) => {
  if (!order) return null;

  const [messageText, setMessageText] = useState(() => buildWhatsAppConfirmationMessage(order));

  useEffect(() => {
    if (order) {
      setMessageText(buildWhatsAppConfirmationMessage(order));
    }
  }, [order]);

  const cleanPhone = formatWhatsAppPhone(order.mobile_number);

  const handleSend = () => {
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    onClose();
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
                  <span>Send WhatsApp Message</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                    Order #{order.order_number} Saved
                  </span>
                </h3>
                <p className="text-xs text-emerald-400 font-medium">
                  Review and send order confirmation directly to customer
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
            {/* Recipient info line */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-slate-400">To:</span>
                <span className="font-mono font-bold text-white">
                  +{cleanPhone || order.mobile_number || 'N/A'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                {order.customer_name}
              </span>
            </div>

            {/* Message Preview */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400">
                Message Preview
              </label>
              <div className="bg-[#060810] border border-emerald-900/50 rounded-xl p-3.5 max-h-56 overflow-y-auto">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={8}
                  className="w-full bg-transparent text-xs font-mono text-emerald-200 leading-relaxed focus:outline-none resize-none whitespace-pre-wrap"
                />
              </div>
            </div>

            {/* Image thumbnail if item_image_url exists */}
            {order.item_image_url && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                <img
                  src={order.item_image_url}
                  alt="Item Thumbnail"
                  className="w-14 h-14 object-cover rounded-lg border border-slate-700 bg-black shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Item Photo Available</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Item photo is stored safely with the order
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition cursor-pointer text-center active:scale-[0.98]"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98]"
              >
                <Send className="w-4 h-4" />
                <span>Send on WhatsApp</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
