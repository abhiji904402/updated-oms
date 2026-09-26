import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  ShoppingBag
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminDashboardProps {
  onOpenAddModal?: () => void;
  onOpenThermalModal?: () => void;
  onOpenDeliveryModal?: (order: any) => void;
  onOpenPasswordModal?: () => void;
  onOpenSheetModal?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenAddModal, onOpenThermalModal, onOpenDeliveryModal, onOpenPasswordModal, onOpenSheetModal }) => {
  const { orders, getStats, isLoading, addOrder } = useStore();
  const stats = getStats();

  const quickStats = [
    { label: 'Today Orders', value: stats.todayCount, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Today Revenue', value: `₹${stats.todayAmount}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Pending', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active Riders', value: 8, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Central Dashboard</h1>
          <p className="text-slate-500 font-medium">Monitoring all Broomies Bakery outlets in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm">
            <Download className="w-4 h-4" /> Export Report
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
            <Plus className="w-5 h-5" /> New Order
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">Real-time</span>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Orders Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
            Recent Orders
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">{orders.length} Total</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..."
                className="bg-slate-50 border-none rounded-xl py-2 pl-10 pr-4 text-xs w-full md:w-64 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100 transition-all">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Outlet</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 10).map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-900">#{order.order_number}</span>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold uppercase">
                        {order.customer_name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{order.customer_name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{order.customer_phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600 truncate max-w-[200px]">{order.items}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900 text-sm">₹{order.total_amount}</p>
                    <p className="text-[10px] text-green-600 font-bold uppercase">Paid: ₹{order.advance_amount}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                      ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 
                        order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}
                    `}>
                      {order.status === 'delivered' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {order.status}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">{order.outlet_name}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && !isLoading && (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No orders found. Start by adding one!</p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing top 10 recent orders</p>
          <button className="text-xs font-bold text-blue-600 hover:underline">View All Orders</button>
        </div>
      </div>
    </div>
  );
};

export { AdminDashboard };
export default AdminDashboard;
