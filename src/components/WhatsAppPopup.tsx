import React, { useState, useEffect } from 'react';
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

export const WA_TEMPLATES_STORAGE_KEY = 'broomies_wa_templates_v1';

export type WhatsAppTemplateType = 'confirm' | 'dispatch' | 'delivered' | 'reminder' | 'pickup';

export const DEFAULT_WA_TEMPLATES: Record<WhatsAppTemplateType, string> = {
  confirm: `Thank you so much for your recent order from Broomies! Your order number is ({order_number}).

We're thrilled to have the opportunity to serve you and hope you enjoy every delicious bite.

Order Details:
Item: {items}
Name on Cake: {name_on_cake}
Total Amount: ₹{total_amount}
Advance Paid: ₹{advance_amount}
Remaining Balance: ₹{remaining_balance}
Delivery Date: {delivery_date}
Delivery Time: {delivery_time}

If you have any queries or need further assistance, please feel free to get in touch with us at:
9266424088
If still query not solved call 9971860845

Best wishes,
The Broomies Team`,
  dispatch: `Hi {customer_name},

Your Broomies Bakery order #{order_number} ({items}) is out for delivery with our rider {rider_name} from {outlet}.

Delivery OTP for verification: {otp}
Remaining Balance Due: ₹{remaining_balance}

Thank you for ordering from Broomies!`,
  delivered: `Hi {customer_name},

Your Broomies Bakery order #{order_number} ({items}) has been delivered successfully! Thank you for choosing Broomies Bakery. Have a sweet day!

Best wishes,
The Broomies Team`,
  reminder: `Hi {customer_name},

Friendly reminder for your Broomies Bakery order #{order_number} ({items}) scheduled for {delivery_date} at {delivery_time}.

Remaining Due Amount: ₹{remaining_balance}

Please pay via UPI/Cash on delivery.
Thank you!
The Broomies Team`,
  pickup: `Hi {customer_name},

Great news! Your Broomies Bakery Pickup order #{order_number} ({items}) is ready for pickup at our {outlet} outlet.

Remaining Balance Due: ₹{remaining_balance}

Please visit {outlet} counter to collect your order.
Best wishes,
The Broomies Team`
};

export function getSavedWhatsAppTemplates(): Record<WhatsAppTemplateType, string> {
  try {
    const raw = localStorage.getItem(WA_TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_WA_TEMPLATES,
        ...(parsed || {})
      };
    }
  } catch {}
  return { ...DEFAULT_WA_TEMPLATES };
}

export function saveWhatsAppTemplatesLocally(templates: Partial<Record<WhatsAppTemplateType, string>>) {
  try {
    const merged = {
      ...getSavedWhatsAppTemplates(),
      ...templates
    };
    localStorage.setItem(WA_TEMPLATES_STORAGE_KEY, JSON.stringify(merged));
  } catch {}
}

export function renderWhatsAppTemplate(
  type: WhatsAppTemplateType,
  order: Order,
  customTemplates?: Partial<Record<WhatsAppTemplateType, string>>
): string {
  const saved = getSavedWhatsAppTemplates();
  const rawTemplate = customTemplates?.[type] || saved[type] || DEFAULT_WA_TEMPLATES[type];

  const itemDetails = `${order.item_type || 'Bakery Item'}${order.quantity ? ` (${order.quantity})` : ''}`;
  const delDate = order.delivery_date || order.order_date || 'Today';
  const rawTime = order.delivery_time_expected || order.order_time || '06:00 PM';
  const delTime = formatTo12Hour(rawTime) || rawTime;

  const totalVal = Number(order.total_amount) || 0;
  const pType = String(order.payment_type || 'due').toLowerCase().trim();
  const isPaidFull = pType === 'full' || pType === 'full_paid' || pType === 'paid' || pType === 'cash' || pType === 'upi' || pType === 'online';
  const advanceVal = isPaidFull ? totalVal : (pType === 'due' ? 0 : (Number(order.advance_amount) || 0));
  const remainingVal = isPaidFull ? 0 : (pType === 'due' ? totalVal : Math.max(0, totalVal - advanceVal));

  const riderName = order.delivery_partner && order.delivery_partner !== 'Unassigned'
    ? order.delivery_partner
    : 'Broomies Express Rider';

  return rawTemplate
    .replace(/\{order_number\}/g, String(order.order_number))
    .replace(/\{customer_name\}/g, order.customer_name || 'Customer')
    .replace(/\{mobile_number\}/g, order.mobile_number || '')
    .replace(/\{items\}/g, itemDetails)
    .replace(/\{item_type\}/g, order.item_type || 'Bakery Item')
    .replace(/\{quantity\}/g, String(order.quantity || 1))
    .replace(/\{name_on_cake\}/g, order.name_on_cake || '.')
    .replace(/\{outlet\}/g, order.outlet || 'Sector 31')
    .replace(/\{total_amount\}/g, String(totalVal))
    .replace(/\{advance_amount\}/g, String(advanceVal))
    .replace(/\{remaining_balance\}/g, String(remainingVal))
    .replace(/\{delivery_date\}/g, delDate)
    .replace(/\{delivery_time\}/g, delTime)
    .replace(/\{rider_name\}/g, riderName)
    .replace(/\{delivery_partner\}/g, riderName)
    .replace(/\{otp\}/g, order.otp || '1234')
    .replace(/\{address\}/g, order.address || order.delivery_address || 'In-Store Pickup');
}

export function buildWhatsAppConfirmationMessage(order: Order): string {
  return renderWhatsAppTemplate('confirm', order);
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
  const { isWhatsAppConnected, checkWhatsAppStatus, showNotification } = useOMS();
  const [selectedType, setSelectedType] = useState<WhatsAppTemplateType>('confirm');
  const [messageText, setMessageText] = useState(() => (order ? renderWhatsAppTemplate('confirm', order) : ''));
  const [isDirectSending, setIsDirectSending] = useState<boolean>(false);
  const [localConnected, setLocalConnected] = useState<boolean>(isWhatsAppConnected);

  useEffect(() => {
    if (order) {
      setMessageText(renderWhatsAppTemplate(selectedType, order));
    }
  }, [order, selectedType]);

  // Sync latest server templates & connection status on popup open
  useEffect(() => {
    let isMounted = true;
    checkWhatsAppStatus().then((connected) => {
      if (isMounted) setLocalConnected(connected);
    });
    fetch('/api/whatsapp/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isMounted || !data?.config?.templates) return;
        saveWhatsAppTemplatesLocally(data.config.templates);
        if (order) {
          setMessageText(renderWhatsAppTemplate(selectedType, order, data.config.templates));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [checkWhatsAppStatus, order, selectedType]);

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
          type: selectedType
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`⚡ WhatsApp ${selectedType} message dispatched to +${cleanPhone}!`);
        onClose();
      } else {
        showNotification(data.error || 'Queued in Outbox; you can also send via WhatsApp Web.');
      }
    } catch (err: any) {
      showNotification(`Network notice: ${err.message || 'Could not reach server'}`);
    } finally {
      setIsDirectSending(false);
    }
  };

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(messageText).catch(() => {});
    }
    showNotification('WhatsApp message copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b0d14] border border-emerald-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-200 my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/90 to-[#0e121e] border-b border-emerald-900/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Send WhatsApp Message</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                  Order #{order.order_number}
                </span>
              </h3>
              <p className="text-xs text-emerald-400 font-medium">
                {localConnected
                  ? 'Official WhatsApp Linked — 1-Click Auto Dispatch Available'
                  : 'WhatsApp Web / App 1-Click Dispatch'}
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

        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Connection Status Banner */}
          {localConnected ? (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-2">
                  <span>🟢 Official WhatsApp Linked &amp; Active (All Devices)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40">
                    Cloud Synced
                  </span>
                </div>
                <div className="text-emerald-200/80 leading-relaxed">
                  Aapka WhatsApp system me permanently linked hai. Aap yahan se direct <strong>Instant Auto-Send</strong> kar sakte hain, ya WhatsApp Web open kar sakte hain.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-amber-300">
                  ⚠️ Official WhatsApp Linked Nahi Hai (1-Click Manual Send)
                </div>
                <div className="text-amber-200/90 leading-relaxed">
                  Neeche green button par click karke <strong>WhatsApp Web / App se 1-Click message</strong> bhejein.
                </div>
              </div>
            </div>
          )}

          {/* Template Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'confirm', label: 'Order Confirm' },
              { id: 'dispatch', label: 'Out for Delivery / OTP' },
              { id: 'pickup', label: 'Ready for Pickup' },
              { id: 'delivered', label: 'Delivered Thank You' },
              { id: 'reminder', label: 'Payment Reminder' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id as any)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer ${
                  selectedType === t.id
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Recipient info line */}
          <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-400">Recipient:</span>
              <span className="font-mono font-bold text-white">
                +{cleanPhone || order.mobile_number || 'N/A'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>Copy Text</span>
            </button>
          </div>

          {/* Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400">
                Message Content Preview (Uses Your Custom Template)
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
          {order.item_image_url && !order.item_image_url.startsWith('[') && (
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
          <div className="pt-1 space-y-2">
            {localConnected ? (
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
              <button
                type="button"
                onClick={handleSendManual}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-950/80 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98]"
              >
                <Send className="w-4 h-4" />
                <span>Send via WhatsApp Web / App (1-Click)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
