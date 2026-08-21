import React, { useState, useMemo, useEffect } from 'react';
import { useOMS } from '../lib/store';
import { Order, DeliveryPartner } from '../types';
import { compressImage } from '../lib/imageCompressor';
import { sortOrdersByDeliveryPriority, getCountdownInfo, formatTo12Hour } from '../lib/timeUtils';
import { matchesOutlet, formatOutletDisplayName, isOrderForToday } from '../lib/outletUtils';
import { getDeliveredByDisplayName } from '../lib/orderLogic';
import {
  Truck,
  Phone,
  MapPin,
  CheckCircle,
  Key,
  Camera,
  MessageCircle,
  Clock,
  DollarSign,
  AlertCircle,
  Plus,
  Trash2,
  Package,
  UserCheck,
  Search,
  ShieldCheck,
  X,
  ShoppingBag,
  Sparkles,
  Radio
} from 'lucide-react';

export const DeliveryDashboard = React.memo(() => {
  const {
    orders = [],
    partners = [],
    session,
    switchRole,
    markDelivered,
    addPartner,
    deletePartner
  } = useOMS();

  const safeOrders = orders || [];
  const safePartners = partners || [];

  const [activePartnerId, setActivePartnerId] = useState<string>(
    session.deliveryPartnerId || safePartners[0]?.id || ''
  );

  const activePartner = useMemo(() => {
    return safePartners.find((p) => p.id === activePartnerId) || safePartners[0];
  }, [safePartners, activePartnerId]);

  const [activeTab, setActiveTab] = useState<'queue' | 'delivered_products' | 'manage_partners'>('queue');
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');
  const [deliveredSearch, setDeliveredSearch] = useState<string>('');
  const [queueSearch, setQueueSearch] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [queueScope, setQueueScope] = useState<'all' | 'my'>('all');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('ALL');
  const [selectedDateScope, setSelectedDateScope] = useState<'today' | 'all'>('today');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const mainOutlets = useMemo(() => {
    const base = ['ALL', 'Sector 31', 'Sector 35', 'Sector 42', 'Sector 88'];
    const found = new Set<string>(base);
    safeOrders.forEach((o) => {
      if (o.outlet) {
        const formatted = formatOutletDisplayName(o.outlet);
        if (formatted) found.add(formatted);
      }
    });
    return Array.from(found);
  }, [safeOrders]);

  // Search Autocomplete Suggestions for Riders
  const searchSuggestions = useMemo(() => {
    if (!queueSearch.trim()) return [];
    const q = queueSearch.toLowerCase().trim().replace('#', '');
    return safeOrders.filter((o) => {
      const matchNum = o.order_number.toString().includes(q);
      const matchCust = (o.customer_name || '').toLowerCase().includes(q);
      const matchPhone = (o.mobile_number || '').includes(q);
      const matchItem = (o.item_type || '').toLowerCase().includes(q);
      return matchNum || matchCust || matchPhone || matchItem;
    }).slice(0, 6);
  }, [safeOrders, queueSearch]);

  // Selected order modal for delivery execution
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add partner modal state
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');
  const [newPartnerLoginId, setNewPartnerLoginId] = useState('');
  const [newPartnerVehicle, setNewPartnerVehicle] = useState('Bike');
  const [newPartnerAvatar, setNewPartnerAvatar] = useState('');
  const [deletingPartnerId, setDeletingPartnerId] = useState<string | null>(null);
  const [createPartnerError, setCreatePartnerError] = useState<string | null>(null);

  const isConfirmedDelivered = (o: Order) => o.status === 'delivered' && !o.delivery_confirmation_pending;

  // Active deliveries filterable by outlet, date (today vs all), scope & search
  const activeDeliveries = useMemo(() => {
    const list = safeOrders.filter((o) => {
      if (isConfirmedDelivered(o) || o.status === 'cancelled') return false;

      // 1. Outlet Tab Filter
      if (selectedOutlet !== 'ALL' && !matchesOutlet(o.outlet, selectedOutlet)) {
        return false;
      }

      // 2. Date Scope Filter (Today vs All Dates)
      if (selectedDateScope === 'today') {
        if (!isOrderForToday(o, todayStr)) return false;
      }

      // 3. Scope filter: My Assigned vs All Deliveries
      if (queueScope === 'my' && activePartner?.name) {
        if (o.delivery_partner !== activePartner.name) return false;
      }

      // 4. Search filter by Order ID, Customer Name, Mobile, Item, Outlet, Address
      if (queueSearch.trim()) {
        const q = queueSearch.toLowerCase().trim();
        const matchNum = o.order_number.toString().includes(q);
        const matchCust = (o.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (o.mobile_number || '').includes(q);
        const matchItem = (o.item_type || '').toLowerCase().includes(q);
        const matchOutlet = (o.outlet || '').toLowerCase().includes(q);
        const matchAddr = (o.address || '').toLowerCase().includes(q);
        const matchRider = (o.delivery_partner || '').toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchPhone && !matchItem && !matchOutlet && !matchAddr && !matchRider) {
          return false;
        }
      }

      return true;
    });

    return sortOrdersByDeliveryPriority(list);
  }, [safeOrders, selectedOutlet, selectedDateScope, todayStr, queueScope, queueSearch, activePartner]);

  // Delivered Products filterable by Partner
  const deliveredOrders = useMemo(() => {
    return safeOrders.filter((o) => {
      if (!isConfirmedDelivered(o)) return false;

      // Filter by Partner
      if (partnerFilter !== 'ALL') {
        const targetPartner = safePartners.find((p) => p.id === partnerFilter);
        if (targetPartner && o.delivery_partner !== targetPartner.name) {
          return false;
        }
      }

      // Search filter
      if (deliveredSearch) {
        const q = deliveredSearch.toLowerCase();
        const matchNum = o.order_number.toString().includes(q);
        const matchItem = o.item_type.toLowerCase().includes(q);
        const matchCust = o.customer_name.toLowerCase().includes(q);
        const matchRider = (o.delivery_partner || '').toLowerCase().includes(q);
        if (!matchNum && !matchItem && !matchCust && !matchRider) return false;
      }

      return true;
    });
  }, [safeOrders, partnerFilter, deliveredSearch, safePartners]);

  // Handle Photo Proof Capture
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedDataUrl = await compressImage(file, 800, 0.8);
      setProofPhotoUrl(compressedDataUrl);
      setErrorMessage(null);
    } catch (err) {
      console.error('Failed to compress proof image', err);
      setErrorMessage('Image upload failed. Please try again.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Handle Submit Order Delivery
  const handleConfirmDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const result = markDelivered(selectedOrder.id, proofPhotoUrl || undefined, otpInput);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    setSelectedOrder(null);
    setOtpInput('');
    setProofPhotoUrl(null);
    setErrorMessage(null);
  };

  // Handle Create New Delivery Partner
  const handleCreatePartner = (e: React.FormEvent) => {
    e.preventDefault();
    setCreatePartnerError(null);
    if (!newPartnerName.trim() || !newPartnerPhone.trim()) {
      setCreatePartnerError('Please enter both partner name and phone number.');
      return;
    }

    const avatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
    ];

    addPartner({
      name: newPartnerName.trim(),
      phone: newPartnerPhone.trim(),
      login_id: newPartnerLoginId.trim() || `rider_${Date.now().toString().slice(-4)}`,
      status: 'available',
      vehicle: newPartnerVehicle || 'Bike',
      avatar: newPartnerAvatar.trim() || avatars[Math.floor(Math.random() * avatars.length)]
    });

    // Reset Form
    setNewPartnerName('');
    setNewPartnerPhone('');
    setNewPartnerLoginId('');
    setNewPartnerVehicle('Bike');
    setNewPartnerAvatar('');
    setCreatePartnerError(null);
    setIsAddPartnerOpen(false);
  };

  // Handle Confirm Delete Partner
  const handleConfirmDeletePartner = (id: string) => {
    deletePartner(id);
    setDeletingPartnerId(null);
    if (activePartnerId === id) {
      const remaining = safePartners.filter((p) => p.id !== id);
      if (remaining.length > 0) {
        setActivePartnerId(remaining[0].id);
      }
    }
  };

  const formattedWhatsAppUrl = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Banner (Hidden for Delivery Riders as details are in the sidebar) */}
      {session.role !== 'delivery' && (
        <div className="p-5 rounded-2xl bg-[#0d1020] border border-indigo-950 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={
                activePartner?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
              }
              alt={activePartner?.name || 'Rider'}
              className="w-13 h-13 rounded-2xl object-cover border-2 border-emerald-500 shadow-lg shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  {activePartner?.name || 'Delivery Partner Portal'}
                </h1>
                <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  {activePartner?.status || 'available'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Vehicle: <strong className="text-slate-200">{activePartner?.vehicle || 'Bike'}</strong> •
                Total Completed Deliveries: <strong className="text-emerald-400 font-extrabold">{activePartner?.total_deliveries ?? 0}</strong>
              </p>
            </div>
          </div>

          {/* Action Controls & Persona Selector */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-[#12162a] border border-indigo-900/60 p-2 rounded-xl text-xs">
              <Truck className="w-4 h-4 text-emerald-400 ml-1" />
              <select
                value={activePartnerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setActivePartnerId(val);
                  if (session.role === 'delivery') {
                    switchRole('delivery', undefined, val);
                  }
                }}
                className="bg-transparent font-bold text-slate-200 focus:outline-none cursor-pointer pr-2"
              >
                {safePartners.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                    {p.name} ({p.vehicle})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsAddPartnerOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 flex items-center gap-1.5 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              + Add Delivery Partner
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="bg-[#0c0f1d] border border-indigo-950 rounded-2xl p-2 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            activeTab === 'queue'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Active Queue ({activeDeliveries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('delivered_products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            activeTab === 'delivered_products'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4 text-emerald-400" />
          <span>Delivered Products History</span>
        </button>

        {session.role !== 'delivery' && (
          <button
            onClick={() => setActiveTab('manage_partners')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
              activeTab === 'manage_partners'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4 text-purple-300" />
            <span>Manage Partners ({safePartners.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: ACTIVE DELIVERY QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Outlet Tabs & Today's Orders Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0a0c16] border border-indigo-950 shadow-lg">
            {/* Outlet Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pr-1 hidden sm:inline">Outlet:</span>
              {mainOutlets.map((outlet) => {
                const count = safeOrders.filter((o) => {
                  if (isConfirmedDelivered(o) || o.status === 'cancelled') return false;
                  if (outlet !== 'ALL' && !matchesOutlet(o.outlet, outlet)) return false;
                  if (selectedDateScope === 'today') {
                    if (!isOrderForToday(o, todayStr)) return false;
                  }
                  if (queueScope === 'my' && activePartner?.name && o.delivery_partner !== activePartner.name) return false;
                  return true;
                }).length;

                return (
                  <button
                    key={outlet}
                    onClick={() => setSelectedOutlet(outlet)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                      selectedOutlet === outlet
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                        : 'bg-[#12162a] text-slate-300 hover:text-white border border-indigo-900/50'
                    }`}
                  >
                    <span>{outlet === 'ALL' ? '🏪 All Outlets' : `📍 ${outlet}`}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedOutlet === outlet ? 'bg-white/20 text-white font-extrabold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Date Scope Selector */}
            <div className="flex items-center bg-[#12162a] border border-indigo-900/60 p-1 rounded-xl text-xs shrink-0 self-start md:self-center">
              <button
                onClick={() => setSelectedDateScope('today')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  selectedDateScope === 'today'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-emerald-300" />
                <span>Today's Orders</span>
              </button>
              <button
                onClick={() => setSelectedDateScope('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  selectedDateScope === 'all'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>All Dates</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0d1020] border border-indigo-950 shadow-xl">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                Active Deliveries Queue ({activeDeliveries.length})
                {selectedOutlet !== 'ALL' && (
                  <span className="text-xs font-normal text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-lg">
                    {selectedOutlet}
                  </span>
                )}
                {selectedDateScope === 'today' && (
                  <span className="text-xs font-normal text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-lg">
                    Today
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Search order ID or customer name to verify & mark delivered with photo or OTP
              </p>
            </div>

            {/* Queue Scope Selector & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
              {/* Scope Switcher */}
              <div className="flex items-center bg-[#12162a] border border-indigo-900/60 p-1 rounded-xl text-xs w-full sm:w-auto">
                <button
                  onClick={() => setQueueScope('all')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold transition ${
                    queueScope === 'all'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Deliveries
                </button>
                <button
                  onClick={() => setQueueScope('my')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold transition ${
                    queueScope === 'my'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Assigned ({activePartner?.name})
                </button>
              </div>

              {/* Search Bar with Autocomplete Suggestions */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Order ID #, Customer, Phone..."
                  value={queueSearch}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onChange={(e) => {
                    setQueueSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  className="w-full pl-9 pr-8 py-2 bg-[#12162a] border border-indigo-800/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-sans shadow-inner"
                />
                {queueSearch && (
                  <button
                    onClick={() => {
                      setQueueSearch('');
                      setShowSuggestions(false);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Live Order ID Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-[#0d1020] border border-indigo-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-indigo-950/80 animate-fade-in">
                    <div className="px-3 py-2 bg-[#141830] text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-purple-300">
                        <Sparkles className="w-3 h-3 text-purple-400" /> Matching Suggestions ({searchSuggestions.length})
                      </span>
                      <span className="text-slate-500 text-[9px]">Click to Open Card</span>
                    </div>
                    {searchSuggestions.map((ord) => (
                      <div
                        key={ord.id}
                        onClick={() => {
                          setSelectedOrder(ord);
                          setQueueSearch(`#${ord.order_number}`);
                          setShowSuggestions(false);
                        }}
                        className="p-3 hover:bg-purple-900/40 cursor-pointer transition flex items-center justify-between gap-2 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-white flex items-center gap-2">
                            <span className="text-emerald-400 font-mono">#{ord.order_number}</span>
                            <span className="text-slate-200 font-bold truncate">{ord.customer_name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            📍 {ord.outlet} • 🍰 {ord.item_type} • 📱 {ord.mobile_number}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            ord.status === 'delivered'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-purple-950 text-purple-300 border border-purple-800'
                          }`}>
                            {ord.status}
                          </span>
                          <div className="text-[10px] text-slate-300 font-bold mt-0.5">₹{ord.total_amount}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeDeliveries.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-indigo-950 rounded-2xl bg-[#0a0d1a] text-slate-400 text-xs space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <div className="font-bold text-slate-200 text-sm">
                No Active Deliveries Pending
              </div>
              <div>All orders assigned to {activePartner?.name} have been fulfilled.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeDeliveries.map((order) => {
                const countdown = getCountdownInfo(order);
                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl bg-[#0e1120] border border-indigo-950 hover:border-emerald-500/50 transition space-y-3 shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-indigo-950 pb-2 flex-wrap gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-white">
                          Order #{order.order_number}
                        </span>
                        <span className="text-[11px] font-bold uppercase bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                          {order.status}
                        </span>
                      </div>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black ${countdown.badgeColorClass}`}>
                        {countdown.text}
                      </span>
                    </div>

                  <div className="text-xs space-y-2">
                    <div className="font-extrabold text-slate-100 text-sm">{order.customer_name}</div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        {order.mobile_number}
                      </span>
                      <a
                        href={formattedWhatsAppUrl(
                          order.mobile_number,
                          `Hi ${order.customer_name},\n\nI am ${activePartner?.name || 'your rider'} from Broomies Bakery bringing your order #${order.order_number}!\n\nDelivery Date: ${order.delivery_date}\nDelivery Time: ${formatTo12Hour(order.delivery_time_expected) || '11:00 AM'}\n\nThank you!`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 text-[11px] font-bold border border-emerald-800/60 flex items-center gap-1 hover:bg-emerald-900 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    </div>

                    <div className="text-slate-300 flex items-start gap-1.5 pt-1 border-t border-indigo-950">
                      <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span>{order.address || 'Store Pickup at ' + formatOutletDisplayName(order.outlet)}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#070913] border border-indigo-950 flex items-center justify-between">
                      <div>
                        <div className="text-slate-300 font-bold">{order.item_type}</div>
                        <div className="text-[10px] text-slate-500">Qty: x{order.quantity} • Outlet: {formatOutletDisplayName(order.outlet)}</div>
                      </div>
                      <span className="text-emerald-400 font-extrabold text-sm">
                        ₹{(order.total_amount ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {order.rider_delivered || order.status === 'delivered' || order.delivery_confirmation_pending ? (
                    <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between shadow-inner">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <div>
                          <div className="font-extrabold text-emerald-300 text-[11px]">
                            {order.delivery_confirmation_pending
                              ? 'Delivered (Awaiting Outlet Approval)'
                              : 'Delivered Successfully'}
                          </div>
                          {order.actual_delivery_time && (
                            <div className="text-[10px] text-emerald-400/80 font-mono">
                              At {new Date(order.actual_delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrder(order);
                          setOtpInput(order.otp || '');
                          setProofPhotoUrl(order.delivery_photo_url || null);
                          setErrorMessage(null);
                        }}
                        className="text-[10px] font-bold text-emerald-400 underline hover:text-emerald-200 px-2 py-1 rounded bg-emerald-900/40 border border-emerald-700/50 shrink-0"
                      >
                        View Proof
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setOtpInput(order.otp || '1234');
                          setProofPhotoUrl(null);
                          setErrorMessage(null);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Verify Delivery & Submit Proof
                      </button>

                      <button
                        onClick={() => {
                          markDelivered(order.id, undefined, order.otp || '1234');
                        }}
                        className="px-3 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 font-bold text-xs shrink-0 transition flex items-center gap-1"
                        title="Instant 1-Click Deliver"
                      >
                        ⚡ Fast Deliver
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DELIVERED PRODUCTS HISTORY PER PARTNER */}
      {activeTab === 'delivered_products' && (
        <div className="space-y-5">
          {/* Header & Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-[#0d1020] border border-indigo-950 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">Delivered Products Log</h2>
                <p className="text-xs text-slate-400">
                  Products delivered by riders with proof photos and fulfillment timestamps
                </p>
              </div>
            </div>

            {/* Filter by Delivery Partner & Search */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search item, customer, order #..."
                  value={deliveredSearch}
                  onChange={(e) => setDeliveredSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#12162a] border border-indigo-900/60 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <select
                value={partnerFilter}
                onChange={(e) => setPartnerFilter(e.target.value)}
                className="w-full sm:w-auto bg-[#12162a] border border-indigo-900/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Delivery Partners</option>
                {safePartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delivered Products Count Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0e111d] border border-indigo-950 flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-lg">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-white">{deliveredOrders.length}</div>
                <div className="text-xs text-slate-400 font-medium">Total Products Delivered</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0e111d] border border-indigo-950 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-emerald-400">
                  ₹{deliveredOrders.reduce((sum, o) => sum + o.total_amount, 0).toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 font-medium">Value of Delivered Products</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0e111d] border border-indigo-950 flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-lg">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-blue-400">{safePartners.length}</div>
                <div className="text-xs text-slate-400 font-medium">Active Delivery Riders</div>
              </div>
            </div>
          </div>

          {/* Delivered Products Table / Cards */}
          {deliveredOrders.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-indigo-950 rounded-2xl text-slate-400 text-xs">
              No delivered products match the selected partner or search query.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deliveredOrders.map((o) => (
                <div
                  key={o.id}
                  className="p-4 rounded-2xl bg-[#0e111d] border border-indigo-950 space-y-3 shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-indigo-950/80 pb-2">
                      <span className="font-black text-white text-sm">
                        Order #{o.order_number}
                      </span>
                      <span className="text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                        Delivered
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-slate-200 text-sm">{o.item_type}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Quantity: <strong className="text-purple-300">x{o.quantity}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-black text-sm">₹{o.total_amount}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">{o.outlet}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#070913] border border-indigo-950/80 text-xs space-y-1">
                      <div className="text-slate-300 font-semibold">
                        Customer: <span className="text-white">{o.customer_name}</span> ({o.mobile_number})
                      </div>
                      <div className="text-slate-400 flex items-center justify-between">
                        <span>Rider: <strong className="text-purple-300">{getDeliveredByDisplayName(o)}</strong></span>
                        <span className="text-[10px] text-slate-500">
                          {o.actual_delivery_time ? new Date(o.actual_delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Delivered'}
                        </span>
                      </div>
                    </div>

                    {o.delivery_photo_url && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-indigo-950 h-28 relative">
                        <img
                          src={o.delivery_photo_url}
                          alt="Delivery Proof"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-slate-950 font-bold text-[9px] px-2 py-0.5 rounded-full">
                          Verified Photo
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANAGE / ADD / REMOVE DELIVERY PARTNERS */}
      {activeTab === 'manage_partners' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-400" />
                Delivery Partner Directory
              </h2>
              <p className="text-xs text-slate-400">
                Add new delivery drivers or remove active partner profiles
              </p>
            </div>

            <button
              onClick={() => setIsAddPartnerOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              + Add Partner
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {safePartners.map((partner) => (
              <div
                key={partner.id}
                className="p-5 rounded-2xl bg-[#0e111d] border border-indigo-950 space-y-4 shadow-xl flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={partner.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={partner.name}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-purple-500/50 shadow"
                    />
                    <div>
                      <h3 className="font-bold text-white text-sm">{partner.name}</h3>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {partner.phone}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      partner.status === 'available'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : partner.status === 'on_delivery'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {partner.status}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#070913] border border-indigo-950/80 text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Vehicle:</span>
                    <strong className="text-slate-200">{partner.vehicle || 'Bike'}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Login ID:</span>
                    <strong className="text-purple-300 font-mono">{partner.login_id}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Completed Deliveries:</span>
                    <strong className="text-emerald-400 font-bold">{partner.total_deliveries}</strong>
                  </div>
                </div>

                {deletingPartnerId === partner.id ? (
                  <div className="p-3 bg-rose-950/90 border border-rose-800 rounded-xl space-y-2 text-xs animate-fade-in">
                    <p className="font-bold text-rose-200">Delete partner "{partner.name}"?</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConfirmDeletePartner(partner.id)}
                        className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition text-xs"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setDeletingPartnerId(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-indigo-950/80">
                    <button
                      onClick={() => {
                        setActivePartnerId(partner.id);
                        if (session.role === 'delivery') {
                          switchRole('delivery', undefined, partner.id);
                        }
                        setActiveTab('queue');
                      }}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
                    >
                      Select Persona
                    </button>

                    <button
                      onClick={() => setDeletingPartnerId(partner.id)}
                      className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition"
                      title="Delete Partner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE NEW DELIVERY PARTNER MODAL */}
      {isAddPartnerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e111d] border border-indigo-900 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-indigo-950 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-400" />
                Add New Delivery Partner
              </h3>
              <button
                onClick={() => {
                  setIsAddPartnerOpen(false);
                  setCreatePartnerError(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createPartnerError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-200 font-medium">
                {createPartnerError}
              </div>
            )}

            <form onSubmit={handleCreatePartner} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  required
                  className="w-full bg-[#121524] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(e.target.value)}
                  required
                  className="w-full bg-[#121524] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Login / Rider ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. rider_35"
                  value={newPartnerLoginId}
                  onChange={(e) => setNewPartnerLoginId(e.target.value)}
                  className="w-full bg-[#121524] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Vehicle Type
                </label>
                <select
                  value={newPartnerVehicle}
                  onChange={(e) => setNewPartnerVehicle(e.target.value)}
                  className="w-full bg-[#121524] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="Bike">Motorbike</option>
                  <option value="Scooter">Scooter</option>
                  <option value="E-Bike">Electric Scooter</option>
                  <option value="Van">Delivery Van</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Profile Photo / Avatar URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newPartnerAvatar}
                  onChange={(e) => setNewPartnerAvatar(e.target.value)}
                  className="w-full bg-[#121524] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPartnerOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-950/50"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELIVERY PROOF & OTP VERIFICATION MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e111d] border border-indigo-900 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-indigo-950 pb-3">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Delivery Verification - Order #{selectedOrder.order_number}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDelivery} className="space-y-4 text-xs">
              <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl text-purple-200 text-xs leading-relaxed font-medium">
                ⚡ <strong>Delivery Requirement:</strong> Deliver mark karne ke liye customer se <strong>OTP maangein</strong> YA delivery ki <strong>Photo click karein</strong>.
              </div>

              {/* Option A: Customer OTP Entry */}
              <div className="p-3.5 rounded-xl bg-[#070913] border border-indigo-950 space-y-2">
                <label className="block text-slate-200 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Key className="w-4 h-4" /> Option 1: Customer OTP Code
                  </span>
                  <span className="text-[10px] text-amber-300 font-normal bg-amber-950 px-2 py-0.5 rounded border border-amber-800/50">
                    Required if no photo
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Enter 4-digit OTP provided by customer"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="w-full bg-[#121524] border border-indigo-900/80 rounded-xl px-3 py-2.5 text-white font-mono text-center tracking-widest font-extrabold text-base focus:border-emerald-500"
                />
                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                  <span>Customer OTP Hint:</span>
                  <strong className="text-amber-400 font-mono text-xs">{selectedOrder.otp || '1234'}</strong>
                </div>
              </div>

              {/* Option B: Photo Proof Upload */}
              <div className="p-3.5 rounded-xl bg-[#070913] border border-indigo-950 space-y-2">
                <label className="block text-slate-200 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Camera className="w-4 h-4" /> Option 2: Delivery Photo Proof
                  </span>
                  <span className="text-[10px] text-emerald-300 font-normal bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/50">
                    Required if no OTP
                  </span>
                </label>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                  id="delivery-proof-photo"
                />

                <label
                  htmlFor="delivery-proof-photo"
                  className="cursor-pointer w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  {isCompressing ? 'Compressing Photo...' : proofPhotoUrl ? 'Retake Photo' : 'Capture / Upload Photo'}
                </label>

                {proofPhotoUrl && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-indigo-900 h-36">
                    <img
                      src={proofPhotoUrl}
                      alt="Delivery Proof"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full">
                      Photo Ready
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Submit */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-950/50"
                >
                  Confirm Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
