import { Order, DeliveryPartner, Alert, SheetConfig } from '../types';

export const INITIAL_DELIVERY_PARTNERS: DeliveryPartner[] = [
  {
    id: 'dp-1',
    name: 'Rahul Sharma',
    phone: '+91 98110 01122',
    login_id: 'rahul.rider',
    status: 'available',
    total_deliveries: 142,
    vehicle: 'Honda Activa (HR 51 AB 1234)',
    is_tracking_active: true,
    location: {
      lat: 28.4446,
      lng: 77.3138,
      address: 'Shop no. 4, Ch. Hetram Complex, near Anupam Sweets, Sector 31, Faridabad',
      speed: 0,
      updated_at: new Date().toISOString()
    }
  },
  {
    id: 'dp-2',
    name: 'Ajay Kumar',
    phone: '+91 95993 30212',
    login_id: 'ajay.rider',
    status: 'available',
    total_deliveries: 98,
    vehicle: 'TVS Jupiter (HR 51 XY 5678)',
    is_tracking_active: true,
    location: {
      lat: 28.4727,
      lng: 77.3057,
      address: 'Shop No.9, Ashoka Enclave Part 3, Sector 35, Faridabad',
      speed: 22,
      updated_at: new Date().toISOString()
    }
  },
  {
    id: 'dp-3',
    name: 'Vikram Singh',
    phone: '+91 98991 12233',
    login_id: 'vikram.rider',
    status: 'on_delivery',
    total_deliveries: 215,
    vehicle: 'Hero Splendor (HR 51 C 9988)',
    is_tracking_active: true,
    location: {
      lat: 28.4622,
      lng: 77.2963,
      address: 'B-107, Greenfield Colony, Sector 42, Faridabad',
      speed: 35,
      updated_at: new Date().toISOString()
    }
  },
  {
    id: 'dp-4',
    name: 'Sonu Rider',
    phone: '+91 98115 52504',
    login_id: 'sonu.rider',
    status: 'available',
    total_deliveries: 176,
    vehicle: 'Bajaj Pulsar (HR 51 D 4433)',
    is_tracking_active: true,
    location: {
      lat: 28.4197,
      lng: 77.3556,
      address: 'Shop 112, RPS Savana Rd, Sector 88, Faridabad',
      speed: 0,
      updated_at: new Date().toISOString()
    }
  }
];

export const INITIAL_ORDERS: Order[] = [];

export interface ItemPreset {
  name: string;
  price: number;
}

export const ITEM_PRESETS: ItemPreset[] = [
  { name: 'Chocolate Truffle Cake', price: 600 },
  { name: 'Black Forest Cake', price: 550 },
  { name: 'Red Velvet Cake', price: 700 },
  { name: 'Pineapple Fresh Cream', price: 500 },
  { name: 'Butterscotch Cake', price: 550 },
  { name: 'Blueberry Cheesecake', price: 900 },
  { name: 'Chocolate Truffle Custom', price: 1200 },
  { name: 'Fruit Overload Cake', price: 750 },
  { name: 'Bento Cake (Mini)', price: 350 },
  { name: 'Cupcakes Box (Set of 6)', price: 450 }
];

export const INITIAL_SHEET_CONFIG: SheetConfig = {
  sheet_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
  is_active: true,
  last_sync: new Date().toISOString(),
  last_synced_at: new Date().toISOString(),
  auto_sync: true,
  webhook_status: 'connected',
  sync_count: 0
};

export const INITIAL_ALERTS: Alert[] = [];
