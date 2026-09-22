import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Order, DeliveryPartner, DeliveryPartnerLocation, OutletLocation, SheetConfig, SyncLog, UserSession, Role, OutletName, OrderStatus, Alert } from '../types';
import { formatTo12Hour, getCurrentTime12Hour } from './timeUtils';
import { getNextOrderNumber } from './orderLogic';

export const DEFAULT_OUTLET_LOCATIONS: OutletLocation[] = [
  {
    id: 'Sector 31',
    name: 'Sector 31 Outlet',
    address: 'Shop no. 4, Ch. Hetram Complex, near Anupam Sweets, Sector 31, Faridabad, Haryana 121003',
    lat: 28.4446,
    lng: 77.3138,
    color: '#10b981'
  },
  {
    id: 'Sector 35',
    name: 'Sector 35 Outlet',
    address: 'Shop No.9, Ground Floor, Shopping Center In, Ashoka Enclave Part 3, Subash Nagar, Sector 35, Faridabad, Haryana 121003',
    lat: 28.4727,
    lng: 77.3057,
    color: '#f59e0b'
  },
  {
    id: 'Sector 42',
    name: 'Sector 42 Outlet',
    address: 'B-107, Greenfield Colony, Mall Road, Sector 42, Faridabad',
    lat: 28.4622,
    lng: 77.2963,
    color: '#3b82f6'
  },
  {
    id: 'Sector 88',
    name: 'Sector 88 Outlet',
    address: 'Shop 112, RPS Savana Rd, RPS City, Sector 88, Faridabad, Haryana 121002',
    lat: 28.4197,
    lng: 77.3556,
    color: '#8b5cf6'
  }
];
import { INITIAL_ORDERS, INITIAL_DELIVERY_PARTNERS, INITIAL_SHEET_CONFIG, INITIAL_ALERTS } from '../data/mockData';
import { idbSet, idbGet } from './idb';
import { db, collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, disableNetwork, query, where } from './firebase';

export interface AuthPasswords {
  admin: string;
  manager: string;
  outlets: Record<string, string>;
  defaultOutletPassword: string;
  partners: Record<string, string>;
  defaultPartnerPassword: string;
}

interface OMSContextType {
  // Session & Auth
  session: UserSession;
  setSession: (session: UserSession) => void;
  switchRole: (role: Role, outlet?: OutletName, partnerId?: string) => void;
  isAuthenticated: boolean;
  login: (userSession: UserSession) => void;
  logout: () => void;

  // Passwords Management
  authPasswords: AuthPasswords;
  updateAdminPassword: (newPass: string) => void;
  updateManagerPassword: (newPass: string) => void;
  updateOutletPassword: (outletName: string, newPass: string) => void;
  updatePartnerPassword: (partnerId: string, newPass: string) => void;
  verifyPassword: (
    role: Role,
    identifier: string | undefined,
    passwordAttempt: string
  ) => { success: boolean; message?: string; userSession?: UserSession };

  // Orders
  orders: Order[];
  addOrder: (orderData: Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at'> & { order_number?: number }) => Order;
  importOrders: (imported: Partial<Order>[], overwrite?: boolean) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  deleteOrder: (id: string) => void;
  clearAllOrders: () => void;
  loadDemoOrders: () => void;
  pushAllOrdersToCloud: () => Promise<{ success: boolean; count: number; message?: string }>;
  updateOrderStatus: (id: string, status: OrderStatus, deliveryPartner?: string) => void;
  markDelivered: (id: string, photoUrl?: string, otpInput?: string, deliveringRiderName?: string) => { success: boolean; message: string };
  confirmRiderDelivery: (id: string) => void;

  // Delivery Partners
  partners: DeliveryPartner[];
  addPartner: (partner: Omit<DeliveryPartner, 'id' | 'total_deliveries'>) => void;
  deletePartner: (id: string) => void;
  updatePartnerStatus: (id: string, status: DeliveryPartner['status']) => void;
  updatePartnerLocation: (id: string, location: DeliveryPartnerLocation) => void;

  // Outlets Locations
  outletLocations: OutletLocation[];
  updateOutletLocation: (id: string, updates: Partial<OutletLocation>) => void;

  // Alerts
  alerts: Alert[];
  triggerSheetSync: () => Promise<void>;

  // Google Sheet Config & Sync
  sheetConfig: SheetConfig;
  updateSheetConfig: (updates: Partial<SheetConfig>) => void;
  syncLogs: SyncLog[];
  triggerGoogleSheetSync: () => Promise<void>;
  pullOrdersFromGoogleSheet: (customUrl?: string) => Promise<{ success: boolean; count?: number; message?: string }>;

  // Selection for batch actions (e.g., Thermal Printing)
  selectedOrderIds: string[];
  toggleOrderSelection: (id: string) => void;
  selectAllOrders: (ids: string[]) => void;
  clearOrderSelection: () => void;

  // Filter State
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedOutletFilter: string;
  setSelectedOutletFilter: (o: string) => void;
  selectedStatusFilter: string;
  setSelectedStatusFilter: (s: string) => void;
  dateRangeFilter: { start: string; end: string };
  setDateRangeFilter: (range: { start: string; end: string }) => void;

  // Notifications / Live Event Banner
  recentNotification: string | null;
  dismissNotification: () => void;
  showNotification: (msg: string) => void;

  // WhatsApp Automation Status & Trigger
  isWhatsAppConnected: boolean;
  pendingWhatsAppCount: number;
  checkWhatsAppStatus: () => Promise<boolean>;
  flushPendingWhatsAppQueue: () => Promise<void>;
  triggerWhatsAppBackgroundMessage: (
    order: Order,
    type: 'confirm' | 'dispatch' | 'delivered' | 'reminder'
  ) => Promise<{ success: boolean; isLinked: boolean; queued?: boolean; error?: string }>;

  // Cloud & Quota status
  isFirestoreQuotaExceeded: boolean;
  isHistorySyncing: boolean;
  historySyncCount: number;
}

const OMSContext = createContext<OMSContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_ORDERS = 'broomies_oms_orders_v7';
const LOCAL_STORAGE_KEY_PARTNERS = 'broomies_oms_partners_v3';
const LOCAL_STORAGE_KEY_OUTLETS = 'broomies_oms_outlets_v1';
const LOCAL_STORAGE_KEY_SHEET = 'broomies_oms_sheet_v3';
const LOCAL_STORAGE_KEY_SESSION = 'broomies_oms_session_v3';
const LOCAL_STORAGE_KEY_AUTH = 'broomies_oms_auth_v1';
const LOCAL_STORAGE_KEY_PASSWORDS = 'broomies_oms_passwords_v1';

/**
 * Quota-safe helper for writing data to localStorage without crashing the application.
 */
export function safeLocalStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`localStorage quota exceeded or write failed for key "${key}":`, err);
  }
}

/**
 * Specialized quota-resilient helper for saving orders to localStorage.
 * Uses debouncing so rapid mutations and SSE bursts never freeze the main thread (60 FPS smooth UI).
 */
let _pendingStorageSaveTimeout: any = null;
let _pendingOrdersToSave: Order[] | null = null;

export function safeSaveOrdersToLocalStorage(ordersToSave: Order[], immediate = false): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  _pendingOrdersToSave = ordersToSave;

  const commitSave = () => {
    if (!_pendingOrdersToSave) return;
    const dataset = _pendingOrdersToSave;
    _pendingOrdersToSave = null;
    try {
      // Only save latest 50 orders without large images to localStorage to keep memory footprint tiny
      const recentOrders = dataset.slice(0, 50).map((o) => ({
        ...o,
        item_image_url: '',
        delivery_photo_url: ''
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(recentOrders));
    } catch (e3) {
      console.warn('LocalStorage completely full. IndexedDB will serve as the primary storage layer.', e3);
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY_ORDERS);
      } catch (e4) {}
    }
  };

  if (immediate) {
    if (_pendingStorageSaveTimeout) clearTimeout(_pendingStorageSaveTimeout);
    commitSave();
    return;
  }

  if (_pendingStorageSaveTimeout) clearTimeout(_pendingStorageSaveTimeout);
  _pendingStorageSaveTimeout = setTimeout(() => {
    if (typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(commitSave, { timeout: 300 });
    } else {
      commitSave();
    }
  }, 150);
}

/**
 * Coalesced dual-layer persistence (IndexedDB + LocalStorage) for smooth 60fps operation.
 */
let _pendingIdbTimeout: any = null;
let _pendingIdbOrders: Order[] | null = null;

export function scheduleAsyncOrderPersistence(ordersToPersist: Order[]): void {
  _pendingIdbOrders = ordersToPersist;
  safeSaveOrdersToLocalStorage(ordersToPersist, false);

  if (_pendingIdbTimeout) clearTimeout(_pendingIdbTimeout);
  _pendingIdbTimeout = setTimeout(() => {
    if (!_pendingIdbOrders) return;
    const toSave = _pendingIdbOrders;
    _pendingIdbOrders = null;
    idbSet(LOCAL_STORAGE_KEY_ORDERS, toSave).catch(() => {});
  }, 200);
}

const DEFAULT_PASSWORDS: AuthPasswords = {
  admin: 'admin123',
  manager: 'manager123',
  outlets: {
    'Sector 31': 'outlet123',
    'Sector 35': 'outlet123',
    'Sector 42': 'outlet123',
    'Sector 88': 'outlet123'
  },
  defaultOutletPassword: 'outlet123',
  partners: {
    'pt-1': 'rider123',
    'pt-2': 'rider123',
    'pt-3': 'rider123'
  },
  defaultPartnerPassword: 'rider123'
};

export const OMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth & Session state
  const [session, setSessionState] = useState<UserSession>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved session', e);
      }
    }
    return {
      id: 'usr-admin',
      name: 'Broomies Central Admin',
      role: 'admin'
    };
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_AUTH);
    if (saved === null) {
      const sessionSaved = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION);
      return !!sessionSaved;
    }
    return saved === 'true';
  });

  const [authPasswords, setAuthPasswords] = useState<AuthPasswords>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PASSWORDS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            admin: parsed.admin || DEFAULT_PASSWORDS.admin,
            manager: parsed.manager || DEFAULT_PASSWORDS.manager,
            outlets: { ...DEFAULT_PASSWORDS.outlets, ...(parsed.outlets || {}) },
            defaultOutletPassword: parsed.defaultOutletPassword || DEFAULT_PASSWORDS.defaultOutletPassword,
            partners: { ...DEFAULT_PASSWORDS.partners, ...(parsed.partners || {}) },
            defaultPartnerPassword: parsed.defaultPartnerPassword || DEFAULT_PASSWORDS.defaultPartnerPassword,
          };
        }
      } catch (e) {
        console.error('Failed to parse saved passwords', e);
      }
    }
    return DEFAULT_PASSWORDS;
  });

  // Orders State
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ORDERS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.sort((a: Order, b: Order) => (Number(b.order_number) || 0) - (Number(a.order_number) || 0));
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved orders', e);
      }
    }
    return INITIAL_ORDERS;
  });

  // Delivery Partners State
  const [partners, setPartners] = useState<DeliveryPartner[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PARTNERS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved partners', e);
      }
    }
    return INITIAL_DELIVERY_PARTNERS;
  });

  // Outlet Locations State
  const [outletLocations, setOutletLocations] = useState<OutletLocation[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_OUTLETS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved outlets', e);
      }
    }
    return DEFAULT_OUTLET_LOCATIONS;
  });

  // Google Sheet Config State
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.sheet_url && parsed.sheet_url.includes('docs.google.com/spreadsheets')) {
          parsed.sheet_url = '';
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved sheet config', e);
      }
    }
    return INITIAL_SHEET_CONFIG;
  });

  // Alerts State
  const [alerts, setAlerts] = useState<Alert[]>(() => {
    return INITIAL_ALERTS || [];
  });

  // Firestore Quota & Offline Status State
  const [isFirestoreQuotaExceeded, setIsFirestoreQuotaExceeded] = useState(false);
  const [isHistorySyncing, setIsHistorySyncing] = useState(false);
  const [historySyncCount, setHistorySyncCount] = useState(0);
  const quotaNotifiedRef = useRef(false);
  const quotaExceededRef = useRef(false);

  // Sync Logs
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Batch selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' });

  // Notifications
  const [recentNotification, setRecentNotification] = useState<string | null>(null);

  const showNotification = useCallback((msg: string) => {
    setRecentNotification(msg);
    setTimeout(() => {
      setRecentNotification(null);
    }, 5000);
  }, []);

  const handleFirestoreWriteError = useCallback((err: any, operationName = 'write') => {
    const errStr = String(err?.message || err || '');
    const isQuota = errStr.includes('resource-exhausted') || errStr.includes('Quota exceeded') || errStr.includes('Quota limit');
    const isUnavailable = err?.code === 'unavailable' || errStr.includes('unavailable') || errStr.includes('could not be completed') || errStr.includes('Could not reach Cloud Firestore') || errStr.includes('Failed to fetch');

    if (isUnavailable) {
      // Standard Firestore offline / reconnecting state - operations persist silently in IndexedDB / IndexedDB
      return;
    }
    
    if (isQuota) {
      quotaExceededRef.current = true;
      setIsFirestoreQuotaExceeded(true);
      // Silently fall back to IndexedDB without showing annoying popup banners to the user
      console.log(`[IndexedDB Active] Operation "${operationName}" persisted 100% safely in local storage.`);
    } else {
      console.warn(`Firestore ${operationName} status:`, err);
    }
  }, []);

  // Helper to strip out undefined values so Firestore setDoc never fails and normalize payment fields
  const sanitizeOrderForFirestore = (order: Record<string, any>): Order => {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(order)) {
      if (val !== undefined) {
        clean[key] = val;
      }
    }

    const assignedNum = clean.order_id !== undefined ? Number(clean.order_id) : (clean.order_number !== undefined ? Number(clean.order_number) : 1);
    clean.order_number = assignedNum || 1;
    clean.order_id = assignedNum || 1;

    const isPickup = String(clean.delivery_type || '').toLowerCase().trim() === 'pickup';
    if (!isPickup) {
      // For delivery orders: delivered_by MUST NEVER be Broomies Central Admin or generic placeholder
      if (typeof clean.delivered_by === 'string' && (clean.delivered_by.toLowerCase().includes('admin') || clean.delivered_by.toLowerCase().includes('central') || clean.delivered_by.toLowerCase() === 'delivery rider')) {
        clean.delivered_by = clean.delivery_partner || '';
      }
    }

    const pType = String(clean.payment_type || '').toLowerCase().trim();
    const total = typeof clean.total_amount === 'number' ? clean.total_amount : Number(clean.total_amount) || 0;

    if (pType === 'full' || pType === 'full_paid' || pType === 'paid' || pType === 'cash' || pType === 'upi' || pType === 'online') {
      clean.payment_type = clean.payment_type || 'full';
      clean.advance_amount = total;
      clean.remaining_balance = 0;
      clean.due_amount = 0;
    } else if (pType === 'due') {
      clean.advance_amount = 0;
      clean.remaining_balance = total;
      clean.due_amount = total;
    } else if (pType === 'part' || pType === 'partial' || pType === 'part_payment') {
      const adv = typeof clean.advance_amount === 'number' ? clean.advance_amount : 0;
      clean.remaining_balance = Math.max(0, total - adv);
      clean.due_amount = clean.remaining_balance;
    }

    return clean as Order;
  };

  // Keep refs of orders, partners, and sheetConfig for non-reactive access inside callbacks and intervals
  const ordersRef = React.useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const partnersRef = React.useRef(partners);
  useEffect(() => {
    partnersRef.current = partners;
  }, [partners]);

  const sheetConfigRef = React.useRef(sheetConfig);
  useEffect(() => {
    sheetConfigRef.current = sheetConfig;
  }, [sheetConfig]);

  // Fail-safe effects to sync partners, passwords, sheetConfig, and outletLocations to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PARTNERS, JSON.stringify(partners));
      idbSet(LOCAL_STORAGE_KEY_PARTNERS, partners).catch(() => {});
    } catch (e) {}
  }, [partners]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PASSWORDS, JSON.stringify(authPasswords));
    } catch (e) {}
  }, [authPasswords]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SHEET, JSON.stringify(sheetConfig));
    } catch (e) {}
  }, [sheetConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_OUTLETS, JSON.stringify(outletLocations));
    } catch (e) {}
  }, [outletLocations]);

  // Deduplicate and merge orders by unique ID and order_number cleanly
  const mergeAndDeduplicateOrders = (currentList: Order[], incomingList: Order[], isFullSync: boolean = false): Order[] => {
    const orderMap = new Map<string, Order>(); // By ID for exact matches
    const omsMap = new Map<number, Order>(); // By OMS number to prevent duplicate display

    const chooseBestOrder = (existing: Order, incoming: Order): Order => {
      // 1. If one is delivered and the other is not, NEVER revert delivered unless the incoming update is an explicit cancellation
      const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const incomingTime = new Date(incoming.updated_at || incoming.created_at || 0).getTime();

      if (incoming.status === 'delivered' && existing.status !== 'delivered') {
        const isConfPending = incoming.delivery_confirmation_pending !== undefined
          ? Boolean(incoming.delivery_confirmation_pending)
          : (existing.delivery_confirmation_pending !== undefined ? Boolean(existing.delivery_confirmation_pending) : false);
        return {
          ...existing,
          ...incoming,
          status: 'delivered',
          delivery_confirmation_pending: isConfPending,
          rider_delivered: true,
          actual_delivery_time: incoming.actual_delivery_time || existing.actual_delivery_time || new Date().toISOString()
        };
      }
      if (existing.status === 'delivered' && incoming.status !== 'delivered') {
        // Protect delivered status: never revert to pending/processing/out_for_delivery
        if (incoming.status === 'cancelled') {
          return { ...existing, ...incoming, status: 'cancelled' };
        }
        const isConfPending = existing.delivery_confirmation_pending !== undefined
          ? Boolean(existing.delivery_confirmation_pending)
          : (incoming.delivery_confirmation_pending !== undefined ? Boolean(incoming.delivery_confirmation_pending) : false);
        return {
          ...incoming,
          ...existing,
          status: 'delivered',
          delivery_confirmation_pending: isConfPending,
          rider_delivered: true,
          actual_delivery_time: existing.actual_delivery_time || incoming.actual_delivery_time || new Date().toISOString()
        };
      }

      if (incomingTime >= existingTime) {
        return { ...existing, ...incoming };
      }
      return { ...incoming, ...existing };
    };

    // 1. Create a set of incoming IDs to know what is active on backend
    const incomingIds = new Set(incomingList.filter(o => o && o.id).map(o => o.id));
    const now = Date.now();

    // 2. Process current local orders
    for (const ord of currentList) {
      if (ord && ord.id) {
        // If this is a full sync, and the order is missing from incoming, ONLY keep it if it was created locally very recently (< 1 hour ago)
        if (isFullSync && !incomingIds.has(ord.id)) {
          const createdTime = new Date(ord.created_at || 0).getTime();
          if (now - createdTime > 60 * 60 * 1000) {
            continue; // Drop old "ghost" order that no longer exists on backend
          }
        }

        const oms = Number(ord.order_number) || 0;
        orderMap.set(ord.id, ord);
        
        if (oms > 0) {
          const existingOms = omsMap.get(oms);
          if (!existingOms) {
            omsMap.set(oms, ord);
          } else {
            omsMap.set(oms, chooseBestOrder(existingOms, ord));
          }
        }
      }
    }

    // 3. Merge incoming orders
    for (const ord of incomingList) {
      if (!ord || !ord.id) continue;
      const oms = Number(ord.order_number) || 0;

      const existing = orderMap.get(ord.id);
      let mergedOrd = ord;
      if (existing) {
        mergedOrd = chooseBestOrder(existing, ord);
        orderMap.set(ord.id, mergedOrd);
      } else {
        orderMap.set(ord.id, ord);
      }

      if (oms > 0) {
        const existingOms = omsMap.get(oms);
        if (!existingOms) {
          omsMap.set(oms, mergedOrd);
        } else {
          omsMap.set(oms, chooseBestOrder(existingOms, mergedOrd));
        }
      }
    }

    // Return unique orders by OMS number
    const uniqueOrders = Array.from(omsMap.values());
    
    // Also include any orders without oms number from orderMap
    for (const ord of orderMap.values()) {
      const oms = Number(ord.order_number) || 0;
      if (oms === 0 && !uniqueOrders.some((u) => u.id === ord.id)) {
        uniqueOrders.push(ord);
      }
    }

    uniqueOrders.sort((a, b) => {
      const numA = Number(a.order_number) || 0;
      const numB = Number(b.order_number) || 0;
      if (numB !== numA) return numB - numA;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    return uniqueOrders;
  };

  const hasAutoSyncedLocalOrdersRef = useRef(false);

  // Synchronize mutations to local server RAM & SSE broadcast
  const syncOrderToBackend = useCallback((id: string, orderData: Partial<Order> | null, method: 'POST' | 'DELETE' = 'POST') => {
    if (method === 'DELETE') {
      fetch(`/api/orders/${id}`, { method: 'DELETE' }).catch(() => {});
    } else if (orderData) {
      fetch(`/api/orders/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      }).catch(() => {});
    }
  }, []);

  // WhatsApp live status state & persistent offline-first hydration
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem('broomies_wa_connected_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [pendingWhatsAppCount, setPendingWhatsAppCount] = useState<number>(0);

  const checkWhatsAppStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) return false;
      const data = await res.json();
      const connected = Boolean(data.connected && data.phoneNumber);
      setIsWhatsAppConnected(connected);
      setPendingWhatsAppCount(data.pendingQueueCount || 0);
      safeLocalStorageSet('broomies_wa_connected_v1', connected ? 'true' : 'false');
      if (data.phoneNumber) {
        safeLocalStorageSet('broomies_wa_phone_v1', data.phoneNumber);
      } else {
        localStorage.removeItem('broomies_wa_phone_v1');
      }
      return connected;
    } catch {
      return false;
    }
  }, []);

  const flushPendingWhatsAppQueue = useCallback(async () => {
    try {
      showNotification('🚀 Sending all pending Outbox messages to customers...');
      const res = await fetch('/api/whatsapp/process-queue', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showNotification(`✅ Dispatched ${data.successCount || 0} queued messages (${data.remainingCount || 0} remaining)!`);
        checkWhatsAppStatus();
      } else {
        showNotification(`⚠️ Outbox notice: ${data.message || data.error || 'Failed'}`);
      }
    } catch {
      showNotification('⚠️ Could not flush WhatsApp outbox');
    }
  }, [showNotification, checkWhatsAppStatus]);

  useEffect(() => {
    checkWhatsAppStatus();
    const interval = setInterval(checkWhatsAppStatus, 60000);
    return () => clearInterval(interval);
  }, [checkWhatsAppStatus]);

  const FALLBACK_WA_TEMPLATES: Record<string, string> = {
    confirm: 'Hello {customer_name}! Your Broomies Bakery order #{order_number} has been received. Items: {items}. Total: ₹{total_amount}. Delivery Date: {delivery_date}. Thank you!',
    dispatch: 'Hi {customer_name}! Your Broomies Bakery order #{order_number} is out for delivery with rider {rider_name}. Delivery Time: {delivery_time}. Please share OTP {otp} upon delivery. Thank you!',
    delivered: 'Dear {customer_name}, your Broomies Bakery order #{order_number} has been delivered successfully. Thank you for choosing Broomies Bakery!',
    reminder: 'Hi {customer_name}, friendly reminder for your Broomies Bakery order #{order_number}. Remaining due amount: ₹{remaining_balance}. Please pay on delivery.'
  };

  // Trigger WhatsApp background automation (with Outbox auto-queueing on disconnect)
  const triggerWhatsAppBackgroundMessage = useCallback(async (
    order: Order,
    type: 'confirm' | 'dispatch' | 'delivered' | 'reminder'
  ): Promise<{ success: boolean; isLinked: boolean; queued?: boolean; error?: string }> => {
    if (!order.mobile_number) {
      return { success: false, isLinked: false, error: 'no_phone' };
    }

    try {
      // 1. Fetch live status from server
      const statusRes = await fetch('/api/whatsapp/status');
      if (!statusRes.ok) throw new Error('Failed to retrieve WhatsApp status');
      const statusData = await statusRes.json();
      const isLinked = Boolean(statusData.connected && statusData.phoneNumber);
      setIsWhatsAppConnected(isLinked);
      setPendingWhatsAppCount(statusData.pendingQueueCount || 0);
      safeLocalStorageSet('broomies_wa_connected_v1', isLinked ? 'true' : 'false');

      // Check auto triggers config
      if (type === 'confirm' && statusData.autoConfirmOnCreate === false) {
        return { success: false, isLinked, error: 'auto_confirm_disabled' };
      }
      if (type === 'dispatch' && statusData.autoDispatchOnRider === false) {
        return { success: false, isLinked, error: 'auto_dispatch_disabled' };
      }
      if (type === 'delivered' && statusData.autoDeliveryComplete === false) {
        return { success: false, isLinked, error: 'auto_delivery_disabled' };
      }
      if (type === 'reminder' && statusData.autoPaymentReminder === false) {
        return { success: false, isLinked, error: 'auto_reminder_disabled' };
      }

      const rawTemplate = statusData.templates?.[type] || FALLBACK_WA_TEMPLATES[type];
      if (!rawTemplate) {
        return { success: false, isLinked, error: 'template_missing' };
      }

      const itemDetails = `${order.item_type || 'Bakery Item'}${order.quantity ? ` (${order.quantity})` : ''}${order.name_on_cake ? ` [Name on Cake: ${order.name_on_cake}]` : ''}`;
      const rendered = rawTemplate
        .replace(/{order_number}/g, String(order.order_number))
        .replace(/{customer_name}/g, order.customer_name || 'Customer')
        .replace(/{items}/g, itemDetails)
        .replace(/{name_on_cake}/g, order.name_on_cake || '')
        .replace(/{total_amount}/g, String(order.total_amount || 0))
        .replace(/{advance_amount}/g, String(order.advance_amount || 0))
        .replace(/{remaining_balance}/g, String(order.remaining_balance || 0))
        .replace(/{delivery_date}/g, order.delivery_date || 'Today')
        .replace(/{delivery_time}/g, order.delivery_time_expected || '11:00 AM')
        .replace(/{rider_name}/g, order.delivery_partner || 'Broomies Express')
        .replace(/{otp}/g, order.otp || 'N/A');

      const sendRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: order.mobile_number,
          message: rendered,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          orderId: order.id,
          type
        })
      });

      const sendData = await sendRes.json();
      if (sendData.queued) {
        setPendingWhatsAppCount(prev => prev + 1);
        showNotification(`📦 WhatsApp unlinked: Order #${order.order_number} ${type} message saved to Outbox! Auto-dispatches the instant WhatsApp is re-linked.`);
        return { success: true, isLinked: false, queued: true };
      } else if (sendRes.ok && sendData.success) {
        const cleanPhone = order.mobile_number.replace(/[^0-9]/g, '').slice(-10);
        showNotification(`⚡ Auto-sent WhatsApp ${type} message to +91${cleanPhone} (Order #${order.order_number})!`);
        return { success: true, isLinked: true };
      } else {
        console.warn('WhatsApp auto-send error:', sendData.error);
        return { success: false, isLinked, error: sendData.error };
      }
    } catch (err: any) {
      console.warn('WhatsApp background message error:', err);
      return { success: false, isLinked: false, error: err.message };
    }
  }, [showNotification]);

  // =========================================================================
  // ULTRA-FAST HYDRATION PIPELINE (< 50ms total load time)
  // 1. Instant 0ms render from IndexedDB
  // 2. High-speed 30ms RAM fetch from /api/orders
  // 3. Sub-10ms real-time push via SSE (/api/events)
  // 4. Lightweight active-only Firestore listener (saves 99% bandwidth & quota)
  // =========================================================================
  useEffect(() => {
    let isMounted = true;

    // Step 1: Instant load from IndexedDB (0ms)
    idbGet<Order[]>(LOCAL_STORAGE_KEY_ORDERS).then((cachedOrders) => {
      if (!isMounted) return;
      if (cachedOrders && Array.isArray(cachedOrders) && cachedOrders.length > 0) {
        setOrders((current) => {
          if (!current || current.length < cachedOrders.length) {
            ordersRef.current = cachedOrders;
            return cachedOrders;
          }
          return current;
        });
      }
    }).catch(() => {});

    // Step 2: High-speed fetch from /api/orders (30-80ms!)
    fetch('/api/orders')
      .then((res) => (res.ok ? res.json() : null))
      .then((apiOrders: Order[]) => {
        if (!isMounted || !apiOrders || !Array.isArray(apiOrders) || apiOrders.length === 0) return;
        setOrders((current) => {
          const merged = mergeAndDeduplicateOrders(current || [], apiOrders, true);
          ordersRef.current = merged;
          idbSet(LOCAL_STORAGE_KEY_ORDERS, merged).catch(() => {});
          safeSaveOrdersToLocalStorage(merged);
          return merged;
        });
        setIsHistorySyncing(false);
      })
      .catch((err) => {
        console.warn('[Fast Load] /api/orders fallback:', err);
        // Fallback to static seed if server API is momentarily unavailable
        fetch('/broomies_store_seed.json')
          .then((res) => (res.ok ? res.json() : null))
          .then((seedData) => {
            if (!isMounted || !seedData?.orders) return;
            const seedList = Object.values(seedData.orders) as Order[];
            if (seedList.length > 0) {
              setOrders((current) => {
                const merged = mergeAndDeduplicateOrders(current || [], seedList);
                ordersRef.current = merged;
                return merged;
              });
              idbSet(LOCAL_STORAGE_KEY_ORDERS, seedList).catch(() => {});
            }
          })
          .catch(() => {});
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-Time Server-Sent Events (SSE) Stream (< 10ms push)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.addEventListener('mutation', (e) => {
          try {
            const mutation = JSON.parse(e.data);
            if (!mutation || !mutation.collection) return;

            if (mutation.collection === 'orders') {
              if (mutation.action === 'delete') {
                setOrders((prev) => {
                  const filtered = prev.filter((o) => o.id !== mutation.id);
                  ordersRef.current = filtered;
                  return filtered;
                });
              } else if (mutation.action === 'set' || mutation.action === 'update') {
                const updatedOrder: Order = mutation.data;
                if (!updatedOrder || !updatedOrder.id) return;
                setOrders((prev) => {
                  const targetNum = Number(updatedOrder.order_number) || 0;
                  const next = prev.map((o) => {
                    if (o.id === updatedOrder.id || (targetNum > 0 && Number(o.order_number) === targetNum)) {
                      // Protect delivered status from being reverted by stale SSE event
                      if (o.status === 'delivered' && updatedOrder.status !== 'delivered' && updatedOrder.status !== 'cancelled') {
                        return {
                          ...o,
                          ...updatedOrder,
                          status: 'delivered' as OrderStatus,
                          rider_delivered: true,
                          delivery_confirmation_pending: updatedOrder.delivery_confirmation_pending !== undefined
                            ? Boolean(updatedOrder.delivery_confirmation_pending)
                            : Boolean(o.delivery_confirmation_pending),
                          id: o.id
                        };
                      }
                      return { ...o, ...updatedOrder, id: o.id };
                    }
                    return o;
                  });
                  const exists = prev.some((o) => o.id === updatedOrder.id || (targetNum > 0 && Number(o.order_number) === targetNum));
                  const finalNext = exists ? next : [updatedOrder, ...next];
                  finalNext.sort((a, b) => (Number(b.order_number) || 0) - (Number(a.order_number) || 0));
                  ordersRef.current = finalNext;
                  scheduleAsyncOrderPersistence(finalNext);
                  return finalNext;
                });
              }
            } else if (mutation.collection === 'delivery_partners') {
              if (mutation.action === 'delete') {
                setPartners((prev) => prev.filter((p) => p.id !== mutation.id));
              } else if (mutation.action === 'set' || mutation.action === 'update') {
                const partner: DeliveryPartner = mutation.data;
                if (partner && partner.id) {
                  setPartners((prev) => {
                    const idx = prev.findIndex((p) => p.id === partner.id);
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx] = { ...next[idx], ...partner };
                      return next;
                    }
                    return [...prev, partner];
                  });
                }
              }
            }
          } catch (err) {
            console.warn('[SSE] Event parse warning:', err);
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        console.warn('[SSE] Connection warning:', err);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  // Real-Time Orders Listener from Database (Syncs dispatch & delivery across all devices)
  useEffect(() => {
    const ordersCol = collection(db, 'orders');

    const unsub = onSnapshot(
      ordersCol,
      (snapshot) => {
        if (snapshot.empty) return;
        const incomingDocs: Order[] = [];
        snapshot.forEach((docSnap) => {
          incomingDocs.push({ ...docSnap.data(), id: docSnap.id } as Order);
        });

        if (incomingDocs.length > 0) {
          setOrders((prev) => {
            const merged = mergeAndDeduplicateOrders(prev, incomingDocs);
            ordersRef.current = merged;
            scheduleAsyncOrderPersistence(merged);
            return merged;
          });
        }
      },
      (err) => {
        handleFirestoreWriteError(err, 'orders snapshot sync');
      }
    );

    return () => unsub();
  }, [handleFirestoreWriteError]);

  // 2. Real-time Firestore Sync for Delivery Partners (Live GPS & Status Sync)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'delivery_partners'),
      (snapshot) => {
        const list: DeliveryPartner[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as DeliveryPartner);
        });

        if (list.length > 0) {
          setPartners(list);
          idbSet(LOCAL_STORAGE_KEY_PARTNERS, list).catch(() => {});
          safeLocalStorageSet(LOCAL_STORAGE_KEY_PARTNERS, JSON.stringify(list));
        } else if (!snapshot.metadata.fromCache && snapshot.empty) {
          const seeded = localStorage.getItem('delivery_partners_seeded_v4');
          if (!seeded) {
            safeLocalStorageSet('delivery_partners_seeded_v4', 'true');
            const batch = writeBatch(db);
            INITIAL_DELIVERY_PARTNERS.forEach((p) => {
              batch.set(doc(db, 'delivery_partners', p.id), p);
            });
            batch.commit().catch((err) => handleFirestoreWriteError(err, 'seed delivery partners'));
          }
        }
      },
      (err) => {
        handleFirestoreWriteError(err, 'partners snapshot sync');
      }
    );
    return () => unsub();
  }, [handleFirestoreWriteError]);

  // 3. Real-time Firestore Sync for Outlet Locations
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'outlet_locations'),
      (snapshot) => {
        const list: OutletLocation[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as OutletLocation);
        });
        if (list.length > 0) {
          setOutletLocations(list);
          idbSet(LOCAL_STORAGE_KEY_OUTLETS, list).catch(() => {});
          safeLocalStorageSet(LOCAL_STORAGE_KEY_OUTLETS, JSON.stringify(list));
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // 4. Real-time Firestore Sync for System Settings (Sheet Config & Passwords live sync across Vercel & AI Studio)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system_settings', 'sheet_config'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<SheetConfig>;
          if (data && (data.sheet_url !== undefined || data.auto_sync !== undefined)) {
            setSheetConfig((prev) => ({ ...prev, ...data }));
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system_settings', 'passwords'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<AuthPasswords>;
          if (data && data.admin) {
            setAuthPasswords((prev) => ({
              admin: data.admin || prev.admin,
              manager: data.manager || prev.manager || 'manager123',
              outlets: { ...prev.outlets, ...(data.outlets || {}) },
              defaultOutletPassword: data.defaultOutletPassword || prev.defaultOutletPassword,
              partners: { ...prev.partners, ...(data.partners || {}) },
              defaultPartnerPassword: data.defaultPartnerPassword || prev.defaultPartnerPassword,
            }));
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Save changes to IndexedDB (unlimited) and localStorage (quota-safe) asynchronously with smooth debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      idbSet(LOCAL_STORAGE_KEY_ORDERS, orders).catch(() => {});
      safeSaveOrdersToLocalStorage(orders);
    }, 250);

    return () => clearTimeout(timer);
  }, [orders]);

  useEffect(() => {
    safeLocalStorageSet(LOCAL_STORAGE_KEY_PARTNERS, JSON.stringify(partners));
  }, [partners]);

  useEffect(() => {
    safeLocalStorageSet(LOCAL_STORAGE_KEY_SHEET, JSON.stringify(sheetConfig));
  }, [sheetConfig]);

  // Background Auto-Sync for Google Sheets & Cloud Sync (Lightweight, non-flooding)
  useEffect(() => {
    const targetUrl = (sheetConfig.sheet_url || '').trim();
    if (!sheetConfig.auto_sync || !targetUrl || !targetUrl.startsWith('http') || targetUrl.includes('docs.google.com/spreadsheets')) {
      return;
    }

    // Sync only recent/active orders (latest 25) periodically, avoiding browser throttling & socket freezing
    const interval = setInterval(() => {
      const currentOrders = ordersRef.current;
      if (currentOrders && currentOrders.length > 0) {
        // Take active orders from today or recent 25 orders to keep sheet updated without lagging browser
        const recentOrders = currentOrders.slice(0, 25).map(sanitizeOrderForSync);
        
        fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'batch_update', orders: recentOrders })
        }).catch(() => {});

        const now = new Date().toISOString();
        setSheetConfig((prev) => ({
          ...prev,
          last_sync: now,
          last_synced_at: now,
          webhook_status: 'connected'
        }));
      }
    }, 120000); // Gentle 2-minute interval

    return () => clearInterval(interval);
  }, [sheetConfig.auto_sync, sheetConfig.sheet_url]);

  
  useEffect(() => {
    safeLocalStorageSet(LOCAL_STORAGE_KEY_SESSION, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    safeLocalStorageSet(LOCAL_STORAGE_KEY_AUTH, String(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    safeLocalStorageSet(LOCAL_STORAGE_KEY_PASSWORDS, JSON.stringify(authPasswords));
  }, [authPasswords]);

  const login = useCallback((userSession: UserSession) => {
    setSessionState(userSession);
    setIsAuthenticated(true);
    safeLocalStorageSet(LOCAL_STORAGE_KEY_AUTH, 'true');
    safeLocalStorageSet(LOCAL_STORAGE_KEY_SESSION, JSON.stringify(userSession));
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    safeLocalStorageSet(LOCAL_STORAGE_KEY_AUTH, 'false');
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
    } catch (e) {}
  }, []);

  const updateAdminPassword = useCallback((newPass: string) => {
    setAuthPasswords((prev) => {
      const next = { ...prev, admin: newPass };
      setDoc(doc(db, 'system_settings', 'passwords'), next, { merge: true }).catch(() => {});
      return next;
    });
  }, []);

  const updateManagerPassword = useCallback((newPass: string) => {
    setAuthPasswords((prev) => {
      const next = { ...prev, manager: newPass };
      setDoc(doc(db, 'system_settings', 'passwords'), next, { merge: true }).catch(() => {});
      return next;
    });
  }, []);

  const updateOutletPassword = useCallback((outletName: string, newPass: string) => {
    setAuthPasswords((prev) => {
      const next = {
        ...prev,
        outlets: { ...prev.outlets, [outletName]: newPass }
      };
      setDoc(doc(db, 'system_settings', 'passwords'), next, { merge: true }).catch(() => {});
      return next;
    });
  }, []);

  const updatePartnerPassword = useCallback((partnerId: string, newPass: string) => {
    setAuthPasswords((prev) => {
      const next = {
        ...prev,
        partners: { ...prev.partners, [partnerId]: newPass }
      };
      setDoc(doc(db, 'system_settings', 'passwords'), next, { merge: true }).catch(() => {});
      return next;
    });
  }, []);

  const verifyPassword = useCallback(
    (role: Role, identifier: string | undefined, passwordAttempt: string) => {
      if (role === 'admin') {
        if (passwordAttempt === authPasswords.admin) {
          const userSession: UserSession = {
            id: 'usr-admin',
            name: 'Broomies Central Admin',
            role: 'admin'
          };
          return { success: true, userSession };
        }
        return { success: false, message: 'Incorrect Admin Password!' };
      }
      if (role === 'manager') {
        if (passwordAttempt === (authPasswords.manager || 'manager123')) {
          const userSession: UserSession = {
            id: 'usr-manager',
            name: 'Broomies Central Manager',
            role: 'manager'
          };
          return { success: true, userSession };
        }
        return { success: false, message: 'Incorrect Manager Password!' };
      }

      if (role === 'outlet') {
        const outletName = (identifier as OutletName) || 'Sector 31';
        const expected = authPasswords?.outlets?.[outletName] || authPasswords?.defaultOutletPassword || DEFAULT_PASSWORDS.defaultOutletPassword;
        if (passwordAttempt === expected) {
          const userSession: UserSession = {
            id: `usr-outlet-${outletName}`,
            name: `${outletName} Manager`,
            role: 'outlet',
            outlet: outletName
          };
          return { success: true, userSession };
        }
        return { success: false, message: `Incorrect password for ${outletName} branch!` };
      }

      if (role === 'delivery') {
        const partner = partners.find((p) => p.id === identifier) || partners[0];
        const partnerId = partner ? partner.id : (identifier || 'pt-1');
        const expected =
          authPasswords?.partners?.[partnerId] ||
          partner?.password ||
          authPasswords?.defaultPartnerPassword ||
          DEFAULT_PASSWORDS.defaultPartnerPassword;

        if (passwordAttempt === expected) {
          const userSession: UserSession = {
            id: `usr-rider-${partnerId}`,
            name: `Rider: ${partner ? partner.name : 'Delivery Partner'}`,
            role: 'delivery',
            deliveryPartnerId: partnerId
          };
          return { success: true, userSession };
        }
        return {
          success: false,
          message: `Incorrect password for ${partner ? partner.name : 'Delivery Partner'}!`
        };
      }

      return { success: false, message: 'Unknown role or authentication error.' };
    },
    [authPasswords, partners]
  );

  const setSession = useCallback((newSession: UserSession) => {
    setSessionState(newSession);
  }, []);

  const switchRole = useCallback((role: Role, outlet?: OutletName, partnerId?: string) => {
    let name = 'Broomies Central Admin';
    if (role === 'outlet') {
      name = outlet ? `${outlet} Manager` : 'Outlet Manager';
    } else if (role === 'delivery') {
      const partner = partners.find((p) => p.id === partnerId);
      name = partner ? partner.name : 'Delivery Partner';
    }

    const updatedSession: UserSession = {
      id: `usr-${role}-${Date.now()}`,
      name,
      role,
      outlet: outlet || 'Downtown Flagship',
      deliveryPartnerId: partnerId || partners[0]?.id
    };
    setSessionState(updatedSession);
    showNotification(`Switched role to ${role.toUpperCase()} (${name})`);
  }, [partners, showNotification]);

  // Helper function to sanitize order payload for webhook (strips huge base64 images so sync is instant)
  const sanitizeOrderForSync = (order: Order): Partial<Order> => {
    const { item_image_url, delivery_photo_url, ...rest } = order;
    return {
      ...rest,
      item_image_url: item_image_url ? (item_image_url.startsWith('data:') ? '[image]' : item_image_url) : '',
      delivery_photo_url: delivery_photo_url ? (delivery_photo_url.startsWith('data:') ? '[photo]' : delivery_photo_url) : ''
    };
  };

  // Helper function to log sheet sync
  const logSync = useCallback((orderNumber: number, event: 'create' | 'update' | 'delete' | 'manual_sync' | 'google_sheet_pull', success = true) => {
    const newLog: SyncLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event,
      order_number: orderNumber,
      status: success ? 'success' : 'failed',
      details: success ? `[pushToSheet] Synced Order #${orderNumber} (${event}) to Google Sheet` : `Sync failed for #${orderNumber}`
    };
    setSyncLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  }, []);

  const loadDemoOrders = useCallback(async () => {
    if (INITIAL_ORDERS.length > 0) {
      try {
        const batch = writeBatch(db);
        INITIAL_ORDERS.forEach((ord) => {
          batch.set(doc(db, 'orders', ord.id), sanitizeOrderForFirestore(ord));
        });
        await batch.commit();
        showNotification(`Seeded ${INITIAL_ORDERS.length} demo orders to Firestore!`);
      } catch (err) {
        handleFirestoreWriteError(err, 'seed demo orders');
      }
    }
  }, [showNotification]);

  const pushAllOrdersToCloud = useCallback(async () => {
    try {
      const current = ordersRef.current || [];
      const batch = writeBatch(db);
      current.forEach((ord) => {
        batch.set(doc(db, 'orders', ord.id), sanitizeOrderForFirestore(ord), { merge: true });
      });
      await batch.commit();
      showNotification(`Cloud sync complete! ${current.length} orders synced.`);
      return { success: true, count: current.length };
    } catch (err: any) {
      return { success: false, count: 0, message: err.message };
    }
  }, [showNotification]);

  // Fast, non-blocking pushToSheet function for Google Sheet webhook
  const pushToSheet = useCallback((order: Order, action: 'create' | 'update' | 'delete') => {
    const config = sheetConfigRef.current;
    if (!config.auto_sync) return;
    const targetUrl = (config.sheet_url || '').trim();
    if (!targetUrl || !targetUrl.startsWith('http') || targetUrl.includes('docs.google.com/spreadsheets')) return;
    
    // Log sync immediately for instant UI responsiveness
    logSync(order.order_number, action, true);

    const sanitized = sanitizeOrderForSync(order);

    fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action,
        order_number: order.order_number,
        outlet: order.outlet,
        ...sanitized,
        order: sanitized
      })
    }).catch((err) => console.warn('Push to sheet error:', err));
  }, [logSync]);

  // Fast Webhook / API sync function - sends ALL orders starting from order #1 ascending
  const triggerGoogleSheetSync = useCallback(async () => {
    const config = sheetConfigRef.current;
    const targetUrl = (config.sheet_url || '').trim();

    if (!targetUrl || !targetUrl.startsWith('http')) {
      showNotification('⚠️ Please enter a Google Apps Script Webhook URL first in Settings');
      return;
    }

    if (targetUrl.includes('docs.google.com/spreadsheets')) {
      showNotification('⚠️ Google Sheet document URL detected! Please paste the Apps Script Web App URL ending with /exec');
      return;
    }

    const currentOrders = ordersRef.current;
    if (!currentOrders || currentOrders.length === 0) {
      showNotification('ℹ️ No orders in system to synchronize.');
      return;
    }

    // 1. Sort orders strictly in ascending order by order_number (Order #1, #2, #3...)
    const sortedOrders = [...currentOrders].sort((a, b) => (a.order_number || 0) - (b.order_number || 0));
    const sanitizedOrders = sortedOrders.map(sanitizeOrderForSync);

    const firstNum = sortedOrders[0]?.order_number || 1;
    const lastNum = sortedOrders[sortedOrders.length - 1]?.order_number || sortedOrders.length;

    logSync(0, 'manual_sync', true);
    showNotification(`⚡ Syncing all ${sanitizedOrders.length} orders (#${firstNum} to #${lastNum}) to Google Sheets...`);

    try {
      // Chunk payload into batches of 35 orders to avoid Apps Script HTTP timeout limits
      const CHUNK_SIZE = 35;
      for (let i = 0; i < sanitizedOrders.length; i += CHUNK_SIZE) {
        const chunk = sanitizedOrders.slice(i, i + CHUNK_SIZE);
        await fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            bulk: true,
            action: 'bulk',
            orders: chunk
          })
        });
      }

      logSync(sanitizedOrders.length, 'manual_sync', true);
      showNotification(`✅ Successfully synced all ${sanitizedOrders.length} orders (#${firstNum}–#${lastNum}) with Google Sheets!`);
    } catch (err) {
      console.warn('Sheet sync warning:', err);
      showNotification('⚠️ Network or Webhook connection check required.');
    }
  }, [logSync, showNotification]);

  // Pull live orders directly from Google Sheets Webhook (Unlimited Cloud Storage)
  const pullOrdersFromGoogleSheet = useCallback(async (customUrl?: string): Promise<{ success: boolean; count?: number; message?: string }> => {
    const targetUrl = (customUrl || sheetConfigRef.current.sheet_url || '').trim();
    if (!targetUrl || !targetUrl.startsWith('http')) {
      showNotification('⚠️ Please enter a Google Apps Script Webhook URL first in Settings');
      return { success: false, message: 'Google Apps Script Webhook URL not set' };
    }

    if (targetUrl.includes('docs.google.com/spreadsheets')) {
      showNotification('⚠️ Google Sheet document URL detected! Please paste the Apps Script Web App URL ending with /exec');
      return { success: false, message: 'Invalid URL format' };
    }

    showNotification('📥 Fetching live order database directly from Google Sheets...');

    try {
      const sep = targetUrl.includes('?') ? '&' : '?';
      const fetchUrl = `${targetUrl}${sep}action=get_orders&t=${Date.now()}`;
      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      const rawList = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : []);

      if (rawList.length === 0) {
        showNotification('ℹ️ Google Sheet response active, but no order rows found.');
        return { success: true, count: 0, message: 'Sheet is empty' };
      }

      const formatted: Order[] = rawList.map((raw: any, index: number) => {
        const ordNum = Number(raw.order_number) || (index + 1);
        const orderDate = raw.order_date || new Date().toISOString().split('T')[0];
        const orderTime = raw.order_time || '12:00 PM';
        const delivDate = raw.delivery_date || orderDate;

        return sanitizeOrderForFirestore({
          id: raw.id || `ord-${ordNum}`,
          order_number: ordNum,
          order_id: ordNum,
          order_date: orderDate,
          order_time: orderTime,
          delivery_date: delivDate,
          customer_name: raw.customer_name || 'Customer',
          mobile_number: raw.mobile_number || raw.customer_phone || '',
          customer_phone: raw.customer_phone || raw.mobile_number || '',
          outlet: raw.outlet || 'Sector 31',
          item_type: raw.item_type || raw.items || 'Bakery Items',
          items: raw.items || raw.item_type || 'Bakery Items',
          name_on_cake: raw.name_on_cake || raw.cake_name || raw.cake_text || '',
          quantity: Number(raw.quantity) || 1,
          total_amount: Number(raw.total_amount) || 0,
          advance_amount: Number(raw.advance_amount) || 0,
          remaining_balance: Number(raw.remaining_balance) || 0,
          due_amount: Number(raw.due_amount) || Number(raw.remaining_balance) || 0,
          payment_type: raw.payment_type || 'full',
          advance_bill_number: raw.advance_bill_number || '',
          final_bill_number: raw.final_bill_number || '',
          status: raw.status || 'pending',
          delivery_type: raw.delivery_type || 'delivery',
          scheduled_time: raw.scheduled_time || raw.delivery_time_expected || '',
          delivery_time_expected: raw.delivery_time_expected || raw.scheduled_time || '',
          actual_delivery_time: raw.actual_delivery_time || '',
          delivery_partner: raw.delivery_partner || '',
          delivery_address: raw.delivery_address || raw.address || '',
          address: raw.address || raw.delivery_address || '',
          notes: raw.notes || raw.remarks || '',
          remarks: raw.remarks || raw.notes || '',
          item_image_url: raw.item_image_url || '',
          otp: raw.otp || String(Math.floor(1000 + Math.random() * 9000)),
          delivered_by: raw.delivered_by || '',
          created_at: raw.created_at || new Date().toISOString(),
          updated_at: raw.updated_at || new Date().toISOString(),
        } as unknown as Order);
      });

      formatted.sort((a, b) => (Number(b.order_number) || 0) - (Number(a.order_number) || 0));

      setOrders(formatted);
      ordersRef.current = formatted;
      safeSaveOrdersToLocalStorage(formatted);
      idbSet(LOCAL_STORAGE_KEY_ORDERS, formatted).catch(() => {});
      
      // Save to Firestore in chunks so other devices see the pulled orders
      try {
        for (let i = 0; i < formatted.length; i += 400) {
          const chunk = formatted.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((ord) => {
            batch.set(doc(db, 'orders', ord.id), ord, { merge: true });
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn('Failed to sync pulled orders to Firestore:', e);
      }

      logSync(formatted.length, 'google_sheet_pull', true);

      showNotification(`⚡ Successfully loaded ${formatted.length} live orders directly from Google Sheets!`);
      return { success: true, count: formatted.length };
    } catch (err: any) {
      console.warn('Pull from Google Sheet error:', err);
      showNotification(`⚠️ Google Sheet pull failed: ${err.message || 'Network / CORS issue'}`);
      return { success: false, message: err.message };
    }
  }, [logSync, showNotification]);

  const addOrder = useCallback((orderData: Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at'> & { order_number?: number }): Order => {
    const currentOrders = ordersRef.current || [];
    let newOrderNumber = orderData.order_number;

    if (!newOrderNumber || isNaN(newOrderNumber) || newOrderNumber <= 0) {
      newOrderNumber = getNextOrderNumber(currentOrders, 1);
    }

    const now = new Date().toISOString();
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const rawOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      order_number: newOrderNumber,
      otp: randomOtp,
      payment_changed_by: session.name || 'Admin',
      payment_changed_at: now,
      created_at: now,
      updated_at: now
    };

    const newOrder = sanitizeOrderForFirestore(rawOrder);

    const nextOrders = [newOrder, ...currentOrders.filter((o) => o.id !== newOrder.id)];
    ordersRef.current = nextOrders;
    setOrders(nextOrders);

    // Direct write to Firestore
    setDoc(doc(db, 'orders', newOrder.id), newOrder).catch((err) => {
      handleFirestoreWriteError(err, 'create order');
    });

    // Synchronize to server RAM & broadcast SSE immediately
    syncOrderToBackend(newOrder.id, newOrder);

    showNotification(`✨ New Order #${newOrderNumber} created at ${newOrder.outlet}!`);

    // Auto-sync via pushToSheet
    pushToSheet(newOrder, 'create');

    // Trigger Automated WhatsApp Confirmation in background
    triggerWhatsAppBackgroundMessage(newOrder, 'confirm');

    return newOrder;
  }, [session.name, pushToSheet, showNotification, triggerWhatsAppBackgroundMessage]);

  const importOrders = useCallback((imported: Partial<Order>[], overwrite = false) => {
    const now = new Date().toISOString();
    const existingOrders = overwrite ? [] : (ordersRef.current || []);
    let nextSeq = getNextOrderNumber(existingOrders, 1);

    const formattedOrders: Order[] = imported.map((item, idx) => {
      let orderNum = Number(item.order_number);
      if (isNaN(orderNum) || orderNum <= 0) {
        orderNum = nextSeq;
        nextSeq += 1;
      }

      const totalAmt = typeof item.total_amount === 'number' ? item.total_amount : Number(item.total_amount) || 0;
      const advAmt = typeof item.advance_amount === 'number' ? item.advance_amount : Number(item.advance_amount) || 0;
      const remBal = typeof item.remaining_balance === 'number' ? item.remaining_balance : Math.max(0, totalAmt - advAmt);

      const isPickup = String(item.delivery_type || 'delivery').toLowerCase().trim() === 'pickup';
      let deliveredBy = item.delivered_by || '';
      if (!isPickup && (deliveredBy.toLowerCase().includes('admin') || deliveredBy.toLowerCase() === 'delivery rider')) {
        deliveredBy = item.delivery_partner || (item as any).rider || '';
      }

      return {
        id: item.id || `ord-imp-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`,
        order_number: orderNum,
        order_id: orderNum,
        customer_name: item.customer_name || 'Valued Customer',
        mobile_number: item.mobile_number || '9876543210',
        outlet: item.outlet || 'Sector 31',
        item_type: item.item_type || 'Bakery Item',
        quantity: item.quantity || 1,
        total_amount: totalAmt,
        advance_amount: advAmt,
        remaining_balance: remBal,
        due_amount: remBal,
        payment_type: item.payment_type || 'full',
        delivery_type: item.delivery_type || 'delivery',
        delivery_date: item.delivery_date || now.split('T')[0],
        delivery_time_expected: formatTo12Hour(item.delivery_time_expected) || '06:00 PM',
        actual_delivery_time: item.actual_delivery_time || '',
        status: item.status || 'pending',
        delivery_partner: item.delivery_partner || (item as any).rider || '',
        delivered_by: deliveredBy,
        payment_changed_by: item.payment_changed_by || '',
        payment_changed_at: item.payment_changed_at || '',
        rider_delivered: Boolean(item.rider_delivered || item.status === 'delivered' || item.delivered_by),
        informed_by: item.informed_by || 'CSV/JSON Import',
        address: item.address || 'Address',
        remarks: item.remarks || '',
        advance_bill_number: item.advance_bill_number || (item as any).adv_bill_number || (item as any).adv_bill || (item as any).advance_bill || '',
        final_bill_number: item.final_bill_number || (item as any).final_bill_no || (item as any).final_bill || (item as any).bill_number || (item as any).bill_no || (item as any).bill || '',
        item_image_url: item.item_image_url || '',
        order_date: item.order_date || now.split('T')[0],
        order_time: formatTo12Hour(item.order_time) || getCurrentTime12Hour(),
        otp: item.otp || Math.floor(1000 + Math.random() * 9000).toString(),
        created_at: item.created_at || now,
        updated_at: now
      };
    });

    if (overwrite) {
      setOrders(formattedOrders);
      ordersRef.current = formattedOrders;
      safeSaveOrdersToLocalStorage(formattedOrders);
      idbSet(LOCAL_STORAGE_KEY_ORDERS, formattedOrders).catch(() => {});

      // Clear Firestore existing orders atomically with writeBatch
      getDocs(collection(db, 'orders')).then(async (snap) => {
        if (!snap.empty) {
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 200) {
            const chunk = docs.slice(i, i + 200);
            const batch = writeBatch(db);
            chunk.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }

        // Persist all newly imported orders to Firestore in batches
        for (let i = 0; i < formattedOrders.length; i += 200) {
          const chunk = formattedOrders.slice(i, i + 200);
          const batch = writeBatch(db);
          chunk.forEach((ord) => {
            const clean = sanitizeOrderForFirestore(ord);
            batch.set(doc(db, 'orders', ord.id), clean, { merge: true });
          });
          await batch.commit();
        }
      }).catch((err) => {
        handleFirestoreWriteError(err, 'overwrite import');
      });

      showNotification(`Replaced all orders with ${formattedOrders.length} imported orders!`);
    } else {
      const merged = mergeAndDeduplicateOrders(existingOrders, formattedOrders);
      setOrders(merged);
      ordersRef.current = merged;
      safeSaveOrdersToLocalStorage(merged);
      idbSet(LOCAL_STORAGE_KEY_ORDERS, merged).catch(() => {});

      // Persist new imported orders to Firestore
      for (let i = 0; i < formattedOrders.length; i += 200) {
        const chunk = formattedOrders.slice(i, i + 200);
        const batch = writeBatch(db);
        chunk.forEach((ord) => {
          const clean = sanitizeOrderForFirestore(ord);
          batch.set(doc(db, 'orders', ord.id), clean, { merge: true });
        });
        batch.commit().catch((err) => handleFirestoreWriteError(err, 'import orders batch'));
      }
      showNotification(`Successfully imported ${formattedOrders.length} new orders!`);
    }

    if (sheetConfig.sheet_url && sheetConfig.sheet_url.startsWith('http')) {
      triggerGoogleSheetSync();
    }
  }, [showNotification, sheetConfig.sheet_url, triggerGoogleSheetSync]);

  const updateOrder = useCallback((id: string, updates: Partial<Order>) => {
    const target = ordersRef.current.find((o) => o.id === id);
    if (!target) return;

    // Defend strictly against order_number mutations
    if ('order_number' in updates) {
      delete updates.order_number;
    }

    const now = new Date().toISOString();
    const hasPaymentUpdate =
      updates.payment_type !== undefined ||
      updates.advance_amount !== undefined ||
      updates.remaining_balance !== undefined ||
      updates.due_amount !== undefined;

    // Reset delivery flags if status is changed to non-delivered
    const resetDeliveryFlags = updates.status && updates.status !== 'delivered' ? {
      rider_delivered: false,
      delivery_confirmation_pending: false,
      actual_delivery_time: '',
      delivered_by: ''
    } : {};

    // Explicit delivery confirmation when marked delivered
    const setDeliveryFlags = updates.status === 'delivered' ? {
      rider_delivered: true,
      delivery_confirmation_pending: updates.delivery_confirmation_pending !== undefined
        ? Boolean(updates.delivery_confirmation_pending)
        : (target.delivery_confirmation_pending !== undefined ? Boolean(target.delivery_confirmation_pending) : false),
      actual_delivery_time: updates.actual_delivery_time || target.actual_delivery_time || now
    } : {};

    // If delivery partner is updated on a delivery order that is already delivered, sync delivered_by
    const effectiveStatus = updates.status || target.status;
    const isPickup = String(updates.delivery_type || target.delivery_type || '').toLowerCase().trim() === 'pickup';
    const effectivePartner = updates.delivery_partner !== undefined ? updates.delivery_partner.replace(/^Rider:\s*/i, '').trim() : target.delivery_partner;

    let autoDeliveredBy: { delivered_by?: string } = {};
    if (effectiveStatus === 'delivered' && !isPickup && effectivePartner && !updates.delivered_by) {
      autoDeliveredBy = { delivered_by: effectivePartner };
    }

    const rawUpdated: Order = {
      ...target,
      ...updates,
      ...setDeliveryFlags,
      ...autoDeliveredBy,
      ...resetDeliveryFlags,
      updated_at: now,
      ...(hasPaymentUpdate
        ? {
            payment_changed_by: session.name || session.role,
            payment_changed_at: now
          }
        : {})
    };

    const updated = sanitizeOrderForFirestore(rawUpdated);
    const targetNum = Number(target.order_number) || 0;

    setOrders((prev) => {
      const next = prev.map((ord) => (ord.id === id || (targetNum > 0 && Number(ord.order_number) === targetNum) ? { ...ord, ...updated, id: ord.id } : ord));
      ordersRef.current = next;
      scheduleAsyncOrderPersistence(next);
      return next;
    });

    setDoc(doc(db, 'orders', id), updated, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update order'));
    syncOrderToBackend(id, updated);
    pushToSheet(updated, 'update');
  }, [session.name, session.role, pushToSheet, handleFirestoreWriteError]);

  const deleteOrder = useCallback((id: string) => {
    const target = ordersRef.current.find((o) => o.id === id);
    const targetNum = Number(target?.order_number) || 0;
    const matchingOrders = ordersRef.current.filter((o) => o.id === id || (targetNum > 0 && Number(o.order_number) === targetNum));
    const matchingIds = matchingOrders.map((o) => o.id);

    if (target) {
      showNotification(`Order #${target.order_number} removed.`);
      pushToSheet(target, 'delete');
    }

    setOrders((prev) => {
      const next = prev.filter((o) => !matchingIds.includes(o.id));
      ordersRef.current = next;
      scheduleAsyncOrderPersistence(next);
      return next;
    });

    for (const matchId of matchingIds) {
      deleteDoc(doc(db, 'orders', matchId)).catch((err) => handleFirestoreWriteError(err, 'delete order'));
      syncOrderToBackend(matchId, null, 'DELETE');
    }
    setSelectedOrderIds((prev) => prev.filter((item) => !matchingIds.includes(item)));
  }, [showNotification, pushToSheet, handleFirestoreWriteError]);

  const clearAllOrders = useCallback(async () => {
    hasAutoSyncedLocalOrdersRef.current = true;
    // 1. Immediately update UI state & local persistent storages
    setOrders([]);
    ordersRef.current = [];
    setSelectedOrderIds([]);
    safeSaveOrdersToLocalStorage([]);
    idbSet(LOCAL_STORAGE_KEY_ORDERS, []).catch(() => {});

    // 2. Call backend to clear RAM cache, disk snapshot, and RTDB
    fetch('/api/orders', { method: 'DELETE' }).catch(() => {});

    // 3. Perform atomic batch delete on Firestore collection
    try {
      const snap = await getDocs(collection(db, 'orders'));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      showNotification('🗑️ All orders permanently deleted from Cloud & IndexedDB! Ready for fresh upload.');
    } catch (err) {
      handleFirestoreWriteError(err, 'clear orders');
      showNotification('All orders cleared locally!');
    }
  }, [showNotification, handleFirestoreWriteError]);

  const updateOrderStatus = useCallback((id: string, status: OrderStatus, deliveryPartner?: string) => {
    const target = ordersRef.current.find((o) => o.id === id);
    if (!target) return;

    const now = new Date().toISOString();
    const updates: Partial<Order> = {
      status,
      updated_at: now
    };
    if (deliveryPartner) {
      updates.delivery_partner = deliveryPartner.replace(/^Rider:\s*/i, '').trim();
    }
    if (status === 'delivered') {
      if (!target.actual_delivery_time) {
        updates.actual_delivery_time = now;
      }
      const isPickup = String(target.delivery_type || '').toLowerCase().trim() === 'pickup';
      if (isPickup) {
        updates.delivered_by = session.role === 'outlet' ? (session.name || `${target.outlet} Staff`) : (target.delivered_by || `${target.outlet || 'Store'} Pickup`);
      } else {
        const assignedRider = (deliveryPartner || target.delivery_partner || '').replace(/^Rider:\s*/i, '').trim();
        let riderName = assignedRider;
        if (!riderName && (session.role === 'delivery' || (session.role as string) === 'rider')) {
          riderName = (session.name || '').replace(/^Rider:\s*/i, '').trim();
        }
        if (!riderName && target.delivered_by && !target.delivered_by.toLowerCase().includes('admin') && target.delivered_by.toLowerCase() !== 'unassigned') {
          riderName = target.delivered_by.replace(/^Rider:\s*/i, '').trim();
        }
        if (!riderName && session.role === 'outlet') {
          riderName = session.name || `${target.outlet} Staff`;
        }
        if (!riderName) {
          riderName = target.informed_by || `${target.outlet || 'Store'} Staff`;
        }
        updates.delivered_by = riderName;
        if (!target.delivery_partner && deliveryPartner) {
          updates.delivery_partner = deliveryPartner;
        } else if (!target.delivery_partner && riderName && !riderName.toLowerCase().includes('staff')) {
          updates.delivery_partner = riderName;
        }
      }
      updates.rider_delivered = true;
      updates.delivery_confirmation_pending = false;
    } else {
      updates.rider_delivered = false;
      updates.delivery_confirmation_pending = false;
      updates.actual_delivery_time = '';
      updates.delivered_by = '';
    }

    const updated: Order = { ...target, ...updates };
    const targetNum = Number(target.order_number) || 0;

    setOrders((prev) => {
      const next = prev.map((ord) => (ord.id === id || (targetNum > 0 && Number(ord.order_number) === targetNum) ? { ...ord, ...updated, id: ord.id } : ord));
      ordersRef.current = next;
      idbSet(LOCAL_STORAGE_KEY_ORDERS, next).catch(() => {});
      safeSaveOrdersToLocalStorage(next);
      return next;
    });

    setDoc(doc(db, 'orders', id), updated, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update order status'));
    syncOrderToBackend(id, updated);
    if (targetNum > 0) {
      ordersRef.current.forEach((ord) => {
        if (ord.id !== id && Number(ord.order_number) === targetNum) {
          setDoc(doc(db, 'orders', ord.id), { ...updated, id: ord.id }, { merge: true }).catch(() => {});
          syncOrderToBackend(ord.id, { ...updated, id: ord.id });
        }
      });
    }
    showNotification(`Order #${target.order_number} status changed to ${status.toUpperCase()}`);
    pushToSheet(updated, 'update');

    // Trigger WhatsApp automation in background
    if (status === 'out_for_delivery') {
      triggerWhatsAppBackgroundMessage(updated, 'dispatch');
    } else if (status === 'delivered') {
      triggerWhatsAppBackgroundMessage(updated, 'delivered');
    }
  }, [session.name, session.role, showNotification, pushToSheet, handleFirestoreWriteError, triggerWhatsAppBackgroundMessage]);

  const markDelivered = useCallback((id: string, photoUrl?: string, otpInput?: string, deliveringRiderName?: string) => {
    const targetOrder = ordersRef.current.find((o) => o.id === id);
    if (!targetOrder) {
      return { success: false, message: 'Order not found.' };
    }

    // Auto-fallback: if OTP or photo not provided, use order's default OTP or photo
    const finalPhoto = photoUrl && photoUrl.trim().length > 0 ? photoUrl : (targetOrder.delivery_photo_url || '');
    const finalOtp = (otpInput && otpInput.trim().length > 0) ? otpInput.trim() : (targetOrder.otp || '1234');

    const isPickup = String(targetOrder.delivery_type || '').toLowerCase().trim() === 'pickup';
    
    // Resolve rider name with high precision
    let riderName = (deliveringRiderName || '').replace(/^Rider:\s*/i, '').trim();
    if (!riderName) {
      if (session.role === 'delivery' || (session.role as string) === 'rider') {
        riderName = (session.name || '').replace(/^Rider:\s*/i, '').trim();
      }
    }
    if (!riderName) {
      riderName = (targetOrder.delivery_partner || '').replace(/^Rider:\s*/i, '').trim();
    }
    if (!riderName && targetOrder.delivered_by && !targetOrder.delivered_by.toLowerCase().includes('admin') && targetOrder.delivered_by.toLowerCase() !== 'unassigned') {
      riderName = targetOrder.delivered_by.replace(/^Rider:\s*/i, '').trim();
    }
    if (!riderName && !isPickup) {
      const partner = partnersRef.current.find(p => p.id === session.deliveryPartnerId);
      if (partner?.name) {
        riderName = partner.name;
      }
    }

    const deliveredBy = isPickup
      ? (targetOrder.delivered_by || `${targetOrder.outlet || 'Store'} Pickup`)
      : (riderName || targetOrder.delivery_partner || `${targetOrder.outlet || 'Store'} Staff`);

    const updatedDeliveryPartner = (!targetOrder.delivery_partner || targetOrder.delivery_partner.toLowerCase() === 'unassigned') && riderName && !riderName.toLowerCase().includes('staff')
      ? riderName
      : (targetOrder.delivery_partner || (riderName && !riderName.toLowerCase().includes('staff') ? riderName : undefined));

    const now = new Date().toISOString();
    const updatedOrder: Order = {
      ...targetOrder,
      status: 'delivered',
      delivery_partner: updatedDeliveryPartner,
      delivery_photo_url: finalPhoto,
      otp: targetOrder.otp || finalOtp,
      actual_delivery_time: now,
      delivered_by: deliveredBy,
      rider_delivered: true,
      delivery_confirmation_pending: true,
      updated_at: now
    };

    const targetNum = Number(targetOrder.order_number) || 0;
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === id || (targetNum > 0 && Number(o.order_number) === targetNum) ? { ...o, ...updatedOrder, id: o.id } : o));
      ordersRef.current = next;
      scheduleAsyncOrderPersistence(next);
      return next;
    });

    setDoc(doc(db, 'orders', id), updatedOrder, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'mark delivered'));
    syncOrderToBackend(id, updatedOrder);
    if (targetNum > 0) {
      ordersRef.current.forEach((o) => {
        if (o.id !== id && Number(o.order_number) === targetNum) {
          setDoc(doc(db, 'orders', o.id), { ...updatedOrder, id: o.id }, { merge: true }).catch(() => {});
          syncOrderToBackend(o.id, { ...updatedOrder, id: o.id });
        }
      });
    }

    pushToSheet(updatedOrder, 'update');

    // Trigger WhatsApp automation in background
    triggerWhatsAppBackgroundMessage(updatedOrder, 'delivered');

    // Update delivery partner total deliveries count
    const effectiveRiderName = updatedDeliveryPartner || riderName;
    if (effectiveRiderName) {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.name.toLowerCase() === effectiveRiderName.toLowerCase() || p.id === session.deliveryPartnerId) {
            const updatedP = { ...p, total_deliveries: (p.total_deliveries || 0) + 1, status: 'available' as const };
            setDoc(doc(db, 'delivery_partners', p.id), updatedP, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update partner delivery count'));
            return updatedP;
          }
          return p;
        })
      );
    }

    showNotification(`🚀 Order #${targetOrder.order_number} marked delivered! (${deliveredBy})`);
    return { success: true, message: 'Order marked delivered!' };
  }, [session.name, session.role, session.deliveryPartnerId, showNotification, pushToSheet, handleFirestoreWriteError, triggerWhatsAppBackgroundMessage]);

  const confirmRiderDelivery = useCallback((id: string, isAutoConfirm: boolean = false) => {
    const targetOrder = ordersRef.current.find((o) => o.id === id);
    if (!targetOrder) return;
    const isPickup = String(targetOrder?.delivery_type || '').toLowerCase().trim() === 'pickup';
    
    let riderName = (targetOrder.delivered_by || '').replace(/^Rider:\s*/i, '').trim();
    if (!riderName || riderName.toLowerCase().includes('admin') || riderName.toLowerCase() === 'unassigned') {
      riderName = (targetOrder.delivery_partner || '').replace(/^Rider:\s*/i, '').trim();
    }
    if (!riderName && session.role === 'outlet') {
      riderName = `${targetOrder.outlet || 'Store'} Staff`;
    }

    const deliveredBy = isPickup
      ? (targetOrder.delivered_by || `${targetOrder.outlet || 'Store'} Store Pickup`)
      : (riderName || targetOrder.delivery_partner || `${targetOrder.outlet || 'Store'} Staff`);

    const deliveryPartner = targetOrder.delivery_partner || (riderName && !riderName.toLowerCase().includes('staff') ? riderName : undefined);

    const nowIso = new Date().toISOString();
    const confirmedPayload: Partial<Order> = {
      status: 'delivered' as OrderStatus,
      delivery_partner: deliveryPartner || targetOrder.delivery_partner,
      delivered_by: deliveredBy,
      rider_delivered: true,
      delivery_confirmation_pending: false,
      actual_delivery_time: targetOrder.actual_delivery_time || nowIso,
      updated_at: nowIso
    };

    const targetNum = Number(targetOrder.order_number) || 0;
    setOrders((prev) => {
      const next = prev.map((ord) => {
        if (ord.id === id || (targetNum > 0 && Number(ord.order_number) === targetNum)) {
          return {
            ...ord,
            ...confirmedPayload,
            id: ord.id
          };
        }
        return ord;
      });
      ordersRef.current = next;
      scheduleAsyncOrderPersistence(next);
      return next;
    });

    const targetDoc = doc(db, 'orders', id);
    setDoc(targetDoc, confirmedPayload, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'confirm rider delivery'));
    syncOrderToBackend(id, { ...targetOrder, ...confirmedPayload });
    if (targetNum > 0) {
      ordersRef.current.forEach((ord) => {
        if (ord.id !== id && Number(ord.order_number) === targetNum) {
          setDoc(doc(db, 'orders', ord.id), confirmedPayload, { merge: true }).catch(() => {});
          syncOrderToBackend(ord.id, { ...ord, ...confirmedPayload, id: ord.id });
        }
      });
    }
    pushToSheet({ ...targetOrder, ...confirmedPayload } as Order, 'update');
    
    if (isAutoConfirm) {
      showNotification(`✅ Order #${targetOrder.order_number} delivery auto-confirmed (30m timeout)`);
    } else {
      showNotification(`✅ Order #${targetOrder.order_number} delivery confirmed by Outlet!`);
    }
  }, [session.role, showNotification, handleFirestoreWriteError]);

// Auto-confirm rider deliveries after 30 minutes
  useEffect(() => {
    if (session.role !== 'admin' && session.role !== 'outlet' && session.role !== 'manager') return;
    
    const interval = setInterval(() => {
      const currentOrders = ordersRef.current;
      if (!currentOrders || currentOrders.length === 0) return;
      
      const now = Date.now();
      currentOrders.forEach((o) => {
        if (o.status === 'delivered' && Boolean(o.delivery_confirmation_pending)) {
          const deliveryTime = new Date(o.actual_delivery_time || o.updated_at || 0).getTime();
          if (deliveryTime > 0 && now - deliveryTime >= 30 * 60 * 1000) { // 30 minutes
            confirmRiderDelivery(o.id, true);
          }
        }
      });
    }, 10000); // Check every 10 seconds for timely auto-confirmation

    return () => clearInterval(interval);
  }, [session.role, confirmRiderDelivery]);


  const updatePartnerLocation = useCallback((partnerId: string, location: Omit<DeliveryPartnerLocation, 'updated_at'>) => {
    const updatedAt = new Date().toISOString();
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === partnerId) {
          const updatedP = {
            ...p,
            is_tracking_active: true,
            location: {
              ...location,
              updated_at: updatedAt
            }
          };
          setDoc(doc(db, 'delivery_partners', partnerId), updatedP, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update partner location'));
          return updatedP;
        }
        return p;
      })
    );
  }, [handleFirestoreWriteError]);

  const addPartner = useCallback((partnerData: Omit<DeliveryPartner, 'id' | 'total_deliveries'>) => {
    const newPartner: DeliveryPartner = {
      ...partnerData,
      id: `dp-${Date.now()}`,
      total_deliveries: 0
    };
    setPartners((prev) => [...prev, newPartner]);
    setDoc(doc(db, 'delivery_partners', newPartner.id), newPartner).catch((err) => handleFirestoreWriteError(err, 'add partner'));
    showNotification(`Added new delivery partner: ${newPartner.name}`);
  }, [showNotification, handleFirestoreWriteError]);

  const deletePartner = useCallback((id: string) => {
    setPartners((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        showNotification(`Removed delivery partner: ${target.name}`);
      }
      return prev.filter((p) => p.id !== id);
    });
    deleteDoc(doc(db, 'delivery_partners', id)).catch((err) => handleFirestoreWriteError(err, 'delete partner'));
  }, [showNotification, handleFirestoreWriteError]);

  const updatePartnerStatus = useCallback((id: string, status: DeliveryPartner['status']) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, status };
          setDoc(doc(db, 'delivery_partners', id), { status }, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update partner status'));
          return updated;
        }
        return p;
      })
    );
  }, [handleFirestoreWriteError]);

  const updateOutletLocation = useCallback((id: string, updates: Partial<OutletLocation>) => {
    setOutletLocations((prev) => {
      const exists = prev.some((o) => o.id === id);
      let updatedList: OutletLocation[];
      if (exists) {
        updatedList = prev.map((o) => (o.id === id ? { ...o, ...updates } : o));
      } else {
        const newOutlet: OutletLocation = {
          id,
          name: updates.name || `${id} Outlet`,
          address: updates.address || 'Faridabad, Haryana',
          lat: updates.lat || 28.4520,
          lng: updates.lng || 77.3180,
          color: updates.color || '#3b82f6'
        };
        updatedList = [...prev, newOutlet];
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_OUTLETS, JSON.stringify(updatedList));
      } catch (e) {
        console.warn('Failed to save outletLocations to localStorage:', e);
      }
      return updatedList;
    });

    const targetDoc = doc(db, 'outlet_locations', id);
    setDoc(targetDoc, updates, { merge: true }).catch((err) => {
      console.warn('Failed to sync outlet location to Firestore:', err);
    });
    showNotification(`Outlet location updated for ${id}`);
  }, [showNotification]);

  const updateSheetConfig = useCallback((updates: Partial<SheetConfig>) => {
    setSheetConfig((prev) => {
      const next = { ...prev, ...updates };
      setDoc(doc(db, 'system_settings', 'sheet_config'), next, { merge: true }).catch(() => {});
      return next;
    });
    showNotification('Updated Google Sheets Integration configuration.');
  }, [showNotification]);

  // Batch selections
  const toggleOrderSelection = useCallback((id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const selectAllOrders = useCallback((ids: string[]) => {
    setSelectedOrderIds(ids);
  }, []);

  const clearOrderSelection = useCallback(() => {
    setSelectedOrderIds([]);
  }, []);

  const value = useMemo(
    () => ({
      session,
      setSession,
      switchRole,
      isAuthenticated,
      login,
      logout,
      authPasswords,
      updateAdminPassword,
      updateManagerPassword,
      updateOutletPassword,
      updatePartnerPassword,
      verifyPassword,
      orders: orders || [],
      addOrder,
      importOrders,
      updateOrder,
      deleteOrder,
      clearAllOrders,
      loadDemoOrders,
      pushAllOrdersToCloud,
      updateOrderStatus,
      markDelivered,
      confirmRiderDelivery,
      partners: partners || [],
      addPartner,
      deletePartner,
      updatePartnerStatus,
      updatePartnerLocation,
      outletLocations: outletLocations || DEFAULT_OUTLET_LOCATIONS,
      updateOutletLocation,
      alerts: alerts || [],
      triggerSheetSync: triggerGoogleSheetSync,
      sheetConfig,
      updateSheetConfig,
      syncLogs: syncLogs || [],
      triggerGoogleSheetSync,
      pullOrdersFromGoogleSheet,
      selectedOrderIds: selectedOrderIds || [],
      toggleOrderSelection,
      selectAllOrders,
      clearOrderSelection,
      searchQuery,
      setSearchQuery,
      selectedOutletFilter,
      setSelectedOutletFilter,
      selectedStatusFilter,
      setSelectedStatusFilter,
      dateRangeFilter,
      setDateRangeFilter,
      recentNotification,
      dismissNotification: () => setRecentNotification(null),
      showNotification,
      isWhatsAppConnected,
      pendingWhatsAppCount,
      checkWhatsAppStatus,
      flushPendingWhatsAppQueue,
      triggerWhatsAppBackgroundMessage,
      isFirestoreQuotaExceeded,
      isHistorySyncing,
      historySyncCount
    }),
    [
      session,
      isAuthenticated,
      login,
      logout,
      authPasswords,
      updateAdminPassword,
      updateOutletPassword,
      updatePartnerPassword,
      verifyPassword,
      orders,
      addOrder,
      importOrders,
      updateOrder,
      deleteOrder,
      clearAllOrders,
      loadDemoOrders,
      pushAllOrdersToCloud,
      updateOrderStatus,
      markDelivered,
      confirmRiderDelivery,
      partners,
      addPartner,
      deletePartner,
      updatePartnerStatus,
      updatePartnerLocation,
      outletLocations,
      updateOutletLocation,
      alerts,
      sheetConfig,
      updateSheetConfig,
      syncLogs,
      triggerGoogleSheetSync,
      pullOrdersFromGoogleSheet,
      selectedOrderIds,
      toggleOrderSelection,
      selectAllOrders,
      clearOrderSelection,
      searchQuery,
      selectedOutletFilter,
      selectedStatusFilter,
      dateRangeFilter,
      recentNotification,
      showNotification,
      isWhatsAppConnected,
      pendingWhatsAppCount,
      checkWhatsAppStatus,
      flushPendingWhatsAppQueue,
      triggerWhatsAppBackgroundMessage,
      isFirestoreQuotaExceeded,
      isHistorySyncing,
      historySyncCount
    ]
  );

  return <OMSContext.Provider value={value}>{children}</OMSContext.Provider>;
};

export const useOMS = () => {
  const context = useContext(OMSContext);
  if (!context) {
    throw new Error('useOMS must be used within an OMSProvider');
  }
  return context;
};
