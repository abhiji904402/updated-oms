import React from 'react';
import { useStore } from '../lib/store';
import { MapPin, Phone, CheckCircle2, Clock, Navigation, ShoppingBag } from 'lucide-react';

const DeliveryDashboard = () => {
  const { orders } = useStore();
  const deliveryOrders = orders.filter(o => o.status === 'dispatched' || o.status === 'ready');

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-200">
        <h1 className="text-3xl font-bold mb-2">Rider Dashboard</h1>
        <p className="text-blue-100 font-medium">You have {deliveryOrders.length} active deliveries today</p>
      </div>

      <div className="space-y-4">
        {deliveryOrders.map(order => (
          <div key={order.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{order.customer_name}</h3>
                  <p className="text-xs text-slate-500">#{order.order_number} • {order.delivery_type}</p>
                </div>
              </div>
              <button className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100">
                <Navigation className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="truncate">{order.outlet_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{order.customer_phone}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all">
                Update Status
              </button>
              <button className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                Mark Delivered <CheckCircle2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export { DeliveryDashboard };
export default DeliveryDashboard;
