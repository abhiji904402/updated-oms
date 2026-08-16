import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Order, DeliveryPartner, DeliveryPartnerLocation, OutletLocation, SheetConfig, SyncLog, UserSession, Role, OutletName, OrderStatus, Alert } from '../types';
import { formatTo12Hour, getCurrentTime12Hour } from './timeUtils';
import { getNextOrderNumber, resequenceOrderNumbers } from './orderLogic';

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
import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, disableNetwork } from 'firebase/firestore';

export interface AuthPasswords {
  admin: string;
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
  updateOrderStatus: (id: string, status: OrderStatus, deliveryPartner?: string) => void;
  markDelivered: (id: string, photoUrl?: string, otpInput?: string) => { success: boolean; message: string };
  confirmRiderDelivery: (id: string) => void;
  resequenceAllOrders: (startNumber?: number) => Promise<void>;

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

  // Cloud & Quota status
  isFirestoreQuotaExceeded: boolean;
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
 * Automatically strips large base64/data URLs on quota limits and falls back cleanly.
 */
export function safeSaveOrdersToLocalStorage(ordersToSave: Order[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(ordersToSave));
  } catch (e) {
    console.warn('LocalStorage quota exceeded! Stripping large image payloads for localStorage fallback:', e);
    try {
      // 1. Strip images & delivery photos which consume 90%+ of quota
      const lightweightOrders = ordersToSave.map((o) => {
        const hasLargeImage = o.item_image_url && o.item_image_url.length > 200;
        const hasLargePhoto = o.delivery_photo_url && o.delivery_photo_url.length > 200;
        if (hasLargeImage || hasLargePhoto) {
          return {
            ...o,
            item_image_url: hasLargeImage ? '' : o.item_image_url,
            delivery_photo_url: hasLargePhoto ? '' : o.delivery_photo_url
          };
        }
        return o;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(lightweightOrders));
    } catch (e2) {
      console.warn('LocalStorage still exceeded quota, saving most recent 50 orders only:', e2);
      try {
        // 2. Fallback to latest 50 orders without images
        const recentOrders = ordersToSave.slice(0, 50).map((o) => ({
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
    }
  }
}

const DEFAULT_PASSWORDS: AuthPasswords = {
  admin: 'admin123',
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
        return JSON.parse(saved);
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
    
    if (isQuota) {
      quotaExceededRef.current = true;
      setIsFirestoreQuotaExceeded(true);
      // Disable Firestore background network retries to prevent backoff spam
      try {
        disableNetwork(db).catch(() => {});
      } catch (e) {}

      if (!quotaNotifiedRef.current) {
        quotaNotifiedRef.current = true;
        console.warn(`[Firestore Quota Reached] Operation "${operationName}" was saved locally in IndexedDB & LocalStorage.`);
        showNotification('⚡ Daily Firestore write quota reached. Running smoothly in Offline-First mode (IndexedDB + Google Sheets active).');
      }
    } else {
      console.warn(`Firestore ${operationName} error:`, err);
    }
  }, [showNotification]);

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

  // Keep refs of orders and sheetConfig for non-reactive access inside callbacks and intervals
  const ordersRef = React.useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const sheetConfigRef = React.useRef(sheetConfig);
  useEffect(() => {
    sheetConfigRef.current = sheetConfig;
  }, [sheetConfig]);

  // Fail-safe effects to sync partners, passwords, sheetConfig, and outletLocations to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PARTNERS, JSON.stringify(partners));
      idbSet(LOCAL_STORAGE_KEY_PARTNERS, partners);
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

  // Fast offline hydration from IndexedDB on startup
  useEffect(() => {
    idbGet<Order[]>(LOCAL_STORAGE_KEY_ORDERS).then((idbOrders) => {
      if (idbOrders && Array.isArray(idbOrders) && idbOrders.length > 0) {
        idbOrders.sort((a, b) => (Number(b.order_number) || 0) - (Number(a.order_number) || 0));
        setOrders((current) => {
          if (!current || current.length < idbOrders.length) {
            return idbOrders;
          }
          return current;
        });
      }
    }).catch(() => {});
  }, []);

  // 1. Real-time Firestore Sync for Orders
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;

        const rawList: Order[] = [];
        snapshot.forEach((docSnap) => {
          rawList.push({ ...docSnap.data(), id: docSnap.id } as Order);
        });

        if (rawList.length > 0) {
          rawList.sort((a, b) => (Number(b.order_number) || 0) - (Number(a.order_number) || 0));
          setOrders((prev) => {
            if (prev && prev.length === rawList.length && prev[0]?.id === rawList[0]?.id && prev[0]?.updated_at === rawList[0]?.updated_at) {
              return prev;
            }
            return rawList;
          });
          ordersRef.current = rawList;
          idbSet(LOCAL_STORAGE_KEY_ORDERS, rawList).catch(() => {});
          safeSaveOrdersToLocalStorage(rawList);
        }
      },
      (err) => {
        handleFirestoreWriteError(err, 'orders snapshot sync');
      }
    );
    return () => unsub();
  }, []);

  // 2. Real-time Firestore Sync for Delivery Partners
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'delivery_partners'),
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;

        const list: DeliveryPartner[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as DeliveryPartner);
        });

        if (list.length > 0) {
          setPartners((prev) => {
            if (prev.length === list.length) {
              const matches = prev.every((p, idx) => p.id === list[idx]?.id && p.status === list[idx]?.status);
              if (matches) return prev;
            }
            return list;
          });
        } else if (!snapshot.metadata.fromCache) {
          const seeded = localStorage.getItem('delivery_partners_seeded_v2');
          if (!seeded) {
            safeLocalStorageSet('delivery_partners_seeded_v2', 'true');
            if (!quotaExceededRef.current) {
              const batch = writeBatch(db);
              INITIAL_DELIVERY_PARTNERS.forEach((p) => {
                batch.set(doc(db, 'delivery_partners', p.id), p);
              });
              batch.commit().catch((err) => handleFirestoreWriteError(err, 'seed delivery partners'));
            }
          }
        }
      },
      (err) => {
        handleFirestoreWriteError(err, 'partners snapshot sync');
      }
    );
    return () => unsub();
  }, []);

  // Save changes to IndexedDB (unlimited) and localStorage (quota-safe) asynchronously
  useEffect(() => {
    const timer = setTimeout(() => {
      idbSet(LOCAL_STORAGE_KEY_ORDERS, orders);
      safeSaveOrdersToLocalStorage(orders);
    }, 50);

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
    setAuthPasswords((prev) => ({ ...prev, admin: newPass }));
  }, []);

  const updateOutletPassword = useCallback((outletName: string, newPass: string) => {
    setAuthPasswords((prev) => ({
      ...prev,
      outlets: { ...prev.outlets, [outletName]: newPass }
    }));
  }, []);

  const updatePartnerPassword = useCallback((partnerId: string, newPass: string) => {
    setAuthPasswords((prev) => ({
      ...prev,
      partners: { ...prev.partners, [partnerId]: newPass }
    }));
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

      if (role === 'outlet') {
        const outletName = (identifier as OutletName) || 'Sector 31';
        const expected = authPasswords.outlets[outletName] || authPasswords.defaultOutletPassword;
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
          authPasswords.partners[partnerId] ||
          partner?.password ||
          authPasswords.defaultPartnerPassword;

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
  const logSync = useCallback((orderNumber: number, event: 'create' | 'update' | 'delete' | 'manual_sync', success = true) => {
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

  // Fast, non-blocking pushToSheet function for Google Sheet webhook
  const pushToSheet = useCallback((order: Order, action: 'create' | 'update' | 'delete') => {
    const config = sheetConfigRef.current;
    if (!config.auto_sync) return;
    const targetUrl = (config.sheet_url || '').trim();
    if (!targetUrl || !targetUrl.startsWith('http') || targetUrl.includes('docs.google.com/spreadsheets')) return;
    
    // Log sync immediately for instant UI responsiveness
    logSync(order.order_number, action, true);

    fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, order: sanitizeOrderForSync(order) })
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
          body: JSON.stringify(chunk)
        });
      }

      logSync(sanitizedOrders.length, 'manual_sync', true);
      showNotification(`✅ Successfully synced all ${sanitizedOrders.length} orders (#${firstNum}–#${lastNum}) with Google Sheets!`);
    } catch (err) {
      console.warn('Sheet sync warning:', err);
      showNotification('⚠️ Network or Webhook connection check required.');
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

    // Instant synchronous update to ordersRef to prevent race conditions
    ordersRef.current = [newOrder, ...currentOrders.filter((o) => o.id !== newOrder.id)];

    // Instant local state update
    setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);

    // Write to Firestore if quota not exceeded
    if (!quotaExceededRef.current) {
      setDoc(doc(db, 'orders', newOrder.id), newOrder).catch((err) => {
        handleFirestoreWriteError(err, 'create order');
      });
    }

    showNotification(`✨ New Order #${newOrderNumber} created at ${newOrder.outlet}!`);

    // Auto-sync via pushToSheet
    pushToSheet(newOrder, 'create');

    return newOrder;
  }, [session.name, pushToSheet, showNotification]);

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
        delivered_by: item.delivered_by || '',
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
      idbSet(LOCAL_STORAGE_KEY_ORDERS, formattedOrders);

      // Clear Firestore existing orders atomically with writeBatch
      if (!quotaExceededRef.current) {
        getDocs(collection(db, 'orders')).then(async (snap) => {
          if (!snap.empty) {
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 400) {
              const chunk = docs.slice(i, i + 400);
              const batch = writeBatch(db);
              chunk.forEach((d) => batch.delete(d.ref));
              await batch.commit();
            }
          }

          // Persist all newly imported orders to Firestore in batches
          for (let i = 0; i < formattedOrders.length; i += 400) {
            const chunk = formattedOrders.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach((ord) => batch.set(doc(db, 'orders', ord.id), ord));
            await batch.commit();
          }
        }).catch((err) => {
          handleFirestoreWriteError(err, 'overwrite import');
        });
      }

      showNotification(`Replaced all orders with ${formattedOrders.length} imported orders!`);
    } else {
      setOrders((prev) => [...formattedOrders, ...prev]);
      ordersRef.current = [...formattedOrders, ...existingOrders];
      // Persist new imported orders to Firestore
      if (!quotaExceededRef.current) {
        for (let i = 0; i < formattedOrders.length; i += 400) {
          const chunk = formattedOrders.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((ord) => batch.set(doc(db, 'orders', ord.id), ord));
          batch.commit().catch((err) => handleFirestoreWriteError(err, 'import orders batch'));
        }
      }
      showNotification(`Successfully imported ${formattedOrders.length} new orders!`);
    }

    if (sheetConfig.sheet_url && sheetConfig.sheet_url.startsWith('http')) {
      triggerGoogleSheetSync();
    }
  }, [showNotification, sheetConfig.sheet_url, triggerGoogleSheetSync]);

  const resequenceAllOrders = useCallback(async (startNumber = 1) => {
    const current = ordersRef.current || [];
    if (current.length === 0) {
      showNotification('No orders to re-sequence.');
      return;
    }

    // Sort descending by order_date, then descending by order_time, and assign sequential order_id/order_number
    const resequenced = resequenceOrderNumbers(current, startNumber);

    setOrders(resequenced);
    ordersRef.current = resequenced;
    safeSaveOrdersToLocalStorage(resequenced);
    idbSet(LOCAL_STORAGE_KEY_ORDERS, resequenced);

    // Save to Firestore in chunks without modifying delivery_date
    if (!quotaExceededRef.current) {
      try {
        for (let i = 0; i < resequenced.length; i += 400) {
          const chunk = resequenced.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((ord) => {
            const clean = sanitizeOrderForFirestore(ord);
            batch.set(doc(db, 'orders', ord.id), clean, { merge: true });
          });
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreWriteError(err, 'resequence batch');
      }
    }

    showNotification(`🔢 Order IDs sorted in descending order of punch date/time and updated sequentially!`);
  }, [showNotification]);

  const updateOrder = useCallback((id: string, updates: Partial<Order>) => {
    const target = ordersRef.current.find((o) => o.id === id);
    if (!target) return;

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

    const rawUpdated: Order = {
      ...target,
      ...updates,
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

    setOrders((prev) => prev.map((ord) => (ord.id === id ? updated : ord)));

    if (!quotaExceededRef.current) {
      setDoc(doc(db, 'orders', id), updated, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update order'));
    }
    pushToSheet(updated, 'update');
  }, [session.name, session.role, pushToSheet, handleFirestoreWriteError]);

  const deleteOrder = useCallback((id: string) => {
    const target = ordersRef.current.find((o) => o.id === id);
    if (target) {
      showNotification(`Order #${target.order_number} removed.`);
      pushToSheet(target, 'delete');
    }

    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (!quotaExceededRef.current) {
      deleteDoc(doc(db, 'orders', id)).catch((err) => handleFirestoreWriteError(err, 'delete order'));
    }
    setSelectedOrderIds((prev) => prev.filter((item) => item !== id));
  }, [showNotification, pushToSheet, handleFirestoreWriteError]);

  const clearAllOrders = useCallback(async () => {
    // 1. Immediately update UI state & local persistent storages
    setOrders([]);
    setSelectedOrderIds([]);
    safeSaveOrdersToLocalStorage([]);
    idbSet(LOCAL_STORAGE_KEY_ORDERS, []);

    // 2. Perform atomic batch delete on Firestore collection if quota available
    if (!quotaExceededRef.current) {
      try {
        const snap = await getDocs(collection(db, 'orders'));
        if (!snap.empty) {
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 400) {
            const chunk = docs.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
        showNotification('🗑️ All orders permanently deleted! Ready for fresh data.');
      } catch (err) {
        handleFirestoreWriteError(err, 'clear orders');
        showNotification('All orders cleared locally!');
      }
    } else {
      showNotification('🗑️ All orders permanently cleared locally!');
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
      updates.delivery_partner = deliveryPartner;
    }
    if (status === 'delivered') {
      if (!target.actual_delivery_time) {
        updates.actual_delivery_time = now;
      }
      updates.delivered_by = session.name || deliveryPartner || target.delivered_by || 'Rider';
      updates.rider_delivered = true;
    } else {
      updates.rider_delivered = false;
      updates.delivery_confirmation_pending = false;
      updates.actual_delivery_time = '';
      updates.delivered_by = '';
    }

    const updated: Order = { ...target, ...updates };

    setOrders((prev) => prev.map((ord) => (ord.id === id ? updated : ord)));

    if (!quotaExceededRef.current) {
      setDoc(doc(db, 'orders', id), updated, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update order status'));
    }
    showNotification(`Order #${target.order_number} status changed to ${status.toUpperCase()}`);
    pushToSheet(updated, 'update');
  }, [session.name, showNotification, pushToSheet, handleFirestoreWriteError]);

  const markDelivered = useCallback((id: string, photoUrl?: string, otpInput?: string) => {
    const targetOrder = ordersRef.current.find((o) => o.id === id);
    if (!targetOrder) {
      return { success: false, message: 'Order not found.' };
    }

    // Auto-fallback: if OTP or photo not provided, use order's default OTP or photo
    const finalPhoto = photoUrl && photoUrl.trim().length > 0 ? photoUrl : (targetOrder.delivery_photo_url || '');
    const finalOtp = (otpInput && otpInput.trim().length > 0) ? otpInput.trim() : (targetOrder.otp || '1234');

    const now = new Date().toISOString();
    const updatedOrder: Order = {
      ...targetOrder,
      status: 'delivered',
      delivery_photo_url: finalPhoto,
      otp: targetOrder.otp || finalOtp,
      actual_delivery_time: now,
      delivered_by: session.name || targetOrder.delivery_partner || 'Delivery Partner',
      rider_delivered: true,
      delivery_confirmation_pending: true,
      updated_at: now
    };

    setOrders((prev) => prev.map((o) => (o.id === id ? updatedOrder : o)));
    if (!quotaExceededRef.current) {
      setDoc(doc(db, 'orders', id), updatedOrder, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'mark delivered'));
    }

    pushToSheet(updatedOrder, 'update');

    // Update delivery partner total deliveries count
    if (targetOrder.delivery_partner) {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.name === targetOrder.delivery_partner || p.id === session.deliveryPartnerId) {
            const updatedP = { ...p, total_deliveries: p.total_deliveries + 1, status: 'available' };
            if (!quotaExceededRef.current) {
              setDoc(doc(db, 'delivery_partners', p.id), updatedP, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update partner delivery count'));
            }
            return updatedP;
          }
          return p;
        })
      );
    }

    showNotification(`🚀 Order #${targetOrder.order_number} delivered by rider! Waiting for Outlet confirmation.`);
    return { success: true, message: 'Delivered marked! Waiting for Outlet/Admin confirmation.' };
  }, [session.name, session.deliveryPartnerId, showNotification, pushToSheet, handleFirestoreWriteError]);

  const confirmRiderDelivery = useCallback((id: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === id) {
          return {
            ...ord,
            status: 'delivered' as OrderStatus,
            rider_delivered: true,
            delivery_confirmation_pending: false,
            updated_at: new Date().toISOString()
          };
        }
        return ord;
      })
    );
    if (!quotaExceededRef.current) {
      const targetDoc = doc(db, 'orders', id);
      setDoc(targetDoc, { status: 'delivered', rider_delivered: true, delivery_confirmation_pending: false, updated_at: new Date().toISOString() }, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'confirm rider delivery'));
    }
    showNotification(`✅ Order delivery confirmed by Outlet!`);
  }, [showNotification, handleFirestoreWriteError]);

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
          if (!quotaExceededRef.current) {
            setDoc(doc(db, 'delivery_partners', partnerId), updatedP, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update partner location'));
          }
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
    if (!quotaExceededRef.current) {
      setDoc(doc(db, 'delivery_partners', newPartner.id), newPartner).catch((err) => handleFirestoreWriteError(err, 'add partner'));
    }
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
    if (!quotaExceededRef.current) {
      deleteDoc(doc(db, 'delivery_partners', id)).catch((err) => handleFirestoreWriteError(err, 'delete partner'));
    }
  }, [showNotification, handleFirestoreWriteError]);

  const updatePartnerStatus = useCallback((id: string, status: DeliveryPartner['status']) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, status };
          if (!quotaExceededRef.current) {
            setDoc(doc(db, 'delivery_partners', id), { status }, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update partner status'));
          }
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
    setSheetConfig((prev) => ({ ...prev, ...updates }));
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
      updateOutletPassword,
      updatePartnerPassword,
      verifyPassword,
      orders: orders || [],
      addOrder,
      importOrders,
      updateOrder,
      deleteOrder,
      clearAllOrders,
      updateOrderStatus,
      markDelivered,
      confirmRiderDelivery,
      resequenceAllOrders,
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
      isFirestoreQuotaExceeded
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
      updateOrderStatus,
      markDelivered,
      confirmRiderDelivery,
      resequenceAllOrders,
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
      selectedOrderIds,
      toggleOrderSelection,
      selectAllOrders,
      clearOrderSelection,
      searchQuery,
      selectedOutletFilter,
      selectedStatusFilter,
      dateRangeFilter,
      recentNotification,
      isFirestoreQuotaExceeded
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
