import React from 'react';
import { useStore } from '../lib/store';
import { Clock, CheckCircle2, ShoppingBag, Plus } from 'lucide-react';

const OutletDashboard = () => {
  const { orders, currentOutlet } = useStore();
  const outletOrders = orders.filter(o => currentOutlet === 'all' || o.outlet_name.toLowerCase().includes(currentOutlet.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Outlet Panel</h1>
          <p className="text-slate-500">Manage daily orders and production</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200">
          <Plus className="w-5 h-5" /> New Counter Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {outletOrders.map(order => (
          <div key={order.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{order.order_number}</span>
                <h3 className="font-bold text-slate-900">{order.customer_name}</h3>
              </div>
              <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                order.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {order.status}
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <ShoppingBag className="w-4 h-4 text-slate-400" />
                <span className="truncate">{order.items}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{order.delivery_time}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-all">
                Mark Ready
              </button>
              <button className="px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 border border-slate-200">
                Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export { OutletDashboard };
export default OutletDashboard;
