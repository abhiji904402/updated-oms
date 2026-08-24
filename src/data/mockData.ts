import { Order, DeliveryPartner, SheetConfig, Alert } from '../types';

export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_DELIVERY_PARTNERS: DeliveryPartner[] = [
  { id: '1', name: 'Raju (Biker)', phone: '9876543210', vehicle_type: 'bike', status: 'available', total_deliveries: 142, rating: 4.8 },
  { id: '2', name: 'Amit (Scooter)', phone: '9876543211', vehicle_type: 'scooter', status: 'busy', total_deliveries: 98, rating: 4.9 },
  { id: '3', name: 'Vikas (EV)', phone: '9876543212', vehicle_type: 'ev', status: 'available', total_deliveries: 64, rating: 4.7 }
];
export const INITIAL_SHEET_CONFIG: SheetConfig = { sheet_url: '', is_active: false, last_sync: null, auto_sync: false, webhook_status: 'idle', sync_count: 0 };
export const INITIAL_ALERTS: Alert[] = [];

export const ITEM_PRESETS = [
  { name: 'Chocolate Truffle Cake (1kg)', price: 850 },
  { name: 'Red Velvet Cake (500g)', price: 500 },
  { name: 'Pineapple Cake (1kg)', price: 700 },
  { name: 'Black Forest (500g)', price: 450 },
  { name: 'Custom Fondant Cake (2kg)', price: 2000 },
  { name: 'Pastries Box (4 pcs)', price: 300 }
];

