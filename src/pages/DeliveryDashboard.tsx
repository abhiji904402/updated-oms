import React, { useState, useMemo, useRef } from 'react';
import { useOMS } from '../lib/store';
import { Order } from '../types';
import { OrderCard } from '../components/OrderCard';
import { RiderLocationMapModal } from '../components/RiderLocationMapModal';
import { InstallAndroidAppModal } from '../components/InstallAndroidAppModal';
import { compressImage } from '../lib/imageCompressor';
import {
  Truck,
  MapPin,
  Navigation,
  CheckCircle2,
  Camera,
  KeyRound,
  UserPlus,
  Trash2,
  Smartphone,
  ShieldCheck,
  Search,
  Wallet
} from 'lucide-react';
import {
  isOrderFinalDelivered,
  sortOrdersByDeliveryPriority,
  sortDeliveredOrdersRecentFirst
} from '../lib/timeUtils';

interface DeliveryDashboardProps {
  onViewOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onWhatsAppOrder?: (order: Order) => void;
}

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({
  onViewOrder,
  onEditOrder,
  onWhatsAppOrder
}) => {
  const {
    orders,
    partners,
    markDelivered,
    updateOrderStatus,
    addPartner,
    deletePartner,
    session
  } = useOMS();

  const initialRiderName = useMemo(() => {
    if (session.deliveryPartnerId) {
      const found = partners.find((p) => p.id === session.deliveryPartnerId);
      if (found) return found.name;
    }
    return 'all';
  }, [session.deliveryPartnerId, partners]);

  const [filterType, setFilterType] = useState<'all' | 'delivery' | 'pickup' | 'active' | 'delivered'>('all');
  const [selectedRider, setSelectedRider] = useState<string>(initialRiderName);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFleetMapOpen, setIsFleetMapOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Proof of Delivery Modal State
  const [activeDeliveryOrder, setActiveDeliveryOrder] = useState<Order | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [proofPhoto, setProofPhoto] = useState<string>('');
  const [deliveredByName, setDeliveredByName] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add Rider Modal State
  const [showRiderManager, setShowRiderManager] = useState(false);
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderPhone, setNewRiderPhone] = useState('');
  const [newRiderVehicle, setNewRiderVehicle] = useState('Bike');

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = (orders || []).filter((o) => {
      if (filterType === 'delivery' && o.delivery_type !== 'delivery') return false;
      if (filterType === 'pickup' && o.delivery_type !== 'pickup') return false;
      if (filterType === 'active' && (isOrderFinalDelivered(o) || o.status === 'cancelled')) return false;
      if (filterType === 'delivered' && !isOrderFinalDelivered(o)) return false;

      if (selectedRider !== 'all') {
        const assigned = String(o.delivery_partner || o.delivered_by || '').toLowerCase();
        if (!assigned.includes(selectedRider.toLowerCase())) return false;
      }

      if (q) {
        return (
          String(o.order_number || '').toLowerCase().includes(q) ||
          (o.customer_name || '').toLowerCase().includes(q) ||
          (o.mobile_number || '').toLowerCase().includes(q) ||
          (o.delivery_address || '').toLowerCase().includes(q) ||
          (o.outlet || '').toLowerCase().includes(q)
        );
      }

      return true;
    });

    if (filterType === 'delivered') {
      return sortDeliveredOrdersRecentFirst(list);
    }
    return sortOrdersByDeliveryPriority(list);
  }, [orders, filterType, selectedRider, searchQuery]);

  const deliveryStats = useMemo(() => {
    const list = orders || [];
    const totalDelivery = list.filter((o) => o.delivery_type === 'delivery').length;
    const totalPickup = list.filter((o) => o.delivery_type === 'pickup').length;
    const outForDelivery = list.filter((o) => o.status === 'out_for_delivery').length;
    const delivered = list.filter((o) => isOrderFinalDelivered(o)).length;
    return { totalDelivery, totalPickup, outForDelivery, delivered };
  }, [orders]);

  // Rider-Wise Cash Collection & Settlement Summary
  const riderSettlementStats = useMemo(() => {
    const list = orders || [];
    return (partners || []).map((p) => {
      const rName = p.name.toLowerCase();
      const riderOrders = list.filter((o) => {
        if (o.status === 'cancelled') return false;
        const assigned = String(o.delivery_partner || '').toLowerCase();
        const deliveredBy = String(o.delivered_by || '').toLowerCase();
        return assigned === rName || deliveredBy === rName;
      });

      const deliveredConfirmed = riderOrders.filter((o) => isOrderFinalDelivered(o)).length;
      const awaitingConfirm = riderOrders.filter(
        (o) => o.status === 'delivered' && Boolean(o.delivery_confirmation_pending)
      ).length;
      const activeOut = riderOrders.filter((o) => o.status !== 'delivered').length;

      const codCashToCollect = riderOrders.reduce((sum, o) => {
        const pType = String(o.payment_type || 'due').toLowerCase().trim();
        const isPaid =
          pType === 'full' ||
          pType === 'full_paid' ||
          pType === 'paid' ||
          pType === 'cash' ||
          pType === 'upi' ||
          pType === 'online';
        const rem = isPaid ? 0 : Number(o.remaining_balance ?? o.due_amount ?? o.total_amount) || 0;
        return sum + rem;
      }, 0);

      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        totalAssigned: riderOrders.length,
        deliveredConfirmed,
        awaitingConfirm,
        activeOut,
        codCashToCollect
      };
    });
  }, [orders, partners]);

  const handleOpenProofModal = (order: Order) => {
    setActiveDeliveryOrder(order);
    setEnteredOtp(order.otp || '');
    setProofPhoto(order.delivery_photo_url || '');
    setDeliveredByName(
      order.delivery_partner ||
        partners.find((p) => p.id === session.deliveryPartnerId)?.name ||
        partners[0]?.name ||
        'Store Staff'
    );
    setOtpError('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const compressed = await compressImage(file, 700, 0.72);
      setProofPhoto(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setProofPhoto(String(reader.result || ''));
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleConfirmDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeliveryOrder) return;
    const result = markDelivered(
      activeDeliveryOrder.id,
      proofPhoto || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80',
      enteredOtp || activeDeliveryOrder.otp || '0000',
      deliveredByName || activeDeliveryOrder.delivery_partner || 'Rider'
    );
    if (result.success) {
      setActiveDeliveryOrder(null);
      setEnteredOtp('');
      setProofPhoto('');
    } else {
      setOtpError(result.message || 'Invalid OTP entered! Please check the 4-digit OTP on the order ticket.');
    }
  };

  const handleAddRider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName.trim()) return;
    addPartner({
      name: newRiderName.trim(),
      phone: newRiderPhone.trim() || '9800000000',
      vehicle: newRiderVehicle,
      status: 'available'
    });
    setNewRiderName('');
    setNewRiderPhone('');
  };

  const handleAssignPartner = (orderId: string, riderName: string) => {
    const target = orders.find((o) => o.id === orderId);
    const nextStatus = riderName
      ? target?.status === 'pending' || target?.status === 'processing'
        ? 'out_for_delivery'
        : target?.status || 'out_for_delivery'
      : target?.status || 'processing';
    updateOrderStatus(orderId, nextStatus, riderName);
  };

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#13162b] via-[#171b36] to-[#1e1538] border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Delivery &amp; Rider Dispatch Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live GPS &amp; OTP Proof
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Assign delivery partners, track live rider coordinates, and verify doorstep handovers with OTP &amp; photo proof.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFleetMapOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 text-xs font-bold transition cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
            <span>Live Fleet Map</span>
          </button>

          {session.role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowRiderManager((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/50 text-xs font-bold transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Manage Riders ({partners.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsInstallModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/25 transition cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Rider Android App</span>
          </button>
        </div>
      </div>

      {/* Optional Rider Manager Drawer */}
      {showRiderManager && (
        <div className="bg-[#0f1224] border border-indigo-900/60 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-400" />
              <span>Delivery Fleet Roster</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowRiderManager(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleAddRider} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={newRiderName}
              onChange={(e) => setNewRiderName(e.target.value)}
              placeholder="Rider Full Name..."
              className="px-3 py-2 bg-[#13162b] border border-indigo-900/60 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              value={newRiderPhone}
              onChange={(e) => setNewRiderPhone(e.target.value)}
              placeholder="Mobile Number..."
              className="px-3 py-2 bg-[#13162b] border border-indigo-900/60 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <select
              value={newRiderVehicle}
              onChange={(e) => setNewRiderVehicle(e.target.value)}
              className="px-3 py-2 bg-[#13162b] border border-indigo-900/60 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="Bike">Two-Wheeler (Bike)</option>
              <option value="Scooter">Electric Scooter</option>
              <option value="Van">Refrigerated Cake Van</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition cursor-pointer"
            >
              + Add Rider to Fleet
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {partners.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#13162b] border border-indigo-950"
              >
                <div>
                  <div className="text-xs font-bold text-white">{p.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {p.phone} • {p.vehicle || 'Bike'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deletePartner(p.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 transition cursor-pointer"
                  title="Remove Rider"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-semibold block">Home Delivery</span>
          <span className="text-xl sm:text-2xl font-black text-white font-mono">{deliveryStats.totalDelivery}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-purple-400 font-semibold block">Store Pickup</span>
          <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono">{deliveryStats.totalPickup}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-amber-400 font-semibold block">Out for Delivery</span>
          <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">{deliveryStats.outForDelivery}</span>
        </div>
        <div className="bg-[#0f1224] border border-indigo-950 p-3.5 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-semibold block">Delivered Orders</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">{deliveryStats.delivered}</span>
        </div>
      </div>

      {/* Rider-Wise Daily Cash Collection & Settlement Summary */}
      {riderSettlementStats.length > 0 && (
        <div className="bg-[#0f1224] border border-indigo-950 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>Rider-Wise Cash Collection &amp; Delivery Settlement Summary</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Click any rider card to filter their orders
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {riderSettlementStats.map((rs) => {
              const isSelected = selectedRider.toLowerCase() === rs.name.toLowerCase();
              return (
                <button
                  key={rs.id}
                  type="button"
                  onClick={() => setSelectedRider(isSelected ? 'all' : rs.name)}
                  className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#1a1438] border-purple-400 shadow-lg'
                      : 'bg-[#13162b] hover:bg-[#171b35] border-indigo-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">🚴 {rs.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-extrabold">
                      Collect: ₹{rs.codCashToCollect.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-indigo-950/80 text-[10px]">
                    <div>
                      <span className="text-slate-400 block">Active</span>
                      <span className="font-mono font-black text-sky-300">{rs.activeOut}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Unconfirmed</span>
                      <span className="font-mono font-black text-amber-300">{rs.awaitingConfirm}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Verified</span>
                      <span className="font-mono font-black text-emerald-400">{rs.deliveredConfirmed}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar & Rider Selector */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0f1224] border border-indigo-950 p-3 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'active', label: 'Active Dispatch' },
            { id: 'delivery', label: 'Doorstep Delivery' },
            { id: 'pickup', label: 'Store Pickups' },
            { id: 'delivered', label: 'Completed' }
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterType(id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                filterType === id
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-[#13162b] text-slate-400 hover:text-white border border-indigo-950'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedRider}
            onChange={(e) => setSelectedRider(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#13162b] border border-indigo-900/60 text-xs font-bold text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Delivery Riders</option>
            {partners.map((p) => (
              <option key={p.id} value={p.name}>
                🚴 {p.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, address, phone..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#13162b] border border-indigo-900/60 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1224] border border-indigo-950 rounded-2xl">
          <Truck className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-white">No Matching Delivery Orders</h3>
          <p className="text-xs text-slate-400 mt-1">Try switching the filter tab or rider selection above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((o) => (
            <div key={o.id} className="space-y-2">
              <OrderCard
                order={o}
                onView={onViewOrder}
                onEdit={onEditOrder}
                onWhatsApp={onWhatsAppOrder}
              />

              {/* Quick Rider Dispatch Bar under each card */}
              <div className="bg-[#0f1224] border border-indigo-950/90 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Rider:</span>
                  <select
                    value={o.delivery_partner || ''}
                    onChange={(e) => handleAssignPartner(o.id, e.target.value)}
                    className="bg-[#13162b] border border-indigo-900/60 rounded-lg px-2.5 py-1 text-xs font-bold text-purple-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Unassigned</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {o.delivery_address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.delivery_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/50 text-[11px] font-bold transition"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Navigate</span>
                    </a>
                  )}

                  {o.status !== 'delivered' && o.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => handleOpenProofModal(o)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold shadow transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify OTP &amp; Deliver</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proof of Delivery & OTP Modal */}
      {activeDeliveryOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1224] border border-emerald-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-indigo-950 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Complete Order #{activeDeliveryOrder.order_number}</span>
                </h3>
                <p className="text-xs text-slate-400">{activeDeliveryOrder.customer_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDeliveryOrder(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleConfirmDelivery} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                  Delivered / Handed Over By
                </label>
                <input
                  type="text"
                  value={deliveredByName}
                  onChange={(e) => setDeliveredByName(e.target.value)}
                  placeholder="Rider or Staff Name"
                  className="w-full px-3 py-2 bg-[#13162b] border border-indigo-900 rounded-xl text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center justify-between mb-1">
                  <span>Customer 4-Digit Delivery OTP</span>
                  <span className="text-emerald-400 font-mono">Ticket OTP: {activeDeliveryOrder.otp || 'Any'}</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={enteredOtp}
                    onChange={(e) => {
                      setEnteredOtp(e.target.value);
                      setOtpError('');
                    }}
                    placeholder="Enter 4-digit OTP"
                    className="w-full pl-9 pr-3 py-2 bg-[#13162b] border border-indigo-900 rounded-xl text-sm font-mono font-bold text-white tracking-widest"
                  />
                </div>
                {otpError && <p className="text-[11px] text-red-400 mt-1">{otpError}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                  Delivery Proof Photo (Optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-800 bg-[#13162b] hover:bg-indigo-950/50 text-xs font-bold text-purple-300 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isCompressing ? 'Compressing Photo...' : proofPhoto ? 'Change Proof Photo' : 'Capture / Upload Handover Photo'}</span>
                </button>
                {proofPhoto && (
                  <img
                    src={proofPhoto}
                    alt="Delivery Proof"
                    className="mt-2 h-28 w-full object-cover rounded-xl border border-emerald-500/40"
                  />
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDeliveryOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-950/60 cursor-pointer"
                >
                  Confirm Delivered
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RiderLocationMapModal
        isOpen={isFleetMapOpen}
        onClose={() => setIsFleetMapOpen(false)}
        partners={partners}
      />

      <InstallAndroidAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
};
