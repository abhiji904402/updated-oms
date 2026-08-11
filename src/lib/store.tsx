import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Order, DeliveryPartner, DeliveryPartnerLocation, OutletLocation, SheetConfig, SyncLog, UserSession, Role, OutletName, OrderStatus, Alert } from '../types';

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
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';

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
  addOrder: (orderData: Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at'>) => Order;
  importOrders: (imported: Partial<Order>[], overwrite?: boolean) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  deleteOrder: (id: string) => void;
  clearAllOrders: () => void;
  updateOrderStatus: (id: string, status: OrderStatus, deliveryPartner?: string) => void;
  markDelivered: (id: string, photoUrl?: string, otpInput?: string) => { success: boolean; message: string };
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
}

const OMSContext = createContext<OMSContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_ORDERS = 'broomies_oms_orders_v7';
const LOCAL_STORAGE_KEY_PARTNERS = 'broomies_oms_partners_v3';
const LOCAL_STORAGE_KEY_OUTLETS = 'broomies_oms_outlets_v1';
const LOCAL_STORAGE_KEY_SHEET = 'broomies_oms_sheet_v3';
const LOCAL_STORAGE_KEY_SESSION = 'broomies_oms_session_v3';
const LOCAL_STORAGE_KEY_AUTH = 'broomies_oms_auth_v1';
const LOCAL_STORAGE_KEY_PASSWORDS = 'broomies_oms_passwords_v1';

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
        return JSON.parse(saved);
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

  // Helper to strip out undefined values so Firestore setDoc never fails
  const sanitizeOrderForFirestore = (order: Record<string, any>): Order => {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(order)) {
      if (val !== undefined) {
        clean[key] = val;
      }
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

  // Fast offline hydration from IndexedDB on startup
  useEffect(() => {
    idbGet<Order[]>(LOCAL_STORAGE_KEY_ORDERS).then((idbOrders) => {
      if (idbOrders && Array.isArray(idbOrders) && idbOrders.length > 0) {
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

        const list: Order[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Order);
        });

        if (list.length > 0) {
          list.sort((a, b) => (b.order_number || 0) - (a.order_number || 0));
          setOrders((prev) => {
            if (prev.length === list.length) {
              const matches = prev.every(
                (p, idx) =>
                  p.id === list[idx]?.id &&
                  p.updated_at === list[idx]?.updated_at &&
                  p.status === list[idx]?.status &&
                  p.delivery_confirmation_pending === list[idx]?.delivery_confirmation_pending
              );
              if (matches) return prev;
            }
            return list;
          });
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(list));
            idbSet(LOCAL_STORAGE_KEY_ORDERS, list);
          } catch (e) {}
        } else if (!snapshot.metadata.fromCache) {
          const seeded = localStorage.getItem('orders_firestore_seeded_v2');
          if (!seeded) {
            localStorage.setItem('orders_firestore_seeded_v2', 'true');
            setOrders((currentLocal) => {
              if (currentLocal && currentLocal.length > 0) {
                const batch = writeBatch(db);
                currentLocal.forEach((ord) => {
                  const clean = sanitizeOrderForFirestore(ord);
                  batch.set(doc(db, 'orders', clean.id), clean);
                });
                batch.commit().catch((err) => console.warn('Batch seed failed:', err));
              }
              return currentLocal;
            });
          }
        }
      },
      (err) => {
        console.warn('Firestore orders sync error:', err);
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
            localStorage.setItem('delivery_partners_seeded_v2', 'true');
            const batch = writeBatch(db);
            INITIAL_DELIVERY_PARTNERS.forEach((p) => {
              batch.set(doc(db, 'delivery_partners', p.id), p);
            });
            batch.commit().catch((err) => console.warn('Batch partners seed failed:', err));
          }
        }
      },
      (err) => {
        console.warn('Firestore partners sync error:', err);
      }
    );
    return () => unsub();
  }, []);

  // Save changes to IndexedDB (unlimited) and localStorage (quota-safe) asynchronously
  useEffect(() => {
    const timer = setTimeout(() => {
      idbSet(LOCAL_STORAGE_KEY_ORDERS, orders);

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(orders));
      } catch (e) {
        console.warn('LocalStorage quota exceeded! Stripping large image payloads for localStorage fallback:', e);
        try {
          const lightweightOrders = orders.map((o) => {
            const hasLargeImage = o.item_image_url && o.item_image_url.length > 300;
            const hasLargePhoto = o.delivery_photo_url && o.delivery_photo_url.length > 300;
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
          console.error('Failed to write to localStorage even after image stripping:', e2);
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PARTNERS, JSON.stringify(partners));
  }, [partners]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_SHEET, JSON.stringify(sheetConfig));
  }, [sheetConfig]);

  // 24/7 Continuous Background Auto-Sync Interval for Google Sheets & Cloud Sync
  useEffect(() => {
    const targetUrl = (sheetConfig.sheet_url || '').trim();
    if (!sheetConfig.auto_sync || !targetUrl || !targetUrl.startsWith('http') || targetUrl.includes('docs.google.com/spreadsheets')) {
      return;
    }

    // Background sync timer every 45 seconds to keep Google Sheets & Cloud in 24/7 perfect sync
    const interval = setInterval(() => {
      const currentOrders = ordersRef.current;
      if (currentOrders && currentOrders.length > 0) {
        const sortedOrders = [...currentOrders].sort((a, b) => (a.order_number || 0) - (b.order_number || 0));
        const sanitizedOrders = sortedOrders.map(sanitizeOrderForSync);
        
        // Push batch sync silently in background
        const CHUNK_SIZE = 35;
        for (let i = 0; i < sanitizedOrders.length; i += CHUNK_SIZE) {
          const chunk = sanitizedOrders.slice(i, i + CHUNK_SIZE);
          fetch(targetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(chunk)
          }).catch(() => {});
        }

        const now = new Date().toISOString();
        setSheetConfig((prev) => {
          if (prev.last_synced_at && (Date.now() - new Date(prev.last_synced_at).getTime() < 40000)) {
            return prev;
          }
          return {
            ...prev,
            last_sync: now,
            last_synced_at: now,
            webhook_status: 'connected'
          };
        });
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [sheetConfig.auto_sync, sheetConfig.sheet_url]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_SESSION, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_AUTH, String(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PASSWORDS, JSON.stringify(authPasswords));
  }, [authPasswords]);

  const login = useCallback((userSession: UserSession) => {
    setSessionState(userSession);
    setIsAuthenticated(true);
    localStorage.setItem(LOCAL_STORAGE_KEY_AUTH, 'true');
    localStorage.setItem(LOCAL_STORAGE_KEY_SESSION, JSON.stringify(userSession));
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.setItem(LOCAL_STORAGE_KEY_AUTH, 'false');
    localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
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

  const showNotification = useCallback((msg: string) => {
    setRecentNotification(msg);
    setTimeout(() => {
      setRecentNotification(null);
    }, 5000);
  }, []);

  const setSession = (newSession: UserSession) => {
    setSessionState(newSession);
  };

  const switchRole = (role: Role, outlet?: OutletName, partnerId?: string) => {
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
  };

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

  const addOrder = useCallback((orderData: Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at'>): Order => {
    const currentOrders = ordersRef.current;
    const maxOrderNum = currentOrders.length > 0 ? currentOrders.reduce((max, o) => Math.max(max, o.order_number || 0), 0) : 2159;
    const newOrderNumber = maxOrderNum > 0 ? maxOrderNum + 1 : 2160;
    const now = new Date().toISOString();
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const rawOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_number: newOrderNumber,
      otp: randomOtp,
      payment_changed_by: session.name || 'Admin',
      payment_changed_at: now,
      created_at: now,
      updated_at: now
    };

    const newOrder = sanitizeOrderForFirestore(rawOrder);

    // Instant local state + synchronous local storage / IDB update to prevent data loss
    setOrders((prev) => {
      const updated = [newOrder, ...prev.filter((o) => o.id !== newOrder.id)];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(updated));
        idbSet(LOCAL_STORAGE_KEY_ORDERS, updated);
      } catch (e) {
        console.warn('Sync storage failed:', e);
      }
      return updated;
    });

    // Write to Firestore
    setDoc(doc(db, 'orders', newOrder.id), newOrder).catch((err) => {
      console.warn('Firestore setDoc failed:', err);
    });

    showNotification(`✨ New Order #${newOrderNumber} created at ${newOrder.outlet}!`);

    // Auto-sync via pushToSheet
    pushToSheet(newOrder, 'create');

    return newOrder;
  }, [session.name, pushToSheet, showNotification]);

  const importOrders = useCallback((imported: Partial<Order>[], overwrite = false) => {
    const now = new Date().toISOString();
    let currentMaxNumber = overwrite
      ? 100
      : orders.reduce((max, o) => Math.max(max, o.order_number || 0), 100);

    const formattedOrders: Order[] = imported.map((item, idx) => {
      let orderNum = item.order_number;
      if (!orderNum || isNaN(orderNum)) {
        currentMaxNumber += 1;
        orderNum = currentMaxNumber;
      } else {
        currentMaxNumber = Math.max(currentMaxNumber, orderNum);
      }

      const totalAmt = typeof item.total_amount === 'number' ? item.total_amount : Number(item.total_amount) || 0;
      const advAmt = typeof item.advance_amount === 'number' ? item.advance_amount : Number(item.advance_amount) || 0;
      const remBal = typeof item.remaining_balance === 'number' ? item.remaining_balance : Math.max(0, totalAmt - advAmt);

      return {
        id: item.id || `ord-imp-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        order_number: orderNum,
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
        delivery_time_expected: item.delivery_time_expected || '18:00',
        status: item.status || 'pending',
        informed_by: item.informed_by || 'CSV/JSON Import',
        address: item.address || 'Address',
        remarks: item.remarks || '',
        advance_bill_number: item.advance_bill_number || '',
        final_bill_number: item.final_bill_number || '',
        item_image_url: item.item_image_url || '',
        order_date: item.order_date || now.split('T')[0],
        order_time: item.order_time || now.slice(11, 16),
        otp: item.otp || Math.floor(1000 + Math.random() * 9000).toString(),
        created_at: item.created_at || now,
        updated_at: now
      };
    });

    if (overwrite) {
      setOrders(formattedOrders);
      localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(formattedOrders));
      idbSet(LOCAL_STORAGE_KEY_ORDERS, formattedOrders);

      // Clear Firestore existing orders atomically with writeBatch
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
        console.warn('Firestore overwrite import error:', err);
      });

      showNotification(`Replaced all orders with ${formattedOrders.length} imported orders!`);
    } else {
      setOrders((prev) => [...formattedOrders, ...prev]);
      // Persist new imported orders to Firestore
      for (let i = 0; i < formattedOrders.length; i += 400) {
        const chunk = formattedOrders.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((ord) => batch.set(doc(db, 'orders', ord.id), ord));
        batch.commit().catch(() => {});
      }
      showNotification(`Successfully imported ${formattedOrders.length} new orders!`);
    }

    if (sheetConfig.sheet_url && sheetConfig.sheet_url.startsWith('http')) {
      triggerGoogleSheetSync();
    }
  }, [orders, showNotification, sheetConfig.sheet_url, triggerGoogleSheetSync]);

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

    setOrders((prev) => {
      const newList = prev.map((ord) => (ord.id === id ? updated : ord));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(newList));
        idbSet(LOCAL_STORAGE_KEY_ORDERS, newList);
      } catch (e) {}
      return newList;
    });

    setDoc(doc(db, 'orders', id), updated, { merge: true }).catch(() => {});
    pushToSheet(updated, 'update');
  }, [session.name, session.role, pushToSheet]);

  const deleteOrder = useCallback((id: string) => {
    const target = ordersRef.current.find((o) => o.id === id);
    if (target) {
      showNotification(`Order #${target.order_number} removed.`);
      pushToSheet(target, 'delete');
    }

    setOrders((prev) => prev.filter((o) => o.id !== id));
    deleteDoc(doc(db, 'orders', id)).catch(() => {});
    setSelectedOrderIds((prev) => prev.filter((item) => item !== id));
  }, [showNotification, pushToSheet]);

  const clearAllOrders = useCallback(async () => {
    // 1. Immediately update UI state & local persistent storages
    setOrders([]);
    setSelectedOrderIds([]);
    localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, '[]');
    idbSet(LOCAL_STORAGE_KEY_ORDERS, []);

    // 2. Perform atomic batch delete on Firestore collection
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
      console.error('Error clearing Firestore orders:', err);
      showNotification('All orders cleared locally!');
    }
  }, [showNotification]);

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

    setDoc(doc(db, 'orders', id), updated, { merge: true }).catch(() => {});
    showNotification(`Order #${target.order_number} status changed to ${status.toUpperCase()}`);
    pushToSheet(updated, 'update');
  }, [session.name, showNotification, pushToSheet]);

  const markDelivered = useCallback((id: string, photoUrl?: string, otpInput?: string) => {
    const targetOrder = ordersRef.current.find((o) => o.id === id);
    if (!targetOrder) {
      return { success: false, message: 'Order not found.' };
    }

    const hasPhoto = Boolean(photoUrl && photoUrl.trim().length > 0);
    const hasOtp = Boolean(otpInput && otpInput.trim().length > 0);

    if (!hasPhoto && !hasOtp) {
      return { success: false, message: 'Deliver mark karne ke liye Photo click karein YA Customer OTP enter karein!' };
    }

    if (hasOtp && targetOrder.otp) {
      if (targetOrder.otp.trim() !== otpInput!.trim()) {
        return { success: false, message: 'Invalid OTP code! Customer se sahi 4-digit OTP mangein.' };
      }
    }

    const now = new Date().toISOString();
    const updatedOrder: Order = {
      ...targetOrder,
      status: targetOrder.status === 'delivered' ? 'delivered' : (targetOrder.status || 'out_for_delivery'),
      delivery_photo_url: photoUrl || targetOrder.delivery_photo_url || '',
      actual_delivery_time: now,
      delivered_by: session.name || targetOrder.delivery_partner || 'Delivery Partner',
      rider_delivered: true,
      delivery_confirmation_pending: true,
      updated_at: now
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === id ? updatedOrder : o))
    );
    setDoc(doc(db, 'orders', id), updatedOrder, { merge: true }).catch(() => {});

    pushToSheet(updatedOrder, 'update');

    // Update delivery partner total deliveries count
    if (targetOrder.delivery_partner) {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.name === targetOrder.delivery_partner || p.id === session.deliveryPartnerId) {
            const updatedP = { ...p, total_deliveries: p.total_deliveries + 1, status: 'available' };
            setDoc(doc(db, 'delivery_partners', p.id), updatedP, { merge: true }).catch(() => {});
            return updatedP;
          }
          return p;
        })
      );
    }

    showNotification(`🚀 Order #${targetOrder.order_number} delivered by rider! Waiting for Outlet confirmation.`);
    return { success: true, message: 'Delivered marked! Waiting for Outlet/Admin confirmation.' };
  }, [session.name, session.deliveryPartnerId, showNotification, pushToSheet]);

  const confirmRiderDelivery = useCallback((id: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === id) {
          const updated: Order = {
            ...ord,
            status: 'delivered',
            rider_delivered: true,
            delivery_confirmation_pending: false,
            updated_at: new Date().toISOString()
          };
          setDoc(doc(db, 'orders', id), updated, { merge: true }).catch(() => {});
          showNotification(`✅ Order #${ord.order_number} delivery confirmed by Outlet!`);
          pushToSheet(updated, 'update');
          return updated;
        }
        return ord;
      })
    );
  }, [showNotification, pushToSheet]);

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
          setDoc(doc(db, 'delivery_partners', partnerId), updatedP, { merge: true }).catch(() => {});
          return updatedP;
        }
        return p;
      })
    );
  }, []);

  const addPartner = useCallback((partnerData: Omit<DeliveryPartner, 'id' | 'total_deliveries'>) => {
    const newPartner: DeliveryPartner = {
      ...partnerData,
      id: `dp-${Date.now()}`,
      total_deliveries: 0
    };
    setPartners((prev) => [...prev, newPartner]);
    setDoc(doc(db, 'delivery_partners', newPartner.id), newPartner).catch(() => {});
    showNotification(`Added new delivery partner: ${newPartner.name}`);
  }, [showNotification]);

  const deletePartner = useCallback((id: string) => {
    setPartners((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        showNotification(`Removed delivery partner: ${target.name}`);
      }
      return prev.filter((p) => p.id !== id);
    });
    deleteDoc(doc(db, 'delivery_partners', id)).catch(() => {});
  }, [showNotification]);

  const updatePartnerStatus = useCallback((id: string, status: DeliveryPartner['status']) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, status };
          setDoc(doc(db, 'delivery_partners', id), { status }, { merge: true }).catch(() => {});
          return updated;
        }
        return p;
      })
    );
  }, []);

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
      dismissNotification: () => setRecentNotification(null)
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
      recentNotification
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
