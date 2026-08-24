import { Order, DeliveryPartner, SheetConfig, Alert } from '../types';

export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_DELIVERY_PARTNERS: DeliveryPartner[] = [
  { id: 'goldy', name: 'Goldy', phone: '9004800273', vehicle_type: 'Van', status: 'available', total_deliveries: 0, login_id: 'goldy' },
  { id: 'abhishek', name: 'Abhishek', phone: '9354706040', vehicle_type: 'Bike', status: 'available', total_deliveries: 0, login_id: 'Abhishek' },
  { id: 'vishwakarma', name: 'Vishwakarma', phone: '9205573468', vehicle_type: 'Bike', status: 'available', total_deliveries: 0, login_id: 'vishwakarma' }
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

