import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useOMS } from '../lib/store';
import { Order, OutletName, DeliveryType, PaymentType, OrderStatus } from '../types';
import { ITEM_PRESETS } from '../data/mockData';
import { compressImage } from '../lib/imageCompressor';
import { formatTo12Hour } from '../lib/timeUtils';
import {
  X,
  Package,
  Save,
  ImageIcon,
  Check,
  Trash2,
  Edit3,
  Clock,
  Truck,
  DollarSign,
  User,
  MapPin,
  MessageCircle,
  Key,
  Sparkles,
  UserCheck,
  Lock
} from 'lucide-react';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

const OUTLETS: OutletName[] = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, isOpen, onClose }) => {
  const { updateOrder, deleteOrder, partners, orders, session } = useOMS();
  const isOutletUser = session?.role === 'outlet';
  const formRef = useRef<HTMLFormElement>(null);

  // Form State
  const [outlet, setOutlet] = useState<OutletName>('Sector 31');
  const [orderDate, setOrderDate] = useState<string>('');
  const [orderTime, setOrderTime] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [informedBy, setInformedBy] = useState<string>('');
  const [itemType, setItemType] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1 kg');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [expectedDeliveryTime, setExpectedDeliveryTime] = useState<string>('');
  const [totalAmountStr, setTotalAmountStr] = useState<string>('');
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [advanceAmountStr, setAdvanceAmountStr] = useState<string>('');
  const [advanceBillNumber, setAdvanceBillNumber] = useState<string>('');
  const [finalBillNumber, setFinalBillNumber] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [deliveryPartner, setDeliveryPartner] = useState<string>('');
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null);
  const [otp, setOtp] = useState<string>('');
  const [orderNumberStr, setOrderNumberStr] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // Suggestions State
  const [showItemSuggestions, setShowItemSuggestions] = useState<boolean>(false);
  const [itemHighlightIndex, setItemHighlightIndex] = useState<number>(0);

  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<boolean>(false);
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState<number>(0);

  // Focus Refs
  const itemInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const customerWrapperRef = useRef<HTMLDivElement>(null);
  const itemWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerWrapperRef.current && !customerWrapperRef.current.contains(e.target as Node)) {
        setShowCustomerSuggestions(false);
      }
      if (itemWrapperRef.current && !itemWrapperRef.current.contains(e.target as Node)) {
        setShowItemSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Item Suggestions list computation
  const itemSuggestions = useMemo(() => {
    const query = itemType.trim().toLowerCase();

    // From presets
    const presetMatches = ITEM_PRESETS.filter((p) =>
      !query || p.name.toLowerCase().includes(query)
    );

    // From past orders
    const pastItemNames: string[] = Array.from(
      new Set((orders || []).map((o) => o.item_type).filter((x): x is string => Boolean(x)))
    );

    const pastMatches = pastItemNames
      .filter((name) =>
        (!query || name.toLowerCase().includes(query)) &&
        !presetMatches.some((p) => p.name.toLowerCase() === name.toLowerCase())
      )
      .map((name) => {
        const sampleOrder = orders.find((o) => o.item_type === name);
        return {
          name,
          price: sampleOrder?.total_amount || 600
        };
      });

    return [...presetMatches, ...pastMatches].slice(0, 10);
  }, [itemType, orders]);

  // Customer Suggestions list computation
  const matchedCustomers = useMemo(() => {
    if (!mobileNumber.trim() && !customerName.trim()) return [];
    const mob = mobileNumber.trim();
    const name = customerName.toLowerCase().trim();

    const map = new Map<string, { customer_name: string; mobile_number: string; address?: string }>();
    (orders || []).forEach((o) => {
      if (!o.customer_name) return;
      const matchMob = mob.length >= 2 && o.mobile_number.includes(mob);
      const matchName = name.length >= 2 && o.customer_name.toLowerCase().includes(name);
      if (matchMob || matchName) {
        const key = `${o.customer_name.trim()}-${o.mobile_number.trim()}`;
        if (!map.has(key)) {
          map.set(key, { customer_name: o.customer_name, mobile_number: o.mobile_number, address: o.address });
        }
      }
    });
    return Array.from(map.values()).slice(0, 5);
  }, [mobileNumber, customerName, orders]);

  // Populate state when order changes or modal opens
  useEffect(() => {
    if (order && isOpen) {
      setOutlet(order.outlet);
      setOrderDate(order.order_date || '');
      setOrderTime(formatTo12Hour(order.order_time) || order.order_time || '');
      setMobileNumber(order.mobile_number || '');
      setCustomerName(order.customer_name || '');
      setInformedBy(order.informed_by || '');
      setItemType(order.item_type || '');
      setQuantity(order.quantity?.toString() || '1 kg');
      setDeliveryType(order.delivery_type || 'pickup');
      setDeliveryDate(order.delivery_date || '');
      setExpectedDeliveryTime(formatTo12Hour(order.delivery_time_expected) || order.delivery_time_expected || '');
      setTotalAmountStr((order.total_amount ?? 0).toString());
      setPaymentType(order.payment_type || 'full');
      setAdvanceAmountStr((order.advance_amount ?? 0).toString());
      setAdvanceBillNumber(order.advance_bill_number || (order as any).adv_bill_number || (order as any).adv_bill || (order as any).advance_bill || '');
      setFinalBillNumber(order.final_bill_number || (order as any).final_bill_no || (order as any).final_bill || (order as any).bill_number || (order as any).bill_no || (order as any).bill || '');
      setDeliveryAddress(order.address || '');
      setRemarks(order.remarks || '');
      setStatus(order.status || 'pending');
      setDeliveryPartner(order.delivery_partner || '');
      setItemImageUrl(order.item_image_url || null);
      setOtp(order.otp || '');
      setOrderNumberStr(order.order_number ? order.order_number.toString() : '');
    }
  }, [order, isOpen]);

  // Handle Paste (Ctrl+V / Cmd+V) for instant image attachment
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            try {
              setIsCompressing(true);
              const compressedDataUrl = await compressImage(file, 800, 0.8);
              setItemImageUrl(compressedDataUrl);
            } catch (err) {
              console.error('Failed to compress pasted image:', err);
            } finally {
              setIsCompressing(false);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen]);

  // Helper to parse quantity multiplier for total amount calculation
  const getQuantityMultiplier = (qtyStr: string): number => {
    if (!qtyStr) return 1;
    const str = qtyStr.trim().toLowerCase();
    if (str.startsWith('1/2') || str.startsWith('0.5') || str.startsWith('.5')) return 0.5;
    if (str.startsWith('1/4') || str.startsWith('0.25')) return 0.25;
    if (str.startsWith('3/4') || str.startsWith('0.75')) return 0.75;
    const match = str.match(/^([0-9]+(\.[0-9]+)?)/);
    if (match) return parseFloat(match[1]) || 1;
    return 1;
  };

  // Handle Preset Select
  const handleSelectPreset = (preset: { name: string; price: number }) => {
    setItemType(preset.name);
    const multiplier = getQuantityMultiplier(quantity);
    const calculatedTotal = preset.price * multiplier;
    setTotalAmountStr(calculatedTotal.toString());
  };

  // Handle Customer Select
  const handleSelectCustomer = (cust: { customer_name: string; mobile_number: string; address?: string }) => {
    setCustomerName(cust.customer_name);
    setMobileNumber(cust.mobile_number);
    if (cust.address && cust.address !== 'In-Store Pickup') {
      setDeliveryAddress(cust.address);
      setDeliveryType('delivery');
    }
    setShowCustomerSuggestions(false);
    setTimeout(() => {
      itemInputRef.current?.focus();
    }, 50);
  };

  // Keyboard navigation for Item Type input
  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showItemSuggestions) {
        setShowItemSuggestions(true);
        setItemHighlightIndex(0);
      } else {
        setItemHighlightIndex((prev) => (prev + 1) % Math.max(1, itemSuggestions.length));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showItemSuggestions && itemSuggestions.length > 0) {
        setItemHighlightIndex((prev) => (prev - 1 + itemSuggestions.length) % itemSuggestions.length);
      }
      return;
    }

    if ((e.key === 'Tab' || e.key === 'Enter') && showItemSuggestions && itemSuggestions.length > 0) {
      if (itemHighlightIndex >= 0 && itemHighlightIndex < itemSuggestions.length) {
        e.preventDefault();
        const selected = itemSuggestions[itemHighlightIndex];
        handleSelectPreset(selected);
        setShowItemSuggestions(false);
        setTimeout(() => {
          quantityInputRef.current?.focus();
        }, 50);
        return;
      }
    }

    if (e.key === 'Escape') {
      setShowItemSuggestions(false);
    }
  };

  // Keyboard navigation for Mobile / Customer input
  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showCustomerSuggestions) {
        setShowCustomerSuggestions(true);
        setCustomerHighlightIndex(0);
      } else {
        setCustomerHighlightIndex((prev) => (prev + 1) % Math.max(1, matchedCustomers.length));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showCustomerSuggestions && matchedCustomers.length > 0) {
        setCustomerHighlightIndex((prev) => (prev - 1 + matchedCustomers.length) % matchedCustomers.length);
      }
      return;
    }

    if ((e.key === 'Tab' || e.key === 'Enter') && showCustomerSuggestions && matchedCustomers.length > 0) {
      if (customerHighlightIndex >= 0 && customerHighlightIndex < matchedCustomers.length) {
        e.preventDefault();
        handleSelectCustomer(matchedCustomers[customerHighlightIndex]);
        return;
      }
    }

    if (e.key === 'Escape') {
      setShowCustomerSuggestions(false);
    }
  };

  // Remaining balance calculation
  const totalAmountNum = parseFloat(totalAmountStr) || 0;
  const advanceAmountNum = parseFloat(advanceAmountStr) || 0;
  const remainingBalance = useMemo(() => {
    if (paymentType === 'full') return 0;
    if (paymentType === 'due') return totalAmountNum;
    return Math.max(0, totalAmountNum - advanceAmountNum);
  }, [paymentType, totalAmountNum, advanceAmountNum]);

  // Image Upload handler with client-side compression
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedDataUrl = await compressImage(file, 800, 0.8);
      setItemImageUrl(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress image:', err);
      alert('Could not compress image. Please try another file.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (isOutletUser) {
      const isFullPay = paymentType === 'full' || paymentType === 'cash' || paymentType === 'upi' || paymentType === 'online' || (paymentType as string) === 'full_paid';
      const calculatedAdvance = isFullPay ? totalAmountNum : (paymentType === 'due' ? 0 : advanceAmountNum);
      const calculatedRemaining = isFullPay ? 0 : (paymentType === 'due' ? totalAmountNum : Math.max(0, totalAmountNum - calculatedAdvance));
      updateOrder(order.id, {
        status,
        payment_type: paymentType,
        advance_amount: calculatedAdvance,
        remaining_balance: calculatedRemaining,
        due_amount: calculatedRemaining,
        advance_bill_number: advanceBillNumber || undefined,
        final_bill_number: finalBillNumber || undefined,
      });
      onClose();
      return;
    }

    if (!mobileNumber) {
      alert('Please enter mobile number.');
      return;
    }
    if (!itemType) {
      alert('Please enter item type.');
      return;
    }

    const isFullPay = paymentType === 'full' || paymentType === 'cash' || paymentType === 'upi' || paymentType === 'online' || (paymentType as string) === 'full_paid';
    const calculatedAdvance = isFullPay ? totalAmountNum : (paymentType === 'due' ? 0 : advanceAmountNum);
    const calculatedRemaining = isFullPay ? 0 : (paymentType === 'due' ? totalAmountNum : Math.max(0, totalAmountNum - calculatedAdvance));

    const finalOrderNumber = orderNumberStr && !isNaN(Number(orderNumberStr)) && Number(orderNumberStr) > 0
      ? Number(orderNumberStr)
      : order.order_number;

    updateOrder(order.id, {
      order_number: finalOrderNumber,
      outlet,
      order_date: orderDate,
      order_time: formatTo12Hour(orderTime) || orderTime,
      mobile_number: mobileNumber,
      customer_name: customerName.trim() || `Customer #${order.order_number}`,
      informed_by: informedBy || undefined,
      item_type: itemType,
      quantity: quantity || '1 kg',
      delivery_type: deliveryType,
      total_amount: totalAmountNum,
      payment_type: paymentType,
      advance_amount: calculatedAdvance,
      remaining_balance: calculatedRemaining,
      due_amount: calculatedRemaining,
      advance_bill_number: advanceBillNumber || undefined,
      final_bill_number: finalBillNumber || undefined,
      address: deliveryType === 'delivery' ? (deliveryAddress || 'Local Address') : 'In-Store Pickup',
      remarks: remarks || '',
      status,
      delivery_partner: deliveryPartner || undefined,
      delivery_date: deliveryDate,
      delivery_time_expected: formatTo12Hour(expectedDeliveryTime) || expectedDeliveryTime,
      item_image_url: itemImageUrl || undefined,
      otp: otp || undefined
    });

    onClose();
  };

  const handleDelete = () => {
    if (!order) return;
    if (isOutletUser) {
      alert('Outlet staff is not permitted to delete orders.');
      return;
    }
    if (confirm(`Are you sure you want to permanently delete Order #${order.order_number}?`)) {
      deleteOrder(order.id);
      onClose();
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b0d14] border border-indigo-900/50 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto text-slate-200">
        
        {/* Header */}
        <div className="p-5 border-b border-indigo-950/80 flex items-start justify-between gap-4 bg-[#0e101a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Edit Order #{order.order_number}
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Update order details, status, rider assignment, or payment status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          ref={formRef}
          onKeyDown={handleKeyDown}
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
        >
          {/* Outlet Access Alert Banner */}
          {isOutletUser && (
            <div className="bg-amber-950/70 border border-amber-600/80 rounded-xl p-3 text-xs font-bold text-amber-200 flex items-center gap-2.5 shadow-md">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-white block font-extrabold uppercase tracking-wide text-[11px]">
                  Outlet Role Access Restricted
                </span>
                <span className="text-amber-300 font-medium">
                  You can ONLY modify the <strong className="text-white underline">Order Status</strong> and <strong className="text-white underline font-mono">Bill Numbers</strong>. All other order details are view-only.
                </span>
              </div>
            </div>
          )}

          {/* Order Number & Outlet & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Order Number (#)
              </label>
              <input
                type="number"
                disabled={isOutletUser}
                value={orderNumberStr}
                onChange={(e) => setOrderNumberStr(e.target.value)}
                className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-xs text-purple-300 font-black focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder={order.order_number.toString()}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Outlet Location
              </label>
              <select
                value={outlet}
                disabled={isOutletUser}
                onChange={(e) => setOutlet(e.target.value as OutletName)}
                className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {OUTLETS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Order Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-bold uppercase tracking-wide cursor-pointer"
              >
                <option value="pending" className="text-rose-400">PENDING</option>
                <option value="processing" className="text-amber-400">PROCESSING (IN KITCHEN)</option>
                <option value="out_for_delivery" className="text-blue-400">OUT FOR DELIVERY</option>
                <option value="delivered" className="text-emerald-400">DELIVERED</option>
                <option value="on_hold" className="text-purple-400">ON HOLD</option>
                <option value="cancelled" className="text-slate-400">CANCELLED</option>
                <option value="missed" className="text-orange-400">MISSED</option>
              </select>
            </div>
          </div>

          {/* Dates, Times & Order Status */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#111425] p-3.5 rounded-xl border border-indigo-950">
            <div>
              <label className="block text-[11px] font-bold text-purple-300 mb-1">
                Order Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full bg-[#0a0c18] border border-purple-500/80 rounded-lg px-2.5 py-1.5 text-xs text-purple-200 font-extrabold focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                <option value="pending">Pending (लंबित)</option>
                <option value="processing">Processing (तैयार)</option>
                <option value="out_for_delivery">Out for Delivery (निकला)</option>
                <option value="delivered">Delivered (डिलीवर हुआ)</option>
                <option value="on_hold">On Hold (होल पर)</option>
                <option value="cancelled">Cancelled (रद्द)</option>
                <option value="missed">Missed (मिस हुआ)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={orderDate}
                disabled={isOutletUser}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-[#0a0c18] border border-indigo-900/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Order Time
              </label>
              <input
                type="text"
                value={orderTime}
                disabled={isOutletUser}
                onChange={(e) => setOrderTime(e.target.value)}
                placeholder="10:30 AM"
                className="w-full bg-[#0a0c18] border border-indigo-900/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Delivery Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                disabled={isOutletUser}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-[#0a0c18] border border-indigo-900/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Expected Delivery Time
              </label>
              <input
                type="text"
                value={expectedDeliveryTime}
                disabled={isOutletUser}
                onChange={(e) => setExpectedDeliveryTime(e.target.value)}
                placeholder="18:00"
                className="w-full bg-[#0a0c18] border border-indigo-900/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Customer Details & Informed By */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="relative" ref={customerWrapperRef}>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                value={mobileNumber}
                disabled={isOutletUser}
                onChange={(e) => {
                  setMobileNumber(e.target.value);
                  setShowCustomerSuggestions(true);
                  setCustomerHighlightIndex(0);
                }}
                onFocus={() => !isOutletUser && setShowCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                onKeyDown={handleCustomerKeyDown}
                placeholder="e.g. 9876543210"
                required
                className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono disabled:opacity-60 disabled:cursor-not-allowed"
              />

              {/* Customer Auto-Suggestions Dropdown */}
              {!isOutletUser && showCustomerSuggestions && matchedCustomers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#0f1222] border border-indigo-500/50 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-800/60 backdrop-blur-xl">
                  <div className="px-3 py-1.5 bg-indigo-950/60 text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between border-b border-indigo-900/40">
                    <span>Past Customers ({matchedCustomers.length})</span>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowCustomerSuggestions(false);
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  {matchedCustomers.map((c, idx) => {
                    const isHighlighted = idx === customerHighlightIndex;
                    return (
                      <div
                        key={c.mobile_number + idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectCustomer(c);
                        }}
                        onMouseEnter={() => setCustomerHighlightIndex(idx)}
                        className={`px-3.5 py-2 cursor-pointer text-xs flex items-center justify-between transition ${
                          isHighlighted
                            ? 'bg-purple-600 text-white font-bold'
                            : 'hover:bg-indigo-900/50 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <UserCheck className={`w-3.5 h-3.5 ${isHighlighted ? 'text-white' : 'text-purple-400'}`} />
                          <span className="truncate">{c.customer_name}</span>
                        </div>
                        <span className={`text-[11px] font-mono shrink-0 px-2 py-0.5 rounded ${
                          isHighlighted ? 'bg-purple-800 text-white' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {c.mobile_number}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                disabled={isOutletUser}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setShowCustomerSuggestions(true);
                  setCustomerHighlightIndex(0);
                }}
                onFocus={() => !isOutletUser && setShowCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                onKeyDown={handleCustomerKeyDown}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">
                Informed By <span className="text-[10px] font-normal text-slate-400">(Staff / Informer)</span>
              </label>
              <input
                type="text"
                value={informedBy}
                disabled={isOutletUser}
                onChange={(e) => setInformedBy(e.target.value)}
                onFocus={() => {
                  setShowCustomerSuggestions(false);
                  setShowItemSuggestions(false);
                }}
                placeholder="Staff name (not customer)"
                className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3.5 py-2 text-xs text-purple-200 focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Item Description & Quantity */}
          <div className="space-y-2" ref={itemWrapperRef}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Bakery Item / Cake Description *
              </label>
              {!isOutletUser && <span className="text-[10px] text-purple-400">Type to auto-suggest</span>}
            </div>

            {/* Presets Chips */}
            {!isOutletUser && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {ITEM_PRESETS.slice(0, 6).map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-purple-900/60 border border-indigo-800/50 text-indigo-200 transition"
                  >
                    {p.name} (₹{p.price})
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3 relative">
                <input
                  ref={itemInputRef}
                  type="text"
                  value={itemType}
                  disabled={isOutletUser}
                  onChange={(e) => {
                    setItemType(e.target.value);
                    setShowItemSuggestions(true);
                    setItemHighlightIndex(0);
                  }}
                  onFocus={() => !isOutletUser && setShowItemSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowItemSuggestions(false), 200)}
                  onKeyDown={handleItemKeyDown}
                  placeholder="e.g. 1kg Chocolate Truffle Cake, Vanilla Cake..."
                  required
                  className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                />

                {/* Item Auto-Suggestions Floating Dropdown */}
                {!isOutletUser && showItemSuggestions && itemSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#0f1222] border border-purple-500/60 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-800/60 backdrop-blur-xl">
                    <div className="px-3 py-1.5 bg-purple-950/60 text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center justify-between border-b border-purple-900/40">
                      <span>Suggestions ({itemSuggestions.length})</span>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowItemSuggestions(false);
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    {itemSuggestions.map((s, idx) => {
                      const isHighlighted = idx === itemHighlightIndex;
                      return (
                        <div
                          key={s.name + idx}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectPreset(s);
                            setShowItemSuggestions(false);
                            setTimeout(() => quantityInputRef.current?.focus(), 50);
                          }}
                          onMouseEnter={() => setItemHighlightIndex(idx)}
                          className={`px-3.5 py-2 cursor-pointer text-xs flex items-center justify-between transition ${
                            isHighlighted
                              ? 'bg-purple-600 text-white font-bold'
                              : 'hover:bg-indigo-900/50 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Sparkles className={`w-3.5 h-3.5 ${isHighlighted ? 'text-white' : 'text-purple-400'}`} />
                            <span className="truncate">{s.name}</span>
                          </div>
                          <span className={`text-[11px] font-mono font-bold shrink-0 px-2 py-0.5 rounded ${
                            isHighlighted ? 'bg-purple-800 text-white' : 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                          }`}>
                            ₹{s.price.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <input
                  ref={quantityInputRef}
                  type="text"
                  value={quantity}
                  disabled={isOutletUser}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Qty (e.g. 1/2 kg, 1 kg, 2 Pcs)"
                  className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3 py-2.5 text-xs text-white text-center font-bold focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {!isOutletUser && (
                  <div className="mt-1.5 flex flex-wrap gap-1 justify-center">
                    {['1/2 kg', '1 kg', '1.5 kg', '2 kg', '1 Pcs'].map((qp) => (
                      <button
                        key={qp}
                        type="button"
                        onClick={() => setQuantity(qp)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                          quantity === qp
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-indigo-950/70 text-purple-300 border-indigo-900/50 hover:bg-indigo-900/80'
                        }`}
                      >
                        {qp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Type & Address & Rider */}
          <div className="space-y-3 bg-[#111425] p-3.5 rounded-xl border border-indigo-950">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Delivery Type
                </label>
                <select
                  value={deliveryType}
                  disabled={isOutletUser}
                  onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                  className="w-full bg-[#0a0c18] border border-indigo-900/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="delivery">Home Delivery</option>
                  <option value="pickup">Store Pickup</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Delivery Partner (Rider)
                </label>
                <select
                  value={deliveryPartner}
                  disabled={isOutletUser}
                  onChange={(e) => setDeliveryPartner(e.target.value)}
                  className="w-full bg-[#0a0c18] border border-indigo-900/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">-- Unassigned --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {deliveryType === 'delivery' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Delivery Address
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  disabled={isOutletUser}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House #, Sector/Street, Landmark"
                  className="w-full bg-[#0a0c18] border border-indigo-900/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>

          {/* Financials & Payment Status */}
          <div className="p-4 rounded-2xl bg-[#0d1020] border border-indigo-900/80 space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-950 pb-2">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Payment Breakdown
              </span>
              <span className="text-[11px] text-amber-400 font-bold">
                Remaining Due: ₹{remainingBalance.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Total Amount (₹)
                </label>
                <input
                  type="number"
                  value={totalAmountStr}
                  disabled={isOutletUser}
                  onChange={(e) => setTotalAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3 py-2 text-xs text-emerald-400 font-black focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                  <span>Payment Status</span>
                  {isOutletUser && <span className="text-emerald-400 text-[10px] font-normal">(Editable)</span>}
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                  className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="full">PAID FULL (No Balance)</option>
                  <option value="part">PARTIAL ADVANCE</option>
                  <option value="due">PAY ON DELIVERY (Fully Due)</option>
                </select>
              </div>

              {paymentType === 'part' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Advance Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    value={advanceAmountStr}
                    onChange={(e) => setAdvanceAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#12162a] border border-indigo-950 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              )}
            </div>

            {/* Bill Numbers (DYNAMIC & EDITABLE FOR OUTLET USER) */}
            <div className="pt-2 border-t border-indigo-950/80 bg-purple-950/20 p-2.5 rounded-xl border border-purple-900/40">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                  Bill Numbers {isOutletUser && <span className="text-emerald-400 text-[10px] font-normal font-sans">(Editable by Outlet)</span>}
                </span>
              </div>
              {paymentType === 'part' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-300 mb-1 flex items-center justify-between">
                      <span>Advance Bill No. (एडवांस बिल नंबर)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ADV-1024"
                      value={advanceBillNumber}
                      onChange={(e) => setAdvanceBillNumber(e.target.value)}
                      className="w-full bg-[#12162a] border border-amber-500/80 rounded-xl px-3 py-2 text-xs text-amber-200 font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-300 mb-1 flex items-center justify-between">
                      <span>Final Bill No. (फाइनल बिल नंबर)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BILL-9982"
                      value={finalBillNumber}
                      onChange={(e) => setFinalBillNumber(e.target.value)}
                      className="w-full bg-[#12162a] border border-emerald-500/80 rounded-xl px-3 py-2 text-xs text-emerald-200 font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-emerald-300 mb-1 flex items-center justify-between">
                    <span>Bill Number (बिल नंबर)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BILL-9982"
                    value={finalBillNumber}
                    onChange={(e) => setFinalBillNumber(e.target.value)}
                    className="w-full bg-[#12162a] border border-emerald-500/80 rounded-xl px-3 py-2 text-xs text-emerald-200 font-mono font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Remarks & Image Upload & OTP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Remarks / Cake Customization
              </label>
              <textarea
                value={remarks}
                disabled={isOutletUser}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Write 'Happy Birthday Aarav' on top with blue cream"
                rows={3}
                className="w-full bg-[#12162a] border border-indigo-950 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Item Photo & Verification OTP
              </label>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className={`flex-1 ${isOutletUser ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[#1a1e36]'} bg-[#12162a] border border-indigo-950 rounded-xl px-3 py-2 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition`}>
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>{isCompressing ? 'Compressing...' : itemImageUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/60 hidden sm:inline">Ctrl+V</span>
                    {!isOutletUser && (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    )}
                  </label>

                  {itemImageUrl && (
                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-indigo-800 shrink-0">
                      <img src={itemImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-[#12162a] border border-indigo-950 rounded-xl px-3 py-1.5">
                  <Key className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs text-slate-400 font-semibold">Delivery OTP:</span>
                  <input
                    type="text"
                    value={otp}
                    disabled={isOutletUser}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="1234"
                    className="w-20 bg-slate-950 border border-indigo-900 rounded px-2 py-0.5 text-xs text-amber-300 font-mono font-bold text-center focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-3 border-t border-indigo-950 flex flex-col sm:flex-row items-center justify-between gap-3">
            {!isOutletUser ? (
              <button
                type="button"
                onClick={handleDelete}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete Order
              </button>
            ) : (
              <div className="text-[11px] text-slate-500 font-medium italic">
                (Delete restricted for outlet staff)
              </div>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isCompressing}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
