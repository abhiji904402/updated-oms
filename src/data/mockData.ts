import { Order, DeliveryPartner, SheetConfig, Alert } from '../types';

export interface ItemPreset {
  name: string;
  price: number;
  category: string;
}

export const ITEM_PRESETS: ItemPreset[] = [
  { name: 'Pineapple Cake', price: 450, category: 'Cake' },
  { name: 'Black Forest Cake', price: 550, category: 'Cake' },
  { name: 'Chocolate Truffle Cake', price: 650, category: 'Cake' },
  { name: 'Red Velvet Cake', price: 700, category: 'Cake' },
  { name: 'Butterscotch Cake', price: 500, category: 'Cake' },
  { name: 'Fresh Fruit Cake', price: 750, category: 'Cake' },
  { name: 'Dutch Chocolate Cake', price: 680, category: 'Cake' },
  { name: 'Vanilla Pastry (Pcs)', price: 60, category: 'Pastry' },
  { name: 'Chocolate Pastry (Pcs)', price: 80, category: 'Pastry' },
  { name: 'Cheesecake Slice', price: 150, category: 'Pastry' },
  { name: 'Custom Fondant Theme Cake', price: 1200, category: 'Custom' },
  { name: 'Barbie / Doll 3D Cake', price: 1400, category: 'Custom' },
  { name: 'Multi-Tier Wedding Cake', price: 2500, category: 'Custom' }
];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_DELIVERY_PARTNERS: DeliveryPartner[] = [
  {
    id: 'pt-1',
    name: 'Ramesh Kumar',
    phone: '9876543210',
    status: 'available',
    total_deliveries: 42,
    vehicle: 'Bike • HR-51-AB-1024',
    vehicle_type: 'Bike',
    rating: 4.9,
    is_tracking_active: true,
    location: {
      lat: 28.4446,
      lng: 77.3138,
      address: 'Sector 31, Faridabad',
      updated_at: new Date().toISOString()
    }
  },
  {
    id: 'pt-2',
    name: 'Suresh Sharma',
    phone: '9876543211',
    status: 'available',
    total_deliveries: 38,
    vehicle: 'Scooter • HR-51-CD-2048',
    vehicle_type: 'Scooter',
    rating: 4.8,
    is_tracking_active: true,
    location: {
      lat: 28.4727,
      lng: 77.3057,
      address: 'Sector 35, Faridabad',
      updated_at: new Date().toISOString()
    }
  },
  {
    id: 'pt-3',
    name: 'Amit Singh',
    phone: '9876543212',
    status: 'available',
    total_deliveries: 51,
    vehicle: 'Bike • HR-51-EF-4096',
    vehicle_type: 'Bike',
    rating: 4.9,
    is_tracking_active: true,
    location: {
      lat: 28.4622,
      lng: 77.2963,
      address: 'Sector 42, Faridabad',
      updated_at: new Date().toISOString()
    }
  },
  {
    id: 'pt-4',
    name: 'Rahul Verma',
    phone: '9876543213',
    status: 'available',
    total_deliveries: 29,
    vehicle: 'Bike • HR-51-GH-8192',
    vehicle_type: 'Bike',
    rating: 4.7,
    is_tracking_active: true,
    location: {
      lat: 28.4197,
      lng: 77.3556,
      address: 'Sector 88, Faridabad',
      updated_at: new Date().toISOString()
    }
  }
];

export const INITIAL_SHEET_CONFIG: SheetConfig = {
  sheet_url: '',
  is_active: true,
  last_sync: null,
  last_synced_at: null,
  auto_sync: false,
  webhook_status: 'idle',
  sync_count: 0
};

export const INITIAL_ALERTS: Alert[] = [];
