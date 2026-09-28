import React, { useState, useEffect } from 'react';
import { useOMS } from '../lib/store';
import { Order, OrderStatus, PaymentType, DeliveryType } from '../types';
import { X, Save, Palette, Layers, Sparkle } from 'lucide-react';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, isOpen, onClose }) => {
  const { updateOrder, showNotification } = useOMS();

  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [itemType, setItemType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [nameOnCake, setNameOnCake] = useState('');
  // 3 New Fields:
  const [icingColor, setIcingColor] = useState('');
  const [cakeStyle, setCakeStyle] = useState('Normal');
  const [tiers, setTiers] = useState('1');

  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [address, setAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name || '');
      setMobileNumber(order.mobile_number || '');
      setItemType(order.item_type || '');
      setQuantity(String(order.quantity || '1 kg'));
      setNameOnCake(order.name_on_cake || '');
      setIcingColor(order.icing_color || '');
      setCakeStyle(order.cake_style || 'Normal');
      setTiers(order.tiers || '1');
      setDeliveryDate(order.delivery_date || '');
      setDeliveryTime(order.delivery_time_expected || '');
      setTotalAmount(String(order.total_amount || 0));
      setAdvanceAmount(String(order.advance_amount || 0));
      setStatus(order.status || 'pending');
      setPaymentType(order.payment_type || 'full');
      setAddress(order.address || '');
      setRemarks(order.remarks || '');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tot = parseFloat(totalAmount) || 0;
    const adv = parseFloat(advanceAmount) || 0;
    const due = Math.max(0, tot - adv);

    await updateOrder(order.id, {
      customer_name: customerName,
      mobile_number: mobileNumber,
      item_type: itemType,
      quantity,
      name_on_cake: nameOnCake,
      icing_color: icingColor.trim() || undefined,
      cake_style: cakeStyle,
      tiers,
      delivery_date: deliveryDate,
      delivery_time_expected: deliveryTime,
      total_amount: tot,
      advance_amount: adv,
      remaining_balance: due,
      due_amount: due,
      status,
      payment_type: paymentType,
      address,
      remarks
    });

    showNotification(`Order #${order.order_number} updated successfully!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0f1222] border border-indigo-900/60 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 border-b border-indigo-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base">Edit Order #{order.order_number}</span>
            <span className="text-xs text-slate-400">({order.outlet})</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Mobile Number</label>
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Item Type</label>
              <input
                type="text"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Quantity / Weight</label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Name on Cake</label>
            <input
              type="text"
              value={nameOnCake}
              onChange={(e) => setNameOnCake(e.target.value)}
              className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
            />
          </div>

          {/* 3 New Fields in Edit Modal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-indigo-950/20 rounded-xl border border-indigo-900/30">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                <Palette className="w-3 h-3 text-indigo-400" />
                Icing Color / Type
              </label>
              <input
                type="text"
                placeholder="e.g., Chocolate, Red"
                value={icingColor}
                onChange={(e) => setIcingColor(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                <Sparkle className="w-3 h-3 text-purple-400" />
                Cake Style
              </label>
              <select
                value={cakeStyle}
                onChange={(e) => setCakeStyle(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              >
                <option value="Normal">Normal</option>
                <option value="Cutouts">Cutouts</option>
                <option value="3D Character">3D Character</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400" />
                Tiers
              </label>
              <select
                value={tiers}
                onChange={(e) => setTiers(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Total Amount (₹)</label>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Advance Amount (₹)</label>
              <input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Expected Time</label>
              <input
                type="text"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="pt-3 border-t border-indigo-900/40 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
