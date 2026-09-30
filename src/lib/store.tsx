import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Order, OutletName, DeliveryPartner, Role, OrderStatus } from '../types';
import { getNextOrderNumber } from './orderLogic';

export interface Session {
  role: Role | string;
  name: string;
  outlet?: OutletName;
  token?: string;
  deliveryPartnerId?: string;
}

export interface OMSContextType {
  orders: Order[];
  deliveryPartners: DeliveryPartner[];
  session: Session;
  isLoading: boolean;
  notification: string | null;
  recentNotification?: string | null;
  showNotification: (msg: string) => void;
  setSession: (s: Session) => void;
  addOrder: (orderData: Partial<Order>) => Order;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
  checkWhatsAppStatus: () => Promise<boolean>;

  authPasswords?: any;
  updateAdminPassword?: (pw: string) => void;
  updateManagerPassword?: (pw: string) => void;
  updateOutletPassword?: (outlet: string, pw: string) => void;
  updatePartnerPassword?: (partnerId: string, pw: string) => void;
  partners?: DeliveryPartner[];
  outletLocations?: any[];
  updateOutletLocation?: (loc: any, secondArg?: any) => void;
  sheetConfig?: any;
  updateSheetConfig?: (cfg: any) => void;
  triggerGoogleSheetSync?: () => void;
  triggerSheetSync?: () => void;
  syncLogs?: any[];
  logout?: () => void;
  isWhatsAppConnected?: boolean;
  selectedOrderIds?: string[];
  selectAllOrders?: (ids?: string[]) => void;
  clearOrderSelection?: (arg?: any) => void;
  updateOrderStatus?: (id: string, status: OrderStatus) => void;
  alerts?: any[];
  confirmRiderDelivery?: (id: string) => void;
  pullOrdersFromGoogleSheet?: () => void;
  clearAllOrders?: () => void;
  importOrders?: (orders: Order[]) => void;
  switchRole?: (role: string, name?: string, outlet?: string, deliveryPartnerId?: string) => void;
  login?: (role: string, name?: string, passOrOutlet?: string, extra?: any) => void;
}

const OMSContext = createContext<OMSContextType | null>(null);

export const OMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [session, setSession] = useState<Session>({
    role: 'admin',
    name: 'Broomies Admin',
    outlet: 'Sector 31'
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);
  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4000);
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?active=false');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrders(data);
          ordersRef.current = data;
        }
      }
    } catch (e) {
      console.error('Failed fetching orders:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load + Real-time SSE
  useEffect(() => {
    refreshOrders();

    // SSE connection for real-time live updates
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events');
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.collection === 'orders' && payload.data) {
            const updatedDoc = payload.data;
            setOrders((prev) => {
              const idx = prev.findIndex((o) => o.id === updatedDoc.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...updatedDoc };
                return next;
              } else {
                return [updatedDoc, ...prev];
              }
            });
          }
        } catch {}
      };
    } catch {}

    return () => {
      es?.close();
    };
  }, [refreshOrders]);

  const addOrder = useCallback((orderData: Partial<Order>): Order => {
    const currentOrders = ordersRef.current || [];
    let nextNum = orderData.order_number;
    if (!nextNum || isNaN(nextNum) || nextNum <= 0) {
      nextNum = getNextOrderNumber(currentOrders, 1);
    }

    const now = new Date().toISOString();
    const newId = `ord-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const newOrder: Order = {
      id: newId,
      order_number: nextNum,
      order_id: nextNum,
      outlet: orderData.outlet || session.outlet || 'Sector 31',
      order_date: orderData.order_date || now.split('T')[0],
      order_time: orderData.order_time || '12:00 PM',
      mobile_number: orderData.mobile_number || '',
      customer_name: orderData.customer_name || `Customer #${nextNum}`,
      informed_by: orderData.informed_by || '',
      item_type: orderData.item_type || 'Cake',
      name_on_cake: orderData.name_on_cake || '',
      icing_color: orderData.icing_color || '',
      cake_style: orderData.cake_style || 'Normal',
      tiers: orderData.tiers || '1',
      quantity: orderData.quantity || '1 kg',
      delivery_type: orderData.delivery_type || 'pickup',
      total_amount: Number(orderData.total_amount) || 0,
      payment_type: orderData.payment_type || 'full',
      advance_amount: Number(orderData.advance_amount) || 0,
      remaining_balance: Number(orderData.remaining_balance) || 0,
      due_amount: Number(orderData.due_amount) || 0,
      address: orderData.address || 'In-Store Pickup',
      delivery_address: orderData.delivery_address || '',
      remarks: orderData.remarks || '',
      status: orderData.status || 'pending',
      delivery_date: orderData.delivery_date || now.split('T')[0],
      delivery_time_expected: orderData.delivery_time_expected || '04:00 PM',
      advance_bill_number: orderData.advance_bill_number || '',
      final_bill_number: orderData.final_bill_number || '',
      item_image_url: orderData.item_image_url || null,
      created_at: now,
      updated_at: now
    };

    // Immediate optimistic local state update
    setOrders((prev) => [newOrder, ...prev]);

    // Send to backend API
    fetch(`/api/orders/${newOrder.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder)
    }).catch((err) => console.error('Error saving order to backend:', err));

    return newOrder;
  }, [session.outlet]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates, updated_at: new Date().toISOString() } : o))
    );

    try {
      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.error('Failed updating order:', e);
    }
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed deleting order:', e);
    }
  }, []);

  const checkWhatsAppStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        return Boolean(data.connected);
      }
    } catch {}
    return false;
  }, []);

  return (
    <OMSContext.Provider
      value={{
        orders,
        deliveryPartners,
        session,
        isLoading,
        notification,
        recentNotification: notification,
        showNotification,
        setSession,
        addOrder,
        updateOrder,
        deleteOrder,
        refreshOrders,
        checkWhatsAppStatus,
        authPasswords: {},
        updateAdminPassword: () => {},
        updateManagerPassword: () => {},
        updateOutletPassword: () => {},
        updatePartnerPassword: () => {},
        partners: deliveryPartners,
        outletLocations: [],
        updateOutletLocation: () => {},
        sheetConfig: {},
        updateSheetConfig: () => {},
        triggerGoogleSheetSync: () => {},
        triggerSheetSync: () => {},
        syncLogs: [],
        logout: () => {
          setSession({ role: 'admin', name: 'Admin' });
        },
        isWhatsAppConnected: true,
        selectedOrderIds,
        selectAllOrders: (ids?: string[]) => {
          if (ids) setSelectedOrderIds(ids);
          else setSelectedOrderIds(orders.map(o => o.id));
        },
        clearOrderSelection: () => setSelectedOrderIds([]),
        updateOrderStatus: async (id: string, status: OrderStatus) => {
          await updateOrder(id, { status });
        },
        alerts: [],
        confirmRiderDelivery: (id: string) => {
          updateOrder(id, { status: 'delivered', rider_delivered: true });
        },
        pullOrdersFromGoogleSheet: () => {},
        clearAllOrders: () => setOrders([]),
        importOrders: (newOrders: Order[]) => {
          setOrders(prev => [...newOrders, ...prev]);
        },
        switchRole: (role: string, name = 'User', outlet?: string, deliveryPartnerId?: string) => {
          setSession({ role, name, outlet: outlet as OutletName, deliveryPartnerId });
        },
        login: (roleOrSession: any, name?: string) => {
          if (typeof roleOrSession === 'object' && roleOrSession !== null) {
            setSession({
              role: roleOrSession.role,
              name: roleOrSession.name,
              outlet: roleOrSession.outlet,
              deliveryPartnerId: roleOrSession.deliveryPartnerId
            });
          } else {
            setSession({ role: roleOrSession, name: name || 'User' });
          }
        }
      }}
    >
      {children}
    </OMSContext.Provider>
  );
};

export const useOMS = () => {
  const ctx = useContext(OMSContext);
  if (!ctx) throw new Error('useOMS must be used within OMSProvider');
  return ctx;
};
