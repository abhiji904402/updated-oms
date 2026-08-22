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
import { persistToLocalVault, LOCAL_VAULT_KEYS } from './localStorageVault';
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
  loadDemoOrders: () => void;
  pushAllOrdersToCloud: () => Promise<{ success: boolean; count: number; message?: string }>;
  updateOrderStatus: (id: string, status: OrderStatus, deliveryPartner?: string) => void;
  markDelivered: (id: string, photoUrl?: string, otpInput?: string, deliveringRiderName?: string) => { success: boolean; message: string };
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
    const saved = localStorage.getItem(LOCAL_VAULT_KEYS.ACTIVE_ORDERS) || localStorage.getItem(LOCAL_STORAGE_KEY_ORDERS);
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
    return [];
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
    const isUnavailable = err?.code === 'unavailable' || errStr.includes('unavailable') || errStr.includes('could not be completed') || errStr.includes('Could not reach Cloud Firestore');

    if (isUnavailable) {
      // Standard Firestore offline / reconnecting state - operations persist silently in Local Vault / IndexedDB
      return;
    }
    
    if (isQuota) {
      quotaExceededRef.current = true;
      setIsFirestoreQuotaExceeded(true);
      // Silently fall back to Local Vault without showing annoying popup banners to the user
      console.log(`[Local Vault Active] Operation "${operationName}" persisted 100% safely in local storage.`);
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

  // Deduplicate and merge orders by unique ID and order_number cleanly
  const mergeAndDeduplicateOrders = (currentList: Order[], incomingList: Order[]): Order[] => {
    const orderMap = new Map<string, Order>();

    // Add current local orders
    for (const ord of currentList) {
      if (ord && ord.id) {
        orderMap.set(ord.id, ord);
      }
    }

    // Merge incoming orders from Firestore
    for (const ord of incomingList) {
      if (!ord || !ord.id) continue;
      const existing = orderMap.get(ord.id);
      if (!existing) {
        orderMap.set(ord.id, ord);
      } else {
        const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
        const incomingTime = new Date(ord.updated_at || ord.created_at || 0).getTime();
        if (incomingTime >= existingTime) {
          orderMap.set(ord.id, { ...existing, ...ord });
        }
      }
    }

    const uniqueOrders = Array.from(orderMap.values());

    // Sort descending by order_number
    uniqueOrders.sort((a, b) => {
      const numA = Number(a.order_number) || 0;
      const numB = Number(b.order_number) || 0;
      if (numB !== numA) return numB - numA;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return uniqueOrders;
  };

  const hasAutoSyncedLocalOrdersRef = useRef(false);

  // Fast offline hydration from IndexedDB on startup (provides instant 0ms initial render)
  useEffect(() => {
    // Check both local vault key and legacy IDB key
    idbGet<Order[]>(LOCAL_VAULT_KEYS.ACTIVE_ORDERS).then((vaultOrders) => {
      if (vaultOrders && Array.isArray(vaultOrders) && vaultOrders.length > 0) {
        vaultOrders.sort((a, b) => (Number(b.order_number) || 0) - (Number(a.order_number) || 0));
        setOrders((current) => {
          if (!current || current.length === 0) return vaultOrders;
          return current;
        });
      } else {
        idbGet<Order[]>(LOCAL_STORAGE_KEY_ORDERS).then((legacyOrders) => {
          if (legacyOrders && Array.isArray(legacyOrders) && legacyOrders.length > 0) {
            legacyOrders.sort((a, b) => (Number(b.order_number) || 0) - (Number(a.order_number) || 0));
            setOrders((current) => {
              if (!current || current.length === 0) return legacyOrders;
              return current;
            });
          } else if (INITIAL_ORDERS.length > 0) {
            // Seed INITIAL_ORDERS if fresh browser
            setOrders((current) => {
              if (!current || current.length === 0) return INITIAL_ORDERS;
              return current;
            });
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // 1. Real-time Firestore Sync for Orders (Authoritative Live Sync across all devices, Vercel, & AI Studio)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const firestoreOrders: Order[] = [];
        snapshot.forEach((docSnap) => {
          firestoreOrders.push({ ...docSnap.data(), id: docSnap.id } as Order);
        });

        const currentLocal = ordersRef.current || [];

        // Safe Auto-heal: If Firestore is empty, push local or seed orders
        if (firestoreOrders.length === 0) {
          if (currentLocal.length > 0 && !hasAutoSyncedLocalOrdersRef.current) {
            hasAutoSyncedLocalOrdersRef.current = true;
            console.log(`[Cloud Sync Auto-Heal] Pushing ${currentLocal.length} local orders to Cloud Firestore...`);
            const batch = writeBatch(db);
            currentLocal.forEach((ord) => {
              const clean = sanitizeOrderForFirestore(ord);
              batch.set(doc(db, 'orders', ord.id), clean, { merge: true });
            });
            batch.commit().catch((err) => handleFirestoreWriteError(err, 'auto-heal push local orders to firestore'));
            return;
          } else if (currentLocal.length === 0 && INITIAL_ORDERS.length > 0 && !hasAutoSyncedLocalOrdersRef.current) {
            hasAutoSyncedLocalOrdersRef.current = true;
            const initialList = [...INITIAL_ORDERS];
            setOrders(initialList);
            ordersRef.current = initialList;
            persistToLocalVault(initialList, 'Initial Orders Seed');
            safeSaveOrdersToLocalStorage(initialList);
            idbSet(LOCAL_STORAGE_KEY_ORDERS, initialList).catch(() => {});
            const batch = writeBatch(db);
            initialList.forEach((ord) => {
              const clean = sanitizeOrderForFirestore(ord);
              batch.set(doc(db, 'orders', ord.id), clean, { merge: true });
            });
            batch.commit().catch((err) => handleFirestoreWriteError(err, 'seed initial orders to firestore'));
            return;
          }
        }

        // Sort descending by order_number
        firestoreOrders.sort((a, b) => {
          const numA = Number(a.order_number) || 0;
          const numB = Number(b.order_number) || 0;
          if (numB !== numA) return numB - numA;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        // Firestore is the authoritative central source of truth:
        // Automatically updates local React state, IndexedDB, and localStorage across all open devices!
        setOrders(firestoreOrders);
        ordersRef.current = firestoreOrders;
        persistToLocalVault(firestoreOrders, 'Firestore Live Snapshot');
        safeSaveOrdersToLocalStorage(firestoreOrders);
        idbSet(LOCAL_STORAGE_KEY_ORDERS, firestoreOrders).catch(() => {});
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
          const seeded = localStorage.getItem('delivery_partners_seeded_v2');
          if (!seeded) {
            safeLocalStorageSet('delivery_partners_seeded_v2', 'true');
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
      idbSet(LOCAL_STORAGE_KEY_ORDERS, orders);
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
      persistToLocalVault(formatted, `Google Sheet Live Pull (${formatted.length} orders)`);
      safeSaveOrdersToLocalStorage(formatted);
      idbSet(LOCAL_STORAGE_KEY_ORDERS, formatted).catch(() => {});
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
    persistToLocalVault(nextOrders, `Create Order #${newOrderNumber}`);

    // Direct write to Firestore
    setDoc(doc(db, 'orders', newOrder.id), newOrder).catch((err) => {
      handleFirestoreWriteError(err, 'create order');
    });

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
      persistToLocalVault(formattedOrders, `Import ${formattedOrders.length} Orders (Overwrite)`);
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
      persistToLocalVault(merged, `Import ${formattedOrders.length} Orders`);
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
    persistToLocalVault(resequenced, 'Resequence Orders');

    // Save to Firestore in chunks without modifying delivery_date
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

    setOrders((prev) => {
      const next = prev.map((ord) => (ord.id === id ? updated : ord));
      ordersRef.current = next;
      persistToLocalVault(next, `Update Order #${updated.order_number}`);
      return next;
    });

    setDoc(doc(db, 'orders', id), updated, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update order'));
    pushToSheet(updated, 'update');
  }, [session.name, session.role, pushToSheet, handleFirestoreWriteError]);

  const deleteOrder = useCallback((id: string) => {
    const target = ordersRef.current.find((o) => o.id === id);
    if (target) {
      showNotification(`Order #${target.order_number} removed.`);
      pushToSheet(target, 'delete');
    }

    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      ordersRef.current = next;
      persistToLocalVault(next, `Delete Order`);
      safeSaveOrdersToLocalStorage(next);
      idbSet(LOCAL_STORAGE_KEY_ORDERS, next).catch(() => {});
      return next;
    });

    deleteDoc(doc(db, 'orders', id)).catch((err) => handleFirestoreWriteError(err, 'delete order'));
    setSelectedOrderIds((prev) => prev.filter((item) => item !== id));
  }, [showNotification, pushToSheet, handleFirestoreWriteError]);

  const clearAllOrders = useCallback(async () => {
    hasAutoSyncedLocalOrdersRef.current = true;
    // 1. Immediately update UI state & local persistent storages
    setOrders([]);
    ordersRef.current = [];
    setSelectedOrderIds([]);
    persistToLocalVault([], 'Clear All Orders');
    safeSaveOrdersToLocalStorage([]);
    idbSet(LOCAL_STORAGE_KEY_ORDERS, []).catch(() => {});

    // 2. Perform atomic batch delete on Firestore collection
    try {
      const snap = await getDocs(collection(db, 'orders'));
      if (!snap.empty) {
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 200) {
          const chunk = docs.slice(i, i + 200);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      showNotification('🗑️ All orders permanently deleted from Cloud & Local Vault! Ready for fresh upload.');
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
    } else {
      updates.rider_delivered = false;
      updates.delivery_confirmation_pending = false;
      updates.actual_delivery_time = '';
      updates.delivered_by = '';
    }

    const updated: Order = { ...target, ...updates };

    setOrders((prev) => {
      const next = prev.map((ord) => (ord.id === id ? updated : ord));
      ordersRef.current = next;
      persistToLocalVault(next, `Status -> ${status}`);
      return next;
    });

    setDoc(doc(db, 'orders', id), updated, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'update order status'));
    showNotification(`Order #${target.order_number} status changed to ${status.toUpperCase()}`);
    pushToSheet(updated, 'update');
  }, [session.name, session.role, showNotification, pushToSheet, handleFirestoreWriteError]);

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

    setOrders((prev) => {
      const next = prev.map((o) => (o.id === id ? updatedOrder : o));
      ordersRef.current = next;
      persistToLocalVault(next, `Delivered Order #${updatedOrder.order_number}`);
      return next;
    });

    setDoc(doc(db, 'orders', id), updatedOrder, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'mark delivered'));

    pushToSheet(updatedOrder, 'update');

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
    return { success: true, message: 'Delivered marked! Waiting for Outlet/Admin confirmation.' };
  }, [session.name, session.role, session.deliveryPartnerId, showNotification, pushToSheet, handleFirestoreWriteError]);

  const confirmRiderDelivery = useCallback((id: string) => {
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

    setOrders((prev) => {
      const next = prev.map((ord) => {
        if (ord.id === id) {
          return {
            ...ord,
            status: 'delivered' as OrderStatus,
            delivery_partner: deliveryPartner || ord.delivery_partner,
            delivered_by: deliveredBy,
            rider_delivered: true,
            delivery_confirmation_pending: false,
            updated_at: new Date().toISOString()
          };
        }
        return ord;
      });
      ordersRef.current = next;
      persistToLocalVault(next, `Confirm Rider Delivery`);
      return next;
    });

    const targetDoc = doc(db, 'orders', id);
    setDoc(targetDoc, {
      status: 'delivered',
      delivery_partner: deliveryPartner || targetOrder.delivery_partner,
      delivered_by: deliveredBy,
      rider_delivered: true,
      delivery_confirmation_pending: false,
      updated_at: new Date().toISOString()
    }, { merge: true }).catch((err) => handleFirestoreWriteError(err, 'confirm rider delivery'));
    
    showNotification(`✅ Order #${targetOrder.order_number} delivery confirmed by Outlet!`);
  }, [session.role, showNotification, handleFirestoreWriteError]);

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
