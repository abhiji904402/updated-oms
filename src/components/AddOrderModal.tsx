import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useOMS } from '../lib/store';
import { Order, OutletName, DeliveryType, PaymentType } from '../types';
import { ITEM_PRESETS } from '../data/mockData';
import { compressImage } from '../lib/imageCompressor';
import { WhatsAppPopup } from './WhatsAppPopup';
import { formatTo12Hour } from '../lib/timeUtils';
import {
  X,
  Package,
  Save,
  ImageIcon,
  Sparkles,
  Check,
  UserCheck
} from 'lucide-react';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OUTLETS: OutletName[] = ['Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];

export const AddOrderModal: React.FC<AddOrderModalProps> = ({ isOpen, onClose }) => {
  const { orders, addOrder, session } = useOMS();
  const formRef = useRef<HTMLFormElement>(null);

  // Compute Next Order Number dynamically
  const nextOrderNumber = useMemo(() => {
    if (!orders || orders.length === 0) return 1;
    const maxNum = Math.max(...orders.map((o) => o.order_number || 0), 0);
    return maxNum + 1;
  }, [orders]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentTimeStr = useMemo(() => {
    const d = new Date();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  }, []);

  // Form State matching screenshot fields
  const [outlet, setOutlet] = useState<OutletName>(session.outlet || 'Sector 31');
  const [orderDate, setOrderDate] = useState<string>(todayStr);
  const [orderTime, setOrderTime] = useState<string>(currentTimeStr);
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [itemType, setItemType] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1 kg');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [informedBy, setInformedBy] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(todayStr);
  const [expectedDeliveryTime, setExpectedDeliveryTime] = useState<string>('');
  const [totalAmountStr, setTotalAmountStr] = useState<string>('');
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [advanceAmountStr, setAdvanceAmountStr] = useState<string>('');
  const [advanceBillNumber, setAdvanceBillNumber] = useState<string>('');
  const [finalBillNumber, setFinalBillNumber] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // WhatsApp Confirmation Modal State
  const [confirmationOrder, setConfirmationOrder] = useState<Order | null>(null);

  // Suggestions state
  const [showItemSuggestions, setShowItemSuggestions] = useState<boolean>(false);
  const [itemHighlightIndex, setItemHighlightIndex] = useState<number>(-1);

  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<boolean>(false);
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState<number>(-1);

  // Focus & Container Refs
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const itemContainerRef = useRef<HTMLDivElement>(null);
  const customerMobileContainerRef = useRef<HTMLDivElement>(null);
  const customerNameContainerRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close suggestion dropdowns immediately
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (itemContainerRef.current && !itemContainerRef.current.contains(target)) {
        setShowItemSuggestions(false);
        setItemHighlightIndex(-1);
      }
      if (
        customerMobileContainerRef.current &&
        !customerMobileContainerRef.current.contains(target) &&
        customerNameContainerRef.current &&
        !customerNameContainerRef.current.contains(target)
      ) {
        setShowCustomerSuggestions(false);
        setCustomerHighlightIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
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

  // Handle Preset / Item Select
  const handleSelectPreset = (preset: { name: string; price: number }) => {
    setItemType(preset.name);
    const multiplier = getQuantityMultiplier(quantity);
    const calculatedTotal = preset.price * multiplier;
    setTotalAmountStr(calculatedTotal.toString());
    setShowItemSuggestions(false);
    setItemHighlightIndex(-1);
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

    if (e.key === 'Tab' || e.key === 'Enter') {
      if (showItemSuggestions && itemSuggestions.length > 0 && itemHighlightIndex >= 0 && itemHighlightIndex < itemSuggestions.length) {
        e.preventDefault();
        const selected = itemSuggestions[itemHighlightIndex];
        handleSelectPreset(selected);
        setShowItemSuggestions(false);
        setItemHighlightIndex(-1);
        setTimeout(() => {
          quantityInputRef.current?.focus();
        }, 50);
        return;
      } else {
        setShowItemSuggestions(false);
        setItemHighlightIndex(-1);
      }
    }

    if (e.key === 'Escape') {
      setShowItemSuggestions(false);
      setItemHighlightIndex(-1);
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

    if (e.key === 'Tab' || e.key === 'Enter') {
      if (showCustomerSuggestions && matchedCustomers.length > 0 && customerHighlightIndex >= 0 && customerHighlightIndex < matchedCustomers.length) {
        e.preventDefault();
        handleSelectCustomer(matchedCustomers[customerHighlightIndex]);
        setShowCustomerSuggestions(false);
        setCustomerHighlightIndex(-1);
        return;
      } else {
        setShowCustomerSuggestions(false);
        setCustomerHighlightIndex(-1);
      }
    }

    if (e.key === 'Escape') {
      setShowCustomerSuggestions(false);
      setCustomerHighlightIndex(-1);
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

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setOutlet(session.outlet || 'Sector 31');
      setOrderDate(todayStr);
      setOrderTime(currentTimeStr);
      setMobileNumber('');
      setCustomerName('');
      setItemType('');
      setQuantity('1 kg');
      setDeliveryType('pickup');
      setInformedBy('');
      setDeliveryDate(todayStr);
      setExpectedDeliveryTime('');
      setTotalAmountStr('');
      setPaymentType('full');
      setAdvanceAmountStr('');
      setAdvanceBillNumber('');
      setFinalBillNumber('');
      setDeliveryAddress('');
      setRemarks('');
      setItemImageUrl(null);
    }
  }, [isOpen, session.outlet, todayStr, currentTimeStr]);

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

  // Keyboard Navigation: Enter moves to next input field, Ctrl+Enter saves
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }

    if (e.key === 'Enter' && e.target instanceof HTMLElement) {
      const tagName = e.target.tagName.toLowerCase();
      if (tagName === 'textarea' || tagName === 'button') return;

      e.preventDefault();
      const form = formRef.current;
      if (!form) return;

      const focusable = Array.from(
        form.querySelectorAll('input, select, textarea, button[type="submit"]')
      ).filter((el) => {
        const htmlEl = el as HTMLElement;
        return !htmlEl.hasAttribute('disabled') && htmlEl.tabIndex !== -1;
      }) as HTMLElement[];

      setShowCustomerSuggestions(false);
      setShowItemSuggestions(false);
      setCustomerHighlightIndex(-1);
      setItemHighlightIndex(-1);

      const index = focusable.indexOf(e.target as HTMLElement);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    }
  };

  const resetForm = () => {
    setMobileNumber('');
    setCustomerName('');
    setItemType('');
    setQuantity('1 kg');
    setDeliveryType('pickup');
    setInformedBy('');
    setDeliveryDate(todayStr);
    setExpectedDeliveryTime('');
    setTotalAmountStr('');
    setPaymentType('full');
    setAdvanceAmountStr('');
    setAdvanceBillNumber('');
    setFinalBillNumber('');
    setDeliveryAddress('');
    setRemarks('');
    setItemImageUrl(null);
    setShowItemSuggestions(false);
    setShowCustomerSuggestions(false);
  };

  const handleCloseDataEntryCard = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!outlet) {
      alert('Please select an outlet.');
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

    // Derive final customer name from informedBy or customerName or phone
    const finalCustomerName = customerName.trim() || informedBy.trim() || `Customer #${nextOrderNumber}`;

    const newOrder = addOrder({
      outlet,
      order_date: orderDate || todayStr,
      order_time: formatTo12Hour(orderTime || currentTimeStr) || currentTimeStr,
      mobile_number: mobileNumber,
      customer_name: finalCustomerName,
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
      status: 'pending',
      delivery_date: deliveryDate || todayStr,
      delivery_time_expected: formatTo12Hour(expectedDeliveryTime) || '11:00 AM',
      item_image_url: itemImageUrl || undefined
    });

    // Set saved order into state to trigger WhatsApp confirmation popup
    setConfirmationOrder(newOrder);

    // Reset data entry form & close input card
    resetForm();
    onClose();
  };

  if (!isOpen && !confirmationOrder) return null;

  return (
    <>
      {/* Data Entry Card Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0b0d14] border border-indigo-900/50 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto text-slate-200">
            
            {/* Header */}
            <div className="p-5 border-b border-indigo-950/80 flex items-start justify-between gap-4 bg-[#0e101a]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>Create New Order</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/50">
                      OMS
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Fill order details below to save into system
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-purple-950/80 border border-purple-500/30 rounded-xl px-3 py-1 text-right">
                  <div className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Order No.</div>
                  <div className="text-base font-black text-white font-mono leading-none">
                    #{nextOrderNumber}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseDataEntryCard}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Body */}
        <form
          ref={formRef}
          onKeyDown={handleKeyDown}
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
        >
          {/* Order Number Banner */}
          <div className="bg-[#121524] border border-indigo-900/40 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl font-black text-purple-500/60 leading-none">#</span>
            <div>
              <div className="text-xs font-semibold text-slate-400">Order Number (Auto)</div>
              <div className="text-2xl font-black text-purple-400 tracking-wide mt-0.5">
                #{nextOrderNumber}
              </div>
            </div>
          </div>

          {/* Grid Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
            
            {/* Select Outlet * */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Select Outlet <span className="text-purple-400">*</span>
              </label>
              <select
                value={session.role === 'outlet' ? (session.outlet || outlet) : outlet}
                disabled={session.role === 'outlet'}
                onChange={(e) => setOutlet(e.target.value as OutletName)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
                required
              >
                <option value="" disabled>Choose outlet</option>
                {OUTLETS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Date * */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Order Date <span className="text-purple-400">*</span>
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
                required
              />
            </div>

            {/* Order Time */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Order Time
              </label>
              <input
                type="text"
                placeholder="04:50 pm"
                value={orderTime}
                onChange={(e) => setOrderTime(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              />
            </div>

            {/* Mobile / Phone Number * */}
            <div ref={customerMobileContainerRef} className="relative">
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>Mobile / Phone Number <span className="text-purple-400">*</span></span>
                <span className="text-[10px] text-amber-400 font-normal">Mandatory (जरूरी)</span>
              </label>
              <input
                ref={mobileInputRef}
                type="tel"
                placeholder="Enter 10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => {
                  setMobileNumber(e.target.value);
                  setShowCustomerSuggestions(true);
                  setCustomerHighlightIndex(-1);
                }}
                onFocus={() => setShowCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                onKeyDown={handleCustomerKeyDown}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
                required
              />

              {/* Customer Auto-Suggestions Dropdown */}
              {showCustomerSuggestions && matchedCustomers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#0f1222] border border-indigo-500/50 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-800/60 backdrop-blur-xl">
                  <div className="px-3 py-1.5 bg-indigo-950/60 text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between border-b border-indigo-900/40">
                    <span>Past Customers ({matchedCustomers.length})</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-normal hidden sm:inline">↑↓ navigate • Tab/Enter select</span>
                      <button
                        type="button"
                        onClick={() => setShowCustomerSuggestions(false)}
                        className="text-indigo-400 hover:text-white text-[10px] font-bold underline cursor-pointer px-1 py-0.5 rounded bg-indigo-900/50"
                      >
                        ✕ Close
                      </button>
                    </div>
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

            {/* Customer Name (Optional) */}
            <div ref={customerNameContainerRef} className="relative">
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>Customer Name</span>
                <span className="text-[10px] text-slate-400 font-normal">(Optional / ऐच्छिक)</span>
              </label>
              <input
                ref={customerNameInputRef}
                type="text"
                placeholder="Enter customer name (optional)"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setShowCustomerSuggestions(true);
                  setCustomerHighlightIndex(-1);
                }}
                onFocus={() => setShowCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                onKeyDown={handleCustomerKeyDown}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              />
            </div>

            {/* Item Type * */}
            <div ref={itemContainerRef} className="relative">
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>Item Type <span className="text-purple-400">*</span></span>
                <span className="text-[10px] text-purple-400 font-normal">Type to auto-suggest</span>
              </label>
              <input
                ref={itemInputRef}
                type="text"
                placeholder="e.g. Vanilla Cake, Pastry, Truffle..."
                value={itemType}
                onChange={(e) => {
                  setItemType(e.target.value);
                  setShowItemSuggestions(true);
                  setItemHighlightIndex(-1);
                }}
                onFocus={() => setShowItemSuggestions(true)}
                onBlur={() => setTimeout(() => setShowItemSuggestions(false), 200)}
                onKeyDown={handleItemKeyDown}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
                required
              />

              {/* Item Auto-Suggestions Floating Dropdown */}
              {showItemSuggestions && itemSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#0f1222] border border-purple-500/60 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-800/60 backdrop-blur-xl">
                  <div className="px-3 py-1.5 bg-purple-950/60 text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center justify-between border-b border-purple-900/40">
                    <span>Suggestions ({itemSuggestions.length})</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-normal hidden sm:inline">↑↓ navigate • Tab/Enter select</span>
                      <button
                        type="button"
                        onClick={() => setShowItemSuggestions(false)}
                        className="text-purple-300 hover:text-white text-[10px] font-bold underline cursor-pointer px-1 py-0.5 rounded bg-purple-900/50"
                      >
                        ✕ Close
                      </button>
                    </div>
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

              {/* Quick Item Presets */}
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                {ITEM_PRESETS.slice(0, 5).map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="px-2 py-0.5 rounded-md bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-900/40 text-[11px] text-slate-300 transition"
                  >
                    + {p.name} (₹{p.price})
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity / Weight / Pcs */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>Quantity / Weight</span>
                <span className="text-[10px] text-purple-400 font-normal">e.g. 1/2 kg, 1 kg, 2 Pcs</span>
              </label>
              <input
                ref={quantityInputRef}
                type="text"
                placeholder="e.g. 1/2 kg, 1 kg, 2 Pcs, 500g..."
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onFocus={() => {
                  setShowCustomerSuggestions(false);
                  setShowItemSuggestions(false);
                }}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-semibold focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              />
              {/* Quick Weight & Unit Presets */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['1/2 kg', '1 kg', '1.5 kg', '2 kg', '3 kg', '1 Pcs', '2 Pcs'].map((qPreset) => (
                  <button
                    key={qPreset}
                    type="button"
                    onClick={() => setQuantity(qPreset)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition border ${
                      quantity === qPreset
                        ? 'bg-purple-600 text-white border-purple-400 shadow'
                        : 'bg-indigo-950/60 hover:bg-indigo-900/80 text-purple-300 border-indigo-900/40'
                    }`}
                  >
                    {qPreset}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Type * */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Delivery Type <span className="text-purple-400">*</span>
              </label>
              <select
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>

            {/* Informed By */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Informed By <span className="text-xs font-normal text-purple-400">(Staff / Informer Name)</span>
              </label>
              <div className="text-[11px] text-slate-400 mb-1.5">
                Jis bande ne order inform/place kiya (Not Customer Name)
              </div>
              <input
                type="text"
                placeholder="e.g. Ramesh (Counter Staff), Manager Vijay, Zomato Agent..."
                value={informedBy}
                onChange={(e) => setInformedBy(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              />
            </div>

            {/* Delivery Date */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Delivery Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              />
            </div>

            {/* Expected Delivery Time */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Expected Delivery Time
              </label>
              <input
                type="time"
                value={expectedDeliveryTime}
                onChange={(e) => setExpectedDeliveryTime(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              />
            </div>

            {/* Total Amount * */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Total Amount <span className="text-purple-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder="Amount"
                  value={totalAmountStr}
                  onChange={(e) => setTotalAmountStr(e.target.value)}
                  className="w-full bg-[#121524] border border-indigo-950 rounded-xl pl-8 pr-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
                  required
                />
              </div>
            </div>

            {/* Payment Type * */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Payment Type <span className="text-purple-400">*</span>
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              >
                <option value="full">Full Paid</option>
                <option value="part">Part Payment</option>
                <option value="due">Due / Collect on Delivery</option>
              </select>
            </div>

            {/* Conditional Part Payment fields */}
            {paymentType === 'part' && (
              <>
                <div>
                  <label className="block text-amber-300 font-semibold mb-1.5">
                    Advance Paid (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Advance Amount"
                    value={advanceAmountStr}
                    onChange={(e) => setAdvanceAmountStr(e.target.value)}
                    className="w-full bg-[#121524] border border-amber-900/60 rounded-xl px-3.5 py-2.5 text-amber-200 text-sm focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-rose-400 font-semibold mb-1.5">
                    Remaining Balance
                  </label>
                  <div className="bg-[#121524] border border-rose-900/60 rounded-xl px-3.5 py-2.5 text-rose-300 font-bold text-sm">
                    ₹{remainingBalance.toFixed(2)}
                  </div>
                </div>
              </>
            )}

            {/* Bill Numbers Section (Dynamic by Payment Type, All Optional) */}
            <div className="sm:col-span-2 bg-[#101321] p-3.5 rounded-xl border border-indigo-950/80 space-y-2">
              {paymentType === 'part' ? (
                <>
                  <div className="text-[11px] font-bold text-amber-400 flex items-center justify-between border-b border-indigo-950 pb-1.5">
                    <span>Part Payment Bills (पार्ट पेमेंट पर 2 बिल नंबर विकल्प)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional (ऐच्छिक)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-amber-300 font-semibold mb-1 text-[11px] flex items-center justify-between">
                        <span>Advance Bill No. (एडवांस बिल नंबर)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ADV-1024 (Optional)"
                        value={advanceBillNumber}
                        onChange={(e) => setAdvanceBillNumber(e.target.value)}
                        className="w-full bg-[#121524] border border-amber-900/60 rounded-xl px-3 py-2 text-amber-200 text-xs focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-emerald-300 font-semibold mb-1 text-[11px] flex items-center justify-between">
                        <span>Final Bill No. (फाइनल बिल नंबर)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BILL-9982 (Optional)"
                        value={finalBillNumber}
                        onChange={(e) => setFinalBillNumber(e.target.value)}
                        className="w-full bg-[#121524] border border-emerald-900/60 rounded-xl px-3 py-2 text-emerald-200 text-xs focus:outline-none focus:border-emerald-400 font-mono"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-emerald-300 font-semibold mb-1 text-[11px] flex items-center justify-between">
                    <span>Bill Number (बिल नंबर)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional (ऐच्छिक)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BILL-9982 (Optional)"
                    value={finalBillNumber}
                    onChange={(e) => setFinalBillNumber(e.target.value)}
                    className="w-full bg-[#121524] border border-emerald-900/60 rounded-xl px-3 py-2 text-emerald-200 text-xs focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Conditional Delivery Address if delivery */}
            {deliveryType === 'delivery' && (
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Delivery Address <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter full delivery address, house no., sector, landmark..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
                />
              </div>
            )}

            {/* Past customer suggestion auto-fill helper */}
            {matchedCustomers.length > 0 && (
              <div className="sm:col-span-2 p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl space-y-1.5">
                <div className="text-[11px] text-indigo-300 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Auto-suggest: Click past customer to fill info
                </div>
                <div className="flex flex-wrap gap-2">
                  {matchedCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerName(c.customer_name);
                        setMobileNumber(c.mobile_number);
                        if (c.address && c.address !== 'In-Store Pickup') {
                          setDeliveryAddress(c.address);
                          setDeliveryType('delivery');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/50 text-xs text-indigo-200 flex items-center gap-1.5 transition"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                      <span>{c.customer_name}</span>
                      <span className="text-indigo-400 font-mono">({c.mobile_number})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Remarks */}
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1.5">
                Remarks
              </label>
              <textarea
                placeholder="Any special instructions..."
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-[#121524] border border-indigo-950 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition"
              />
            </div>

            {/* Item Photo (Optional) */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-slate-300 font-semibold">
                Item Photo (Optional)
              </label>

              <div className="relative border border-dashed border-indigo-900/60 hover:border-purple-500/60 bg-[#101321] rounded-xl p-6 text-center cursor-pointer transition group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />

                {itemImageUrl ? (
                  <div className="flex items-center justify-center gap-4">
                    <img
                      src={itemImageUrl}
                      alt="Uploaded Item"
                      className="w-16 h-16 object-cover rounded-xl border border-purple-500/40 shadow-md"
                    />
                    <div className="text-left">
                      <div className="text-sm font-bold text-purple-300 flex items-center gap-1">
                        <Check className="w-4 h-4 text-emerald-400" /> Photo Attached
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">Click or drag new image to replace</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-900/50 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition">
                      <ImageIcon className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-sm font-semibold text-slate-200 mt-1">
                      {isCompressing ? 'Compressing photo...' : 'Drag & drop or click to upload'}
                    </div>
                    <div className="text-xs text-purple-400 font-medium flex items-center justify-center gap-1 mt-0.5">
                      <span>Item photo (optional)</span>
                      <span>•</span>
                      <span className="bg-purple-950/80 text-purple-300 border border-purple-800/60 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">Ctrl+V / Cmd+V to paste image</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Save Order Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-950/60 flex items-center justify-center gap-2 transition active:scale-[0.99]"
            >
              <Save className="w-4 h-4" />
              Save Order
            </button>
          </div>

        </form>
      </div>
    </div>
  )}

      {/* WhatsApp Confirmation Popup Modal */}
      <WhatsAppPopup
        order={confirmationOrder}
        onClose={() => setConfirmationOrder(null)}
      />
    </>
  );
};
