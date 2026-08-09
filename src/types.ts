export type Role = 'admin' | 'outlet' | 'delivery';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'on_hold'
  | 'cancelled'
  | 'missed';

export type OutletName =
  | 'Sector 31'
  | 'Sector 35'
  | 'Sector 42'
  | 'Sector 88'
  | 'Downtown Flagship'
  | 'Westside Bakery'
  | 'East Bay Hub'
  | 'Northside Café'
  | string;

export type DeliveryType = 'delivery' | 'pickup';

export type PaymentType = 'cash' | 'online' | 'upi' | 'part' | 'full' | 'due';

export interface Order {
  id: string;
  order_number: number;
  outlet: OutletName;
  order_date: string; // YYYY-MM-DD
  order_time: string; // HH:MM
  mobile_number: string;
  customer_name: string;
  informed_by?: string;
  item_type: string;
  quantity: string | number;
  delivery_type: DeliveryType;
  total_amount: number;
  payment_type: PaymentType;
  advance_amount: number;
  remaining_balance: number;
  due_amount: number;
  address: string;
  remarks: string;
  status: OrderStatus;
  delivery_partner?: string;
  actual_delivery_time?: string | null;
  delivered_by?: string | null;
  payment_changed_by?: string | null;
  payment_changed_at?: string | null;
  delivery_date: string;
  delivery_time_expected: string;
  item_image_url?: string | null;
  delivery_photo_url?: string | null;
  advance_bill_number?: string;
  final_bill_number?: string;
  rider_delivered?: boolean;
  delivery_confirmation_pending?: boolean;
  otp?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPartnerLocation {
  lat: number;
  lng: number;
  address?: string;
  speed?: number;
  updated_at: string;
}

export interface OutletLocation {
  id: string; // 'Sector 31', 'Sector 35', etc.
  name: string;
  address: string;
  lat: number;
  lng: number;
  color?: string;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  login_id: string;
  password?: string;
  status: 'available' | 'on_delivery' | 'offline';
  total_deliveries: number;
  vehicle?: string;
  avatar?: string;
  location?: DeliveryPartnerLocation;
  is_tracking_active?: boolean;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'urgent' | 'success';
  is_read: boolean;
  outlet: OutletName;
  created_at: string;
}

export interface SheetConfig {
  sheet_url: string;
  is_active: boolean;
  last_sync: string | null;
  last_synced_at?: string | null;
  auto_sync: boolean;
  webhook_status: 'connected' | 'error' | 'idle';
  sync_count: number;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  event: 'create' | 'update' | 'delete' | 'manual_sync';
  order_number: number;
  status: 'success' | 'failed';
  details: string;
}

export interface UserSession {
  id: string;
  name: string;
  role: Role;
  outlet?: OutletName;
  deliveryPartnerId?: string;
}

