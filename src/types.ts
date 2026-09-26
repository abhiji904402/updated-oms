export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';
export type DeliveryType = 'pickup' | 'delivery' | 'dine-in';
export type UserRole = 'admin' | 'outlet' | 'delivery' | 'customer';

export interface Order {
  id: string;
  order_id: number;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  delivery_date: string;
  delivery_time: string;
  items: string;
  total_amount: number;
  advance_amount: number;
  remaining_balance: number;
  status: OrderStatus;
  delivery_type: DeliveryType;
  outlet_name: string;
  delivered_by?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  otp?: string;
  image?: string;
  otp_verified?: boolean;
  payment_type?: string;
  payment_status?: 'paid' | 'unpaid' | 'partial';
  due_amount?: number;
  delivery_partner?: string;
}

export interface WhatsAppConfig {
  id: string;
  connected: boolean;
  phoneNumber?: string;
  sessionState?: string;
  qrCode?: string | null;
  qrExpiresAt?: number;
  businessName?: string;
  userName?: string;
  templates: {
    confirm: string;
    dispatch: string;
    delivered: string;
    reminder: string;
  };
  autoConfirmOnCreate: boolean;
  autoDispatchOnRider: boolean;
  autoDeliveryComplete: boolean;
  autoPaymentReminder: boolean;
  workingHoursOnly: boolean;
  throttleDelaySeconds: number;
  antiBanProtection: boolean;
}

export interface Outlet {
  id: string;
  name: string;
  location?: {
    lat: number;
    lng: number;
  };
  address?: string;
  manager?: string;
  phone?: string;
}
